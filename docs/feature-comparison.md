# Feature Comparison: freellmapi ↔ freellmpool

> **Date:** 2026-06-23
> **Goal:** Identify freellmpool features worth porting to our freellmapi fork.

---

## 1. Quick Overview

| Aspect | freellmapi (Node/TypeScript) | freellmpool (Python) |
|---|---|---|
| Type | Proxy + Web UI + Desktop app | Proxy + CLI + Library |
| Install | `pnpm install`, Docker | `pip install` |
| Keyless | Optional (per provider flag) | **Core design**: auto-detects keyless providers |
| Config | SQLite + .env | TOML files + .env |
| Routing | Bandit algorithm, fallback chains, fusion | Fair/fast/quality/spread/legacy modes |
| Web UI | ✅ Full dashboard, playground, analytics | Minimal (panel only) |
| MCP Server | ❌ No | ✅ Native MCP server |
| Transcription | ❌ No `/v1/audio/*` | ✅ Yes, with provider failover |
| Desktop App | ✅ Electron app | ❌ No |
| CLI | Only as server commands | ✅ Full CLI suite |

---

## 2. Features freellmpool HAS that freellmapi DOESN'T

### 2.1 MCP Server (Model Context Protocol)
**File:** `mcp_server.py`  
**What it does:** Exposes the provider pool as an MCP server so Claude Desktop, Cline, and other MCP hosts can use freellmpool as a backend with routing, failover, and keyless providers.

**Why port:** MCP is the new standard for agent/tool integration. Would let us use our fork as the LLM backend for any MCP-compatible client.

**Effort:** Medium. Would need a new `services/mcp-server.ts` that implements the MCP protocol (JSON-RPC over stdio/SSE). The router and providers already do the heavy lifting.

---

### 2.2 Key Inventory (multi-key management)
**File:** `key_inventory.py`  
**What it does:** Tracks multiple API keys per provider in a local inventory with metadata (creation date, notes, env var name). Detects leaked keys in config files.

**Why port:** Useful for managing multiple free-tier accounts or key rotation without editing config files.

**Effort:** Low. Add a new table to SQLite or a JSON file alongside the existing key storage.

---

### 2.3 Tailnet / Tailscale Integration
**File:** `tailnet.py`  
**What it does:** Auto-discovers Tailscale interface, serves the proxy on the Tailscale IP, generates temporary API keys for remote access.

**Why port:** Perfect for our setup — user already has Oracle Cloud + VPN. Could serve freellmapi over Tailscale for personal use.

**Effort:** Medium. Requires Tailscale awareness.

---

### 2.4 Jobs System (persisted async queue)
**File:** `jobs.py`  
**What it does:** Append-only JSONL job queue that survives restarts. Runs foreground jobs synchronously. Useful for batch processing, scheduled tasks.

**Why port:** Nice-to-have for batch processing or scheduled model tasks.

**Effort:** Medium.

---

### 2.5 Init Wizard (`freellmpool init`)
**Feature:** First-run detection of installed provider keys, agent CLIs, and configuration. Prints a copy-paste next step without editing files.

**Why port:** Lowers the barrier to entry. But it's Python-native, and freellmapi already has a dashboard.

**Effort:** Low. A simple CLI wizard in Node.

---

### 2.6 Benchmark Suite
**File:** `benchmark.py`  
**What it does:** Tests models for latency, factual accuracy, and consistency. Uses a multi-model panel for "second opinions."

**Why port:** Useful for comparing models across providers. But freellmapi has the Analytics page that tracks real usage metrics.

**Effort:** Medium. freellmapi doesn't have a structured benchmark runner.

---

### 2.7 Agent Profiles / Recipes
**File:** `profiles.py`, `agents.py`  
**What it does:** Pre-built config snippets for Claude Code, Codex, aider, Cline, Continue, Cursor, shell agents, metaswarm lanes.

**Why port:** Helpful documentation + quickstart, not core functionality. Could add as docs/pages in the web UI.

**Effort:** Low (mostly documentation).

---

### 2.8 Transcription Endpoint
**Feature:** OpenAI-compatible `/v1/audio/transcriptions` with provider failover across Groq, OVH, etc.

**Why port:** Our use case — nanobot already uses Groq Whisper for voice transcription. Having it as part of freellmapi would unify the voice pipeline.

**Effort:** High. Requires adding audio handling, provider adapters for each transcription API, and potentially file upload handling.

---

### 2.9 Plugins System
**File:** `plugins.py`  
**What it does:** Extensibility hooks for custom providers and adapters. Helps onboard new providers without modifying core code.

**Why port:** Alignment with the software philosophy of modularity. But freellmapi's provider registration is already simple (one file).

**Effort:** Medium.

---

## 3. Features freellmapi HAS that freellmpool DOESN'T

| Feature | Description | Worth Keeping? |
|---|---|---|
| **Full Web UI** | Dashboard, playground, analytics, media, embeddings pages | ✅ Core value |
| **Fusion Routing** | Multi-model synthesis (combine models) | ✅ Unique |
| **Model Groups** | Unify duplicate models across providers | ✅ Keeps catalog clean |
| **Context Handoff** | Preserve context across model switches | ✅ Smart |
| **Desktop App** | Electron app (macOS/Windows/Linux) | ⚠️ Not essential for server |
| **i18n** | en, es, fr, it, pt-BR, zh-CN | ✅ Nice for community |
| **Bandit/Scoring Router** | Explore/exploit ML-based routing | ✅ Advanced |
| **Anthropic /v1/messages** | Anthropic wire format support | ✅ Needed for Claude Code |
| **OpenAI /v1/responses** | New OpenAI Responses API | ✅ Forward-looking |
| **Error Redaction** | Sanitize error messages before sending | 👍 Security |
| **Request Retention** | Audit log of all requests | ✅ Useful |

---

## 4. Comparison: What Each Project Excels At

```
freellmapi (our fork) strengths:
├── Full web dashboard (playground, analytics, media)
├── Sophisticated routing (bandit, fusion, context handoff)
└── Multi-format support (OpenAI, Anthropic, Responses API)

freellmpool strengths:
├── MCP server (Claude Desktop, agents)
├── Keyless-first design (zero config = works)
├── Feature-rich CLI (benchmark, init, key inventory, jobs)
└── Transcription endpoint
```

---

## 5. Proposed Priority for Porting to Our Fork

| # | Feature | Effort | Value | Why |
|---|---|---|---|---|
| 1 | **Transcription endpoint** | 高 | 🔥 | We already use Groq Whisper — integrating into freellmapi unifies the voice pipeline |
| 2 | **MCP Server** | Medium | 🔥 | MCP is the future for agent/model integration |
| 3 | **Key Inventory** | Low | 👍 | Manage multiple keys per provider |
| 4 | **Init Wizard** | Low | 👍 | Better onboarding |
| 5 | **Tailnet** | Medium | 👍 | Fits our Tailscale setup |
| 6 | **Plugins System** | Medium | Nice | Modular provider extensions |
| 7 | **Benchmark** | Medium | Nice | Compare models systematically |
| 8 | **Jobs Queue** | Medium | Nice | Batch/async processing |
| 9 | **Agent Profiles** | Low | Docs | Quickstart guidance |

---

## 6. Key Architectural Insight: Keyless ≠ Zero-Code

**freellmpool** makes keyless providers first-class: you don't configure them at all, the proxy just routes to them if they're online.

**freellmapi** requires an explicit `keyless: true` flag per provider. Users still need to add the platform in `keys.ts` even if no key is needed.

**Proposed improvement for our fork:** auto-detect keyless platforms. If a provider is registered with `keyless: true`, it should be automatically available without any user key configuration — same as freellmpool.

---

## 7. Implementation Notes

### Files we'd touch for each port:

**Transcription endpoint:**
- `server/src/routes/proxy.ts` — add `/v1/audio/transcriptions` route
- `server/src/services/` — new `transcription.ts` service
- `server/src/providers/` — add GroqWhisper, OVHWhisper adapters

**MCP Server:**
- New `server/src/services/mcp-server.ts` — JSON-RPC stdio/SSE
- Reuse existing provider router

**Key Inventory:**
- New `server/src/services/key-inventory.ts`
- Add to existing SQLite or separate JSON file

**Init Wizard:**
- New CLI mode for freellmapi server
- Detect env vars, check provider connectivity
