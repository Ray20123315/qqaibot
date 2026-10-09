# CURRENT_STATE
- Production main before feature 13b915d1d4451d4cb15ff91f70a498cede760d40, existing Bbot cross-group bridge with Abot disabled.
- Baseline Cloudflare deployed qqai existing secret binding names GEMINI_API_KEYS, GEMINI_VISION_API_KEYS, DEEPSEEK_API_KEY and CODEX_BRIDGE_ACCESS_TOKEN (contents not read), GEMINI_CHAT_MODELS/GEMMA_DECISION_MODELS/DEEPSEEK_FLASH_MODEL exist.
- Legacy original backup archive/legacy-main-20261009 commit 6a22b06433cfaffcf13abe2b60a917305290b629; new bridge-before-AI backup archive/bbot-bridge-before-ai-20261010 commit 13b915d1d4451d4cb15ff91f70a498cede760d40.
- New feature branch feature/ai-assistant-rebuild-20261010 contains lazy AI router, bounded Gemini/DeepSeek client, per-group D1 state, quiet default and bridge plugin opt-in, no Workers AI binding needed.
- No changes to main or live Worker at this checkpoint. CI and QQ live acceptance pending.
