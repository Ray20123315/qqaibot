# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: blocked
goal_revision: 4

## Goal

Fix the live QQ category panel so `/!面板 <分类>` renders an actually clickable inline keyboard instead of a plain-text fallback.

## Acceptance Criteria

- VERIFIED code/transport: keyboard card uses `msg_type:0 + content + keyboard`.
- VERIFIED code/transport: successful card excludes `备用文字`.
- VERIFIED code/transport: fallback copy is selected only after a keyboard capability rejection.
- VERIFIED code/transport: direct child commands remain `type=2 + enter=true`.
- VERIFIED code/transport: parameterized child commands remain `type=2 + enter=false`.
- VERIFIED code/transport: pagination remains reusable/clickable.
- VERIFIED: development CI `36883833197` success.
- VERIFIED: main CI `36988176740` success.
- VERIFIED: Cloudflare Connected Build `e33665d0-549a-4926-a797-2add410f2dca` success.
- BLOCKED/PENDING_USER: live QQ must actually display and allow clicking the buttons.

## Product Files Changed

- src/v4/commands/group-panel.js
- src/v4/qqopen/runtime.js
- worker.js
- verify-v4-qqopen.mjs

## Blocker

The automated environment cannot observe the QQ mobile/desktop client's rendered keyboard. User live smoke is required.

## next_exact_action

User sends `/!面板 群聊` in QQ and reports whether clickable buttons render.

last_checkpoint_at: 2026-10-02T17:12:00+08:00
