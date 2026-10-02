# VERIFY

## Goal Revision 4 — Development Evidence

- product revision: `668525a1db65402c8428cfa03930c8c77f255240`
- development CI: `36883833197` — success
- regression checks: success
- V3 regression checks: success
- V4 QQ Open regression checks: success
- isolated deployment checks: success
- Worker bundle: success

## Payload Invariants

For a keyboard card:
- `msg_type === 0`
- `content` is present
- `keyboard.content.rows` is present
- `markdown` is absent
- ordinary message replies retain `msg_id` / `msg_seq`
- interaction replies retain `event_id`

## UX Invariants

- normal successful card does not show `备用文字`
- emergency fallback copy exists separately
- fallback copy is selected only after a keyboard capability error
- keyboard failure emits `QQ_OPEN_KEYBOARD_FALLBACK`

## Button Invariants

- direct command: type=2, enter=true, reply=false
- parameterized command: type=2, enter=false
- reusable: no mandatory click_limit
- pagination: clickable command action

## Remaining Gates

- main CI: PENDING
- Cloudflare Connected Build: PENDING
- live QQ render/click smoke: PENDING_USER
