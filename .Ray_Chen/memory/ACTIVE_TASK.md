# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main, including user-owned AI and persistence resources.

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
- [x] Authenticated dual-entry AI/resource onboarding.
- [x] Cloudflare D1/KV Storage Connector registry + low-volume REST client.
- [x] QQ private settings interception before general chat bridge.
- [x] Product resource integration CI/bundle gate for commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0.
- [x] Produce explicit User Persistence policy/facade with no platform fallback for user content.
- [ ] Verify persistence-policy CI/bundle for commit fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea.
- [ ] Integrate provider live membership resolver into actual AI routing.
- [ ] Route concrete V4 memory/settings/chat/plugin data writers through User Persistence facade.
- [ ] Integrate political classifier/output guard into AI path.
- [ ] Integrate runtime plugin guard into active host.

Phase 2 — user surfaces
- [ ] Rebuild full V4 Portal with human-readable product UI.
- [ ] Developer-only hidden 00000 progressive reveal.
- [x] Standalone secure resource connection page with custom choices.
- [ ] Integrate resource management cards into main V4 dashboard.
- [ ] Plugin security review page.

Phase 3 — Cloudflare/self-test
- [ ] Same-Worker preview with production storage isolation.
- [ ] Integrated regression/live preview validation.
- [ ] Fill official 2023 QQ self-test workbook after implementation verification.

current_phase: Phase 1
current_step: Verify persistence-policy commit, then wire concrete V4 user-content writers through the facade.
completed_steps:
- product resource commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0 passed CI run 36383716345
- persistence policy commit fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea produced
verification_results:
- resource onboarding/regression/bundle: success
- persistence-policy CI: pending
known_failures:
- prior connector orchestration limit was recovered safely with no partial branch commit
blockers: []
next_exact_action: Inspect GitHub Actions for fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea and fix failures before further integration.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:10:00+08:00
