# ACTIVE_TASK

task_id: qqaibot-20260928-full-command-panels-portal
task_status: completed
goal_revision: 3

## Goal

Make command discovery cumulative in the correct direction:
- ordinary group commands remain visible in group panels;
- management/owner/developer commands are additional;
- Developer is the top level and gets every command available in the current scope.

## Acceptance Results

- VERIFIED: every enabled `scope:"group"` command is present in categorized group discovery.
- VERIFIED: ordinary examples `!help`, `!status`, `!codex`, `!模型`, `!群状态`, `!群规`, `!成员发言分析`, `!活动`, `!投票` are present.
- VERIFIED: management examples `!禁言`, `!关闭ai`, `!授权AI踢出` remain present.
- VERIFIED: Developer group commands `!群白名单`, `!授权`, `!撤销授权`, `!禁记忆` are present.
- VERIFIED: Developer C2C discovery is generated from all permission classes, constrained only by command scope.
- VERIFIED: runtime permission checks are unchanged.
- VERIFIED: development CI `36403191041` succeeded.
- VERIFIED: main CI `36403381999` succeeded.
- VERIFIED: production build `005556b2-9747-4bb4-852c-e3157e5c7069` succeeded.

## Product Revision

`d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`

## Changed Product Files

- `src/v4/commands/registry.js`
- `src/v4/qqopen/discovery.js`
- `verify-v4-qqopen.mjs`

## next_exact_action

Open the QQ group command panel and confirm the ordinary categories and management/developer categories are all present after the next discovery sync.

last_checkpoint_at: 2026-09-28T17:27:00+08:00
