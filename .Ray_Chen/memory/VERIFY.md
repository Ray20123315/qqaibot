# VERIFY

## Verified Product Revision

`0fa643433285df0879878441e846dcfc023054b7`

## Live Failure That Triggered This Fix

The real QQ group displayed only the fallback text for a category and no buttons. That is treated as keyboard failure, not success.

## Tencent SDK Alignment

Reference:
`tencent-connect/qqbot-agent-sdk@6163b5dc979a2f12379b1916805009075008c3c3`

Verified outbound button fields:
- `id`
- `render_data.label`
- `render_data.visited_label`
- `render_data.style`
- `action.type=1`
- `action.data`
- `action.permission.type=2`
- `action.click_limit=1`
- `group_id`

Verified keyboard-bearing message fields:
- `msg_type=2`
- `markdown.content`
- `keyboard.content.rows`
- passive path keeps `msg_id` and `msg_seq`
- interaction path keeps `event_id`

## Diagnostics

Runtime source and tests verify keyboard-specific fallback state:
- `lastKeyboardErrorAt`
- `lastKeyboardError`
- `keyboardFallbackCount`

Deterministic keyboard 4xx may fall back to plain text. Ambiguous 5xx/timeouts do not trigger a duplicate write.

## GitHub Actions

- development run `36481097113`: SUCCESS
- main run `36481292173`: SUCCESS

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle
- existing Portal/system-admin regressions

## Cloudflare Production

Connected Build `0d835129-1a85-413b-9e0a-ec063da9e464`:
- commit: `0fa643433285df0879878441e846dcfc023054b7`
- branch: `main`
- outcome: success

## Remaining Live Verification

Click one group category. Expected: QQ renders the two-column inline keyboard. If fallback text still appears, inspect QqOpenGateway `keyboard.lastError` before further payload changes.
