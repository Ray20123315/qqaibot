# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 2
current_phase: fix and verify Abot proactive-media and Bbot fallback
current_step: correct mock argument order in media fallback test, rerun CI and inspect archive artifact

completed_steps:
- legacy main archived at archive/legacy-main-20261009
- Abot first official send, official group /files media, optional proactive status via /bot_state
- Bbot fallback only if Abot definitively rejected / cannot encode source format
- Bbot OneBot send_group_msg confirmation via websocket echo ACK; missing ACK ambiguous and no duplicate retry
- QQ group at uses proven mapping, text <qqbot-at-user id="..."/> or Bbot numeric group @ if target in valid roster
- route normal message/media by active source/destination groups, dedup and outbox
- /status /use /join /verify /rename /stop /resume /leave /grant /ungrant /revoke and no AI

verification:
- prior CI 37946963804: success for previous version
- CI 37949966486: FAILED, 16/17 tests passed; test mock function used (eid,group,segments) rather than actual (env,eid,group,segments). No product failure established.
- fixed mock in this revision. New CI pending.
- Cloudflare production settings read-only check confirms ONEBOT_ACCESS_TOKEN and QQ_OPEN_CLIENT_SECRET bindings exist; value redacted/not read
- Live media / cross-group / @ not tested, no real client evidence

blocking_gates:
- validate real QQ group allow_proactive_msg, Abot outgoing messages, fallback Bbot ACK in isolated groups
- ensure NapCat reverse WS reconnected to new runtime before main cutover
- avoid changing main until safe runtime and permissions are verified

next_exact_action: check new CI and packaged v0.0.68 memory archive; then arrange isolated real QQ smoke with group controls, only afterward production promotion.
