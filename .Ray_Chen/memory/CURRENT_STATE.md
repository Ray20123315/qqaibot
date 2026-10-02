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

## Remaining State

- code: VERIFIED
- development CI: VERIFIED
- main CI: VERIFIED
- production deployment: VERIFIED
- live QQ render/click: BLOCKED / PENDING_USER
