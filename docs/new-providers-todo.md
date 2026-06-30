# New Free Providers — Integration Plan

> Branch: `feat/add-new-free-providers`
> Created: 2026-06-30
> Status: ✅ Research done, pending implementation

## Objective

Add new free-API providers from [freellm.net](https://freellm.net/providers/) that are **not yet integrated** into FreeLLMAPI, to maximize total free token volume by scaling across more providers.

## Architecture (for all OpenAI-compatible providers)

Each new provider requires changes in **3 files**:

| File | Change |
|------|--------|
| `shared/types.ts` | Add platform string to `Platform` union type |
| `server/src/routes/keys.ts` | Add platform string to `PLATFORMS` array |
| `server/src/providers/index.ts` | Register `new OpenAICompatProvider({...})` |

For providers with non-OpenAI APIs, a custom provider class is needed in `server/src/providers/`.

---

## Candidate Providers (ordered by priority)

### 🔴 P1 — Easy wins (OpenAI-compatible, no credit card, models active)

#### 1. DeepSeek (direct)

- **Platform name**: `deepseek`
- **Base URL**: `https://api.deepseek.com/v1`
- **API format**: OpenAI-compatible ✅
- **Models**: deepseek-v4-flash, deepseek-v4-pro, deepseek-r1-0528
- **Notes**: Currently only accessible via OpenRouter/OpenCode intermediaries in FreeLLMAPI. Direct integration bypasses the middleman.
- **Provider models URL**: https://freellm.net/providers/deepseek
- **Integration files needed in LLM router**: route to `deepseek` platform

**Files to add (OpenAICompatProvider):**
- `shared/types.ts` → add `'deepseek'` to Platform
- `server/src/routes/keys.ts` → add `'deepseek'` to PLATFORMS
- `server/src/providers/index.ts` → register `OpenAICompatProvider` for deepseek

#### 2. Chutes.ai

- **Platform name**: `chutes`
- **Base URL**: `https://api.chutes.ai/v1`
- **API format**: OpenAI SDK-compatible ✅
- **Free tier**: No credit card required
- **Models**: DeepSeek-R1, Llama 3.1 70B (2 free, 2 online)
- **Provider URL**: https://freellm.net/providers/chutes-ai
- **Risk**: Community-powered, may be unstable

**Files to add (OpenAICompatProvider):**
- `shared/types.ts` → add `'chutes'` to Platform
- `server/src/routes/keys.ts` → add `'chutes'` to PLATFORMS
- `server/src/providers/index.ts` → register `OpenAICompatProvider` for chutes

#### 3. Glhf.chat

- **Platform name**: `glhf`
- **Base URL**: `https://glhf.chat/api/openai/v1`
- **API format**: OpenAI-compatible ✅
- **Free tier**: No credit card, unlimited
- **Models**: Mixtral 8x7B, Llama 3.1 70B (2 free, 2 online)
- **Provider URL**: https://freellm.net/providers/glhf-chat
- **Note**: Very simple — just a lightweight inference proxy

**Files to add (OpenAICompatProvider):**
- `shared/types.ts` → add `'glhf'` to Platform
- `server/src/routes/keys.ts` → add `'glhf'` to PLATFORMS
- `server/src/providers/index.ts` → register `OpenAICompatProvider` for glhf

### 🟡 P2 — Worth adding but with caveats

#### 4. xAI / Grok

- **Platform name**: `xai`
- **Base URL**: `https://api.x.ai/v1`
- **API format**: OpenAI-compatible ✅
- **Free tier**: $25/mo free credits
- **Caveat**: **Requires credit card** to activate free tier
- **Models**: Grok 4.3, Grok 4.20, Grok code-fast-1 (3 free, 0 currently online)
- **Provider URL**: https://freellm.net/providers/xai

**Files to add (OpenAICompatProvider):**
- `shared/types.ts` → add `'xai'` to Platform (already defined but not wired?)
- `server/src/routes/keys.ts` → add `'xai'` to PLATFORMS
- `server/src/providers/index.ts` → register `OpenAICompatProvider` for xai

#### 5. StepFun (direct)

- **Platform name**: `stepfun`
- **Base URL**: `https://api.stepfun.ai/v1` (international)
- **API format**: OpenAI-compatible ✅
- **Free tier**: Step 3.5 Flash available free via OpenRouter; direct free tier unconfirmed
- **Models**: Step 3.5 Flash, Step 3.7 Flash
- **Note**: Check if direct free tier exists before integrating

**To verify before adding:**
- [ ] Does `api.stepfun.ai` have a free tier without Chinese real-name verification?
- [ ] What is the signup process?

#### 6. ModelScope

- **Platform name**: `modelscope`
- **Base URL**: `https://api-inference.modelscope.cn/v1`
- **API format**: OpenAI-compatible ✅
- **Free tier**: No credit card, 55 free models
- **Caveat**: **Requires Alibaba Cloud account + real-name verification** (Chinese ID / passport)
- **Provider URL**: https://freellm.net/providers/modelscope
- **Potential**: 54 models currently online — the largest untapped source

**To verify:**
- [ ] Can we create an account with a non-Chinese passport?
- [ ] Is the free tier stable?

### 🟢 P3 — Custom adapters needed (not OpenAI-compatible)

#### 7. AI21 Labs

- **Platform name**: `ai21`
- **API format**: Custom REST API (not OpenAI-compatible)
- **Free tier**: No credit card, 2 models, but **0 currently online**
- **Requires**: Custom provider class extending `BaseProvider`

#### 8. Aion Labs

- **Platform name**: `aion`
- **API format**: Custom REST API
- **Free tier**: No credit card, 5 models, 3 online
- **Requires**: Custom provider class

### ⚪ P4 — Low priority (no models currently online)

#### 9. Nscale

- **Platform name**: `nscale`
- **Free models**: 2, but **0 online**
- **API format**: Possibly OpenAI-compatible

#### 10. Nebius

- **Platform name**: `nebius`
- **Free models**: 1 (Llama 3.1 70B), **0 online**
- **API format**: Possibly OpenAI-compatible

#### 11. Alibaba Cloud Model Studio

- **Platform name**: `alibaba`
- **Free models**: 5 (Qwen series), **0 online**
- **Caveat**: Alibaba Cloud account + verification required

---

## Implementation Steps

### Phase 1 — OpenAI-compatible providers (P1)
```bash
# For each: deepseek, chutes, glhf
# 1. Edit shared/types.ts — add platform string
# 2. Edit server/src/routes/keys.ts — add platform to PLATFORMS
# 3. Edit server/src/providers/index.ts — add OpenAICompatProvider registration
# 4. Test with `npm run dev` + curl to /v1/chat/completions
```

### Phase 2 — Conditional providers (P2)
```bash
# For each: xai, stepfun, modelscope
# Same 3-file pattern, but verify free tier access first
```

### Phase 3 — Custom providers (P3)
```bash
# For each: ai21, aion
# 1. Create server/src/providers/<name>.ts extending BaseProvider
# 2. Implement chatCompletion() method
# 3. Register in server/src/providers/index.ts
# 4. Add to Platform type and PLATFORMS array
```

## Files Reference (before/after)

### shared/types.ts
**Current Platform type** includes (check latest):
`'openai' | 'google' | 'groq' | 'cerebras' | 'nvidia' | 'mistral' | 'openrouter' | 'github' | 'pollinations' | 'zhipu' | 'cloudflare' | 'ollama' | 'cohere' | 'kilo' | 'llm7' | 'opencode' | 'ovh' | 'agnes' | 'reka' | 'siliconflow' | 'routeway' | 'bazaarlink' | 'ainative' | 'aihorde' | 'huggingface' ...`

**After**: add `'deepseek' | 'chutes' | 'glhf' | 'xai' | 'stepfun' | 'modelscope'`

### server/src/routes/keys.ts
**Current PLATFORMS array**: same list as Platform type

**After**: add corresponding entries

### server/src/providers/index.ts
**Current**: Has OpenAICompatProvider registrations for existing platforms

**After** — add blocks like:
```typescript
new OpenAICompatProvider({
  platform: 'deepseek' as Platform,
  name: 'DeepSeek (Direct)',
  baseUrl: 'https://api.deepseek.com/v1',
})
```

---

## How to Test Each Provider

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-free-api-key>" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Notes

- All providers on this list are sourced from https://freellm.net/providers/ — not every free API is there
- Some providers (DeepSeek) already have keys in FreeLLMAPI's key system but lack direct routing
- Adding a provider via OpenAICompatProvider takes ~10 lines of code total
- Model metadata is synced from the catalog — no need to manually add models
