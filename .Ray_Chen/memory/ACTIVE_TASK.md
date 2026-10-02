# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 4

## Goal

Fix the live QQ category panel so `/!面板 <分类>` renders an actually clickable inline keyboard instead of a plain-text fallback.

## Acceptance Criteria

- VERIFIED development: inline keyboard reply uses `msg_type:0 + content + keyboard`.
- VERIFIED development: successful card copy excludes `备用文字`.
- VERIFIED development: fallback text is only emitted after a keyboard capability rejection.
- VERIFIED development: direct child commands remain `type=2 + enter=true`.
- VERIFIED development: parameterized child commands remain `type=2 + enter=false`.
- VERIFIED development: pagination remains a reusable clickable command.
- VERIFIED development: relationship and werewolf features remain retired.
- VERIFIED development CI: `36883833197` success.
- PENDING: main CI.
- PENDING: production Connected Build.
- PENDING_USER: live QQ render/click smoke.

## Product Files Changed

- src/v4/commands/group-panel.js
- src/v4/qqopen/runtime.js
- worker.js
- verify-v4-qqopen.mjs

## Current Phase

IN_PROGRESS — development repair validated; promotion to main is next.

## Blockers

None.

## next_exact_action

Promote the validated checkpoint to `main`, then verify main CI and Cloudflare Connected Build.

last_checkpoint_at: 2026-10-02T17:08:00+08:00
