# Ray_Chen Memory Entry

- memory_version: v0.0.31
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-group-panel-keyboard
- task_status: active
- goal_revision: 1
- base_product_revision: b7f8dcba63c7e86cbcb3d7c82e4b64d27b2c840b
- updated_at: 2026-09-29T04:20:00+08:00

## Current Goal

Replace the plain-text group panel category reply with a QQ inline-keyboard button card. The root panel remains a compact category list; selecting a category should return clickable child-command buttons similar to the user's reference screenshot.

## Design

- two command buttons per row for normal pages;
- up to five rows per keyboard page;
- categories over ten commands paginate;
- button callback data is the existing canonical ! command;
- page navigation is handled through the same !面板 category router;
- existing runtime permissions, confirmations, cooldowns and feature switches remain authoritative;
- plain-text child list remains a fallback if QQ rejects keyboard capability.

## next_exact_action

Add category keyboard builder, structured Worker reply metadata, QQ Open keyboard send path and regression coverage.
