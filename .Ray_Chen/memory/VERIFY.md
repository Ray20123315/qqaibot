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


## Goal Revision 5 — Development Patch

Product commit: `2dd39fc24d8d9d8c1d4a6402c6f716890bfa146e`

Expected serialized command-button shape:
- parameterized: `{ type:2, permission:{type:2}, data }`
- direct/pagination: same plus `enter:true`
- no generated `reply`
- no generated `unsupport_tips`
- no generated `group_id`
- no mandatory `click_limit`

Verification state:
- source transformation guards: passed
- exact regression assertions: added
- GitHub workflow: no run returned on first lookup; NOT VERIFIED


## Goal Revision 5 — CI Failure 36996070358

- general regression checks: success
- V3 regression checks: success
- V4 QQ Open check: failed at `verify-v4-qqopen.mjs:226`
- actual value: `undefined`
- stale expected value: `false`
- cause: pagination assertion still required explicit `action.reply=false` after the minimal-payload change intentionally removed the field
- repair: replace the stale equality check with absence assertions for `reply`, `unsupport_tips`, and `group_id`


## Goal Revision 5 — Production Verification

- verified product/main revision: `232e2577558dd67fffab769ac474243956bf8435`
- development validation `36996324380`: success
- main validation `36996506963`: success
- main validation steps: general regression, V3, V4 QQ Open, isolated V4 deployment checks, Worker bundle — all success
- Cloudflare Connected Build `18614133-1169-402a-a9b9-5d9c4b34f0bb`: `status=stopped`, `build_outcome=success`
- Cloudflare build metadata branch: `main`
- Cloudflare build metadata commit: `232e2577558dd67fffab769ac474243956bf8435`
- Ray_Chen package run `36996507133`: success
- artifact `11222360778`: `ray-chen-memory-v0.0.59`

Final acceptance gate:
1. send `/!面板 群聊` in live QQ;
2. confirm buttons render;
3. click a direct command and confirm QQ actually sends the command message;
4. click a parameterized command and confirm it prefills for editing.


## Goal Revision 6 — Native Fallback Verification

Live failure evidence:
- 2026-10-02 18:47:52 +08:00
- `/!面板 基础` -> `【基础】请选择子指令`
- inline buttons: absent

Automated verification:
- development CI `36998626039`: success
- main CI `36998794211`: success
- V4 regression verifies native group panel union contains every enabled concrete group command
- V4 regression verifies managed panel count remains <= 20
- Worker bundle: success
- Cloudflare build `3f3ddb50-013a-4f1a-a4fb-74d045198704`: success for `6927af12dab81a979a13db94c54924ffbce0f35e`
- production settings read-back:
  - `QQ_OPEN_CUSTOM_KEYBOARD_ENABLED=false`
  - `QQ_OPEN_DISCOVERY_SYNC=true`
  - `QQ_OPEN_ENABLED=true`

Remaining live gate:
1. type `/` in the QQ group;
2. confirm concrete commands including `!help` and `!status` are visible;
3. click a direct command and verify it sends;
4. click a parameterized command and verify QQ exposes the intended command input behavior.


## Goal Revision 7 — Pre-implementation Gate

Recovery evidence:
- main == v4-qqopen-native == `09750c6f8d972b8480f5bc03651cac7a89cb5cc1`
- minute cron invokes QQ Gateway `/ensure`
- connected `ensureConnected` path returns before discovery sync
- `QQ_OPEN_DISCOVERY_SYNC=true` remains configured

Required tests:
1. connected `/ensure` invokes discovery reconciliation;
2. same fingerprint returns no-op without deleting/recreating panels;
3. changed fingerprint performs sync and persists the new fingerprint;
4. failed sync persists error without disconnecting an otherwise healthy Gateway;
5. force-sync endpoint bypasses previous fingerprint;
6. existing Gateway, message, V3 and bundle regressions remain green.


## Goal Revision 7 — Verified Repair

Automated tests added:
- connected `POST /ensure` performs discovery synchronization;
- second `/ensure` with same desired fingerprint performs no API mutations;
- force-sync endpoint bypasses fingerprint and re-runs discovery;
- discovery API failure persists an error while healthy Gateway response remains available;
- native `/!help` -> `!help`;
- native `/!status` -> `!status`;
- native parameterized `/!禁言 @123456 10分钟` -> canonical command;
- CQ mention prefix survives normalization;
- unknown `/!普通内容` remains unchanged;
- normalization runs before `stripGroupAiOptOutPrefix`.

Evidence:
- dev CI run `37738458422`: success
- main CI run `37738621298`: success
- Cloudflare Connected Build `77bcd624-84fd-4d1a-a419-c697cadfdeab`: success
- production commit `27052dfaac8ef6627a2fd75f60cbc12fbf142657`
- production settings read-back:
  - `QQ_OPEN_DISCOVERY_SYNC=true`
  - `QQ_OPEN_CUSTOM_KEYBOARD_ENABLED=false`
  - `QQ_OPEN_ENABLED=true`
  - `QQ_OPEN_INTENTS=100663296`

Live acceptance still required:
1. open QQ native `/` command panel;
2. click `!help` and confirm the bot sends/handles the real command;
3. click `!status`;
4. click one parameterized command and confirm its input/send flow.
