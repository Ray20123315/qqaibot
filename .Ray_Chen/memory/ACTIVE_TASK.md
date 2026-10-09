# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 5
goal: restore /use and QQ official replies on deployed main; ensure pending groups recover without losing codes
current_phase: repair official group reply msg_id validation failure
current_step: verify 40034024 safe proactive retry implementation and CI, then promote onto main

verified failure evidence:
- Cloudflare qqai Workers Observability event at 2026-10-09T16:01:12Z: ABOT_RESPONSE_FAILED Error: QQ_API_400:40034024:请求参数msg_id无效或越权
- DO gateway, worker cron, /ensure are being invoked; this is a definite refused send (not merely offline)
- Existing /use created DB rows before responding, leaving pending groups blocked for retry.

completed_steps:
- preserved archive/legacy-main-20261009 from earlier task
- staged src/bridge.js: on explicit QQ 40034024 only, retry one proactive message with no msg_id; never repeat on ambiguous errors
- staged src/bridge.js: /use pending state reissues fresh invite+verification and revokes old invite, but active verified groups untouched
- added tests/qq-reply.test.mjs for normal success, definite rejection retry, fallback failure and uncertain errors

files_modified: src/bridge.js, tests/qq-reply.test.mjs, .github/workflows/bridge-check.yml, .Ray_Chen/memory/*
verification_results: pending GitHub CI
known_risks: proactive send is subject to QQ group owner's toggle; if QQ denies proactive too, responses still cannot be delivered. Cannot prove actual QQ client receipt without new user test.
next_exact_action: inspect repair branch GitHub CI and memory archive; if successful fast-forward main, verify Cloudflare connected build and Observability errors, then ask user to retry @Abot /use once.
last_checkpoint_at: 2026-10-10T00:15:00+08:00
