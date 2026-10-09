# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 8
goal: temporarily disable Abot, route all QQ cross-group operations exclusively via Bbot/NapCat
current_phase: final feature verification
current_step: rerun CI for mock URL argument fix then fast-forward main on green

completed:
- main base e02b5ecd94ef51a70a1299e3f28ea0a578dc4738 and archive preserved
- new source branch feature/bbot-only-20261010 disables QQ Open event handling, outbound API and gateway connecting; legacy DO class inert and cron /shutdown old named instances
- native Bbot-only send for all destination groups (including historical actual OpenIDs with numeric group); no invented group IDs
- Bbot outbox offline holding and direct socket alarm ACK handling
- tests cover no official API, no gateway activity, Bbot routing, ACL and media
- CI 37963398835: 33/35 tests passed; 2 test-only expectations fixed
- CI 37963624474: 34/35 tests passed; remaining fake gateway fetch argument was a string, so mock must normalize it before asserting URL. Fixed mock.

verification: current rerun CI pending, main unchanged
blockers: Cloudflare deployment and hot legacy Abot Gateway shutdown must be checked after main promotion; no live QQ smoke yet.
next_exact_action: verify new CI; on success fast-forward main, check Cloudflare connected build, package final memory, email notification.
checkpoint: 2026-10-09T17:05:09.689Z
