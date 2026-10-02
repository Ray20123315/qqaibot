# VERIFY

## Goal Revision 4 — Production Evidence

- product revision: `668525a1db65402c8428cfa03930c8c77f255240`
- development CI `36883833197`: success
- main CI `36988176740`: success
- Cloudflare Connected Build `e33665d0-549a-4926-a797-2add410f2dca`: success
- v0.0.55 archive SHA-256: `34955b976e6ca788c3447d8e75bd6511e45c5df5ba784820bf4e20a52c6cdce1`

## Payload Invariants

- `msg_type === 0`
- `content` present
- `keyboard.content.rows` present
- no required `markdown`
- ordinary message reply preserves `msg_id` / `msg_seq`
- interaction reply preserves `event_id`

## UX Invariants

- successful card does not contain `备用文字`
- fallback copy exists separately
- fallback copy is used only after keyboard capability error
- keyboard fallback emits `QQ_OPEN_KEYBOARD_FALLBACK`

## Button Invariants

- direct: type=2, enter=true, reply=false
- parameterized: type=2, enter=false
- reusable: no mandatory click_limit
- pagination: clickable command action

## Final Gate

BLOCKED/PENDING_USER:
1. send `/!面板 群聊` in QQ;
2. confirm visible clickable buttons;
3. click one direct command and confirm the QQ message is actually sent;
4. click one parameterized command and confirm it prefills instead of sending immediately.


## Goal Revision 5 — Live Failure / Repair Gate

Live failure evidence:
- 2026-10-02T17:50:41+08:00: `/!面板 群聊`
- reply text: `【群聊】请选择子指令`
- visible buttons: none
- explicit fallback copy: none

Pre-implementation references:
- Tencent current Node SDK: plain text message plus `keyboard` is supported.
- Official button schema requires `render_data`, `action.type`, `action.permission`, and `action.data`; direct-send `action.enter` is optional and supported for command buttons.

Repair gate:
1. exact serializer tests must match the minimized shape;
2. all category pages remain within QQ row/button limits;
3. direct vs parameterized behavior remains distinct;
4. development CI must pass before main promotion;
5. final live QQ smoke remains required.
