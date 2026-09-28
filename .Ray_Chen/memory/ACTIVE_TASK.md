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
- Copyright notice becomes "Copyright © 2026 Ray Chen. All rights reserved." with source-available no-use terms consistent with public GitHub constraints.
- Cloudflare preview uses the existing qqai Worker preview/version flow, not a second Worker.
- Main branch remains untouched.

## hard_constraints

- No production merge/deploy.
- No raw secrets in Git, logs, Ray_Chen memory, diagnostics or normal UI.
- No implicit mapping between QQ OpenID and numeric QQ IDs.
- Destructive fallback must not double-execute after ambiguous timeout/unknown result.
- D1/KV scale should remain lean; add storage only when required.
- QQ platform privacy guide is platform-authored and is not modified by this task.

## execution_plan

Phase 0 — branch/recovery gate
- [x] Read current Ray_Chen canonicals from main.
- [x] Verify latest main head.
- [x] Create feature/v4-public-bot from exact main head.
- [ ] Inspect current V4/auth/plugin/provider/politics surfaces.

Phase 1 — core policy/runtime
- [ ] Add capability-first QQ Open/OneBot decision layer.
- [ ] Add roles and membership-bound AI sharing.
- [ ] Add consent/whitelist state model and political layered guard.
- [ ] Add plugin runtime guard/quarantine model.

Phase 2 — user surfaces
- [ ] Rebuild V4 portal language/interaction shell.
- [ ] Implement developer-mode hidden 00000 interaction.
- [ ] Implement BYOK secure-page + QQ-DM onboarding.
- [ ] Add QQ-DM settings flows and plugin security center.

Phase 3 — licensing/Cloudflare/self-test
- [ ] Replace licensing notice/terms.
- [ ] Configure/verify same-Worker preview workflow without production storage mutation.
- [ ] Add regression tests and run V4/full checks.
- [ ] Fill official 2023 QQ self-test report only after implementation verification.

current_phase: Phase 0
current_step: Inspect implementation surfaces before first product-code transaction.
completed_steps:
- recovered Ray_Chen memory v0.0.19 from main
- main head verified as 08ceeb725590d9efb0160ea38733d929e6e7d18c
- feature/v4-public-bot created from that exact commit
files_created: []
files_modified:
- .Ray_Chen/memory/00_START_HERE.md
- .Ray_Chen/memory/ACTIVE_TASK.md
- .Ray_Chen/memory/CURRENT_STATE.md
- .Ray_Chen/memory/USER_REQUIREMENTS.md
- .Ray_Chen/memory/DECISIONS.md
- .Ray_Chen/memory/FILE_MANIFEST.json
- .Ray_Chen/memory/MEMORY_VERSION.txt
files_pending:
- V4 runtime/policy/provider/plugin/portal files after inspection
commands_run:
- GitHub branch/read operations only
verification_results:
- branch creation succeeded
known_failures: []
blockers: []
next_exact_action: Inspect current authentication, AI provider, V4 runtime/portal, plugin governance and political filtering implementation on feature/v4-public-bot, then implement Phase 1 foundation.
resume_rule: Continue only on feature/v4-public-bot; re-check branch head and main divergence before each write transaction.
last_checkpoint_at: 2026-09-28T12:09:00+08:00
