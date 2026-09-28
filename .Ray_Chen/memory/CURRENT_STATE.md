# CURRENT_STATE

## GitHub

- canonical branch: `main`
- verified product revision: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- main CI `36477699417`: success
- hotfix validation CI `36477469841`: success

## Portal Authentication

- Cloudflare `MY_RATE_LIMITER` remains primary.
- D1 atomic fallback rate limiting is enabled only when the Cloudflare limiter invocation is unavailable.
- fallback is not unlimited and remains fail-closed when D1 is unavailable.
- normal `PORTAL_ADMIN_*` credential remains intact.
- separate TEMP system-admin credential is configured as Cloudflare secrets.
- TEMP expiry: `2026-10-02T00:00:00+08:00`.
- TEMP credential values are intentionally absent from Git and Ray_Chen memory.

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `e1e34aef-e53d-4851-9fbe-0f686f9c3651`
- product commit: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- build outcome: success
- secret-triggered deployment: `9f61378e-d52d-4617-b799-e1fe9c11cbab`
- active Worker version: `0c070598-6d6e-436a-8704-25a46acd0a6f` / 2137
- TEMP secret binding names read back successfully.

## Live Health

- HTTP 200
- `ok: true`
- 10 ok / 1 warning / 0 error
- D1: ok
- OneBot/NapCat: connected, RPC round-trip=true, errorCount=0
- historical WebSocket close 1006 remains diagnostic history, not a current health error.

## Remaining Manual Smoke Test

Use the TEMP credentials once on the production Portal and confirm system-admin/developer controls are visible. The credential cannot be replayed by the automation environment without exposing a secret to a disallowed browser-automation path.
