# ACTIVE_TASK
task_id: qq-always-web-markdown-20261024
task_status: completed
goal_revision: 10
goal: Make Unsloth web_search requested on every QQ and admin Qwen text conversation, and send QQ actual Markdown rich messages with readable single fallback on explicit platform rejection.
acceptance_criteria:
- No manual /search command or webSearch toggle required.
- Only web_search tool allowed; MCP/shell/Python/files/images remain forbidden.
- Model never claims internet verified without actual tool results.
- Native Markdown message type 2 with # and ## headings and 1. 2. 3. lists; permission rejection downgraded to text, no raw syntax and no duplicate retry on unknown outcome.
- GitHub isolated+legacy CI pass, main merge, standalone Worker deployment and readback, preserve 4 secrets/KV/QQ events/old qqai.
current_phase: code/CI/merge/deploy verified, live Unsloth search execution and QQ native rich rendering require human testing.
current_step: User tests actual QQ group reply with structured and fresh-info request; if plain fallback, confirm QQ native/passive Markdown permission.
completed_steps:
- Read official Tencent QQ v2 send + markdown docs; native msg_type 2 markdown.content, special group passive Markdown privilege may be required. Read Unsloth smoke test using enabled_tools web_search; know GitHub issue on some GGUF Studio releases not actually triggering search despite enabled_tools.
- Added standalone-qq-ai/qq-format.js and test/qq-markdown.test.mjs, edited role-router.js/worker.js/dashboard.js/README.md/test/role-router.test.mjs/test/qq-delivery.test.mjs. No images.
- CI isolated 40089303664 SUCCESS, legacy 40089303680 SUCCESS including rejection fallback and retry suppression; code PR #98 merged main 03f829edebff295cb5953ad5636e41db2c5527ce.
- Cloudflare independent qqaibot-unsloth 6-module strict inherit deployed cdfea900-f08a-4df0-9363-d80a5abad14c at 100%, readback verifies new code/4 secret_text+CONFIG_KV/flags, selected-model-v2 and model-roles-v3 intact, original qqai unchanged.
verification_results: CI and Cloudflare API PASS; real QQ rich Markdown and actual Unsloth search tool invocation NOT VERIFIED. No QQ message actively sent by these tools.
known_failures: QQ native Markdown entitlement may not be granted, fallback necessary; external search may not really run; 23-second QQ inference timeout may be insufficient for slow web searches.
blockers: None for code or deployment. Operator needs test results; QQ Markdown permission outside Worker.
next_exact_action: User asks QQ AI for three numbered items and up-to-date info; inspect true heading/list rendering, send back actual output and QQ diag or error code.
resume_rule: Confirm repo main/Cloudflare version before further writes; do not claim actual tool execution or native Markdown rendering until user evidence; preserve all secrets and exclude image models.
last_checkpoint_date: 2026-10-24
