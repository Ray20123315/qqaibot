# ACTIVE_TASK

task_id: qqaibot-20260928-command-capability-fallback
task_status: completed
goal_revision: 1

## Goal

Restore the documented command/function surface on main and make legacy Bot execution a permission-checked fallback behind AIBot/QQ Open.

## Acceptance Results

- VERIFIED: QQ Open inbound commands still use the existing shared command/plugin pipeline.
- VERIFIED: V4 command catalog restored to 75 entries while preserving the original primary panel ordering.
- VERIFIED: QQ Open action is attempted first.
- VERIFIED: deterministic unsupported/unavailable official actions can fall back to OneBot.
- VERIFIED: ambiguous mutating 5xx failures do not cross-retry.
- VERIFIED: legacy group fallback resolves the numeric group and checks legacy Bot membership/role.
- VERIFIED: insufficient legacy permission returns a specific actionable message.
- VERIFIED: member-target legacy fallback requires confirmed OpenID <-> numeric QQ mapping.
- VERIFIED: auxiliary OneBot ingress remains suppressed from duplicate command ownership.
- VERIFIED: development and main CI suites pass.
- VERIFIED: Cloudflare production Connected Build for the final product revision succeeds.

## Product Revision

`fd11cd640cae1124edc03b0fef3d8d8d529cc52b`

## Verification Evidence

- development CI: run `36378926121` — success
- main CI: run `36379048954` — success
- production build: `53058046-38a3-4ecc-9fbd-581032693db5` — success
- main read-back: 75 command entries and representative restored aliases confirmed
- main read-back: fallback permission probe, member mapping and 5xx write safety guard confirmed

## Resolved Failures

- `d397a04d...`: V4 panel regression exposed primary panel ordering drift.
- `6049cacf...`: catalog repair attempt exposed a malformed module tail.
- Final repair `fd11cd640cae1124edc03b0fef3d8d8d529cc52b` resolved both; full CI is green.

## next_exact_action

Perform one live QQ smoke test using a restored command and one legacy-only group operation; if the latter reports insufficient legacy Bot permission, grant exactly the role named by the prompt and retry.

last_checkpoint_at: 2026-09-28T12:50:30+08:00
