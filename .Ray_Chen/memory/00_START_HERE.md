# Ray_Chen Memory
version: v0.0.116
task_id: qq-unsloth-send-unknown-20261024
task_status: blocked
goal_revision: 7
canonical_branch: main
verified_code_commit: d6997d37bb3861e037dbca4bbb742c6b490ecbc5
updated_at: 2026-10-24

## Quick resume
- User submitted real QQ diagnostics: callback_verify OK 2026-10-24T08:50:51.404Z, event_received GROUP_AT 08:47:16.871Z, send_failed UNKNOWN 08:47:17.621Z, event_ignored UNSUPPORTED_OR_INVALID_EVENT 08:46:40.007Z.
- Therefore QQ HTTP callback signing/challenge and at least one GROUP_AT delivery HAVE worked. Delivery to QQ failed AFTER receiving group event; unknown was a gap in sanitizing unexpected fetch errors in qqToken/sendQQ, not proof of IP whitelist failure.
- PR #92 merged main d6997d37bb3861e037dbca4bbb742c6b490ecbc5; isolated CI 40079995888 and original AI CI 40079995892 SUCCESS. Worker distinguishes QQ_AUTH_FETCH_FAILED vs QQ_SEND_FETCH_FAILED, timeouts, HTTP redirects/status and numeric QQ API error codes. No untrusted exception messages, response body, QQ identifiers or tokens in diagnostics.
- Cloudflare independent qqaibot-unsloth version 9ece06c4-edbc-4055-8a2a-1a7e2f87ecb4 deployed at 100%, code/flags/4 secret_text bindings/CONFIG_KV selected-model-v2 verified. Previous diagnostic keys retained. Original production qqai/D1/DO/NapCat/Codex unchanged.
- Tencent QQ official documentation lists IP whitelist requirements for production bots, but causes remain UNVERIFIED pending next real QQ event; official documentation includes multiple legacy/current API domain variants, so no blind URL switch occurred.
- User previously received locally verified v0.0.115 memory archive, but GitHub memory had remained v0.0.114 after platform blocked its sync; this GitHub version v0.0.116 reconciles that historical state and this fix, without reusing version numbers.
- NEXT: User sends a fresh GROUP_AT QQ message and checks the admin webpage's "查看 QQ 診斷"; provide latest send_failed stage code or reply_sent OK, not credentials. If QQ_AUTH_FETCH_FAILED, investigate QQ token endpoint connectivity; if QQ_SEND_FETCH_FAILED, investigate outbound API connectivity/IP allowlisting; if QQ_SEND_HTTP_403, check permission/IP whitelist.
