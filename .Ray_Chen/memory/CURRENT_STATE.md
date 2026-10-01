# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker deployment was not intentionally modified.
- No real QQ-group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- product head: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`
- final GitHub CI: `36846206642` — SUCCESS
- Cloudflare feature build: `4fe5a3b8-9f83-46ff-8c31-767f15ab8531` — SUCCESS
- Worker version: 2187
- Worker version id: `dad31f97-15a0-482f-b31b-b73008ca1684`

## Persistent Login State

Persistent=true:
- system-admin, developer/admin/owner and ordinary sessions use the configured persistent lifetime;
- idle TTL: 30 days;
- absolute TTL: 180 days;
- browser cookie lifetime follows the actual server absolute expiry.

Persistent=false:
- privileged session idle TTL: 30 minutes;
- privileged absolute TTL: 8 hours;
- no persistent remember-device credential is issued.

Remember-device recovery:
- login returns an opaque `rememberToken` only for persistent sessions;
- server stores a hash-keyed remember record that references the server session;
- client stores `qqai_portal_remember` in localStorage;
- boot first requests `/api/portal/me`; if unauthenticated, it calls `/api/auth/restore-session`;
- restore rotates the remember token and sets a replacement HttpOnly session cookie;
- logout revokes the supplied generic remember token;
- Preview retains its previous Preview-only resume path only as a legacy fallback.

## Portal Visual State

The existing Portal structure remains intact. A reference-inspired motion/background layer was added:
- multi-layer dark background with purple/cyan radial lighting;
- animated blurred aurora blobs;
- animated login light fields and glass login card;
- glass/blur sidebar and topbar;
- glass cards/items/status panels;
- pointer-following card glow and hover lift;
- button sheen and press feedback;
- animated page/view entry;
- topbar motion sweep;
- `document.startViewTransition` when supported;
- `prefers-reduced-motion` disables nonessential motion.

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `b821dd63-d777-405f-b60c-2ce8d2e76fc0`
- deployment number: 10
- source: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Evidence

- Preview one-click login: app visible and login hidden.
- Generic remember token exists in localStorage after remembered login.
- `POST /api/auth/restore-session` with `credentials:'omit'`: HTTP 200 / ok=true / new rotated token.
- Stable Preview HTML contains the reference motion marker, aurora keyframes, page-enter keyframes, View Transition logic and remember storage key.

## Bot Testing

Live Bot testing is paused because there is no isolated Bot/canary route and testing the existing Bot would produce real group-chat side effects.

## Merge State

BLOCKED by user acceptance gate. No production merge is authorized.
