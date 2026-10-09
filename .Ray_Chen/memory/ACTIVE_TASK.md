# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 7
goal: replace Abot-only group linking with Bbot/NapCat-verified multi-group linking, preserve all user protection requirements and deploy to main
current_phase: NapCat-native feature regression fix
current_step: new commit CI, then main fast-forward if passed

completed_steps:
- initial feature commit 06583523172de11413c409b9ffe63929479f2a9e created on feature/napcat-native-link-20261010
- CI 37960815779: 31/32 unit tests PASSED, failed only existing tests/command-routing.test.mjs public health expected prefix '/! or !' while new worker returned '! or /!'; no NapCat-native functional test failed
- src/napcat-control.js: !use, !CODE alias, !status, !code, stop/resume/leave/revoke, ACL, Bbot direct replies
- src/bridge.js: Bbot control handling primary, Abot control ignored in new mode, outgoing outbox enqueued only
- src/delivery.js: synthetic napcat: target dispatched through Bbot instead of Abot
- worker.js: OneBotHub direct ws reply awaiting ACK, short alarm flush, /health prefix fixed to maintain existing API response string
- docs, wrangler, tests updated, main not yet changed

known_failures: first feature CI 37960815779 failed single health diagnostic string assertion, fixed this revision
verification: CI pending; no real new QQ group test yet
blockers: need NapCat live client in at least two groups for end-to-end confirmation, and Abot existing stale pending invite cannot be auto-imported
next_exact_action: verify CI success and package, fast-forward main with lease check, verify Cloudflare connected build and D1 safe availability, deliver memory package and notify Gmail.
