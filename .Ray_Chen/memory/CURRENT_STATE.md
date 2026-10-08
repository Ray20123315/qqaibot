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

## Production Verification — Goal Revision 5

- deployed product revision: `232e2577558dd67fffab769ac474243956bf8435`
- development CI: `36996324380` — success
- main CI: `36996506963` — success
- Cloudflare build: `18614133-1169-402a-a9b9-5d9c4b34f0bb` — success
- production build source branch: `main`
- production build commit: `232e2577558dd67fffab769ac474243956bf8435`
- package workflow `36996507133`: success
- package artifact `11222360778`: `ray-chen-memory-v0.0.59`

## Remaining State

- code compatibility repair: VERIFIED
- development CI: VERIFIED
- main CI: VERIFIED
- production deployment: VERIFIED
- live QQ inline-keyboard visibility: BLOCKED / PENDING_USER
- direct-send vs parameterized-click live behavior: BLOCKED / PENDING_USER


## Goal Revision 6 — Verified Production State

- latest failed custom-inline live test: 2026-10-02 18:47:52 +08:00, `/!面板 基础`, title only, no buttons
- custom inline keyboard: production-disabled pending explicit AppID capability approval
- production flag: `QQ_OPEN_CUSTOM_KEYBOARD_ENABLED=false` (read-back verified)
- discovery sync: `QQ_OPEN_DISCOVERY_SYNC=true` (read-back verified)
- native group discovery: category launcher + categorized real-command panels
- development CI `36998626039`: success
- main CI `36998794211`: success
- Cloudflare Connected Build `3f3ddb50-013a-4f1a-a4fb-74d045198704`: success
- deployed product revision: `6927af12dab81a979a13db94c54924ffbce0f35e`
- remaining acceptance: live QQ native `/` panel visibility/click behavior


## 2026-10-08 Panel Incident

User reports the panel is unusable.

Verified code path:
- Worker routine cron calls Durable Object `POST /api/v4/qqopen/ensure` every minute.
- `/ensure` invokes `ensureConnected({force:false})`.
- `ensureConnected` returns immediately if its WebSocket is open/connecting.
- discovery sync is not invoked from this path.
- discovery sync remains tied to READY/RESUMED Gateway events.

Most likely production failure mode:
the panel desired state changed after a deploy, but the existing Gateway session stayed alive, so the new desired panel set was never pushed to QQ.


## 2026-10-08 Panel Repair — Production Verified

Product revision: `27052dfaac8ef6627a2fd75f60cbc12fbf142657`

Root cause A — stale discovery:
- prior routine cron called `/ensure`;
- connected `ensureConnected()` short-circuited;
- discovery sync only occurred on READY/RESUMED;
- fixed by reconciling discovery from `/ensure` as well.

Root cause B — native command prefix:
- QQ native panel invocation has a leading `/`;
- old normalization covered only `/!面板 ...`;
- concrete panel commands could be consumed as `/!` AI opt-out text;
- fixed by stripping the slash only when the remainder resolves to a registered command or `!面板`.

Runtime safeguards:
- unchanged discovery fingerprint is no-op;
- force-sync bypasses persisted fingerprint;
- discovery failure is persisted without dropping a healthy websocket;
- unknown `/!text` is not converted into a command.

Verification:
- development CI `37738458422`: success
- main CI `37738621298`: success
- Cloudflare `77bcd624-84fd-4d1a-a419-c697cadfdeab`: success
- production discovery sync setting: enabled
- custom inline keyboard setting: disabled
- live QQ acceptance: pending user smoke
