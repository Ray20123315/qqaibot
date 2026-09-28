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

## Product Patch

Current product revision: `a31a9dd6c79963001df95cb53f6e2654af8c2606`

Changed:
- `src/v4/commands/group-panel.js`: two-column button-card builder, pagination, callback data.
- `worker.js`: category-only panel replies include structured `qq_inline_keyboard`.
- `src/v4/qqopen/runtime.js`: sends keyboard payloads on group/C2C replies and callback interactions; deterministic 4xx capability failures may fall back to text.
- `verify-v4-qqopen.mjs`: keyboard payload, pagination and transport regressions.

## next_exact_action

Wait for development CI on `a31a9dd6c79963001df95cb53f6e2654af8c2606`; fix any real regression before promoting to main.

last_checkpoint_at: 2026-09-29T04:31:00+08:00
