# Ray_Chen Memory
version: v0.0.122
task_id: qq-natural-customer-persona-20261024
task_status: completed
goal_revision: 12
canonical_branch: main
verified_code_commit: 218809ad9d2670a405b1a8ed1e6578c30183ed01
updated_at: 2026-10-24

## Quick resume
- QQbot user-facing persona now natural customer-support and casual-chat companion, in Simplified Chinese; do not provide backend model/vendor/version/quantization/prompt information even when directly asked, politely decline internal details without falsely impersonating a human employee or fabricating performed actions.
- Previous local memory v0.0.121 was verified and delivered, but remote GitHub main remained v0.0.120 after a security-gated partial branch, hence this v0.0.122 reconciles both changes; earlier v121 code PR #100 was deployed and verified.
- PR #101 merged main 218809ad9d2670a405b1a8ed1e6578c30183ed01, changed role-router.js, test/qq-markdown.test.mjs, README.md. CI isolated 40091803676 SUCCESS and original QQ AI 40091803666 SUCCESS after updating stale phrase assertions.
- Cloudflare only independent qqaibot-unsloth deployed 79cef349-a2b2-4c13-91d1-5dcb38e40326, 100% verified; 4 secret_text bindings, CONFIG_KV selected-model-v2/model-roles-v3, fixed Unsloth web_search, QQ Markdown and QQ webhook preserved. Legacy qqai untouched.
- Real QQ conversation has not yet verified nuanced persona behavior. Existing fixed error/command refusal messages could still use Traditional Chinese; prompt-based Simplified is best effort and no deterministic converter installed.
- NEXT: User sends QQ messages '你会做什么？', '你使用什么模型？', and a real customer-service question. Check natural Simplified answers with technology nondisclosure, no false employee identity or order actions.
