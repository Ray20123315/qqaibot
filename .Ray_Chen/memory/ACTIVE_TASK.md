# ACTIVE_TASK
task_id: qqaibot-ai-rebuild-20261010
task_status: active
goal_revision: 4
goal: concise non-Markdown QQ answers without silent truncation; reattach previously built Codex EXE via authenticated WebSocket, prefer Luna non-thinking and stable sessions; Bbot opt-in group memories in D1 and existing 1024-D Vectorize index.
acceptance_criteria:
1. AI output uses plain text and advisory short length; overlong answers rewritten, never silent mid-sentence cutoff.
2. Existing secret CODEX_BRIDGE_ACCESS_TOKEN authenticates /v3/codex-bridge; separate Codex/NapCat WS tags; request model gpt-6-luna, reasoningEffort none, sessionKey from hashed Abot group/user; disconnected Codex falls back to Gemini.
3. Original Windows EXE source restored and nonthinking Codex CLI config passed; not falsely claiming model process remains loaded.
4. Bbot groups require verified administrator command !memory on before collecting readable group text; D1 and Vectorize use existing VECTORIZE_GEMINI_KEYS, 1024-dimensional gemini-embedding-001; per-group isolation, 200/day, 2-day TTL, delete on recall.
5. Abot only reads Bbot memories when existing verified bridge_groups OpenID→QQ-ID mapping exists; no guessing or cross-group leakage.
6. Preserve QQ official Abot, political-topic guard, API Secrets, existing D1 records and archived branches; CI and Cloudflare build before main.
current_phase: staged feature source in GitHub branch
current_step: run feature CI, diagnose/fix failures, then promote main only after green
execution_plan: prepare isolated branch and backups, add tests, verify CI/dry-run/EXE build, fast-forward main, verify production, update Ray_Chen package, Gmail once.
completed_steps:
- inspected main 0a5580bd0ffa5206261bcdca88da90a2abcbb03d, legacy Windows exe sources and protocol qqai-codex-bridge-v1, Cloudflare Secret binding names and existing Vectorize qqai 1024-dim index.
- src/reply-style.js formatter and regenerate-on-long response; Abot/model-client/qq-api removed silent truncation.
- src/codex-bridge.js and worker.js Codex gateway and DO tagged sockets, model request, SHA256 session keys, fallback.
- old Windows EXE source, EXE build workflow and reasoning effort CLI config restored.
- src/group-memory.js opt-in D1 collection, embeddings, vector namespace search with verified group mapping, recall deletion and scheduled expiry.
- Wrangler binds existing Vectorize qqai, group memory feature available while each group defaults OFF.
- new tests/compact-codex-memory.test.mjs for formatter, Codex request/fallback, group memory, vector dimension; docs updated.
verification_results: feature CI not run yet, live QQ/EXE/Vectorize not tested.
blockers: none currently. Actual installed Codex CLI support for gpt-6-luna and reasoningEffort none UNKNOWN; never claim permanent model process.
next_exact_action: check CI result on feature/compact-codex-vector-memory-20261010 and repair any failure.
last_checkpoint_at: 2026-10-10T16:15:32.435Z
