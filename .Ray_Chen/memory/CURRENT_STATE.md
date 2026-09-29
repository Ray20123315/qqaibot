# CURRENT_STATE

## GitHub

- keyboard product revision: `719290878187f2230a5be10092cc4a9aa3ce1e34`
- deployed main/dev head before final memory reconciliation: `e6824c0a7e825450526152da90b7b0d8fba3049c`
- development product CI `36511639011`: success
- final development-head CI `36511690614`: success
- main CI `36511830433`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `8da5b2da-5646-4e73-a34e-ba21844b020c`
- commit: `e6824c0a7e825450526152da90b7b0d8fba3049c`
- branch: `main`
- outcome: success

## QQ Keyboard Command Behavior

- normal group child-command buttons use action.type=2 command semantics.
- `enter=true`: immediate send for explicitly marked no-argument commands.
- `enter=false`: prefill input for commands that require or commonly accept parameters/targets/content.
- prefill data keeps a trailing space after the canonical command.
- normal command buttons do not carry click_limit, so they are reusable.
- pagination uses reusable type=2 command buttons with enter=true.
- unknown/new commands default to prefill rather than immediate execution.

## Preserved State

- QQ_OPEN_INTENTS remains 100663296; Interaction callbacks remain available for other features.
- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- direct commands, permissions, confirmations, cooldowns and Portal switches are unchanged.
- TEMP-admin and prior Portal security work remain preserved.

## Remaining Live Verification

Click one known direct-send button and one parameterized button in the real QQ client to confirm UX rendering/input behavior.
