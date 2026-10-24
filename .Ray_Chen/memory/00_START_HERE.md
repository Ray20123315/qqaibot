# Ray_Chen Memory
version: v0.0.124
task_id: qq-chat-modes-vision-spam-free-20261024
task_status: completed
goal_revision: 14
canonical_branch: main
verified_code_commit: 15eb046945ad554638be85d4b656f2cc0bf90b5a
updated_at: 2026-10-24

## Quick resume
- User requested four-stage QQbot expansion, user-toggleable search and reasoning (thinking default off), deep research mutually exclusive with search, safer sandboxed code, images in QQ, natural chat, spam protection, HTML output file to group with daily quota, and no credit card or paid backend.
- Stage released: per-QQ-verified-sender /搜索开 /搜索关 /思考开 /思考关, default search ON/thinking OFF. Deep Research stays DISABLED pending real GGUF support; no Unsloth python/terminal/file tools enabled. Models/keys/webhook preserved.
- QQ native d.attachments image input: QQ HTTPS CDN suffix allowlist, no redirects, MIME + magic, 2MB max, content data URI passed to Qwen; real Unsloth vision E2E is NOT VERIFIED. Images generation excluded.
- Repeat spam checks, political servicescope redirect, QQ code output removes thinking text including unfinished think tags. QQ group HTML .html file delivery NOT implemented because official file_type:4 group support cannot be verified; daily quota and verified file receipt therefore NOT implemented. Do not claim sent.
- To protect user's no-credit-card constraint, removed SUPPORT_SEARCH AI Search binding from deployed Worker and gated related calls OFF by default; existing remote AI Search instance was not destroyed. New free SQLite FTS5 knowledge backend STILL PENDING.
- PR #106 merged main 15eb046945ad554638be85d4b656f2cc0bf90b5a, isolated CI 40101646030 SUCCESS and legacy CI 40101646025 SUCCESS. Cloudflare only qqaibot-unsloth version dd8c484e-beb1-408c-bd03-837e13b837b9 100%; 4 Secret bindings, CONFIG_KV and CHAT_ROOMS DO with existing namespace ID retained, selected-model-v2/model-roles-v3 keys retained; old qqai unchanged.
- Prior PR #105 had integrated per-scope SQLite-backed DO conversation and compaction and AI Search dependency before this release; remote memory was still v123. This checkpoint records the current verified state, including paid-path disable and active free memory.
- NEXT: Implement no-credit-card SQLite FTS5 knowledge storage/upload and document permissions first; then verify QQ image E2E and user modes in actual QQ. HTML file/group permissions, sandbox runtime/GPU fair scheduler, tool-led moderation, daily quota are separate pending acceptance tasks.
