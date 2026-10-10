# CURRENT_STATE
- GitHub main official Abot AI code commit e2aeae4485f8bf3f49c6a481e7e71f921aea008c; earlier Bbot-only AI backup archive/bbot-ai-before-abot-20261010 SHA 8bc7427f85f23ab52935c2a83b87e7e2df909c14.
- Feature CI 38062142463 and main CI 38062213315 both success; Node suite and Wrangler dry-run.
- Cloudflare qqai deployment f0031760-6c11-43bf-a712-4426161c9970, version 13cdfd32-245c-4aff-b4ae-a3820ba53b60 from e2aeae4485f8bf3f49c6a481e7e71f921aea008c, build success, 100% traffic.
- Cloudflare QqOpenGateway produced ABOT_AI_GATEWAY_READY on new version at 2026-10-10T15:06:08.297Z; upstream QQ gateway session READY observed. Actual QQ GROUP_AT_MESSAGE_CREATE and outgoing sendGroup not yet verified.
- Existing QQ Open API and Gemini Secrets remain: QQ_OPEN_CLIENT_SECRET and GEMINI_API_KEYS secret_text; no raw values accessed.
- Worker mode abot-ai-passive, QQ_AI_ABOT_ENABLED true, old Abot bridge instances closed by cron, Bbot AI replies disabled, cross-group plugin default off.
- Additive abot_ai_seen, abot_ai_history, abot_ai_settings D1 tables, no deletion of earlier data.
