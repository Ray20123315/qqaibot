# Ray_Chen Memory Entry

- memory_version: v0.0.26
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-full-command-panels-portal
- task_status: completed
- goal_revision: 3
- product_revision: d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a
- updated_at: 2026-09-28T17:27:00+08:00

## Completed Goal

QQ group command discovery now contains the full group-scoped command surface instead of only management commands. Developer is the top cumulative permission level: in any scope, Developer discovery includes every command enabled for that scope.

## QQ Platform Constraint

For group panels, target_type=specific associates a panel with group_openids, not individual user_openids. QQ cannot express a Developer-only panel for one person inside a group. Therefore group discovery contains all group-scoped commands, while runtime authorization remains the security boundary.

## Verified State

- ordinary group commands are present together with management commands;
- Developer commands are present in group discovery;
- Developer C2C discovery uses all permission classes for C2C-capable commands;
- development CI 36403191041: success;
- main CI 36403381999: success;
- production Connected Build 005556b2-9747-4bb4-852c-e3157e5c7069: success.
