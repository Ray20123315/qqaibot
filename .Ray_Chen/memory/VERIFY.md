# VERIFY

## Product Revision

`262b019b3246ea9fba54975fc3f4954e6cfd432a`

## GitHub

Final CI:
- run: `36840520274`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Login-specific regression:
- requires `finishPortalLogin()` to call `location.reload()`
- rejects QQ-code success path calling `await boot()`
- rejects Preview-test success path calling `await boot()`
- rejects password-login success path calling `await boot()`
- requires all three paths to call `finishPortalLogin()`

## Cloudflare Feature Build

- build UUID: `5d11ffad-1a68-48f6-8daa-630246f8c16b`
- branch: `feature/v4-public-bot`
- commit: `262b019b3246ea9fba54975fc3f4954e6cfd432a`
- outcome: SUCCESS
- Worker version: 2171
- Worker version id: `9c24fac6-664c-439e-b005-2f5496ffe81f`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `97c695ee-b4f7-4bdd-b353-3b23ad5b56b4`
- deployment number: 7
- source annotation: `262b019b3246ea9fba54975fc3f4954e6cfd432a`

Read-back isolation:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ client secret: absent
- production OneBot token/DO: absent
- Gemini/DeepSeek/Codex secrets: absent
- Vectorize: absent
- production Portal admin/auth secrets: absent

## Live Login Probe

Cloudflare Browser Rendering same-origin JavaScript probe:
- first login API: HTTP 200, ok=true
- immediately following `/api/portal/me`: HTTP 200, ok=true
- session: systemAdmin=true

This proves the first authentication request creates a valid session and the session is usable immediately by the backend/browser cookie jar.

A separate DOM-click/navigation instrumentation attempt was inconclusive because the injected probe state disappeared across reload. It is not used as acceptance evidence.

## Bot Verification Boundary

No live Bot/group canary was run. Existing QQ group testing would create real user-visible messages. Bot verification remains limited to code and CI until an isolated Bot/canary route exists or the user explicitly authorizes a scoped live test.

## Production

No merge to `main`.
