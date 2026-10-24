# ACTIVE_TASK
task_id: qq-chat-modes-vision-spam-free-20261024
task_status: completed
goal_revision: 14
goal: Deploy safe first stage of larger QQbot roadmap: per-user network search and reasoning controls (thinking OFF by default), bounded image understanding input, anti-flood formatting, keep existing chat and no-credit-card safeguards, without falsely claiming unsupported QQ group HTML files or unsandboxed Python.
acceptance_criteria:
- User QQ modes persisted per verified sender, defaults search ON/thinking OFF; Deep Research fails closed.
- Real QQ image attachment parsing, safe strict allowlist/download/MIME/size, pass supported multimodal content to existing Unsloth, no image generation.
- Requests for large duplicate output rejected, ordinary chat preserved; prevent reasoning tag leaks.
- No host Python/Shell or new billable AI Search; preserve credentials/QQ callbacks/Durable Object memory.
- Isolated and legacy CI pass, main merge, Cloudflare deployed readback, memory archive/email.
current_phase: Code CI/merge/deploy verified; true QQ/Unsloth vision and tool interactions still need user's test.
current_step: Post-deploy user QQ test and next-phase free SQLite FTS5 knowledge replacing disabled AI Search.
completed_steps:
- Inspected main commit 8139f9ae77ef99bedae176a7390d21a7a276d725, current Unsloth role-router, worker, native QQ attachments and previous tests.
- Read upstream Unsloth inference.py: enable_thinking and deep_research_armed supported request fields, Python tool exists but bypass_permissions/full disables sandbox; refused public local execution.
- Checked QQ official group messages supports msg_type 0/2/7; file_type 4 ordinary group file delivery not verified and public SDK docs report unavailable. No false HTML file delivery or quota activation.
- Normal GitHub branch and PR #106: created qq-modes.js, qq-image.js, qq-output-policy.js, test/qq-safety-modes.test.mjs, updated worker.js/role-router.js/qq-commands.js/dashboard.js/test/qq-markdown.test.mjs/README.md. Added auth-first guard for disabled paid search.
- Initial later CI failed old admin unauthorized path after paid backend guard ran before auth; corrected auth-first order and reran CI PASS isolated 40101646030, legacy 40101646025. PR #106 merged main 15eb046945ad554638be85d4b656f2cc0bf90b5a.
- Cloudflare strict-inherit 13-module deployment version dd8c484e-beb1-408c-bd03-837e13b837b9 100% verified; preserved ADMIN_TOKEN, QQ_APP_ID, QQ_APP_SECRET, UNSLOTH_API_KEY, CONFIG_KV namespace 033b241f7377496790d92056d39669ad, CHAT_ROOMS namespace 89327f53409749809942388652927752, model keys. AI Search binding removed, underlying instance left untouched; original qqai unchanged.
verification_results: Source readback and 2 CI suites PASS. Real QQ image and toggle e2e unverified; multi-GPU scheduling, file attachments, free KB FTS5, Python sandbox, daily quota all NOT COMPLETE.
known_failures: API file_type 4 group upload not confirmed; paid AI Search upload previously KNOWLEDGE_UNAVAILABLE; no runtime feature claim. Strict image CDN may reject alternate valid QQ hosts.
next_exact_action: Replace disabled knowledge upload with no-card SQLite FTS5-backed document extraction/search in independent DO, validating storage and privacy before changing production; request QQ operator to test /思考开, /搜索关 and image messages.
resume_rule: Confirm GitHub main and deployment bindings before edits; no enabling python/terminal/bypass_permissions or paid services; no QQ moderation without verifiable admin authority; honor staged scope.
last_checkpoint_at: 2026-10-24
