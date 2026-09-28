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
- [x] Produce authenticated dual-entry AI/resource onboarding.
- [x] Produce Cloudflare D1/KV Storage Connector registry + low-volume REST client.
- [x] Produce QQ private settings interception before general chat bridge.
- [ ] Verify resource integration CI/bundle.
- [ ] Integrate provider live membership resolver into actual AI routing.
- [ ] Route selected V4 persistent data through user Storage Connector when configured.
- [ ] Integrate political classifier/output guard into AI path.
- [ ] Integrate runtime plugin guard into active host.

Phase 2 — user surfaces
- [ ] Rebuild full V4 Portal with human-readable product UI.
- [ ] Developer-only hidden 00000 progressive reveal.
- [x] Produce standalone secure resource connection page with custom choices.
- [ ] Integrate resource management cards into main V4 dashboard.
- [ ] Plugin security review page.

Phase 3 — Cloudflare/self-test
- [ ] Same-Worker preview with production storage isolation.
- [ ] Integrated regression/live preview validation.
- [ ] Fill official 2023 QQ self-test workbook after implementation verification.

current_phase: Phase 1
current_step: Run CI for product commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0 and repair any failures before wiring persistent data routes.
completed_steps:
- verified foundation commit 21e5a8f00daeb7e465ca927c6f1d6acfadfe1259
- product commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0 produced
- D1/KV connector uses Cloudflare current REST paths and encrypted API token storage
- QQ DM direct credential commands bypass general application bridge
- secure web entry requires existing qqai_session and one-time ticket
verification_results:
- source transaction produced
- CI for current product commit pending
known_failures:
- prior connector orchestration limit was recovered safely with no partial branch commit
blockers: []
next_exact_action: Read GitHub Actions run for 678d6a1d1eb21637fb8c542d90da54c590bce6d0; fix any failure before additional integration.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T13:55:00+08:00
