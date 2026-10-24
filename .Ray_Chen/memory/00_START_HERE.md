# Ray_Chen Memory
version: v0.0.120
task_id: qq-always-web-markdown-20261024
task_status: completed
goal_revision: 10
canonical_branch: main
code_commit: 03f829edebff295cb5953ad5636e41db2c5527ce
last_updated: 2026-10-24

## Quick resume
- User requests always-on Unsloth web search without typing /search or flipping a manual switch, and QQ-native rendered Markdown headings, paragraphs and ordered 1/2/3 lists rather than raw ** or #.
- PR #98 code merged main 03f829edebff295cb5953ad5636e41db2c5527ce; isolated Worker CI 40089303664 and legacy AI CI 40089303680 both SUCCESS. Original qqai production untouched.
- New qq-format.js generates QQ msg_type:2 markdown.content with headings and numbered list, fallback once to msg_type:0 cleaned plaintext on explicit HTTP 400/403/415/422 or business-code rejection; caches markdown rejection in CONFIG_KV for 24h. Never retries uncertain transport timeout (duplicate risk). Added tests including actual signed QQ delivery compatibility, markdown rejection/cache, no retry on timeout.
- Unsloth role-router.js effective webSearch TRUE for legacy config and every chat, sends enable_tools:true, enabled_tools:['web_search'], mcp_enabled:false, stream:true, session_id to fixed msiai.ray2025.com. System prompt must not claim live search succeeded if no actual tool result, and requests QQ Markdown-friendly response formatting. No terminal/Python/file/MCP/image routes; user explicitly prohibits image models.
- Cloudflare independent Worker qqaibot-unsloth deployed version cdfea900-f08a-4df0-9363-d80a5abad14c 100% and readback verified 4 secret_text bindings, CONFIG_KV, flags, previous selected-model-v2 / model-roles-v3 keys and QQ callback remain.
- QQ official API docs support native md type 2 but Markdown and especially PASSIVE group Markdown may require distinct privilege. Actual QQ mobile rendering/entitlement is NOT verified; fallback may be plain instead of true sized headings. Unsloth specific GGUF versions can ignore enabled_tools web_search; request being enabled does not prove internet searches actually occur. Must not say guaranteed web searched every turn.
- NEXT: User sends new QQ group @ message asking structured 3-point answer and current web info, inspects rendered headings; report actual output and new error code/QQ stage, without posting secrets.
