# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-interaction-intent
task_status: active
goal_revision: 1

## Goal

Stop every QQ keyboard button from timing out by subscribing the Gateway to INTERACTION_CREATE events.

## Root Cause Evidence

- production wrangler.toml: QQ_OPEN_INTENTS=33554432
- runtime default: 1<<25 only
- verify-v4-hybrid-official explicitly rejects 100663296
- Tencent official SDK defines INTERACTION as 1<<26 and includes it in its default intents
- Tencent official keyboard callback flow: receive INTERACTION_CREATE -> promptly PUT /interactions/{id} with code 0
- current QQAIBOT already implements that ACK path, but the event is never delivered under the current intent mask

## Acceptance Criteria

- QQ_OPEN_INTENTS is 100663296 in production and V4 test configs.
- Runtime default contains both 1<<25 and 1<<26.
- Regression asserts INTERACTION intent is enabled.
- Existing message ingress remains enabled.
- Development/main CI pass.
- Production Connected Build succeeds.
- Live QQ Open Gateway reconnects successfully with the new intent mask.
- No 4014 permission failure occurs; if 4014 occurs, task becomes blocked on QQ platform permission rather than falsely completed.

## next_exact_action

Apply the intent-mask patch and validation updates.

last_checkpoint_at: 2026-09-29T09:55:00+08:00
