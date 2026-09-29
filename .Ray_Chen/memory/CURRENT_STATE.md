# CURRENT_STATE

## GitHub

- product revision on main: `2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`
- development CI `36510290690`: success
- main CI `36510415265`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `16be6f33-cdd1-4e31-9a26-60036dc0f237`
- commit: `2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`
- branch: `main`
- outcome: success
- QQ_OPEN_ENABLED: `true`
- QQ_OPEN_TRANSPORT: `websocket`
- QQ_OPEN_INTENTS: `100663296` (read back from production settings)

## Interaction / Keyboard

- GROUP_MESSAGES: `1 << 25`
- INTERACTION: `1 << 26`
- combined configured mask: `100663296`
- previous production mask `33554432` could never receive button callbacks.
- QqOpenGateway now records `sessionIntents`.
- RESUME requires session intent equality with the current configured mask.
- intent mismatch uses a new IDENTIFY, so deploys cannot retain the old callback subscription.
- callback ACK endpoint/body remains `PUT /interactions/{id}` + `{"code":0}`.

## Preserved State

- keyboard official DTO/Markdown payload fix remains.
- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- direct commands and runtime authorization are unchanged.
- `/!普通内容` still bypasses AI.
- Portal TEMP-admin/D1 rate-limit hotfix remains preserved.

## Remaining Live Verification

Click one rendered child-command button. A remaining timeout would most likely mean QQ-side INTERACTION permission is not granted, typically surfaced as Gateway close 4014.
