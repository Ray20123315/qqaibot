# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main, including user-owned AI and persistence resources.

## execution_plan

Phase 0 — branch/recovery gate
- [x] isolated branch and recovery gate.

Phase 1 — core policy/runtime
- [x] capability-first QQ Open -> OneBot safe fallback.
- [x] roles/legal/whitelist state.
- [x] dual-entry BYOK AI and D1/KV resource onboarding.
- [x] user-persistence policy with no user-content fallback.
- [x] live-membership-bound user AI routing.
- [x] layered political input/output guard.
- [x] runtime plugin forced-stop/quarantine flow.
- [ ] route concrete V4 user-content writers through User Persistence facade.

Phase 2 — user surfaces
- [ ] apply and verify V4 Portal resource cards.
- [ ] apply and verify developer-only hidden 00000 progressive reveal.
- [ ] modernize plugin security review page.
- [ ] complete remaining human-readable Portal cleanup.

Phase 3 — Cloudflare/self-test
- [ ] same-Worker preview with production storage isolation.
- [ ] live preview validation.
- [ ] fill official 2023 QQ self-test workbook after implementation verification.

current_phase: Phase 2
current_step: Apply prepared Portal resource/developer-mode transaction.
completed_steps:
- plugin runtime security commit d38b42137053db3781ff48e4fad0afd22b172a8a
- GitHub Actions run 36385909059 success
verification_results:
- plugin runtime guard regression: success
- full repository regression: success
- V3/V4/V4-test/bundle: success
known_failures: []
blockers: []
next_exact_action: Commit Portal resource cards + developer 00000 gate and run CI.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:32:00+08:00
