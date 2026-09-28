# Ray_Chen Memory Entry

- memory_version: v0.0.37
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-payload-fix
- task_status: active
- goal_revision: 1
- base_product_revision: f74d6ecec99c9dde04ef97ce0a7452b42ad6bcf7
- updated_at: 2026-09-29T05:25:00+08:00

## Current Goal

Fix the live QQ inline-keyboard payload. The real QQ client currently shows only the text fallback, proving that the keyboard write is being rejected before rendering.

## Root Cause Hypothesis Confirmed Against Tencent SDK

The current payload omits fields serialized by Tencent's official SDK:
- action.permission
- action.click_limit
- button.group_id

The current runtime also sends keyboard replies as msg_type=0 text, while Tencent's current SDK end-to-end keyboard example sends msg_type=2 Markdown with keyboard attached.

## Required Behavior

- Serialize keyboard buttons in the current official SDK shape.
- Send keyboard replies as Markdown message bodies while retaining msg_id/msg_seq passive-reply semantics.
- Keep deterministic 4xx fallback to text, but persist the keyboard rejection code/reason for diagnostics.
- Do not alter the existing command handlers, permissions, confirmations, cooldowns, slash-panel normalization, or TEMP-admin hotfix.

## next_exact_action

Patch group-panel keyboard button shape, runtime keyboard normalization/message body, and regression tests; then run full CI.
