# Ray_Chen Memory Entry

- memory_version: v0.0.25
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-full-command-panels-portal
- task_status: active
- goal_revision: 3
- base_product_revision: f44c8118c83e57637a6b0f55f0013ff093b2f1fc
- updated_at: 2026-09-28T17:10:00+08:00

## Current Goal

Correct group command discovery so ordinary group commands are present alongside management commands, and make Developer the top cumulative permission surface for all commands available in the current chat scope.

## Confirmed QQ Constraint

QQ group panels can be specific to groups, not to individual users inside a group. Therefore per-user Developer-only group-panel hiding is not representable by the official API; runtime authorization remains authoritative.

## Recovery Route

1. Read ACTIVE_TASK.md and CURRENT_STATE.md.
2. Continue on v4-qqopen-native.
3. Restore all group-scoped registry entries into categorized group panels, including ordinary and Developer commands.
4. Make Developer discovery cumulative across all permission classes for the current scope.
5. Run full CI before updating main and production.
