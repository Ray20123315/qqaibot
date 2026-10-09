# ACTIVE_TASK
task_id: qqaibot-ai-rebuild-20261010
task_status: blocked
goal_revision: 1
goal: lean QQ AI assistant running existing Gemini and opt-in DeepSeek API Secrets, no uninvited group chat, disabled-by-default bridge plugin, preserve old code/data and deploy to main
current_phase: feature implemented, CI verified and Cloudflare deployed; waiting for controlled NapCat and Gemini live QQ acceptance
current_step: reconnect NapCat WebSocket Client to bridge-bbot-ai-v1, then test !help, !status, !ai in a controlled QQ group; confirm Gemini actual response and no unsolicited chat

completed_steps:
- Confirmed Cloudflare qqai already had secret_text GEMINI_API_KEYS, DEEPSEEK_API_KEY, GEMINI_VISION_API_KEYS and CODEX_BRIDGE_ACCESS_TOKEN, plus model configuration. No raw Secret values read or modified. Followed archived Gemini generateContent / DeepSeek chat/completions syntax.
- Archived full pre-AI bridge main as archive/bbot-bridge-before-ai-20261010 SHA 13b915d1d4451d4cb15ff91f70a498cede760d40; older archive/legacy-main-20261009 SHA 6a22b06433cfaffcf13abe2b60a917305290b629 unchanged.
- src/model-client.js reuses existing Gemini key list and DeepSeek explicit key, limits attempts, sanitizes errors, no automatic paid provider fallback.
- src/assistant.js handles only @Bot, reply-to-Bot and !ai triggers, no proactive group chatter. Includes !help, !status, !setting on/off, !model Gemini/DeepSeek, !plugin bridge on/off, !clear, per-group/user 3-day context and D1 daily quotas 20 user/120 group by Taiwan date.
- Worker /health reports AI assistant mode, provider Secret binding presence only, and active NapCat socket. Abot gateway inert, old DO preserved; bridge loaded dynamically only as needed.
- src/bridge.js blocks old outbox targeting groups without explicit bridge plugin enabled, uses ASSISTANT_MODE=true.
- New OneBotHub generation bridge-bbot-ai-v1; NapCat WS client must reconnect post-deploy; no URL/Token changes.
- Modified README docs/DEPLOY and CI tests, added provider mock tests. Feature CI 37973263797 success, main CI 37973472725 success, Node tests and Wrangler dry-run.
- Non-force GitHub main fast-forward to product SHA 9d19fd6ad19970290b2c4ee34259bf97fe30679e.
- Cloudflare qqai build from 9d19fd6ad19970290b2c4ee34259bf97fe30679e outcome success, deployment ID 5162563f-51b9-4ddc-a52e-888e46798fa7, version 291e36cf-dbc6-4963-8984-db0f64bd90b6, 100% traffic.
- Read-back after deploy confirmed Secret types: GEMINI_API_KEYS secret_text, DEEPSEEK_API_KEY secret_text, GEMINI_VISION_API_KEYS secret_text, ONEBOT_ACCESS_TOKEN secret_text, D1 and OneBotHub bindings. ASSISTANT_MODE true.
- Latest v0.0.92 memory-only commit prepared; CI artifact pending.

verification_results: tests and Cloudflare deploy successful; real Gemini API/QQ chat behavior NOT TESTED, image understanding is not part of first text MVP.
known_risks:
- GEMINI_CHAT_MODELS configuration includes recent/preview model names; first configured model could be unavailable, client tries stable gemini-2.5-flash fallback. Unknown actual Gemini quota.
- No real network model call or NapCat QQ chat send performed for this release. Controlled QQ group test needed.
- QQ replies and command triggers need Bbot WS reconnect to fresh Durable Object bridge-bbot-ai-v1.
- Vision, voice, file AI and other old plugins not ported; text assistant is deliberately minimal.
- Existing legacy D1 bridge data persists but opt-in plugin OFF; avoid accidental old message replay after enabling without review.
next_exact_action: user toggles NapCat WebSocket Client off and on without changing wss://aibot.ray2025.com/onebot or token; checks /health mode ai-assistant, hub_generation ai-v1, bbot.connected true, assistant.configured true; in a small group sends !help then !ai 你好 once. If reply fails, collect sanitized Worker logs and provider HTTP status only.
checkpoint_at: 2026-10-09T18:29:45.586Z
