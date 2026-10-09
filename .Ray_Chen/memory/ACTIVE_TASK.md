# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 9
goal: parallelize Bbot-only QQ 3+ group forwarding and diagnose/recover false websocket-connected status
current_phase: program and Cloudflare deployed, live NapCat reconnect and QQ acceptance pending
current_step: user toggles NapCat WebSocket Client off and on, then checks /health bbot.hub_generation, connected, and sends one QQ cross-group test

completed_steps:
- main before new task 9b97668ccb4bfa910b065ff9be386fe2022a8604, original archive still at 6a22b06433cfaffcf13abe2b60a917305290b629
- src/batch.js fanoutByGroup provides bounded 4-target parallel actions, preserves each target message ordering
- src/bridge.js parallelizes target preparations and outbox sends, logs BBOT_BATCH_RESULT count/groups/parallel/sent/failed/duration_ms
- src/relay.js nativeBatch packages source text, picture, face/emoji, voice, video and file segments as one native send per target where practical
- worker.js changes 1000ms alarm to 50ms, cron only wakes OneBotHub /flush and avoids competing with DO, reschedules next batch if needed
- worker.js health includes websocket_count, last_connected_at, last_event_at, last_closed_at; history not equated to connected
- tests/parallel-relay.test.mjs covers three QQ targets concurrent, same-group ordering, combined native message and health truthfulness
- initial new feature 95057385c5822e6e355066c273f7475b06d32d87 CI 37965452837 PASS and main CI 37965524681 PASS, Cloudflare deployment e9f2e322-b3a8-4ba8-868e-d9656dfaf36e succeeded
- observed live Cloudflare at 2026-10-09T17:21:04Z old Qq OneBotHub version ac768bc3-0d69-4eb7-9d18-f162cac90c5f returned 404 to GET /internal/flush despite latest Worker: old hot Durable Object websocket instance still running old source
- fixed routing by adding src/bbot-hub.js with shared BBOT_HUB_ID='bridge-bbot-parallel-v3', updating worker/src/bridge/src/delivery in one commit and adding generation regression test
- fix branch commit 5b36ddcd8106f4566fcc15f2c63706cd5febd8dc CI 37965979192 PASS and main CI 37966044948 PASS
- main advanced nonforce to 5b36ddcd8106f4566fcc15f2c63706cd5febd8dc; Cloudflare qqai deploy 11d869b9-a305-4e0a-ad60-7be82a616293, version 77ce16ed-350d-4b7f-ad55-e8c2309f4d01, build success, 100% traffic and source 5b36ddcd8106f4566fcc15f2c63706cd5febd8dc
- protected QQ permissions, Bbot-only mode, Abot disabled, D1 existing state and original archive unchanged
- memory-only follow-up version v0.0.86 pending final CI and archive

verification_results:
- tests + Wrangler dry-run PASS on feature and main
- Cloudflare build/deployment PASS for code revision
- live WebSocket reconnect on new hub UNKNOWN pending user action; no 3-group measured speed claim
- QQ composite media segments may need adaptation for NapCat specific formats

known_risks:
- /health bbot.connected false cannot be repaired by pretending old socket counts; user must reconnect NapCat to new DO identity
- QQ/NapCat rate limits/media types may still cause >5s, no SLA
- old DO may still emit logs until underlying WS closes; new current routing always goes to parallel-v3

next_exact_action: User goes to NapCat WebSocket Client and disables then enables QQAIBOT-Bbot once (same wss URL and token); checks GET https://aibot.ray2025.com/health has bbot.hub_generation parallel-v3, websocket_count >=1, connected true; test normal chat from first group to two other linked groups, report duration. If still false inspect last_connected_at/last_closed_at and NapCat HTTP 401/connection logs.
checkpoint_at: 2026-10-09T17:26:06.060Z
