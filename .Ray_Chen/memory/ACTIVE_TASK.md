# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-keyboard
task_status: active
goal_revision: 1

## Goal

Make `!面板 <分类>` reply with a clickable QQ button grid rather than a plain child-command string.

## Acceptance Criteria

- Category-only group-panel command returns structured inline keyboard metadata.
- Normal category pages use two buttons per row and at most five rows.
- Categories over ten commands have previous/next page buttons without exceeding QQ keyboard limits.
- Command buttons use callback data beginning with the existing canonical `!` command so INTERACTION_CREATE reuses the existing handler.
- Group and C2C QQ Open send paths can attach the keyboard payload.
- Keyboard send failures only fall back to text for deterministic client/capability errors, never ambiguous 5xx/timeouts.
- Existing direct commands and `/!普通内容` semantics remain unchanged.
- Full CI passes before promotion to main.

## next_exact_action

Implement group category keyboard + QQ Open structured reply transport, then run regressions.

last_checkpoint_at: 2026-09-29T04:20:00+08:00
