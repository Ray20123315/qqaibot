# CURRENT_STATE

## Production

- main trigger revision: `5f40bf4ade906a0eae7aa555eac70225f054665e`
- verified product code: `668525a1db65402c8428cfa03930c8c77f255240`
- development CI: `36883833197` — success
- main CI: `36988176740` — success
- Cloudflare Connected Build: `e33665d0-549a-4926-a797-2add410f2dca` — success

## Deployed Keyboard Transport

- message type: `msg_type:0`
- body: `content + keyboard`
- no Markdown dependency
- successful card body excludes fallback command list
- fallback text is separate and used only after QQ rejects the keyboard
- keyboard failures log `QQ_OPEN_KEYBOARD_FALLBACK`

## Preserved Semantics

- direct command: `type=2 + enter=true + reply=false`
- parameterized command: `type=2 + enter=false`
- pagination: reusable command button
- no mandatory `click_limit`

## Live Result — 2026-10-02T17:50:41+08:00

- category routing: VERIFIED
- bot text reply: VERIFIED
- inline keyboard visibility: FAILED
- observed reply: `【群聊】请选择子指令` only
- explicit API-error fallback: NOT OBSERVED
- current inference: keyboard is being silently omitted after an otherwise successful message send

## Current Repair Implementation

Development commit `2dd39fc24d8d9d8c1d4a6402c6f716890bfa146e`:
- generated buttons now use the current Tencent SDK minimum fields: `id`, `render_data`, `action.type`, `action.permission`, `action.data`;
- direct buttons add only `action.enter=true`;
- parameterized buttons omit `enter` so the QQ default remains prefill/no auto-send;
- generated `group_id`, `unsupport_tips`, `reply:false`, and `enter:false` are removed;
- runtime normalization no longer re-injects those fields;
- exact payload regression assertions were added.

## Remaining State

- code compatibility repair: PRODUCED
- development CI: PENDING (no workflow run observed immediately after commit)
- main CI: pending
- production deployment: pending
- live QQ render/click after repair: pending
