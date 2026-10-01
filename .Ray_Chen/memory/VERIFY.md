# VERIFY

## Product Revision

`d64126c8d39e2bfad23ea6355c8e764573bc0692`

## GitHub

Final CI:
- run: `36843510857`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Integration coverage includes:
- privileged remember-login remains persistent when requested while retaining privileged TTL caps;
- unchecked remember-login remains non-persistent;
- Preview login issues opaque resume token + expiry;
- Preview resume succeeds without the original session cookie;
- restored session cookie authenticates `/api/portal/me`;
- used resume token cannot be reused;
- logout revokes the rotated resume token;
- same-page login handoff does not force `location.reload()`;
- boot owns automatic Preview resume fallback.

## Cloudflare Feature Build

- build UUID: `33170c85-6b09-4874-a6c5-8c870968db43`
- branch: `feature/v4-public-bot`
- commit: `d64126c8d39e2bfad23ea6355c8e764573bc0692`
- outcome: SUCCESS
- Worker version: 2181
- Worker version id: `a3644fc0-b524-40d4-8b33-51bd994f078b`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `7e284694-6e51-41f8-8d7f-443454af0b62`
- deployment number: 9
- source annotation: `d64126c8d39e2bfad23ea6355c8e764573bc0692`

Read-back isolation:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ/OneBot/Gemini/DeepSeek/Codex/Vectorize/Portal-admin sensitive bindings: absent

## Live Login / Resume

Cloudflare Browser Rendering on stable Preview:
- a single login click entered the app without reload;
- app visible, login hidden, identity rendered as V4 Preview system admin;
- Preview resume token was present in Preview client storage;
- `POST /api/auth/preview-resume` returned HTTP 200, ok=true, and a new rotated resume token.

A forced reload Browser Rendering attempt returned to the login DOM, but the tool does not guarantee injected browser storage/context across its navigation boundary. This result is not treated as authoritative product failure or success. The server/client resume flow is integration-tested and live resume endpoint behavior is verified; real-browser reload remains manual user acceptance.

## Bot Verification Boundary

No live Bot/group canary was run. Existing QQ group testing would have user-visible side effects.

## Production

No merge to `main`.
