# CURRENT_STATE

## GitHub

- verified product revision on main/dev: `dea8ae5448382830262399aa3ee3773d5e4e030f`
- development CI `36522596708`: success
- main CI `36522715591`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `ce40accb-f1f3-4824-b299-411e130e2573`
- commit: `dea8ae5448382830262399aa3ee3773d5e4e030f`
- branch: `main`
- outcome: success

## QQ Group Keyboard Behavior

- test branch: `fix/qq-panel-message-send-20261001`
- base main revision: `a1c19cf0d732fd576000c8ecb2753facf38c51e8`
- direct/no-argument commands: action.type=2, enter=true, canonical command data, normal QQ command-message path;
- parameterized/target/content commands: action.type=2, enter=false, trailing-space command prefill;
- navigation buttons: action.type=2, enter=true, normal command-message path;
- normal buttons omit click_limit;
- direct-vs-parameterized classification still comes from command.panel.enter metadata;
- automated validation run `36796984396`: success across repository, V3, V4 QQ Open, isolated V4 test deployment checks and bundle;
- main is unchanged;
- live QQ send-vs-prefill behavior remains NEEDS_REVIEW.

## Preserved State

- QQ_OPEN_INTENTS remains 100663296, so callback delivery remains available.
- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- direct command handlers, permissions, confirmations, cooldowns and Portal switches are unchanged.
- `/!普通内容` remains AI bypass.
- TEMP-admin and prior Portal security work remain preserved.

## Remaining Live Verification

Only real-client UX confirmation remains: direct button should execute immediately, parameterized button should stay editable, and non-basic categories should render buttons.

## 2026-10-01 Test-Branch Update

- User live feedback established that callback-only direct commands do not satisfy the required Bot reply path because they do not create the normal QQ user-message event.
- The previous callback direct-command implementation is superseded on the test branch by type=2 + enter=true.
- This change is intentionally isolated from main until live client validation succeeds.
