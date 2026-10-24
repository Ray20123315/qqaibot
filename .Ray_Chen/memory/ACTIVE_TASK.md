# ACTIVE_TASK
task_id: qq-unsloth-send-unknown-20261024
task_status: blocked
goal_revision: 7
goal: Resolve QQ bot silence following confirmed incoming GROUP_AT callback and opaque send_failed UNKNOWN.
acceptance_criteria:
- Preserve original qqai Worker, original D1/DO, QQ routing and four Worker secrets; no fabricated real QQ message.
- Distinguish auth fetch failure from send fetch failure, timeout, HTTP status, and numeric provider code; never log secrets, QQ IDs or raw exception text.
- Test signed delivery failure paths and legacy QQ regression CI; merge main and deploy independent Worker safely.
- Deliver versioned memory archive and Gmail notification. Real QQ reply accepted only with live evidence.
current_phase: CI/merge/deploy complete; awaiting real QQ retry to determine upstream/egress root cause.
current_step: User sends new QQ GROUP_AT message, then opens authorized QQ diagnostics and reports newly recorded send_failed code or reply_sent.
completed_steps:
- Real user QQ diagnostic event evidence: callback_verify OK 08:50:51Z, event_received GROUP_AT 08:47:16Z, send_failed UNKNOWN 08:47:17Z, separate event_ignored 08:46:40Z.
- Source inspection found qqToken and sendQQ fetch errors unclassified, diagnosticCode only allowed limited QQ errors. Verified Tencent IP allowlist docs but no proof of specific block.
- PR #92 adds QQ_AUTH_FETCH_FAILED/TIMEOUT, QQ_SEND_FETCH_FAILED/TIMEOUT, safe business codes, redirect and invalid response handling; includes tests and README.
- GitHub CI isolated 40079995888 SUCCESS, legacy 40079995892 SUCCESS; main commit d6997d37bb3861e037dbca4bbb742c6b490ecbc5.
- Cloudflare qqaibot-unsloth version 9ece06c4-edbc-4055-8a2a-1a7e2f87ecb4 100% API readback; preserved ADMIN_TOKEN, QQ_APP_ID, QQ_APP_SECRET, UNSLOTH_API_KEY Secret and CONFIG_KV/model. Original qqai untouched.
- Local archive v0.0.115 from previous task verified checksum 330f5cef91ad35c3708e01724ff37d460053518ddb2e3778c0c5ecd0a0765603; GitHub v0.0.114 had not been updated due prior tool safety gate.
verification_results: New CI pass; new Cloudflare deployment/version/source/bindings verify pass. QQ real outbound success NOT verified; prior QQ callback/event receipt verified by user diagnostics.
blockers: Need new code from fresh QQ retry to distinguish QQ Access Token fetch failure, QQ message fetch failure or QQ response business error. QQ outbound fixed IP allowlist unknown.
next_exact_action: User sends new group @ message and checks new send_failed code or reply_sent OK in https://qqbot-ai.ray2025.com/ authenticated admin diagnostics.
resume_rule: Never call real QQ sends without new user message; use safe diagnostic codes only, never reveal secret values; do not touch old qqai.
last_checkpoint_date: 2026-10-24
