# GOTCHAS
- QQ actual bridge data as of 2026-10-15: four verified groups share one room, but all stopped=1. Preserve these settings; protected QQ account rules restrict !resume. No end-to-end relay can succeed until authorized resume.
- QQ Bbot/NapCat authenticated websocket and fresh roster required for privileged !use/!CODE/!resume controls. Bbot receives native numeric QQ IDs; never send synthetic napcat: identifiers to QQ official API.
- An incoming OneBot message may be duplicated; idempotent manual-v1: hashed outbox IDs are required. Outbound OneBot ACK timeout is ambiguous and must not be blindly retried.
- Group memory collection deliberately excludes leading slash commands, so /跨群 content is not ingested as source group long-term memory.
- QQ official published native slash menu is NOT the same as command text parser. Text command works if Bbot receives it; QQ menu cannot be claimed configured without platform readback.
- Existing qqai /v2/panels API returned QQ_PANEL_RECORDS_MISSING_OBJECT_ABSENT_ABSENT. Do not assume empty response is evidence old menu removed; refuse unrelated deletes.
- Preserve Windows native Codex GUI, local bridge JSON including edit/read roots, Cloudflare Secrets, Abot AI, D1/Vectorize. No destructive repo reset or force push.

- New QQ worker: Cloudflare Workers general outgoing egress IP is not stable; QQ Open Platform may require fixed outbound IP whitelist. Cannot claim real message delivery without addressing policy and E2E evidence.
- New Worker has no Secrets as of 2026-10-24; Unsloth model ID/key, QQ App credentials and ADMIN_TOKEN must be set manually. Custom domain API binding enabled but public HTTPS not independently verified. The home Unsloth service may need Access service authentication not implemented in this minimal Worker.
- New Worker uses isolate-local best-effort replay cache and `waitUntil`; extremely slow local inference or retries can fail; no durable exactly-once semantics.

- Encrypted KV key is derived from high-entropy ADMIN_TOKEN; changing it invalidates stored ciphertext. Explicitly supplying a new API Key via admin can overwrite undecryptable config. Never log or send raw key in GET query/URL.
- Cloudflare KV is eventually consistent; after selecting a model, QQ requests from other locations may see an older configuration briefly. Never claim strong transactional consistency.
- New dedicated CONFIG_KV namespace (033b241f7377496790d92056d39669ad) is NOT preexisting QQ data and must not be confused with legacy QQAIBOT D1 or QQbotKV.

- 2026-10-24: Cloudflare same-zone fetch to Tunnel may bypass public front door without global_fetch_strictly_public; keep flag on standalone Worker. Admin Token existing Cloudflare binding currently plain_text, not Secret; user must upgrade manually. API key secret missing; do not claim live Worker chat works.

- 2026-10-24: A 200 on GET /v1/models does NOT prove POST /v1/chat/completions succeeds. Large 40B local model may take >18s; old Worker returned undifferentiated MODEL_UNAVAILABLE on all failures. New safe code separates timeout/http/empty response. QQ waitUntil after HTTP acknowledgement has a finite background execution allowance; 22s limit may be too short for cold models, durable queue required if persistent.

- 2026-10-24: QQ send_failed UNKNOWN followed event_received GROUP_AT in real diagnostics; original qqToken/sendQQ passed fetch exceptions to diagnosticCode where unexpected Error/TypeError became UNKNOWN. Distinguish auth/send fetch failures before changing URLs or guessing IP allowlist. Tencent production IP allowlist can restrict QQ OpenAPI, but does not establish cause without specific API status.
- 2026-10-24 memory divergence: verified local v0.0.115 existed, while GitHub memory remained v0.0.114 due blocked GitHub branch creation. v0.0.116 advances version, summarizes missing v0.0.115 release and reconciles with current code.

- 2026-10-24: Original Worker flattened all AI output control chars via /[\\u0000-\\u001f\\u007f]/g including newlines; replacement retains newline/tab and normalizes CRLF. Does not implement unbounded response length or QQ Markdown; QQ text length limit still applies.
- 2026-10-24: User's Qwen vision/web/voice resources may be installed in separate local services, but standalone-qq-ai/worker.js currently handles only text in QQ payload. Do not falsely claim QQ end-to-end multimodal capabilities from just local model readiness. Image generation specifically disabled by user.
- 2026-10-24: New admin cookie session requires browser HTTPS and matching Origin on POST/DELETE, distinct from API bearer compatibility. Changing ADMIN_TOKEN revokes all old signed sessions; user sign-in required again. No immediate server-side per-session revocation beyond cookie deletion.

- 2026-10-24: Previously GitHub create_file denied by platform security check; user-requested fresh retry via the SAME normal GitHub create_file succeeded. Do not claim permanent GitHub write block or use alternate APIs to defeat controls. Review branch/head before mutations.
- 2026-10-24: New role-router upstream errors UPSTREAM_* initially broke 4 existing MODEL_* tests; queryModel maps them back. Upstream web_search SSE may vary by Unsloth version and must be validated against actual local Studio. webSearch defaults off; setting model IDs does not load models.
- 2026-10-24: ASR/TTS admin endpoints do NOT automatically enable QQ voice. QQ audio upload/send requires official media APIs and codec/transcoding; no images permitted under current request. Cloudflare KV model-roles-v3 not populated until owner explicitly saves in admin UI.
