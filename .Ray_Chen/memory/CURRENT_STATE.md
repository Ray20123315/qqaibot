# CURRENT_STATE

## GitHub

- product revision on `main`: `0fa643433285df0879878441e846dcfc023054b7`
- development CI `36481097113`: success
- main CI `36481292173`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `0d835129-1a85-413b-9e0a-ec063da9e464`
- commit: `0fa643433285df0879878441e846dcfc023054b7`
- branch: `main`
- outcome: success

## QQ Keyboard Payload

Current custom keyboard button shape includes:
- `id`
- `render_data.label / visited_label / style`
- `action.type=1`
- `action.data`
- `action.permission.type=2`
- `action.click_limit=1`
- `group_id`

Keyboard message shape:
- `msg_type=2`
- `markdown.content`
- `keyboard.content.rows`
- passive replies retain `msg_id` and `msg_seq`
- interaction replies retain `event_id`

## Diagnostics

QqOpenGateway status now includes:
- `keyboard.lastErrorAt`
- `keyboard.lastError`
- `keyboard.fallbackCount`

These fields make deterministic keyboard rejection visible instead of silently hiding it behind the text fallback.

## Preserved State

- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- direct commands and runtime authorization are unchanged.
- `/!普通内容` still bypasses AI.
- Portal TEMP-admin/D1 rate-limit hotfix remains preserved.

## Remaining Live Verification

Click one category in the real QQ group and confirm the inline keyboard renders.
