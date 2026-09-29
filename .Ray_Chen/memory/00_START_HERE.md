# Ray_Chen Memory Entry

- memory_version: v0.0.39
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-interaction-intent
- task_status: active
- goal_revision: 1
- base_product_revision: 882970c516c7a753d65896c5135c6cac844fcdfd
- updated_at: 2026-09-29T09:55:00+08:00

## Current Goal

Fix QQ inline-keyboard clicks timing out for every button.

## Verified Root Cause

Production explicitly uses QQ_OPEN_INTENTS=33554432 (1<<25, GROUP_AND_C2C_EVENT) and does not subscribe to INTERACTION (1<<26). Tencent's current official SDK includes INTERACTION in its default intent set and requires INTERACTION_CREATE to ACK keyboard callbacks. Without that intent, buttons render but every click times out because the Bot never receives the callback event.

## Planned Fix

- change production/test/example QQ_OPEN_INTENTS to 100663296 = (1<<25) | (1<<26);
- update runtime default intent mask accordingly;
- replace regressions that intentionally forbid Interaction;
- deploy first to development/test validation;
- after main promotion, verify Gateway remains connected and no 4014 occurs;
- if Gateway returns 4014, record that QQ Developer Console has not granted Interaction and stop rather than masking the platform permission failure.

## next_exact_action

Patch intent configuration/runtime/tests/docs, run full CI, then promote and validate live Gateway.
