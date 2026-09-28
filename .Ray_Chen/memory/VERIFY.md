# VERIFY

## Verified Product Revision

`4865c7c6c9f381916082e70063be78aaaba8e6d6`

## Authentication Hotfix Regression

`verify-system-admin-auth.mjs` verifies:
- permanent environment admin still works.
- TEMP environment admin can authenticate as system-admin.
- TEMP session role is developer and uses `temporary_environment_admin_password`.
- TEMP credentials expire and are rejected after expiry.
- TEMP configuration with invalid/missing fields is rejected.
- Cloudflare Rate Limiter exceptions fall back to D1.
- D1 fallback rate-limits a second immediate TEMP login.

## GitHub Actions

- hotfix branch run `36477469841`: SUCCESS.
- main run `36477699417`: SUCCESS.

Both passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cloudflare Production

Connected Build `e1e34aef-e53d-4851-9fbe-0f686f9c3651`:
- commit: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- branch: `main`
- outcome: success

Secret-triggered deployment:
- deployment: `9f61378e-d52d-4617-b799-e1fe9c11cbab`
- version: `0c070598-6d6e-436a-8704-25a46acd0a6f`
- version number: 2137
- three `PORTAL_TEMP_ADMIN_*` binding names present.

## Live Health

- HTTP: 200
- health ok: true
- counts: 10 ok / 1 warning / 0 error
- D1 query: ok
- OneBot/NapCat connected: true
- RPC round-trip: true
- current errorCount: 0

## Limitation

Production true-password replay is intentionally not automated because the available browser-automation safety layer blocks secret-bearing external actions. User login is the remaining smoke test; this does not invalidate the CI, binding, deployment, or health verification above.
