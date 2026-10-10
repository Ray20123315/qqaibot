# VERIFY
- QQ official docs: POST /v2/groups/{group_openid}/messages, msg_type:0, incoming msg_id and msg_seq:1, passive lifetime approx 5 minutes; no proactive messages.
- GitHub feature CI 38062142463 SUCCESS and main CI 38062213315 SUCCESS, npm check + Wrangler dry-run; 7 new Abot tests in tests/abot-ai.test.mjs.
- Cloudflare deployed product SHA e2aeae4485f8bf3f49c6a481e7e71f921aea008c (success, 100%), deployment f0031760-6c11-43bf-a712-4426161c9970, version 13cdfd32-245c-4aff-b4ae-a3820ba53b60.
- Cloudflare Telemetry ABOT_AI_GATEWAY_READY at 2026-10-10T15:06:08.297Z matches deployed version.
- Live QQ @/message delivery not yet proven. Verify one '@AIBot !help' in a small group then '@AIBot 你好', inspect safe ABOT_AI_PASSIVE_SENT or ABOT_AI_FAILED error code and state.
- Archive v0.0.94 CI pending latest memory-only commit.
