# ACTIVE_TASK

task_id: qqaibot-20261001-panel-normal-message-send
task_status: active
goal_revision: 1

## Goal

Make QQ group keyboard direct commands generate normal QQ message events while keeping parameterized commands editable, without touching main during the user's current main-line testing.

## Acceptance Criteria

- VERIFIED: direct/no-argument buttons use action.type=2 with enter=true.
- VERIFIED: parameterized/target/content buttons use action.type=2 with enter=false and preserve trailing-space prefill.
- VERIFIED: pagination uses action.type=2 with enter=true.
- VERIFIED: click_limit remains absent from normal buttons.
- VERIFIED: existing command metadata remains the source of direct-vs-parameterized classification.
- VERIFIED: repository, V3, V4 QQ Open, isolated V4 test-deployment and bundle checks pass.
- VERIFIED: main is unchanged.
- NEEDS_REVIEW: live QQ client smoke test confirms direct buttons are actually sent and produce normal Bot replies.

## Hard Constraints

- Do not use callback-only execution as a substitute for direct commands.
- Do not merge or fast-forward main while the user is testing latest main.
- Preserve existing permissions, confirmations, cooldowns, routing and fallback behavior.
- Do not convert parameterized commands into immediate sends.

## Current Phase

live_validation

## Current Step

Product patch and automated verification are complete on `fix/qq-panel-message-send-20261001`; live QQ behavior is the remaining gate.

## Execution Plan

1. PRODUCED: replace callback direct buttons with type=2 normal-command buttons.
2. PRODUCED: update regression expectations.
3. VERIFIED: run full GitHub validation.
4. IN_PROGRESS: package updated Ray_Chen memory and notify the user.
5. NEEDS_REVIEW: run a real QQ client smoke test before any main update.

## Files Modified

- src/v4/commands/group-panel.js
- verify-v4-qqopen.mjs
- .github/workflows/validate.yml
- .github/workflows/ray-chen-memory-package.yml
- .Ray_Chen/memory/*

## Verification Results

- GitHub Actions run 36796984396: success.
- Main branch base remains `a1c19cf0d732fd576000c8ecb2753facf38c51e8`.
- Local sandbox clone attempt was blocked by sandbox DNS; GitHub Actions supplied the authoritative automated verification instead.

## Known Risks

- Some QQ group clients historically ignored `enter=true` and only inserted the command into the input box.
- Callback execution is intentionally not accepted as a fallback for direct commands because it does not produce the normal user-message event required by the Bot path.

## Next Exact Action

Smoke-test `help` and `status` on a real QQ client using this branch's test deployment/path; only after that should main be considered for update.

## Resume Rule

Read 00_START_HERE.md, ACTIVE_TASK.md, CURRENT_STATE.md and FILE_MANIFEST.json, then verify the branch head and GitHub Actions status before modifying anything.
