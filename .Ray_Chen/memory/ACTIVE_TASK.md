# ACTIVE_TASK

task_id: qqaibot-20260928-full-command-panels-portal
task_status: completed
goal_revision: 2

## Goal Revision 2

Fix privileged QQ discovery so higher permission never replaces lower-permission visibility. Developer-specific discovery must show ordinary commands plus Developer-only commands.

## Acceptance Results

- VERIFIED: Developer-specific C2C panels include ordinary commands such as `!help`, `!codex`, and `!QQ语音`.
- VERIFIED: the same panel set includes `!codexchat`, `!codexwork`, `!群白名单`, and `!重置`.
- VERIFIED: every C2C command with permission `member` or `developer` and panel discovery enabled appears in the Developer-specific set.
- VERIFIED: discovery uses QQ's official maximum of 20 panels instead of the previous internal 10-panel cap.
- VERIFIED: development CI `36400632740` succeeded.
- VERIFIED: main CI `36400793446` succeeded.
- VERIFIED: production build `e5270c67-4c0e-4eaf-9d1a-3d5feb95cdd5` succeeded.

## Product Revision

`f44c8118c83e57637a6b0f55f0013ff093b2f1fc`

## Changed Product Files

- `src/v4/qqopen/discovery.js`
- `verify-v4-qqopen.mjs`

## next_exact_action

Perform one live QQ check with a configured Developer OpenID and confirm ordinary and Developer-only commands are visible together.

last_checkpoint_at: 2026-09-28T17:02:00+08:00
