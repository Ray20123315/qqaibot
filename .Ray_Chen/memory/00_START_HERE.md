# Ray_Chen Memory Entry

- memory_version: v0.0.62
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20261001-panel-complete-real-message-send
- task_status: active
- goal_revision: 7
- verified_product_revision: 6927af12dab81a979a13db94c54924ffbce0f35e
- deployed_main_revision: 6927af12dab81a979a13db94c54924ffbce0f35e
- updated_at: 2026-10-08T14:30:00+08:00

## Production Repair State

The command-panel transport repair is deployed:

- keyboard cards use `msg_type:0 + content + keyboard`;
- successful cards do not show `备用文字`;
- emergency fallback copy is sent only after a QQ keyboard capability rejection;
- keyboard rejection emits `QQ_OPEN_KEYBOARD_FALLBACK`;
- direct child commands remain normal QQ command messages (`type=2 + enter=true`);
- parameterized commands remain editable prefills (`type=2 + enter=false`).

## Verified Evidence

- development CI: `36883833197` — success
- main CI: `36988176740` — success
- Cloudflare Connected Build: `e33665d0-549a-4926-a797-2add410f2dca` — success
- v0.0.55 archive extraction: success
- v0.0.55 archive SHA-256: `34955b976e6ca788c3447d8e75bd6511e45c5df5ba784820bf4e20a52c6cdce1`

## Live Failure Evidence

At 2026-10-02T17:50:41+08:00, the user sent `/!面板 群聊`. The bot replied only `【群聊】请选择子指令`; no clickable buttons rendered. This resolves the previous PENDING_USER gate as a live failure.

Current diagnosis: the message send itself succeeds, but the QQ client does not render the attached custom inline keyboard. Tencent's current Node SDK documents plain-text + inline keyboard, while the deployed payload contains additional compatibility fields beyond the minimal SDK example.

## Production Repair State

The minimal Tencent-compatible inline-keyboard payload repair is deployed to production.

- product/main revision: `232e2577558dd67fffab769ac474243956bf8435`
- development validation run: `36996324380` — success
- main validation run: `36996506963` — success
- Cloudflare Connected Build: `18614133-1169-402a-a9b9-5d9c4b34f0bb` — success
- prior package run: `36996507133` — success
- prior package artifact: `11222360778` (`ray-chen-memory-v0.0.59`)

Keyboard serialization now uses:
- parameterized command: `type + permission + data`
- direct/pagination command: same plus `enter:true`
- generated `reply:false`, `enter:false`, `unsupport_tips`, and `group_id` are omitted.

## Blocker

PENDING_USER: automated tests prove the payload and deployment, but only the live QQ client can prove that the platform now renders the buttons. If the client still returns only the title text, the remaining dependency is most likely the QQ application message-button/custom-keyboard capability rather than missing category data.

## next_exact_action

In QQ, send `/!面板 群聊` once. Report whether visible clickable child-command buttons appear. If they do, click one direct command and one parameterized command to confirm send-vs-prefill behavior.


## Goal Revision 6 — Native Command Fallback

Live evidence at 2026-10-02 18:47:52 +08:00:
- `/!面板 基础` returned only `【基础】请选择子指令`;
- custom inline buttons were still absent after the minimal-payload production repair.

Verified platform finding:
- Tencent documentation marks custom buttons as a gated / invite-only capability.
- Production had no keyboard template binding and no proven custom-button grant.

Production repair:
- product revision: `6927af12dab81a979a13db94c54924ffbce0f35e`
- development CI: `36998626039` success
- main CI: `36998794211` success
- Cloudflare build: `3f3ddb50-013a-4f1a-a4fb-74d045198704` success
- production setting read-back: `QQ_OPEN_CUSTOM_KEYBOARD_ENABLED=false`
- QQ native group discovery now publishes the compact category launcher plus categorized concrete group-command panels.
- custom inline keyboard remains an optional enhancement only after the AppID capability is explicitly confirmed.

## Current Blocker

PENDING_USER: open the QQ native `/` command panel and verify concrete commands such as `!help` and `!status` are visible/clickable. The custom inline-keyboard path is intentionally not part of this acceptance gate.


## Goal Revision 7 — Native Panel Repair

User report at 2026-10-08 14:24 +08:00: panel is unusable.

Recovery Gate result:
- main and v4-qqopen-native both point to `09750c6f8d972b8480f5bc03651cac7a89cb5cc1`;
- production code still enables `QQ_OPEN_DISCOVERY_SYNC=true`;
- minute cron calls the QQ Gateway `/ensure` endpoint;
- `/ensure` only calls `ensureConnected()`;
- when the WebSocket is already open or connecting, `ensureConnected()` returns immediately;
- discovery synchronization still runs only on READY / RESUMED events.

Most likely root cause:
A deployment can change the desired panel fingerprint while the existing Gateway WebSocket remains connected. In that state, the minute watchdog never invokes discovery synchronization, so QQ can keep stale or missing panels indefinitely.

Repair plan:
1. make the minute `/ensure` path reconcile discovery even when the socket is already connected;
2. add an internal force-sync endpoint and persistent sync-result diagnostics;
3. regression-test connected-socket reconciliation and fingerprint no-op behavior;
4. validate development CI, promote to main, verify production build/settings;
5. wait at least one routine cron cycle and verify sync evidence where observable;
6. require one final QQ client panel smoke.
