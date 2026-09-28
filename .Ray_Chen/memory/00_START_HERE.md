# Ray_Chen Memory Entry

- memory_version: v0.0.29
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-group-panel-slash-dispatch
- task_status: active
- goal_revision: 1
- base_product_revision: 6bcdb255f90e822ec68fec6cdc971cd292150802
- updated_at: 2026-09-29T03:48:00+08:00

## Current Goal

Fix the live QQ group command panel command dispatch. QQ renders/sends group panel commands with a leading slash, e.g. `/!面板 基础`. The existing group opt-out syntax also uses `/!`, so panel commands are currently stripped as AI opt-out before the group-panel router can see them.

## Required Behavior

- `/!面板 基础` must be normalized to `!面板 基础` and return the category child list.
- `/!面板 基础 help` must expand to the existing `!help` handler.
- The normalization is reserved to the `面板` router; ordinary manual `/!普通内容` must keep its existing "bypass AI" behavior.
- Existing direct `!` commands, permissions, confirmations, cooldowns and Portal switches remain unchanged.

## Recovery Route

1. Read ACTIVE_TASK.md.
2. Patch the group-panel helper and Worker input normalization before `stripGroupAiOptOutPrefix`.
3. Add regression coverage for slash-prefixed panel commands and preservation of ordinary `/!` opt-out.
4. Run full CI, update main only after success, then verify production.
