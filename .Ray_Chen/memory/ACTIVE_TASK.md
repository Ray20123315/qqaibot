# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 4

## Goal

Fix the live QQ category panel so `/!面板 <分类>` produces an actually clickable inline keyboard instead of only fallback text.

## Acceptance Criteria

- The live QQ client renders clickable buttons for retained categories.
- The primary panel reply payload uses plain text `msg_type:0 + content + keyboard`, not forced Markdown.
- Direct child commands remain `type=2 + enter=true`.
- Parameterized child commands remain `type=2 + enter=false`.
- Pagination remains clickable.
- Plain text fallback remains only an emergency fallback after a real keyboard send failure.
- Relationship and werewolf features remain retired.
- Development CI, main CI and production Connected Build must pass.
- Final live QQ retest is required before task completion.

## Current Phase

IN_PROGRESS — live smoke failed; transport repair not yet implemented.

## Blockers

None.

## next_exact_action

Modify QQ Open keyboard send payloads and regression tests on `v4-qqopen-native`.

last_checkpoint_at: 2026-10-01T23:14:00+08:00
