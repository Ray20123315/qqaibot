# Ray_Chen Memory
version: v0.0.111
task_id: unsloth-qq-model-picker-20261024
task_status: blocked
goal_revision: 2
canonical_branch: main
verified_code_commit: 16764e1bcc7509f0eb761040e6ed738e05572194
updated_at: 2026-10-24

## Quick resume
- Standalone QQ official Worker `qqaibot-unsloth` at `qqbot-ai.ray2025.com`, separate from production `qqai`.
- PR #84 merged into main `16764e1bcc7509f0eb761040e6ed738e05572194`; isolated CI 40072501757 and existing CI 40072501794 SUCCESS.
- New admin UI: enter Unsloth API Key → GET fixed `https://msiai.ray2025.com/v1/models` → select verified ID → save. Worker encrypts API Key+model with AES-GCM key derived from ADMIN_TOKEN Secret, stores ciphertext in new exclusive KV `qqaibot-unsloth-config` (binding CONFIG_KV).
- Cloudflare script deployment `c179d753-b3f8-4f0f-ac2f-a262379eff14`, running 100%; CONFIG_KV bound to `033b241f7377496790d92056d39669ad`. Original QQ worker, D1/DO/NapCat/Codex and domains unmodified.
- No ADMIN_TOKEN, QQ credentials or Unsloth API key configured as of latest read; live model list, public HTTPS and QQ sending unverified.
- Next: Set ADMIN_TOKEN (>=32 random chars) in qqaibot-unsloth Secrets, open https://qqbot-ai.ray2025.com/ to paste Unsloth API Key and pick model; then configure QQ_APP_ID / QQ_APP_SECRET for a separate Bot and verify actual webhook and message.
- Changing ADMIN_TOKEN makes the old saved ciphertext unreadable; entering a fresh API Key in admin UI overwrites and restores config. KV eventual consistency. Legacy /跨群 and stopped D1 group bindings unchanged.
