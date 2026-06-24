import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';

export const metricsRouter = Router();

metricsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const lines: string[] = [];
    const now = Date.now();

    // ─── HELP / TYPE declarations ─────────────────────────────────────────
    lines.push('# HELP freellmapi_up 1 if the process is alive, 0 otherwise');
    lines.push('# TYPE freellmapi_up gauge');
    lines.push('freellmapi_up 1');

    lines.push('# HELP freellmapi_info Static metadata about this instance');
    lines.push('# TYPE freellmapi_info gauge');
    lines.push('freellmapi_info{version="1.0.0",host="' + (process.env.HOST || 'localhost') + '",port="' + (process.env.PORT || '3001') + '"} 1');

    // ─── Process metrics (runtime) ────────────────────────────────────────
    const mem = process.memoryUsage();
    lines.push('# HELP freellmapi_process_memory_bytes Memory usage in bytes (rss, heapTotal, heapExternal)');
    lines.push('# TYPE freellmapi_process_memory_bytes gauge');
    lines.push('freellmapi_process_memory_bytes{type="rss"} ' + mem.rss);
    lines.push('freellmapi_process_memory_bytes{type="heapTotal"} ' + mem.heapTotal);
    lines.push('freellmapi_process_memory_bytes{type="heapUsed"} ' + mem.heapUsed);
    lines.push('freellmapi_process_memory_bytes{type="external"} ' + mem.external);

    const cpu = process.cpuUsage();
    lines.push('# HELP freellmapi_process_cpu_microseconds Total CPU usage in microseconds');
    lines.push('# TYPE freellmapi_process_cpu_microseconds counter');
    lines.push('freellmapi_process_cpu_microseconds{type="user"} ' + cpu.user);
    lines.push('freellmapi_process_cpu_microseconds{type="system"} ' + cpu.system);

    lines.push('# HELP freellmapi_process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE freellmapi_process_uptime_seconds gauge');
    lines.push('freellmapi_process_uptime_seconds ' + Math.floor(process.uptime()));

    // ─── Request metrics ──────────────────────────────────────────────────
    lines.push('# HELP freellmapi_requests_total Total number of API requests processed');
    lines.push('# TYPE freellmapi_requests_total counter');

    const reqRows = db.prepare(
      `SELECT platform, model_id, status, COUNT(*) as cnt, 
              COALESCE(SUM(input_tokens),0) as in_tok, 
              COALESCE(SUM(output_tokens),0) as out_tok,
              COALESCE(AVG(latency_ms),0) as avg_lat
       FROM requests GROUP BY platform, model_id, status`
    ).all() as Array<{
      platform: string; model_id: string; status: string;
      cnt: number; in_tok: number; out_tok: number; avg_lat: number;
    }>;

    let totalInTokens = 0;
    let totalOutTokens = 0;
    for (const r of reqRows) {
      const labels = `platform="${r.platform}",model="${r.model_id}",status="${r.status}"`;
      lines.push(`freellmapi_requests_total{${labels}} ${r.cnt}`);
      totalInTokens += r.in_tok;
      totalOutTokens += r.out_tok;
    }

    // Total request count across all labels
    const totalReq = db.prepare('SELECT COUNT(*) as cnt FROM requests').get() as { cnt: number };
    lines.push('# HELP freellmapi_requests_total All requests aggregated');
    lines.push('# TYPE freellmapi_requests_total counter');
    lines.push('freellmapi_requests_total{aggregate="all"} ' + totalReq.cnt);

    // ─── Token usage ──────────────────────────────────────────────────────
    lines.push('# HELP freellmapi_tokens_total Total tokens consumed');
    lines.push('# TYPE freellmapi_tokens_total counter');
    lines.push('freellmapi_tokens_total{type="input"} ' + totalInTokens);
    lines.push('freellmapi_tokens_total{type="output"} ' + totalOutTokens);
    lines.push('freellmapi_tokens_total{type="total"} ' + (totalInTokens + totalOutTokens));

    // ─── Average latency ──────────────────────────────────────────────────
    lines.push('# HELP freellmapi_latency_ms Average request latency in milliseconds');
    lines.push('# TYPE freellmapi_latency_ms gauge');
    const avgLatency = db.prepare(
      'SELECT COALESCE(AVG(latency_ms),0) as avg_lat FROM requests'
    ).get() as { avg_lat: number };
    lines.push('freellmapi_latency_ms{average="overall"} ' + avgLatency.avg_lat.toFixed(2));

    // ─── Requests in last hour (liveness indicator) ───────────────────────
    lines.push('# HELP freellmapi_requests_last_hour Number of requests in the last 60 minutes');
    lines.push('# TYPE freellmapi_requests_last_hour gauge');
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
    const lastHour = db.prepare(
      "SELECT COUNT(*) as cnt FROM requests WHERE created_at >= ?"
    ).get(hourAgo) as { cnt: number };
    lines.push('freellmapi_requests_last_hour ' + lastHour.cnt);

    // ─── Last request timestamp ──────────────────────────────────────────
    lines.push('# HELP freellmapi_last_request_timestamp_seconds Unix timestamp of the most recent request');
    lines.push('# TYPE freellmapi_last_request_timestamp_seconds gauge');
    const lastReq = db.prepare(
      "SELECT created_at FROM requests ORDER BY id DESC LIMIT 1"
    ).get() as { created_at: string } | undefined;
    if (lastReq) {
      const ts = new Date(lastReq.created_at + 'Z').getTime() / 1000;
      lines.push('freellmapi_last_request_timestamp_seconds ' + ts);
    }

    // ─── Error rate ──────────────────────────────────────────────────────
    lines.push('# HELP freellmapi_errors_total Total failed requests');
    lines.push('# TYPE freellmapi_errors_total counter');
    const errTotal = db.prepare(
      "SELECT COUNT(*) as cnt FROM requests WHERE status IN ('error','failure')"
    ).get() as { cnt: number };
    lines.push('freellmapi_errors_total{aggregate="all"} ' + errTotal.cnt);

    // ─── API Keys status ─────────────────────────────────────────────────
    lines.push('# HELP freellmapi_api_keys_total Number of configured API keys by platform and status');
    lines.push('# TYPE freellmapi_api_keys_total gauge');
    const keyRows = db.prepare(
      'SELECT platform, status, COUNT(*) as cnt FROM api_keys GROUP BY platform, status'
    ).all() as Array<{ platform: string; status: string; cnt: number }>;
    for (const k of keyRows) {
      lines.push(`freellmapi_api_keys_total{platform="${k.platform}",status="${k.status}"} ${k.cnt}`);
    }

    // ─── Active cooldowns ─────────────────────────────────────────────────
    lines.push('# HELP freellmapi_active_cooldowns Number of API keys currently in rate-limit cooldown');
    lines.push('# TYPE freellmapi_active_cooldowns gauge');
    const activeCools = db.prepare(
      'SELECT COUNT(*) as cnt FROM rate_limit_cooldowns WHERE expires_at_ms > ?'
    ).get(now) as { cnt: number };
    lines.push('freellmapi_active_cooldowns ' + activeCools.cnt);

    // ─── Models registered ───────────────────────────────────────────────
    lines.push('# HELP freellmapi_models_total Number of registered models by platform');
    lines.push('# TYPE freellmapi_models_total gauge');
    const modelRows = db.prepare(
      'SELECT platform, COUNT(*) as cnt FROM models GROUP BY platform'
    ).all() as Array<{ platform: string; cnt: number }>;
    for (const m of modelRows) {
      lines.push(`freellmapi_models_total{platform="${m.platform}"} ${m.cnt}`);
    }

    // ─── Provider quota ──────────────────────────────────────────────────
    lines.push('# HELP freellmapi_quota_remaining Provider quota remaining');
    lines.push('# TYPE freellmapi_quota_remaining gauge');
    const quotaRows = db.prepare(
      `SELECT platform, quota_pool_key, metric, limit_value, remaining_value, reset_strategy
       FROM provider_quota_state
       WHERE remaining_value IS NOT NULL`
    ).all() as Array<{
      platform: string; quota_pool_key: string; metric: string;
      limit_value: number | null; remaining_value: number; reset_strategy: string;
    }>;
    for (const q of quotaRows) {
      const labels = `platform="${q.platform}",pool="${q.quota_pool_key}",metric="${q.metric}",reset="${q.reset_strategy}"`;
      lines.push(`freellmapi_quota_remaining{${labels}} ${q.remaining_value}`);
    }

    // ─── Send response ───────────────────────────────────────────────────
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(lines.join('\n') + '\n');
  } catch (err) {
    res.status(500).set('Content-Type', 'text/plain; charset=utf-8');
    res.send(`# ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  }
});
