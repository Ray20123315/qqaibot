# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 8
goal: temporarily disable all Abot application traffic and route QQ commands and cross-group messages by Bbot only
current_phase: production code and Cloudflare deployment completed; QQ live acceptance pending
current_step: user checks Bbot connected in /health and sends !use in first QQ group
completed_steps:
- original main preserved at archive/legacy-main-20261009, 6a22b06433cfaffcf13abe2b60a917305290b629
- feature/bbot-only-20261010 tested commit 7d2dbac38f212dc23f735e3f8f3fa18c156ce89e fast-forwarded to main with expected SHA and no force
- GitHub Actions feature CI 37963923027 SUCCESS, 35 tests + Wrangler dry-run and memory package
- GitHub Actions main CI 37964001494 SUCCESS
- Cloudflare Worker qqai successfully deployed main commit 7d2dbac38f212dc23f735e3f8f3fa18c156ce89e, deployment ed52e60a-7c9f-47ec-bf8a-78383af71815, version a37b19c5-42ea-43aa-b8b7-a38d702f3d45, 100% traffic
- worker.js has no QQ Open API import/connection; QqOpenGateway class inert, periodic /shutdown to bridge-abot and bridge-abot-commands-v2
- src/bridge.js accepts only Bbot events, src/delivery.js sends every eligible destination via native Bbot OneBot
- missing numeric QQ group fails explicitly; existing D1 and QQ secrets kept, protected QQ IDs unchanged
- Bbot offline holds pending outbox, direct DO alarm uses ACK
- Cloudflare telemetry 2026-10-09T17:08Z showed latest Bbot OneBotHub requests on Worker version a37b19c5 and a historical QqOpenGateway received POST /shutdown; no new Abot READY/group event in sampled results

verification_results:
- product tests and build passed; Cloudflare 100% new code
- actual old Gateway WebSocket closure and QQ platform UI status not independently confirmed
- live QQ !use / !CODE / media / cross-group not yet tested since Bbot-only deployment
- final memory v0.0.83 packaging and CI pending this commit

known_risks:
- old hot DO could retain an existing Abot session temporarily; new code does not reconnect
- QQ Open Platform command panel remains managed separately and is not removed by Worker deployment
- QQ groups missing numeric group bindings cannot relay through Bbot until trusted mapping
- NapCat must have active authorized OneBot connection; unknown ACK must not be retried

next_exact_action: user checks https://aibot.ray2025.com/health for mode bbot-only and bbot.connected=true; in first group send plain !use without @, in second group send !CODE alias; report whether reply/relay succeeded.
last_checkpoint_at: 2026-10-09T17:10:03.717Z
