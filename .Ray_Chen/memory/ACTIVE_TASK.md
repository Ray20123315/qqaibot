# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 7
goal: permit all Bbot/NapCat-accessible QQ groups to join and verify bridge without Abot OpenID, with direct native QQ replies
current_phase: implement and validate new independent Bbot group registration / joining
current_step: run GitHub CI on feature/napcat-native-link-20261010, repair failures, then promote to main and verify deployment

acceptance_criteria:
- first QQ group sends plain !use, trusted NapCat roster verifies actual QQ role, emits 12-letter invite by OneBot with ACK
- other QQ group sends !CODE alias, validates admin member from fresh roster, binds numeric QQ group without Abot OpenID, replies by OneBot
- !status !code !stop !resume !leave !rename !grant !ungrant work via Bbot; protected QQ 3569028262 / 2681167798 prevent ungranted stop or grants
- unlinked target with synthetic napcat: group ID is sent only by Bbot, not Abot; official target with valid OpenID still Abot first + guarded Bbot fallback
- multi-group messages stored in deduplicated outbox, delivered with OneBotHub short alarm, no synchronous OneBotHub self-dispatch when handling incoming WS event
- Abot official control commands ignored while Bbot native controller enabled, no stale parallel room creation in current code
- existing database tables and legacy backup unaffected; AI chat still off
- tests, Wrangler dry-run, Cloudflare deployed build and limited actual QQ tests

completed_steps:
- cloudflare qqai logs show QQ GROUP event ack succeeded for only one group, other groups failed official proactive 40034105 no permission
- Bbot websocket connection succeeded in a prior log on 2026-10-09 16:24 UTC (current connectivity subject to recheck)
- new src/napcat-control.js handles room creation, code join, ACL and all relevant text commands
- src/delivery.js routes synthetic napcat: target QQ groups directly to Bbot
- src/bridge.js prioritizes Bbot controls and enqueues normal message operations, does not synchronously flush in Bbot DO
- worker.js implements direct OneBot replies with ACK, alarm-based low-latency delivery
- tests/napcat-control.test.mjs adds two-group and protected-management checks
- README/docs/DEPLOY.md refreshed, wrangler.toml BRIDGE_NAPCAT_COMMANDS=true

verification: STAGED, CI pending; QQ end-to-end not verified
blockers: NapCat needs active authenticated reverse WS and group member roster, users need to try plain !use and !CODE alias in two groups; old Abot pending invite codes are not auto-imported
next_exact_action: Run CI and fix any code/test failures; after green promote to main with expected SHA, verify Cloudflare deployment, memory archive and Gmail once.
last_checkpoint_at: 2026-10-10T00:39:00+08:00
