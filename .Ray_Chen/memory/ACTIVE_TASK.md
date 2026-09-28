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
- [x] Explicit User Persistence policy/facade with no platform fallback for user content.
- [x] User AI Provider real routing with live membership validation.
- [x] Political classifier + output guard integrated into plugin AI and main Worker AI paths.
- [x] AI Provider group/private-share controls exposed through QQ DM and Portal API.
- [ ] Integrate runtime plugin guard into active host/quarantine flow.
- [ ] Route concrete V4 memory/settings/chat/plugin writers through User Persistence facade.

Phase 2 — user surfaces
- [ ] Rebuild full V4 Portal with human-readable product UI.
- [ ] Developer-only hidden 00000 progressive reveal.
- [x] Standalone secure resource connection page with custom choices.
- [ ] Integrate resource management cards into main V4 dashboard.
- [ ] Plugin security review page modernization.

Phase 3 — Cloudflare/self-test
- [ ] Same-Worker preview with production storage isolation.
- [ ] Integrated regression/live preview validation.
- [ ] Fill official 2023 QQ self-test workbook after implementation verification.

current_phase: Phase 1
current_step: Commit and verify plugin runtime forced-stop/quarantine wiring.
completed_steps:
- c27821b247f3e8bdc35bf6987886b8c5855fcb60 passed GitHub Actions run 36385372063
verification_results:
- user AI route + live membership: success
- layered political input/output guard: success
- secure resource regression: success
- V3/V4/bundle: success
known_failures:
- none in current verified product state
blockers: []
next_exact_action: Commit prepared plugin runtime guard wiring, run full CI, then continue V4 Portal/resource UI.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:25:00+08:00
