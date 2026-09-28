# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-hierarchy
task_status: active
goal_revision: 4

## Goal

Make the QQ group command panel usable in the real client:
- ordinary functions must not disappear;
- Developer must retain access to the full command surface;
- do not rely on multiple group panels being merged by the client;
- preserve all existing command handlers and permissions.

## Acceptance Criteria

- Discovery creates exactly one managed scope=group panel.
- That panel contains <=20 functional category roots.
- Categories cover every enabled group-scoped registry command.
- Syntax `!面板 <分类> <子指令> [参数]` expands to the existing canonical command, e.g. `!面板 基础 help` -> `!help`, `!面板 群操作 禁言 ...` -> `!禁言 ...`, `!面板 开发者 codexwork ...` -> `!codexwork ...`.
- Sending only a category root returns its child-command list.
- Runtime permission checks remain unchanged.
- Existing direct commands remain valid.
- C2C menu remains native nested submenu discovery.
- Full CI and production deployment succeed.

## Confirmed Official Constraint

QQ group panels have at most 20 items and PanelItem has no nested submenu field. Multiple panel resources must not be treated as an in-client nested hierarchy.

## next_exact_action

Implement group-panel helper, Worker category routing, single group-panel sync, and regression tests.

last_checkpoint_at: 2026-09-29T03:40:00+08:00
