# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 1
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main.

## acceptance_criteria

- QQ Open attempts supported full-message/context/moderation capabilities first; OneBot is automatic fallback only when capability is explicitly unavailable/denied.
- User-facing website contains human-readable product wording, not source/config jargon.
- Developer Mode is available only to server-authorized developer accounts and uses hidden 00000 progressive text reveal.
- AI API keys support both authenticated one-time secure-page entry and direct AIBot private-message entry; full secrets are never redisplayed.
- An AI Provider may share their configured AI only with groups they currently belong to; leaving a group revokes eligibility.
- AIBot private chat supports settings for all eligible users; AI private chat requires BYOK/authorized provider access and is not a public API proxy.
- Legal gate records agreement version separately from developer group whitelist override.
- Developer can enable/disable silent group whitelist from AIBot private chat; whitelist state is not announced in the group.
- Political content uses text prefilter first, then classifier for uncertain content, plus output guard.
- User plugins run with tenant/resource boundaries; global-risk behavior is terminated, quarantined and surfaced in a security-review page.
- Copyright notice is "Copyright © 2026 Ray Chen. All rights reserved." with source-available no-use terms.
- Cloudflare preview uses existing qqai Worker preview/version flow, not a second Worker.
- Main branch remains untouched.

## execution_plan

Phase 0 — branch/recovery gate
- [x] Recover Ray_Chen state and verify main head.
- [x] Create feature/v4-public-bot from exact main head.
- [x] Inspect V4/auth/plugin/provider/politics surfaces.

Phase 1 — core policy/runtime
- [x] Add safe capability-first QQ Open -> OneBot fallback foundation.
- [x] Add platform role/legal-consent/group-whitelist state module.
- [x] Add membership-bound AI Provider access foundation.
- [x] Add text-first political guard contract.
- [x] Add runtime plugin boundary/quarantine hook foundation.
- [ ] Integrate provider ownership/BYOK endpoints and QQ private-message settings.
- [ ] Integrate political classifier/output guard into AI send path.
- [ ] Integrate runtime plugin guard into active plugin host.

Phase 2 — user surfaces
- [ ] Rebuild V4 portal human-readable product shell.
- [ ] Implement developer-mode hidden 00000 interaction.
- [ ] Implement authenticated secure-page + QQ-DM BYOK onboarding.
- [ ] Add QQ-DM settings flows and plugin security center.

Phase 3 — Cloudflare/self-test
- [ ] Configure/verify same-Worker preview without production storage mutation.
- [ ] Run V4/full checks and repair regressions.
- [ ] Fill official 2023 QQ self-test report after implementation verification.

current_phase: Phase 1
current_step: Foundation transaction prepared; commit and CI verification are the current gate.
completed_steps:
- branch isolation and v0.0.20 checkpoint
- inspected existing provider registry, plugin governance/quarantine/security center, QQ Open legacy bridge and Portal
- reused existing D1-backed provider store and plugin security architecture instead of adding new storage products
- prepared safe capability fallback, access model, provider sharing model, political guard, runtime plugin guard and license update
files_created:
- src/v4/public/access.js
- src/v4/public/politics.js
- src/v4/hybrid/capability-router.js
- src/plugins/runtime-guard.js
- verify-v4-public-foundation.mjs
files_modified:
- src/ai/provider-registry.js
- src/core/permissions.js
- package.json
- .github/workflows/validate.yml
- LICENSE
- Ray_Chen memory files
files_pending:
- BYOK authenticated endpoint and DM workflow
- provider membership resolver integration
- portal redesign/developer mode
- plugin runtime wiring/security-review UI
- Cloudflare same-Worker preview
- self-test workbook
verification_results:
- source blobs prepared
- branch commit/CI pending
known_failures:
- first large connector orchestration hit per-call limit before creating a commit; Recovery Gate confirmed branch head remained 61acced3d9bd96ec54cc02f30cff239bef9873b6 and no product write landed
blockers: []
next_exact_action: Create one Git tree/commit from prepared blobs, move feature/v4-public-bot, then inspect GitHub CI.
resume_rule: Continue only on feature/v4-public-bot. Never fallback destructive QQ Open operations on unknown timeout/5xx outcomes.
last_checkpoint_at: 2026-09-28T12:45:00+08:00
