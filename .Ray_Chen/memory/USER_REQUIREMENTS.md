# USER_REQUIREMENTS
- User asks to try Abot as direct AI bot, using official QQ Gateway for group @ events and REST passive msg_id replies, not relying on Bbot/NapCat for AI.
- Reuse existing GEMINI_API_KEYS, DEEPSEEK_API_KEY and QQ_OPEN_CLIENT_SECRET, never request/reveal keys.
- No proactive chatter, no duplicate Abot/Bbot responses. Preserve Bbot optional bridge plugin off by default, archives, D1 and protected QQ identities.
- Explicitly distinguish Gateway READY from verified group message send; actual QQ reply must be tested.
