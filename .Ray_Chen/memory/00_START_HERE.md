# Ray_Chen Memory
version: v0.0.121
task_id: qq-customer-service-simplified-20261024
task_status: completed
goal_revision: 11
canonical_branch: main
verified_code_commit: 17afc4ea71084cac4cd270312edf202b909fb864
updated_at: 2026-10-24

## Quick resume
- Latest user requirement: independent QQ AI assistant acts as a customer-service helper AND natural chat partner, always responds in Simplified Chinese, and must NOT proactively disclose its base model, provider, version or quantization. Do not pretend to be a human, fabricate order/refund/entitlement actions or customer-service policies. If explicitly asked about the underlying model, answer truthfully if known; no deception.
- PR #100 main 17afc4ea71084cac4cd270312edf202b909fb864: changed standalone-qq-ai/role-router.js customer-service system persona, test/qq-markdown.test.mjs to verify injected instructions/compatibility, README.md docs.
- GitHub isolated CI 40090505572 SUCCESS; original AI CI 40090505508 SUCCESS. Deployment only to separate Cloudflare qqaibot-unsloth version a958a3ad-9d21-498e-9f91-0b7bff4bec50 at 100%. Strict inherited 4 Secret bindings and CONFIG_KV, previous model roles and QQ webhook readback verified; production legacy qqai untouched.
- Attempt to edit hardcoded QQ fallback/command responses in standalone-qq-ai/worker.js was blocked by platform security check. No bypass. So static legacy responses may remain Traditional Chinese. Model-generated Chinese remains best-effort via prompt, not deterministic transliteration; live reply not yet observed.
- Existing Unsloth every-message web_search attempt, QQ native Markdown/fallback, ASR/TTS role settings and image exclusion unchanged.
- NEXT: owner send QQ @ bot '你会做什么？' and a question in Traditional Chinese, inspect that response is natural customer/chat assistant using Simplified and does not voluntarily mention model. Provide sample if noncompliant.
