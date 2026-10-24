# ACTIVE_TASK
task_id: unsloth-qq-model-picker-20261024
task_status: blocked
goal_revision: 2
goal: Let admin paste their Unsloth API key into the QQ AI web admin, list their actual models and select/persist the model used by QQ and web chat.
acceptance_criteria:
- Admin-only model discovery from fixed /v1/models endpoint using submitted/saved key. No API keys in GitHub, browser persistence or API responses.
- Only model listed by API is selectable. Selection+key encrypted at rest in standalone KV, used for QQ reply and admin test.
- Existing env secret fallback retained. ADMIN_TOKEN rotation supports new API Key overwrite.
- No shell/tools/file execution, no edits to legacy qqai, D1, QQ bot callback or Codex.
- GitHub tests pass, new standalone Cloudflare Worker deployed with verified KV binding.
current_phase: Model picker PR #84 merged, Cloudflare Worker/KV deployed; real authenticated Unsloth & QQ verification blocked.
current_step: User must configure ADMIN_TOKEN, supply Unsloth API Key in web UI, choose model and test; configure QQ credentials separately for real QQ bot.
completed_steps:
- Inspected baseline main v0.0.110 and Cloudflare scripts/secrets; checked Unsloth model endpoint and Cloudflare KV docs.
- Added standalone-qq-ai/model-config.js, test/model-config.test.mjs; updated Worker admin HTML/API, README and wrangler binding.
- Isolated tests CI 40072501757 SUCCESS; legacy AI CI 40072501794 SUCCESS; merged PR #84 main 16764e1bcc7509f0eb761040e6ed738e05572194.
- Created dedicated KV namespace 033b241f7377496790d92056d39669ad; deployed script version c179d753-b3f8-4f0f-ac2f-a262379eff14 at 100% with CONFIG_KV API readback.
verification_results: Github CI pass; Cloudflare Worker domain/binding/100% deployment readback pass. Secrets count zero. External HTTPS open via web tool not accessible. No live Unsloth or QQ bot event tested.
blockers: Missing ADMIN_TOKEN, Unsloth API Key, QQ_APP_ID, QQ_APP_SECRET and actual QQ publisher webhook setup. May require fixed outbound IP allowlist for QQ API.
next_exact_action: Set ADMIN_TOKEN as a strong Worker Secret in qqaibot-unsloth, then use admin UI to submit Unsloth API Key, list and save model; check live chat test.
resume_rule: Confirm main SHA and Worker KV binding; do not modify original qqai resources or claim live QQ success without evidence.
last_checkpoint_date: 2026-10-24
