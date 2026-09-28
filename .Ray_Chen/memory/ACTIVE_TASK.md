# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-payload-fix
task_status: active
goal_revision: 1

## Goal

Make the live QQ client render the inline keyboard instead of falling back to the plain child-command text.

## Live Evidence

The QQ client showed:
- category fallback text;
- no inline buttons.

That means the keyboard branch executed, QQ rejected the keyboard write with a deterministic error, and the runtime text fallback succeeded.

## Acceptance Criteria

- Keyboard button action includes `permission:{type:2}` and `click_limit`.
- Keyboard button includes stable `group_id`.
- Runtime normalization preserves/defaults those official fields.
- Keyboard replies use `msg_type:2` plus `markdown:{content:...}`, matching Tencent's official SDK E2E pattern.
- Passive keyboard replies retain `msg_id` and `msg_seq`.
- Interaction keyboard replies retain `event_id`.
- Deterministic keyboard rejection records a dedicated diagnostic state instead of being silently hidden.
- Plain-text fallback remains available only for deterministic 4xx capability/validation failures.
- Existing direct commands and runtime permissions remain unchanged.
- Full CI and production Connected Build succeed before completion.

## next_exact_action

Implement official keyboard DTO/message shape and add regression coverage.

last_checkpoint_at: 2026-09-29T05:25:00+08:00
