# ACTIVE_TASK
task_id: qq-customer-service-simplified-20261024
task_status: completed
goal_revision: 11
goal: Make the independent Unsloth QQbot a Simplified-Chinese customer service and casual-chat assistant that never volunteers its underlying model while preserving truthful direct answers and existing safety.
acceptance_criteria:
- System prompt defines helpful customer support for known issues and natural casual chat; no invented orders, payments, permission grants/refunds, or impersonation of human support.
- All model responses instructed to be Simplified Chinese even when user asks in Traditional Chinese; no unsolicited model vendor/version/quantization disclosure, but no deceptive responses to direct technical questions.
- Existing QQ signatures, Unsloth web_search/Markdown/ASR/TTS/secret/KV remain intact; images stay excluded.
- GitHub isolated/legacy CI successful, PR merged to main, standalone Cloudflare deployment verified.
- Versioned memory archive and Gmail notice completed or explicit blocker reported.
current_phase: Code and deployment verified; real QQ persona behavior and fixed static message language awaiting user test.
current_step: User sends QQ test messages checking self-description, Simplified and casual/customer support.
completed_steps:
- Inspected current GitHub code and main 19ad8f937b4124da40ea33e6596688e350209283; created normal feature branch.
- Introduced exported CUSTOMER_SERVICE_PROMPT in standalone-qq-ai/role-router.js, replacing previous generic QQ AI/system strings; preserved fixed allowed tools/web search request, ASR/TTS paths and the original chat API.
- Extended test/qq-markdown.test.mjs for system prompt injection, Chinese script, truthful model disclosure only on direct question and customer service safeguards. Updated README.md.
- Tried writing static QQ fallback phrase replacements in worker.js; GitHub tool safety check BLOCKED the write. Did not bypass and did not modify worker.js; fixed fallback phrases may still be Traditional.
- PR #100 CI isolated 40090505572 SUCCESS; legacy QQ CI 40090505508 SUCCESS; merge main 17afc4ea71084cac4cd270312edf202b909fb864.
- Cloudflare independent qqaibot-unsloth deployed a958a3ad-9d21-498e-9f91-0b7bff4bec50 100%, readback confirms prompt strings, 4 secret_text, CONFIG_KV model role keys, existing QQ Webhook. Other production qqai not modified.
verification_results: CI and Cloudflare readback pass. Real QQ model compliance/entitlement not tested; prompts are best effort. Static message language remains an acknowledged partial gap.
known_failures: Blocked worker.js static-message modification; no bypass. Model may occasionally output Traditional despite instructions, no full CJK conversion engine.
blockers: None for deployment; user acceptance needed; future security-compliant repair for static QQ error strings if required.
next_exact_action: Owner sends a new QQ @ test '你会做什么？' and a Traditional-language question, then reports whether it responds in Simplified without unsolicited model-name disclosure.
resume_rule: Check main and deployed version before new changes; do not claim all static messages converted. Continue preserving image exclusion and four Secrets.
last_checkpoint_date: 2026-10-24
