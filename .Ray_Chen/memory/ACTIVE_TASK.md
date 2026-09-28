# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-keyboard
task_status: active
goal_revision: 1

## Goal

Deploy clickable QQ button cards for group command categories while preserving the newer Portal temporary-admin security fix already present on main.

## Implemented Keyboard Behavior

- two command buttons per row;
- at most five rows;
- categories over ten commands paginate;
- command buttons send canonical existing ! commands;
- page navigation uses the same !面板 router;
- QQ Open passive replies and interaction replies can carry inline keyboard payloads;
- deterministic 4xx keyboard capability failures may fall back to text;
- ambiguous 5xx/timeouts are not resent through a fallback write.

## Integration Checkpoint

- newest main before merge: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- keyboard branch before merge: `d4ae8580ff28c7cc7a88d888b2ea0a65c6a55f0f`
- integration commit: `af4b743fec796cc071aafce3559f66c2ae7c9a50`
- merge is non-destructive and has two parents
- Portal temporary-admin and D1 auth-rate-limit fallback from main are preserved
- integration CI: pending

## Acceptance Criteria

- system-admin auth tests still pass;
- keyboard V4 regression still passes;
- repository/V3/V4/isolation/bundle checks all pass;
- main updates without force;
- production Connected Build succeeds.

## next_exact_action

Validate integration commit `af4b743fec796cc071aafce3559f66c2ae7c9a50` on v4-qqopen-native.

last_checkpoint_at: 2026-09-29T04:47:00+08:00
