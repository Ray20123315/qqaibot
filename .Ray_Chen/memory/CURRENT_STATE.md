# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker deployment was not intentionally modified.
- No real QQ-group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- product head: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`
- final GitHub CI: `36871158902` — SUCCESS
- Cloudflare feature build: `5b74a8a1-ef8c-4246-889a-4ee425e0017c` — SUCCESS
- Worker version: 2207
- Worker version id: `49b8b3d4-a907-49b0-9448-9fce34b99d74`

## Persistent Login State

Persistent=true:
- ordinary, developer/admin/owner and system-admin sessions use the configured persistent lifetime;
- idle TTL: 30 days;
- absolute TTL: 180 days;
- browser receives `qqai_session` and `qqai_remember` as HttpOnly, Secure, SameSite=Lax cookies.

Persistent=false:
- privileged session idle TTL: 30 minutes;
- privileged absolute TTL: 8 hours;
- no persistent remember credential is issued.

Remember-device recovery:
- server stores only a SHA-256-keyed remember record;
- remember record contains a minimal session seed, not the plaintext remember credential;
- `GET /api/portal/me` first checks the ordinary session; if invalid, it can consume `qqai_remember`;
- if the old server session record still exists, it is resumed;
- if the old server session record is gone, a new persistent session is reconstructed from the remember seed;
- reconstructed session expiry cannot exceed remember expiry;
- successful restore rotates the remember credential and refreshes both browser cookies;
- logout revokes remember state and clears both cookies.
- Preview-only resume storage remains only as a legacy acceptance fallback and is not the primary persistent-login path.

## Portal Visual State

The existing Portal information architecture remains intact. Strong reference-inspired motion/background is active:
- real foreground `.qqai-aurora` layer instead of a negative-z pseudo-element;
- three large blurred purple/cyan/blue moving orbs;
- moving light ribbon;
- pointer-follow page glow and card glow;
- glass sidebar/topbar/cards;
- button sheen and press feedback;
- stronger page/view entry motion and topbar sweep;
- `document.startViewTransition` when supported;
- light theme aurora opacity `0.58`;
- `prefers-reduced-motion` disables nonessential motion.

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `9e54bef0-0af0-47be-abd4-9f4841c70318`
- deployment number: 16
- source: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- Preview test expiry: `2026-10-03T00:00:00+08:00`
- production-sensitive bindings: absent

## Live Evidence

Fault injection on isolated Preview before diagnostic cleanup:
- before deletion: session cookie present=true, sessionValid=true, remember cookie present=true, remember record present=true;
- deliberate server-session deletion: HTTP 200;
- after deletion: session cookie still present=true, sessionValid=false, remember cookie present=true, remember record present=true;
- next `GET /api/portal/me`: HTTP 200, ok=true, systemAdmin=true;
- after restore: sessionValid=true and remember record remains valid after rotation.

Final Preview #16:
- one-click Preview login: app visible=true, login hidden=true;
- `GET /api/portal/me`: HTTP 200, ok=true, systemAdmin=true;
- Chromium animation name: `qqaiFloatOrbA`;
- light-theme aurora opacity: `0.58`;
- orb transform changes over time: true;
- three-orb strong-motion marker present: true.

## Bot Testing

Live Bot testing is paused because there is no isolated Bot/canary route and testing the existing Bot would create real group-chat side effects.

## Merge State

BLOCKED by user acceptance gate. No production merge is authorized.
