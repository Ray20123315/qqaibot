# GOTCHAS
- Do not invent missing credentials; Cloudflare qqai already has GEMINI_API_KEYS, GEMINI_VISION_API_KEYS and DEEPSEEK_API_KEY. Never print raw binding values.
- Existing GEMINI_CHAT_MODELS starts with 2026 model names; some may be retired or preview. Try first configured model plus gemini-2.5-flash fallback, no DeepSeek automatic fallback.
- Model requests can be rate-limited/cost money; quotas per user/group default 20/120, Gemini only by default, DeepSeek explicit.
- Old bridge D1 pending queue may exist, so plugin off should block cron and target deliveries, not just incoming processing.
- Cloudflare DO WebSocket can keep old version after deploy; use fresh bridge-bbot-ai-v1 and require NapCat WS client restart after cutover.
- Existing code QqOpenGateway class and migrations must be retained to avoid migration failure; it should remain inert.
- Tests with stubbed model fetch do NOT prove actual QQ chat or provider availability. No live messages sent without controlled test.
