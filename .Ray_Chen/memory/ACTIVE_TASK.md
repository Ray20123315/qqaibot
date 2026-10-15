# ACTIVE_TASK
task_id: qqaibot-full-upgrade-20261015
task_status: active
goal_revision: 1
goal: Upgrade existing QQAIBOT compatibly across Gemini/Luna routing, quotas, isolated Agent, legacy prompts, activities, voting, developer-only Sol/Max, web portal and QQ transports.
acceptance_criteria: All 17 user criteria in 2026-10-15 complete upgrade request, preserving Abot/Bbot/D1/Vectorize/GUI/QQ bindings and manual /跨群 routing; safe non-destructive D1 migrations; no production writes without permission.
hard_constraints: Do NOT merge/push to main, deploy production, modify live D1 data or emit live QQ traffic in this task; no group agent file/shell tools without verified VM isolation.
current_phase: Phase 1 code verification and memory packaging on draft PR #81.
current_step: Verify latest CI after memory update; deliver memory package and final incremental progress.
execution_plan:
1. Read main, legacy archive, Ray_Chen memory and tests; record compatibility risks.
2. Phase 1: make Gemini primary, remove daily Gemini cap, keep idempotency and short-term rate gate, add tests.
3. Phase 2: verify QQ identity mapping; implement controlled Luna quota/fallback with global concurrency DO; implement hard Agent isolation.
4. Phase 3: restore valid legacy social persona and Portal without reintroducing deprecated features.
5. Phase 4: activity and feature lab plugins with atomic D1 operations, permissions, QQ+web.
6. Phase 5: controlled Max/Sol; staging, integration, migration tests and authorized release.
completed_steps:
- Confirmed main head 78d7a8b252cbd12a44599e8c93e1462a524de4a6 and original memory v0.0.108; located archive/legacy-main-20261009.
- Read main model/assistant/abot/Core/DO paths, test suite and selected legacy worker imports; identified stripped main Portal and unsafe old Codex preference.
- Branch feature/qqaibot-upgrade-phase1-20261015 and draft PR #81 created; code update in src/codex-bridge.js, src/abot-ai.js, src/assistant.js.
- Tests added/updated to verify Gemini primary when Bridge online and no daily cap with short burst blocking.
- First GitHub CI 38728955414 FAIL (outdated Bridge-first test), test fixed; subsequent run 38729107874 SUCCESS with npm check.
- Added safe additive schema migration file and staged implementation plan; no D1 migration run.
files_created: tests/gemini-default-routing.test.mjs, migrations/20261015_001_abot_ai_rate_limit.sql, docs/QQAIBOT_UPGRADE_PLAN_20261015.md
files_modified: src/codex-bridge.js, src/abot-ai.js, src/assistant.js, tests/abot-ai.test.mjs, tests/compact-codex-memory.test.mjs, .Ray_Chen/memory/*, .github/workflows/bridge-check.yml
files_pending: Phase 2–5 code; no backend Portal API changes yet.
verification_results: GitHub CI 38729107874 SUCCESS before docs/memory updates; production D1, QQ, Windows GUI and Agent isolation untested.
blockers: Existing main has no full Portal. Live D1 schema/mapping unknown; hard Agent isolation not yet designed/verified; live QQ /跨群 bindings stopped. No permission to deploy.
next_exact_action: Design and validate group-independent canonical QQ identity mapping plus atomic Luna personal quota before any fallback/Agent activation.
resume_rule: Check latest feature branch/PR SHA, code CI and memory archive; never assume staged code is deployed or that historic stopped QQ bindings have resumed.
last_checkpoint_date: 2026-10-15
