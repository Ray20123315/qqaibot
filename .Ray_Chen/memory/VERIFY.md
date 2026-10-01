# VERIFY

## Product Revision

`ca92f9a0628ac57a14ec8ffe505a79c79a01793c`

## GitHub

Final CI:
- run: `36871158902`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Persistent-login regression coverage:
- remembered system-admin/developer sessions use `DEFAULTS.portalSessionTtlMs` and `DEFAULTS.portalSessionAbsoluteTtlMs`;
- unchecked privileged sessions remain 30m idle / 8h absolute;
- persistent logins issue `qqai_session` and `qqai_remember` HttpOnly cookies;
- remember records are SHA-256-keyed;
- generic restore rotates the remember credential;
- used/revoked remember credentials cannot be reused;
- logout clears both cookies and revokes server-side remember state;
- a remember record can reconstruct a fresh session after the original `portal_session:<token>` row is deliberately deleted;
- rebuilt session is persistent and cannot outlive the remember credential;
- runtime no longer depends on generic `qqai_portal_remember` localStorage state.

Motion/background regression coverage:
- `qqai-reference-motion-v2-strong` marker;
- real `.qqai-aurora` DOM layer;
- three orb animations `qqaiFloatOrbA/B/C`;
- moving ribbon `qqaiRibbon`;
- strong page-enter and View Transition keyframes;
- pointer-follow page/card glow;
- light-theme aurora opacity `.58`;
- reduced-motion fallback retained.

## Cloudflare Feature Build

- build UUID: `5b74a8a1-ef8c-4246-889a-4ee425e0017c`
- branch: `feature/v4-public-bot`
- commit: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`
- outcome: SUCCESS
- Worker version: 2207
- Worker version id: `49b8b3d4-a907-49b0-9448-9fce34b99d74`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `9e54bef0-0af0-47be-abd4-9f4841c70318`
- deployment number: 16
- source annotation: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`

Read-back isolation:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- `V4_PREVIEW_TEST_EXPIRES_AT=2026-10-03T00:00:00+08:00`
- production QQ/OneBot/AI/Codex/Portal-admin sensitive bindings: absent

## Live Failure-Injection Proof

An isolated Preview-only diagnostic was temporarily added, used, then removed before final deployment.

Browser sequence:
1. Login completed: session cookie present=true, sessionValid=true, remember cookie present=true, remember record present=true.
2. Server-side session row was deliberately deleted.
3. Diagnostic read-back: session cookie present=true, sessionValid=false, remember cookie present=true, remember record present=true.
4. `GET /api/portal/me` returned HTTP 200, ok=true, systemAdmin=true.
5. Diagnostic read-back after restore: sessionValid=true, remember record present=true after credential rotation.

This directly verifies remember recovery no longer depends on the old server session record.

## Final Preview Browser Smoke

Cloudflare Browser Rendering on final Preview #16:
- app visible after one Preview login: true
- login page hidden: true
- `GET /api/portal/me`: HTTP 200 / ok=true / systemAdmin=true
- animation name: `qqaiFloatOrbA`
- light-theme aurora opacity: `0.58`
- orb transform changed during observation: true
- three aurora orbs present: true
- strong-motion marker present: true

## Bot Verification Boundary

No live Bot/group canary was run.

## Production

No merge to `main`.
