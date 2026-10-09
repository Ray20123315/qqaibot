# CURRENT_STATE
- GitHub Ray20123315/qqaibot production main code SHA 9d19fd6ad19970290b2c4ee34259bf97fe30679e, AI assistant mode replacing noisy bridge core. Original bridge code preserved archive/bbot-bridge-before-ai-20261010 SHA 13b915d1d4451d4cb15ff91f70a498cede760d40, legacy archive/legacy-main-20261009 SHA 6a22b06433cfaffcf13abe2b60a917305290b629.
- Cloudflare Worker qqai deployment 5162563f-51b9-4ddc-a52e-888e46798fa7, version 291e36cf-dbc6-4963-8984-db0f64bd90b6, source 9d19fd6ad19970290b2c4ee34259bf97fe30679e, build success, traffic 100%.
- Secret bindings physically exist post-deploy: GEMINI_API_KEYS, DEEPSEEK_API_KEY, GEMINI_VISION_API_KEYS, ONEBOT_ACCESS_TOKEN; all secret_text. D1 and OneBotHub bound. ASSISTANT_MODE=true. No Secret values read.
- Model client uses existing Google / DeepSeek HTTP APIs, not env.AI or Workers AI binding. Gemini default, DeepSeek explicitly selected only; vision key preserved but not yet used.
- Per-group AI and bridge plugin settings via D1, original bridge only loaded on explicit plugin usage; source and target opt-in required.
- CI feature 37973263797 and main 37973472725 both success; no live Gemini call, QQ response or manual NapCat socket reconnect verified.
