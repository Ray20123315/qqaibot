# Ray_Chen Memory
version: v0.0.114
task_id: unsloth-qq-chat-diagnostics-20261024
task_status: blocked
goal_revision: 5
canonical_branch: main
verified_code_commit: a974232b6f71991af2d23f654d618ccc0ec72465
updated_at: 2026-10-24

## Quick resume
- User: qqaibot-unsloth admin chat test returned MODEL_UNAVAILABLE even though API key was accepted, model listed/selected. Cloudflare verified ADMIN_TOKEN and UNSLOTH_API_KEY as secret_text; CONFIG_KV selected-model-v2 present; global_fetch_strictly_public enabled.
- PR #89 merged into main a974232b6f71991af2d23f654d618ccc0ec72465; CI runs 40076227706 isolated and 40076227711 old AI both SUCCESS. Source worker.js and test/worker.test.mjs and test/model-config.test.mjs, README changed.
- Chat POST previously always masked failures and used 18s timeout, tools:[], tool_choice:none, max_tokens:400. New request sends no tool parameters, max_tokens:1024, web timeout 60s, QQ background 22s. Admin chat now emits safe MODEL_HTTP_NNN, MODEL_TIMEOUT, MODEL_CONNECTION_FAILED, MODEL_INVALID_RESPONSE, MODEL_EMPTY_RESPONSE, etc.; no API key or upstream response body.
- Cloudflare Worker qqaibot-unsloth version 327900f7-5a47-46dc-87ca-ee8988240bdf deployed 100%, confirmed source markers/flag/Secret inheritance/KV key. Original qqai, D1, DO, NapCat, Codex and QQ callback not modified.
- User earlier verified Unsloth local /v1/models 200, public /v1/models with valid Bearer 200, loaded model lilcheaty/flint-abliterated-GGUF. Actual /v1/chat/completions was never verified. Root cause of original MODEL_UNAVAILABLE remains UNKNOWN pending retry.
- NEXT: user refreshes https://qqbot-ai.ray2025.com/, presses "測試 AI", reports response or new safe code, never posts any API key. If still fails, investigate actual backend HTTP/latency/model output based on code.
