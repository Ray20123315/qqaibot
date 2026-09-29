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

- direct/no-argument commands: action.type=1 callback, no click_limit, immediate ACK + canonical handler execution;
- parameterized/target/content commands: action.type=2, enter=false, trailing-space command prefill;
- navigation buttons: reusable callback actions;
- every non-empty group command category renders a keyboard;
- every category page stays within 5 rows and 2 command columns;
- all enabled group-scoped panel commands are included by regression coverage;
- new/unclassified commands remain prefill by default unless explicitly marked direct.

## Preserved State

- QQ_OPEN_INTENTS remains 100663296, so callback delivery remains available.
- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- direct command handlers, permissions, confirmations, cooldowns and Portal switches are unchanged.
- `/!普通内容` remains AI bypass.
- TEMP-admin and prior Portal security work remain preserved.

## Remaining Live Verification

Only real-client UX confirmation remains: direct button should execute immediately, parameterized button should stay editable, and non-basic categories should render buttons.
