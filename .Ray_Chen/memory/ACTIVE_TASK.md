# ACTIVE_TASK

task_id: qqaibot-20260928-command-capability-fallback
task_status: active
goal_revision: 1

## Goal

Make main commands effective again while preserving QQ Open as the primary AIBot transport. Restore the documented command catalog and use the legacy Bot only as a permission-checked execution fallback for capabilities that QQ Open cannot safely execute.

## Acceptance Criteria

- QQ Open inbound commands continue through the existing command/plugin pipeline.
- Documented command families missing from V4 discovery are restored.
- Official QQ Open action is attempted first.
- Legacy fallback is limited to deterministic unsupported/permission/not-configured/rate-limit conditions or safe read operations.
- Mutating group fallback resolves the numeric OneBot group and verifies legacy Bot membership/role.
- Insufficient legacy permission returns an actionable permission request.
- Legacy member targets require a numeric or confirmed mapped QQ identity.
- No duplicate command execution from both ingress transports.
- Full CI and Worker bundle validation pass before main is updated.

## Hard Constraints

- Keep QQ_HYBRID_PRIMARY=qq-open.
- Keep OneBot/NapCat auxiliary except for controlled action fallback.
- Never retry ambiguous mutating QQ Open failures through OneBot.
- Preserve ONEBOT_READ_ONLY where enabled.
- Do not store secrets.

## Execution Plan

### Phase 1 — VERIFIED
- Recovered v0.0.19 and current main/dev baseline 08ceeb725590d9efb0160ea38733d929e6e7d18c.
- Confirmed the missing action fallback and the reduced V4 command catalog.

### Phase 2 — IN_PROGRESS
- Add safe group/member mapping needed for legacy fallback.
- Add direct OneBot fallback plus action-specific Bot role checks.
- Expand V4 command discovery/catalog.
- Add regression coverage.

### Phase 3 — PLANNED
- Commit product changes to v4-qqopen-native.
- Verify full GitHub Actions validation and repair failures.
- Fast-forward main only after success.

### Phase 4 — PLANNED
- Reconcile final Ray_Chen memory and verification evidence.
- Create and verify the next TAR.GZ memory package.
- Send one Gmail notification to ray20123315@gmail.com.

## next_exact_action

Implement product changes on v4-qqopen-native, then run full repository CI before updating main.

last_checkpoint_at: 2026-09-28T12:25:00+08:00
