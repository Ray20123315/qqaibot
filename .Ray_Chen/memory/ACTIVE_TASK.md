# ACTIVE_TASK
task_id: qqaibot-ai-rebuild-20261010
task_status: active
goal_revision: 2
goal: trial QQ official Abot as sole AI message receiver/sender through passive msg_id replies; Bbot retains opt-in bridge plugin only
acceptance_criteria:
- QQ official Gateway QqOpenGateway reconnects and heartbeats, receives GROUP_AT_MESSAGE_CREATE; ignores unmentioned ordinary GROUP_MESSAGE_CREATE.
- AI uses existing GEMINI_API_KEYS Secret and Gemini model client, group and sender OpenIDs preserved and separated, no numeric QQ-ID guessing.
- QQ passive group reply POST /v2/groups/{group_openid}/messages contains inbound msg_id and msg_seq; never proactively sends AI.
- No duplicate AI answers from Bbot; Bbot remains only for optional off-by-default bridge.
- D1 dedupe, daily limits, short context; official API error stays visible as code only, no silent Bbot fallback.
- Preserve main backup and old backups, QQ keys, D1, DO migrations; pass CI and Wrangler dry-run before main.
current_phase: initial Abot implementation staged
current_step: run CI on feature/abot-ai-passive-20261010, repair tests and deploy to main if green
completed_steps:
- Inspected QQ official message send docs; msg_id passive reply valid for about 5 min, per incoming event.
- Archived current Bbot AI main 8bc7427f85f23ab52935c2a83b87e7e2df909c14 as archive/bbot-ai-before-abot-20261010; earlier full archives remain.
- Added src/abot-ai.js parseOfficialGroupEvent, D1 OpenID per-room/per-author context and seen dedupe, Gemini response and sendGroup via QQ official only, error-code-only log.
- Reimplemented worker.js QqOpenGateway outbound WebSocket op10 HELLO/op2 IDENTIFY/op1 heartbeat/op0 READY, reconnect alarm, status endpoint; cron ensures new official ai Gateway ID qqai-abot-passive-ai-v1 while shutdown old two gateway instances.
- Worker /health mode abot-ai-passive and gateway status, AI commands received by Abot only; Bbot route now bridge-only + authorized plugin/settings control.
- wrangler.toml QQ_AI_ABOT_ENABLED true, bridge plugin still default disabled, Abot old bridge sender still off.
- Tests include passive reply msg_id, official OpenID identity and dedupe, no Bbot fallback on HTTP rejection, gateway HELLO and READY, cron starts new+shuts old.
verification_results: CI pending; no live QQ API sent or official gateway event received yet.
known_risks:
- QQ official per-app group privileges may still reject passive response (past errors e.g. 40034105), actual Gateway connection not tested.
- No private user C2C or proactive send. Official group @ event and bot membership/intents required.
- 5-minute passive message window; if Gemini stalls beyond window, may fail.
- Existing Bbot AI command behavior intentionally stopped to prevent duplicated responses; Bbot plugin control remains.
- Claude Gemini credentials not shown; only configured name.
next_exact_action: run CI; if green promote main with expected old SHA, verify Cloudflare deployment and bindings, archive memory, notify Gmail. Human live acceptance: @AIBot !help then @AIBot 你好 in small group, inspect /health and QQ error codes.
checkpoint_at: 2026-10-10T15:04:16.032Z
