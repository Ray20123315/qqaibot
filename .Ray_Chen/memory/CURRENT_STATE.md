# CURRENT_STATE
- GitHub main before new Abot trial 8bc7427f85f23ab52935c2a83b87e7e2df909c14.
- New branch feature/abot-ai-passive-20261010 official AI passive reply implementation; no live network tests.
- Cloudflare existing names QQ_OPEN_APP_ID, QQ_OPEN_CLIENT_SECRET, GEMINI_API_KEYS, DEEPSEEK_API_KEY, QQ_OPEN_GATEWAY, DB all retained. Intents existing QQ_OPEN_INTENTS read from existing Cloudflare env.
- New QqOpenGateway instance qqai-abot-passive-ai-v1, old bridge-abot and bridge-abot-commands-v2 shut down by cron; class DO migrations preserved.
- Bbot remains connected but routeBbotBridgeOnly avoids AI generation/reply. Bridge plugin per-group D1 remains default off.
- D1 additive abot_ai_seen / abot_ai_history / abot_ai_settings tables. No old data destroyed.
- Original legacy archive/legacy-main-20261009 at SHA 6a22b06433cfaffcf13abe2b60a917305290b629.
