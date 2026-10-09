# VERIFY

- Cloudflare Workers Observability incident 2026-10-09T16:01:12Z: ABOT_RESPONSE_FAILED Error: QQ_API_400:40034024:请求参数msg_id无效或越权.
- Cloudflare cron and QqOpenGateway ensure/alarm events present, so runtime is active; cannot claim offline.
- Unit tests in tests/qq-reply.test.mjs verify direct success, definite invalid passive msg_id -> one proactive retry, 5xx no retry, proactive denial stops.
- GitHub Actions npm run check includes tests and Wrangler --dry-run.
- After promotion check GitHub ref, CI, Cloudflare worker deployment by source SHA, and sampled Observability. Then user verifies QQ client @Abot /use.
- Rollback ref archive/legacy-main-20261009.
