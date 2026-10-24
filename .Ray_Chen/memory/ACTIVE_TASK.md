# ACTIVE_TASK
task_id: unsloth-qq-secret-only-20261024
task_status: blocked
goal_revision: 4
goal: Change standalone QQ Unsloth Worker so Unsloth API Key lives exclusively in Cloudflare Worker Secret; admin web can list, select and save a model ID.
acceptance_criteria:
- No API key accepted via web; only env.UNSLOTH_API_KEY. KV stores selected model ID alone.
- Keep ADMIN_TOKEN auth, fixed upstream, command/tool execution disabled and QQ worker separate from original.
- Test and merge main; deploy to independent Cloudflare Worker with same-zone public route flag and preserve existing bindings.
- Real model and QQ tests only after operator secrets.
current_phase: GitHub PR #87 merged and Worker deployed/verified; missing user-provided secrets prevent end-to-end.
current_step: User creates UNSLOTH_API_KEY Worker Secret and converts existing ADMIN_TOKEN plain_text to Secret.
completed_steps:
- User verified local /v1/models HTTP 200; public without key HTTP 401; public with valid Bearer HTTP 200 listing lilcheaty/flint-abliterated-GGUF.
- Inspected Cloudflare bindings and empty dedicated CONFIG_KV key list.
- Updated worker.js, model-config.js, model-config.test.mjs, README.md and wrangler.toml in PR #87.
- CI 40075035673 isolated and 40075035664 original QQ both SUCCESS. Main merged 500c7689c199dc5db33f91146dc6e7c78f05f2fd.
- Deployed Cloudflare version 678a0b74-800b-47ea-9efe-868fd7e551f0 at 100%; verified global_fetch_strictly_public, ADMIN_TOKEN and CONFIG_KV bindings.
verification_results: GitHub CI pass; Cloudflare script PUT/API settings readback/deploy 100% pass. Public URL web fetch tool unavailable. Actual Worker model request and QQ events unverified. UNSLOTH_API_KEY absent; ADMIN_TOKEN binding is plain_text.
blockers: Operator must configure API Secret/upgrade ADMIN_TOKEN to Secret; QQ_APP_ID and QQ_APP_SECRET needed later; actual Worker model list not tested.
next_exact_action: Set UNSLOTH_API_KEY as Secret (not Plain Text) in qqaibot-unsloth, re-add ADMIN_TOKEN as Secret, open admin web and click 取得模型清單; select model and test.
resume_rule: Check main and Worker deployment before changing anything; never alter original qqai or commit credentials.
last_checkpoint_date: 2026-10-24
