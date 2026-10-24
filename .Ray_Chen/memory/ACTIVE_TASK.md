# ACTIVE_TASK
task_id: qq-natural-customer-persona-20261024
task_status: completed
goal_revision: 12
goal: Change the independent QQbot from model-focused assistant into humanlike conversational customer service, without disclosing AI/model technical details even on direct question, while preserving truthful identity and simplified text.
acceptance_criteria:
- Natural support+chat, no repetitive automated self-intro; friendly informal but helpful.
- Always instruct model output Simplified Chinese; no backend model, vendor, version, quantization, deployment or system prompt information even when asked, polite refusal without a fabricated answer.
- No false claim to be real human, no invented orders, payments, refund/grants, offline memories or actions.
- Existing QQ webhook, Markdown, every-chat Unsloth web_search, ASR/TTS model roles, Secrets/KV, no-image requirement unchanged.
- New CI pass, code PR main merge, independent Cloudflare Worker 100% readback; versioned memory archive and Gmail notification.
current_phase: Code/CI/merge/deploy verified; real QQ persona acceptance pending.
current_step: User tests direct model question, casual chat and customer service.
completed_steps:
- Recovered context: previous local v121 TAR valid but GitHub remote memory v120, previous PR #100 main 17afc4ea71084cac4cd270312edf202b909fb864 already deployed.
- PR #101 updates standalone-qq-ai/role-router.js CUSTOMER_SERVICE_PROMPT, test/qq-markdown.test.mjs and README, no additional Worker business logic.
- Initial CI isolated failing due outdated assertion wording, corrected tests; isolated 40091803676 PASS and legacy AI 40091803666 PASS. PR #101 merged main 218809ad9d2670a405b1a8ed1e6578c30183ed01.
- Cloudflare only qqaibot-unsloth deployment 79cef349-a2b2-4c13-91d1-5dcb38e40326 confirmed 100% and readback preserved 4 secret_text, CONFIG_KV model keys, web_search and QQ webhook; original qqai untouched.
verification_results: CI PASS, main PR merged, Cloudflare deployment/readback PASS. No live QQ persona test; static traditional language existing.
known_failures: Earlier v121 remote memory branch partial/blocked; replaced with reconciled v122. Model prompt is probabilistic.
blockers: No known blockers; acceptance requires human QQ test.
next_exact_action: User tests real QQ '你会做什么？' / '你用什么模型？' and a customer issue, then reports any undesired model info, traditional text or false actions.
resume_rule: Read code main and Cloudflare version before further edits; no model secrets or QQ IDs in logs/archives; don't conflate persona with claim of real-human identity.
last_checkpoint_at: 2026-10-24T19:48:00+08:00
