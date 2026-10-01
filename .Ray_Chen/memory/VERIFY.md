# VERIFY

## Product Revision

`654d340be94559ba3409a9b6e4de3f8a2eb2c849`

## GitHub

Final CI:
- run: `36846206642`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Persistent-login regression coverage:
- remembered system-admin session uses `DEFAULTS.portalSessionTtlMs` and `DEFAULTS.portalSessionAbsoluteTtlMs`;
- remembered developer session uses the same persistent limits;
- unchecked privileged session remains 30m idle / 8h absolute;
- remember token creation succeeds only for persistent sessions;
- restore rotates the token;
- used token cannot be reused;
- revoked token remains invalid;
- worker `/api/auth/restore-session` returns a replacement HttpOnly cookie;
- replacement cookie authenticates `/api/portal/me`;
- runtime stores generic `qqai_portal_remember`, attempts generic restore during boot, and sends the token on logout.

Motion/background regression coverage:
- `qqai-reference-motion-v1` marker;
- aurora and page-enter keyframes;
- radial-gradient background layer;
- View Transition support;
- motion sweep helper.

## Cloudflare Feature Build

- build UUID: `4fe5a3b8-9f83-46ff-8c31-767f15ab8531`
- branch: `feature/v4-public-bot`
- commit: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`
- outcome: SUCCESS
- Worker version: 2187
- Worker version id: `dad31f97-15a0-482f-b31b-b73008ca1684`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `b821dd63-d777-405f-b60c-2ce8d2e76fc0`
- deployment number: 10
- source annotation: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`

Read-back isolation:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ/OneBot/Gemini/DeepSeek/Codex/Vectorize/Portal-admin sensitive bindings: absent

## Live Persistent Login Probe

Cloudflare Browser Rendering on stable Preview:
- a single Preview login entered the app;
- generic remember token was saved;
- `POST /api/auth/restore-session` was explicitly called with `credentials:'omit'`, so the original session cookie was not sent;
- restore response: HTTP 200, ok=true;
- response contained a newly rotated remember token.

This verifies the server/client persistent recovery path does not depend on the original session cookie. Full browser refresh/close/reopen still requires the user's real-browser acceptance because the automation environment is not treated as authoritative for browser storage persistence across navigation/restart.

## Live Visual Payload Probe

Stable Preview HTML:
- `qqai-reference-motion-v1`: present
- aurora keyframes: present
- page-enter keyframes: present
- `document.startViewTransition`: present
- generic remember storage key: present

## Bot Verification Boundary

No live Bot/group canary was run.

## Production

No merge to `main`.
