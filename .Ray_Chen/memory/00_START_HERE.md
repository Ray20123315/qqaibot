# Ray_Chen Memory Entry

- memory_version: v0.0.20
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-command-capability-fallback
- task_status: active
- goal_revision: 1
- base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- updated_at: 2026-09-28T12:25:00+08:00

## Current Goal

Restore the full documented command surface on the QQ Open AIBot path and add a conservative capability-aware legacy OneBot fallback.

## Confirmed Root Causes

- QQ Open inbound commands already reach the existing command pipeline through /v4/qqopen/process.
- QQ Open actions currently throw instead of falling back when an official action is unsupported or deterministically unavailable.
- The V4 command catalog exposes only 20 commands while !help documents a substantially larger active surface.
- Existing hybrid mapping resolves groups, but does not retain member OpenID -> numeric QQ identity needed by some legacy-only member actions.

## Safety Invariants

- QQ Open remains the single primary inbound owner.
- OneBot fallback occurs inside one AIBot command execution only after official capability evaluation.
- Never cross-retry an ambiguous mutating QQ Open timeout/5xx result.
- Preserve ONEBOT_READ_ONLY when it is explicitly enabled.
- Never send group_openid/member_openid directly to NapCat numeric group/user parameters.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, USER_REQUIREMENTS.md, DECISIONS.md, GOTCHAS.md and VERIFY.md.
2. Continue implementation on v4-qqopen-native.
3. Run the full repository CI; only after success may main be fast-forwarded.
4. Reconcile final memory, package the next version, and send the required Gmail notification.
