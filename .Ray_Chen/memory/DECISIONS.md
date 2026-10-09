# DECISIONS
2026-10-10 goal revision 1 NEW task qqaibot-ai-rebuild-20261010 replaces previous cross-group-bridge task.
2026-10-10: Existing Cloudflare qqai has GEMINI_API_KEYS / DEEPSEEK_API_KEY and old provider-client confirms Gemini generateContent + DeepSeek chat/completions. No Workers AI binding currently present; reuse user's API Keys.
2026-10-10: Gemini is default, DeepSeek only via explicit provider selection, no surprise paid fallback. Key values never shown/logged; health displays presence and provider labels only.
2026-10-10: Cross-group bridge remains code plugin, D1 off-by-default per group; require source and target explicit opt-in and restore old command paths only for enabled groups. Existing bridge data preserved.
2026-10-10: OneBot requires true WS ACK for reply tracking, so route commands via authenticated hub and keep old Abot Gateway disabled. New DO bridge-bbot-ai-v1 avoids hot-code issue after release.
