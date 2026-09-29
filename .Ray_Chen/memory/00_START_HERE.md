# Ray_Chen Memory Entry

- memory_version: v0.0.39
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-interaction-timeout-fix
- task_status: active
- goal_revision: 1
- base_product_revision: 882970c516c7a753d65896c5135c6cac844fcdfd
- updated_at: 2026-09-29T09:55:00+08:00

## Current Goal

Fix every QQ inline-keyboard button timing out.

## Confirmed Root Cause

Production is explicitly bound to `QQ_OPEN_INTENTS=33554432`, which is only `GROUP_MESSAGES (1 << 25)`. Tencent's current official SDK defines button callbacks under `INTERACTION (1 << 26)`. Therefore the bot can render buttons but the gateway never receives `INTERACTION_CREATE`, cannot ACK it, and every click times out.

Required intent mask:
`(1 << 25) | (1 << 26) = 100663296`.

## Implementation Direction

- change production/test/default QQ Open intents to 100663296;
- update tests/docs/config guards that intentionally pinned 33554432;
- track configured/connected intents and force gateway reconnect when they differ so an old websocket cannot keep the stale subscription;
- preserve all existing keyboard payload, command handlers, permissions, cooldowns and Portal security work.

## next_exact_action

Patch intents/reconnect behavior and regression tests, then run full CI.
