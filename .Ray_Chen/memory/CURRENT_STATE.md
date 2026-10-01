# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker deployment was not intentionally modified.
- No real QQ-group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- product head: `d64126c8d39e2bfad23ea6355c8e764573bc0692`
- final GitHub CI: `36843510857` — SUCCESS
- Cloudflare feature build: `33170c85-6b09-4874-a6c5-8c870968db43` — SUCCESS
- Worker version: 2181
- Worker version id: `a3644fc0-b524-40d4-8b33-51bd994f078b`

## Login State

Successful authentication:
- does not force a page reload;
- confirms `/api/portal/me` in the current page;
- calls `enterAuthenticatedPortal(me)` when the session is available.

Remember-login:
- ordinary and privileged accounts can request persistence;
- privileged accounts remain capped at 30-minute idle / 8-hour absolute session lifetimes;
- browser cookie lifetime is aligned to server absolute expiry.

V4 Preview recovery:
- Preview login returns a separate opaque resume token and expiry.
- Client stores it in localStorage when remember-login is checked, otherwise sessionStorage.
- If boot finds no valid session cookie, Preview calls `/api/auth/preview-resume`.
- Server validates exact Preview host, Preview enablement, `QQ_OPEN_ENABLED=false`, expiry and hashed resume record.
- Successful resume rotates the resume token and sends a replacement HttpOnly session cookie.
- logout revokes both the server session and supplied Preview resume token.

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `7e284694-6e51-41f8-8d7f-443454af0b62`
- deployment number: 9
- source: `d64126c8d39e2bfad23ea6355c8e764573bc0692`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Evidence

- One-click Preview login entered the app: app visible, login hidden, system-admin identity rendered.
- Live client storage contained a Preview resume token.
- Live `POST /api/auth/preview-resume`: HTTP 200 / ok=true and returned a rotated resume token.
- Automated Browser Rendering cannot be used as authoritative proof of storage survival across full page navigation; manual browser refresh remains pending.

## Bot Testing

Live Bot testing is paused because there is no isolated Bot/canary route and testing the existing Bot would produce real group-chat side effects.

## Merge State

BLOCKED by user acceptance gate. No production merge is authorized.
