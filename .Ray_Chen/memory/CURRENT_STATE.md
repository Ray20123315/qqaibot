# CURRENT_STATE

## Development

- branch: `v4-qqopen-native`
- verified product revision: `668525a1db65402c8428cfa03930c8c77f255240`
- CI: `36883833197` — success

## Fixed Behavior

- inline keyboard card: `msg_type:0 + content + keyboard`
- no Markdown dependency for command-panel keyboard cards
- successful card body: title/prompt only
- emergency fallback copy: separate metadata, used only after a QQ keyboard capability error
- diagnostic marker on fallback: `QQ_OPEN_KEYBOARD_FALLBACK`

## Preserved Button Semantics

- direct command: `type=2 + enter=true + reply=false`
- parameterized command: `type=2 + enter=false`
- pagination remains reusable
- no mandatory `click_limit`

## Production

- current main still at pre-repair checkpoint: `080bfe7f0a8e2b8fb6686515ea2a5c914a8fb183`
- main promotion: PENDING
- main CI: PENDING
- Cloudflare production Connected Build: PENDING
- live QQ retest: PENDING_USER
