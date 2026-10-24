# ACTIVE_TASK
task_id: unsloth-qq-ai-20261024
task_status: blocked
goal_revision: 1
goal: Implement an independent QQ official AI Bot on Cloudflare Worker using home-hosted Unsloth at https://msiai.ray2025.com/, no command execution, simple web admin.
acceptance_criteria:
- New Worker and code isolated from old qqai and existing D1/NapCat/Codex/QQ callback.
- Signed QQ Webhook accepts GROUP_AT_MESSAGE_CREATE and C2C_MESSAGE_CREATE, uses fixed authenticated Unsloth chat completions, passive QQ replies.
- No shell/tool/file execution or arbitrary upstream; protected web test/status; no committed credentials.
- GitHub code verified and Cloudflare script deployed; operator to complete real QQ/Unsloth E2E.
current_phase: Code PR merged and independent Cloudflare Worker deployed; real QQ integration blocked by missing secrets/QQ config.
current_step: Configure five Secrets, verify QQ publisher event settings and outgoing whitelist, test model/admin then QQ messages.
completed_steps:
- Inspected existing QQAIBOT code and memory; read QQ/Cloudflare/Unsloth docs.
- Implemented standalone-qq-ai files plus isolated GitHub Action; local 5/5 tests PASS; PR #82 CI runs 40068743188 and 40068743122 both SUCCESS.
- Merged main SHA a365f0c6c391a171154241e82c28f00bfa1eb322 (readback).
- Cloudflare script qqaibot-unsloth deployed as 4ca53f6f1f6648d097ca1109607d8b9f; workers.dev enabled; qqbot-ai.ray2025.com custom domain enabled via API.
verification_results: GitHub PR CI success (40068743188, 40068743122), memory CI 40069333964 SUCCESS, Cloudflare script/domain API success, secrets EMPTY. Public HTTPS live request could not be verified. Real Unsloth and QQ responses untested.
blockers: QQ_APP_ID, QQ_APP_SECRET, UNSLOTH_API_KEY, UNSLOTH_MODEL, ADMIN_TOKEN missing; QQ event subscription and fixed outgoing IP whitelist may be required.
next_exact_action: Manually populate five Secrets for qqaibot-unsloth in Cloudflare, configure *new* QQ official Bot callback and perform C2C/group @ E2E; never replace old qqai callback without authorization.
resume_rule: Confirm main SHA and Cloudflare worker/domain/secrets readback; no old Worker, D1 or group status mutations.
last_checkpoint_date: 2026-10-24
