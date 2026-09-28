# ACTIVE_TASK

task_id: qqaibot-20260928-full-command-panels-portal
task_status: active
goal_revision: 3

## Goal

Fix QQ group command discovery:
- group panels must include ordinary group commands, not only management commands;
- Developer is the top permission level and must see every command available in that scope;
- higher permissions add capabilities rather than replace lower-level commands.

## Acceptance Criteria

- Group discovery includes every enabled group-scoped registry command across member, group_ops, ai_admin, owner and developer permission classes.
- Representative ordinary group commands such as !help, !status, !codex, !模型, !群状态, !群规, !成员发言分析, !活动 and !投票 are present.
- Representative management commands remain present.
- Developer group commands such as !授权, !撤销授权, !禁记忆 and !群白名单 are present in group discovery.
- Developer-specific C2C discovery uses every permission class that has C2C commands, not only member + developer.
- Runtime authorization is unchanged and remains the security boundary.
- Full CI and production Connected Build succeed before completion.

## QQ Platform Limitation

For scope=group, target_type=specific accepts group_openids, not user_openids. The platform cannot express an individual Developer-only group panel. Developer commands in group discovery therefore remain runtime-authorized.

## next_exact_action

Patch group discovery and regression tests, then run full CI.

last_checkpoint_at: 2026-09-28T17:10:00+08:00
