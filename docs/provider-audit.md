# Provider Audit: freellmapi ↔ freellmpool

> **Date:** 2026-06-23
> **Goal:** Identify keyless providers and other providers in freellmpool that can be ported to our freellmapi fork.

---

## 1. Architecture Comparison

### freellmapi (TypeScript, Node.js)
- Providers are TypeScript classes registered in `server/src/providers/index.ts`
- Keyless = `keyless: true` on the `OpenAICompatProvider` constructor
- When keyless, `authHeader()` returns `{}` (no `Authorization` header sent)
- Providers, models, usage quotas live in SQLite via `server/src/db/`
- Model catalog distributed via `catalog-sync` service (not code migrations)
- Image generation: `services/media.ts` (separate routing from chat)
- Add provider = register in `index.ts` + add platform to `keys.ts` + add to `shared/types.ts`

### freellmpool (Python)
- Providers are TOML-defined in `src/freellmpool/providers.toml`
- `auth = "none"` → keyless (no API key header)
- `key_optional = true` → works with or without a key
- `key_env = "VAR"` → reads key from environment
- Each request: if `api_key` available, sets `Authorization: Bearer {api_key}` — otherwise sends bare request
- CLI + Python library + proxy, all in one package

---

## 2. Keyless Providers (auth = "none" / keyless: true)

### Already in freellmapi ✅

| Provider | freellmpool auth | freellmapi flag | Notes |
|---|---|---|---|
| **Pollinations** | `auth = "none"` | `keyless: true` | Chat + **image gen** already in `MEDIA_PLATFORMS` and `KEYLESS_CAPABLE` |
| **OVHcloud** | `auth = "none"` | `keyless: true` | Chat only; OVH image gen not in `MEDIA_PLATFORMS` yet |
| **Kilo Gateway** | `auth = "none"` | `keyless: true` | Chat only |
| **LLM7** | `key_optional = true` | No flag, works anon | Already works without key |

### Keyless in freellmpool, KEYED in freellmapi ⚠️

| Provider | freellmpool | freellmapi | Impact |
|---|---|---|---|
| **OpenCode Zen** | `auth = "none"` | Requires API key | freellmapi users must register on opencode.ai; freellmpool uses it keyless |
| **SiliconFlow text** | Keyless (some models) | Requires `SILICONFLOW_API_KEY` | freellmapi uses key for both chat and media; freellmpool has keyless text models |

### Action items for our fork:

1. **OpenCode Zen → keyless**
   - Change: `keyless: true` in `providers/index.ts`
   - freellmpool shows OpenCode Zen works without a key: `https://opencode.ai/zen/v1`
   - freellmapi's current registration doesn't set `keyless: true`
   - If keyless works reliably, no need for users to register

---

## 3. Providers in freellmpool NOT in freellmapi

| Provider | Key env | Free tier | Notes |
|---|---|---|---|
| **LongCat (Meituan)** | `LONGCAT_API_KEY` | Yes | `LongCat-2.0-Preview` model, OpenAI-compatible |
| **SambaNova** | `SAMBA_NOVA_API_KEY` | Was free | Both projects disabled it (402 errors) — skip |

**Only LongCat is a real addition candidate.** All other freellmpool providers overlap with freellmapi's existing set.

### How to add LongCat to freellmapi

Based on the codebase patterns:

```typescript
// server/src/providers/index.ts
register(new OpenAICompatProvider({
  platform: 'longcat',
  name: 'LongCat (Meituan)',
  baseUrl: 'https://api.longcat.chat/v1',  // confirm URL
}));
```

Plus:
- Add `'longcat'` to `PLATFORMS` in `server/src/routes/keys.ts`
- Add `'longcat'` to `Platform` type in `shared/types.ts`
- Add `LONGCAT_API_KEY` to `.env.example`

---

## 4. Keyless Text Providers Worth Investigating

### SiliconFlow free text models
freellmapi uses SiliconFlow with a key for media (FLUX image, CosyVoice TTS).
freellmpool lists some SiliconFlow text models as keyless.

**Recommendation:** Test if `https://api.siliconflow.com/v1/chat/completions`
works without a key for specific models. If yes, we could either:
- Make the provider `keyless: true` and require key only for media
- Or register a separate keyless SiliconFlow text provider

### OpenCode Zen free tier
freellmpool routes OpenCode as `auth = "none"` and includes models like
DeepSeek V4 Flash Free, MiMo-V2.5 Free, etc. freellmapi requires a key.

**Recommendation:** change to `keyless: true` and test.

---

## 5. Image Generation — Extending MEDIA_PLATFORMS

### Current state in freellmapi (`services/media.ts`)

```typescript
export const MEDIA_PLATFORMS = new Set([
  'nvidia', 'pollinations', 'cloudflare', 'siliconflow', 'google'
]);

export const KEYLESS_CAPABLE = new Set(['pollinations']);
```

### Opportunities from freellmpool

| Provider | freellmpool feature | Can add to freellmapi? |
|---|---|---|
| **OVH** | Free image gen (Stable Diffusion, FLUX) | ✅ Add `'ovh'` to `MEDIA_PLATFORMS` |
| **Kilo Gateway** | Chat only (no image) | ❌ Not needed |
| **LLM7** | Chat only (no image gen) | ❌ Not needed |

Adding OVH image gen would require a new adapter in `services/media.ts` similar
to the existing platform adapters (NVIDIA, Pollinations, SiliconFlow, etc.).

---

## 6. Transcription Providers

### Current state in freellmapi
freellmapi does have TTS (via media.ts), but there's no visible transcription
endpoint in the codebase.

### freellmpool transcription
freellmpool's proxy has a `/v1/audio/transcriptions` endpoint that fails over
across providers (Whisper via Groq, OVH, etc.).

**Recommendation:** Investigate adding a transcription endpoint to our fork
using the media routing pattern. Groq already has a Whisper endpoint that
we could integrate (we use it for nanobot's voice messages).

---

## 7. Summary of Proposed Changes (Priority Order)

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | **Make OpenCode keyless** | Low (1 line) | Unlocks 5+ free models without registration |
| 2 | **Test & add LongCat provider** | Medium (3 files) | Adds 1 new provider |
| 3 | **Test SiliconFlow keyless text** | Low (test only) | May allow keyless chat alongside keyed media |
| 4 | **Add OVH to MEDIA_PLATFORMS** | Medium (new adapter) | Unlocks free image gen on OVH |
| 5 | **Add transcription endpoint** | High (new route) | Voice → text with failover |

---

## 8. Quick-Reference: Files to Edit

| File | Purpose |
|---|---|
| `server/src/providers/index.ts` | Register providers (add or modify) |
| `server/src/providers/base.ts` | Base class / `authHeader()` for keyless |
| `server/src/routes/keys.ts` | `PLATFORMS` array (allowed platforms) |
| `shared/types.ts` | `Platform` union type |
| `server/src/services/media.ts` | Media providers (image/audio) |
| `server/src/db/migrations.ts` | Legacy model seeding (mostly frozen) |
| `.env.example` | Document env vars |
