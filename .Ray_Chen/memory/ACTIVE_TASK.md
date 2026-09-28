# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-slash-dispatch
task_status: active
goal_revision: 1

## Goal

Repair live QQ group panel clicks that currently send `/!面板 ...` and produce no bot response.

## Root Cause

The QQ client displays/sends a leading slash for panel commands. Before command routing, group member input is passed through `stripGroupAiOptOutPrefix`, where every `/!` prefix is intentionally treated as "skip AI". Therefore `/!面板 基础` becomes plain `面板 基础` with `aiReplyOptOut=true`, and `resolveGroupPanelInput` never matches it.

## Acceptance Criteria

- Panel slash normalization happens before group AI opt-out stripping.
- Only the reserved `/!面板` / `/！面板` route is normalized.
- `/!普通内容` continues to opt out of AI exactly as before.
- Category-only input returns child commands.
- Category + child expands to the existing canonical command handler.
- Existing direct commands and authorization paths are unchanged.
- V3/V4/full regression, isolated deployment check and bundle pass.

## next_exact_action

Implement reserved slash normalization in src/v4/commands/group-panel.js and worker.js, then add regression coverage.

last_checkpoint_at: 2026-09-29T03:48:00+08:00
