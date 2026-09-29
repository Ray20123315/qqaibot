# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-all-categories-direct-callback
task_status: active
goal_revision: 1

## Goal

Deliver the complete group keyboard behavior:
- no-argument/direct commands execute immediately;
- parameterized commands prefill the input and wait for user data;
- every group category renders buttons.

## Acceptance Criteria

- `help`, `status`, `群状态`, `群规`, toggles and other explicitly direct commands use reusable callback buttons.
- Direct buttons do not contain click_limit and do not depend on QQ group type=2 enter behavior.
- Parameterized commands use type=2 + enter=false + trailing-space data.
- Navigation buttons are reusable callbacks.
- Every non-empty category in GROUP_PANEL_CATEGORY_META builds at least one keyboard page.
- Every command enabled for a group category appears on exactly one category page.
- Every page has <=5 rows and <=2 command columns; navigation stays within limits.
- Regression sends/normalizes a keyboard payload for every category, not only 基础.
- Existing permissions, confirmations, cooldowns, slash-panel normalization, Portal switches and transport safety are unchanged.
- Development/main CI and production Connected Build succeed before completion.

## next_exact_action

Implement reusable direct callbacks and all-category keyboard coverage.

last_checkpoint_at: 2026-09-29T12:31:00+08:00
