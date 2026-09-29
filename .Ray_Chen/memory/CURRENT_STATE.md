# CURRENT_STATE

## Keyboard Command Actions

- development product revision: `719290878187f2230a5be10092cc4a9aa3ce1e34`
- CI: pending
- normal group child-command buttons now use QQ action.type=2 instead of callback action.type=1
- direct-send commands: `enter=true`
- parameterized commands: `enter=false` with trailing-space prefill
- `click_limit` is omitted for normal command buttons, so they are reusable
- pagination buttons are type=2 + enter=true
- unknown/new commands default to prefill rather than immediate execution

## Preserved State

- QQ_OPEN_INTENTS remains 100663296; Interaction support is preserved for unrelated callback features.
- QQ Open remains primary; OneBot remains controlled fallback.
- existing permissions, confirmations, cooldowns and Portal switches are unchanged.
- TEMP-admin and prior Portal security work remain preserved.

## Verification Pending

Run repository/V3/V4/isolation/bundle CI, then promote to main and confirm Cloudflare production.
