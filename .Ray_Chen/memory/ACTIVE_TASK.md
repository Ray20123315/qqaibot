# ACTIVE_TASK
task_id: qqaibot-ai-rebuild-20261010
task_status: blocked
goal_revision: 4
goal: short complete plaintext Abot AI, Codex Bridge EXE Luna non-thinking while connected, D1 and existing 1024d Vectorize opt-in memory from Bbot
current_phase: code/CI/deployment and Windows EXE build complete, waiting live operator tests
current_step: operator connects updated EXE and verifies /health codex.connected; in small NapCat group opt-in !memory on, send one normal text, verify D1/Vectorize and Abot retrieval only with verified group mapping
completed_steps:
- Existing main baseline 0a5580bd0ffa5206261bcdca88da90a2abcbb03d, backup archive branches retained.
- src/reply-style.js formats Markdown to plain text, model system advisory usual 120-350 Chinese characters, regenerate if overlong instead of cutting; src/model-client.js no 1800 slice and rejects incomplete finishReason; src/qq-api.js throws if >1800 rather than silently truncate.
- src/codex-bridge.js and worker.js re-enable authenticated old EXE /v3/codex-bridge WebSocket via CODEX_BRIDGE_ACCESS_TOKEN, with Codex and NapCat tagged sockets. Online request gpt-6-luna reasoningEffort none and stable SHA256 group/user sessionKey; model generation fallback Gemini if offline/error.
- tools/codex-work-bridge.mjs, tools/codex-bridge-windows.mjs and config example restored from legacy archive, new EXE passes model_reasoning_effort=none to CLI. This persists conversation sessions but DOES NOT keep model weights loaded continuously.
- src/group-memory.js group admin opt-in !memory on/off/status/clear, D1 source records, 200 per day group, two-day TTL/cron cleanup, deletion on QQ group recall. Vector embeddings via existing VECTORIZE_GEMINI_KEYS to existing qqai index dimensions 1024, namespace per group; Abot retrieves ONLY for verified QQ numeric group/OpenID map and checks D1 group again.
- Bbot group gathering does not activate bridge forwarding or unsolicited AI, default memory per group is OFF, ignores media and political messages.
- Added tests/compact-codex-memory.test.mjs, tests/codex-websocket.test.mjs for formatting, model fallback, authentication, DO isolation, memory and embeddings; preserved existing regression tests.
- Feature CI 38067245509 success, final main CI 38067312503 success (all Node suites and Wrangler dry-run).
- Windows EXE CI run 38067312576 success; smoke test --help and artifact QQAIBOT-CodexBridge-Windows-x64 (artifact 11675425929) sha256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7, confirmed Windows x64 PE and matching checksum.
- Promoted product to main via non-force commit c39f8cc4c8468b83ce530f30063b726193d2729f. Cloudflare qqai deployment 7a15e23e-8a7d-40fa-ae25-c7111c131951 version 45eab88a-7fe6-421b-a60e-568eb4e739a0 build success, source c39f8cc4c8468b83ce530f30063b726193d2729f, 100% traffic.
- Post deploy confirmed script binding names/types: VECTORIZE vectorize, VECTORIZE_GEMINI_KEYS secret_text, CODEX_BRIDGE_ACCESS_TOKEN secret_text, GEMINI_API_KEYS secret_text, QQ_OPEN_GATEWAY and ONEBOT_HUB DO, DB d1, BOT_MEMORY_ENABLED plain_text. No key values read.
verification_results: GitHub CI PASS, Cloudflare build and binding PASS, Windows exe packaged and SHA PASS, real QQ/EXE/model/embedding not yet exercised.
known_risks:
- Exact Codex CLI model gpt-6-luna and non-thinking option support depend on installed local CLI/plan; do not promise model stays resident in RAM or remote Luna is proven.
- App's model/embedding latency and QQ passive reply acceptance need controlled live testing. No verified bridge_groups numeric/OpenID map means Bbot memory cannot appear in Abot chat.
- Personal/group memory collection opt-in requires verified QQ admin credentials, old records only retained two days and manual clear is available.
- Live /health from external crawler inaccessible; Cloudflare binding and deployment were verified via Cloudflare API instead.
next_exact_action: reconnect/relaunch updated Windows EXE, confirm /health codex.connected=true; in test QQ group admin sends !memory on via Bbot, send normal nonpolitical text, test @Abot asking about recent text only after verified group binding; report Codex CLI errors/QQ results for follow-up.
checkpoint_at: 2026-10-10T16:24:56.845Z
