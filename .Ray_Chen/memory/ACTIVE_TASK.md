# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 9
goal: fix slow group relay through parallel Bbot dispatch and reconcile false health status
current_phase: resolve stale OneBotHub instance after deployment
current_step: feature CI for new BbotHub generation, then main fast-forward if green
completed_steps:
- previous feature/parallel-bbot-relay-20261010 commit 95057385c5822e6e355066c273f7475b06d32d87 passed GitHub CI 37965452837 and main CI 37965524681; Cloudflare deployment e9f2e322-b3a8-4ba8-868e-d9656dfaf36e, version 64354e7a-aa3a-43d8-8695-3bbcf61d29f0, 100% traffic
- new parallel send worker groups by target with max 4 concurrent groups, FIFO per group, ACK and no ambiguous replay, nativeBatch multi-segment delivery
- new health exposes timestamps, active websocket count and non-misleading current connected
- LIVE Cloudflare telemetry on 2026-10-09T17:21:04Z showed GET https://internal/flush returned HTTP 404 on old OneBotHub version ac768bc3-0d69-4eb7-9d18-f162cac90c5f, despite main new code deployed
- diagnosed hot old Durable Object WebSocket preserving stale code
- updated Worker, bridge and delivery to import one src/bbot-hub.js constant bridge-bbot-parallel-v3, using fresh identity
- added tests/hub-generation.test.mjs to ensure health and delivery route same generation; new health displays hub_generation
- documentation explains NapCat WebSocket Client disable/re-enable once after Cloudflare deployment; no Token/URL changes or D1 wipe
files_changed: src/bbot-hub.js worker.js src/bridge.js src/delivery.js tests/hub-generation.test.mjs README.md docs/DEPLOY.md .github/workflows/bridge-check.yml .Ray_Chen/memory/*
verification_results: new code CI pending; prior parallel code CI success, old DO rollout blocker confirmed in observability
known_risks: Bbot remains bbot.connected=false until NapCat reconnects to new DO; actual 3-group elapsed time and mixed media success not proven.
next_exact_action: run CI; if successful fast-forward main, verify source and Cloudflare build, download/package memory, notify Gmail once. Then ask user to toggle NapCat WebSocket Client and report new /health.
checkpoint_at: 2026-10-09T17:23:47.498Z
