# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 1
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main.

## execution_plan

Phase 0 — branch/recovery gate
- [x] Recover Ray_Chen state and verify main head.
- [x] Create feature/v4-public-bot from exact main head.
- [x] Inspect implementation surfaces.

Phase 1 — core policy/runtime
- [x] Safe capability-first QQ Open -> OneBot fallback foundation.
- [x] Roles + legal consent/group-whitelist state foundation.
- [x] Membership-bound AI Provider access foundation.
- [x] Text-first political guard contract.
- [x] Runtime plugin boundary hook foundation.
- [x] Foundation full CI/bundle gate.
- [ ] Integrate authenticated BYOK endpoints and QQ private-message settings.
- [ ] Integrate provider live membership resolver into actual use.
- [ ] Integrate political input/classifier/output guard into AI path.
- [ ] Integrate runtime plugin guard into active host.

Phase 2 — user surfaces
- [ ] Rebuild V4 Portal with human-readable product UI.
- [ ] Developer-only hidden 00000 progressive reveal.
- [ ] Dual API-key entry UI/workflow.
- [ ] Plugin security review page.

Phase 3 — Cloudflare/self-test
- [ ] Same-Worker preview with production storage isolation.
- [ ] Integrated regression/live preview validation.
- [ ] Fill official 2023 QQ self-test workbook after implementation verification.

current_phase: Phase 1
current_step: Start BYOK/private-settings integration from verified foundation.
completed_steps:
- foundation commit 21e5a8f00daeb7e465ca927c6f1d6acfadfe1259
- GitHub Actions run 36379116271 completed success
verification_results:
- npm run check: success
- npm run check:v3: success
- npm run check:v4 including verify-v4-public-foundation.mjs: success
- npm run check:v4test: success
- npm run check:bundle: success
known_failures:
- prior connector orchestration limit was recovered safely with no partial branch commit
blockers: []
next_exact_action: Implement session-bound one-time BYOK token/API plus QQ DM settings workflow, reusing existing encrypted provider registry.
resume_rule: Re-run the same CI gate after every integration transaction; never touch main.
last_checkpoint_at: 2026-09-28T13:00:00+08:00
