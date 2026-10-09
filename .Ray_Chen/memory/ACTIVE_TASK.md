# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 8
goal: temporarily disable all Abot application traffic and run entirely through Bbot/NapCat
current_phase: CI repair and repeat
current_step: verify next CI then fast-forward main with expected HEAD and observe Cloudflare

completed_steps:
- branch feature/bbot-only-20261010, commit 30e423f716cddf23ed4aad397d024bb5dab482d6 stages Bbot-only routing and shutdown of historical Abot DOs
- QQ Open API send and token calls removed from Worker entry and delivery/bridge; legacy QQ_OPEN_GATEWAY inert with shutdown and alarm closing sockets
- Bbot-only health response and same authenticated Bbot DO, storage and group permissions retained
- Bbot offline does not claim queued messages; connected Bbot alarm sends on existing WebSocket
- CI 37963398835: 33 of 35 tests passed, failures ONLY in test expectations: mocked String URL treated as Request.url, extra reason returned for self-echo
- corrected tests/abot-disabled.test.mjs and tests/pairing.test.mjs

verification: rerun CI pending; main unchanged as of checkpoint
known risks: old active Abot DO may continue old connection until new class upgraded; shutdown requested on cron. Live QQ Bbot group send not yet verified.
next_exact_action: verify CI, produce v0.0.80 archive and checksum, fast-forward main, verify Cloudflare source SHA, inspect Abot telemetry, Gmail once.
