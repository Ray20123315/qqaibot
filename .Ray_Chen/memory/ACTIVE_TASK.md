# ACTIVE_TASK
task_id: qqaibot-ai-rebuild-20261010
task_status: active
goal_revision: 3
goal: owner requests QQAIBOT never discuss politics; enforce on current Abot official AI and any future Bbot AI route
acceptance_criteria:
- Obvious political requests in Traditional Chinese, Simplified Chinese and English receive one neutral fixed refusal without LLM call.
- Reinforce provider system prompt with no-politics instruction; generated political output must be sanitized before sending and must not be persisted in conversation history.
- Unrelated technical, lifestyle, food and entertainment questions and !help/status should still work.
- Keep all existing QQ official Abot passive reply msg_id handling, Bbot optional bridge, API secrets, D1 schema, backups and quotas unchanged.
- Run full CI and Wrangler dry-run before non-force promotion to main, verify production source SHA and Cloudflare build.
current_phase: isolated feature branch implementation complete; CI pending
current_step: commit feature and run CI; repair failures, then promote main and verify production
completed_steps:
- Inspected live main a9c55b6ad8c87f02034752f9216720b0543fa85a and verified src/abot-ai.js official group mention route and src/assistant.js dormant Bbot AI route.
- Added src/topic-policy.js with neutral refusal, Chinese/English politics trigger detection, NFKC normalization and spaced-Chinese handling, output sanitizer and central system instruction. Conservative keyword heuristic, not perfect semantic classifier.
- Patched src/abot-ai.js to refuse obvious political input before model call, add system policy, replace any political output before send, never store such output or refused input in history.
- Patched src/assistant.js to refuse before Bbot quota and Gemini requests and suppress/persist no political output; same shared system policy.
- Added tests/political-policy.test.mjs, expanded Abot and Bbot AI regression tests for blocked input, blocked output, normal input, no model call, no storing political output.
- README and docs/DEPLOY describe behavior and keyword false-positive/false-negative limitations.
- Existing backup archive/bbot-ai-before-abot-20261010 SHA 8bc7427f85f23ab52935c2a83b87e7e2df909c14 and original archive/legacy-main-20261009 unchanged.
verification_results: feature CI pending; no live QQ model send to avoid disruption
known_risks:
- Keyword-based pre/post filter may miss coded politics, names not listed, euphemisms or block harmless quoted contexts. Model instruction helps but cannot guarantee perfect exclusion.
- Cross-group plugin forwards user messages as transport rather than generates AI replies; it is not censored by this restriction.
- QQ official group passive reply functionality remains platform-gated, real send unverified.
next_exact_action: trigger CI for feature/no-politics-guard-20261010; if green update main with expected sha, check Cloudflare deployment, update memory with evidence, generate archive and send one Gmail notification. Then user performs @AIBot political and non-political smoke test.
checkpoint_at: 2026-10-10T15:24:12.984Z
