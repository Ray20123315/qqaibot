# CURRENT_STATE

## Production

- `main` was not changed by this login-fix task.
- Production Worker deployment was not intentionally modified.
- No real QQ group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- product head: `262b019b3246ea9fba54975fc3f4954e6cfd432a`
- login implementation commit: `3f0cce32f34ca33aabb8899feff173f491515f46`
- login regression commit: `262b019b3246ea9fba54975fc3f4954e6cfd432a`
- final GitHub CI: `36840520274` — SUCCESS

## Login State

Before:
- successful QQ code, password, and Preview test login immediately called `await boot()` in the same page/fetch chain.

Now:
- all successful login paths call `finishPortalLogin()`
- `finishPortalLogin()` updates the login status and invokes `location.reload()`
- normal page startup then performs the authenticated `/api/portal/me` load.

Live backend evidence:
- first `POST /api/auth/preview-test-login`: HTTP 200, ok=true
- immediately following first `GET /api/portal/me`: HTTP 200, ok=true
- returned session: systemAdmin=true

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `97c695ee-b4f7-4bdd-b353-3b23ad5b56b4`
- deployment number: 7
- source annotation: `262b019b3246ea9fba54975fc3f4954e6cfd432a`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Bot Testing State

Live Bot testing is paused. There is currently no isolated Bot/canary route, and testing against the existing Bot would produce real group-chat side effects. Bot behavior remains code/CI verified only until an isolated route is available or the user authorizes a narrowly scoped live test.

## Merge State

BLOCKED by user acceptance gate. No production merge is authorized.
