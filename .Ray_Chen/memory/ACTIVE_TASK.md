# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 5

## Goal

Make V4 Portal persistence real across all login paths and align the Portal's background and transition motion with the user-provided OneDrive Vault reference, while preserving earlier V4 command/identity/whitelist work. Keep all changes on `feature/v4-public-bot`; do not touch `main`; do not live-test the Bot in existing QQ groups.

## Acceptance Criteria

- One successful credential submission enters the Portal without a forced page reload.
- Checking "keep me signed in" creates a persistent server session for ordinary and privileged accounts.
- Persistent privileged sessions use the configured 30-day idle / 180-day absolute limits instead of the old 30-minute / 8-hour privileged cap.
- Unchecked privileged sessions retain the short 30-minute idle / 8-hour absolute limits.
- Persistent login issues a separate opaque remember-device token that can restore a session when the original HttpOnly cookie is unavailable.
- Remember tokens are hash-keyed server-side, rotated after restore and revocable on logout.
- QQ-code, QQ-password, environment-admin, temporary-admin and Preview test login use the shared persistent-login behavior where allowed.
- The Portal background uses moving purple/cyan aurora fields and glass surfaces inspired by the supplied reference.
- Page/view changes use smooth enter transitions, button sheen, card hover glow/lift and View Transition when supported.
- `prefers-reduced-motion` disables nonessential motion.
- Full repository/V3/V4/isolated/bundle CI passes.
- Preview remains isolated from production credentials and QQ Open.
- No live Bot/group canary testing.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED: persistent privileged/system-admin sessions now use `DEFAULTS.portalSessionTtlMs` and `DEFAULTS.portalSessionAbsoluteTtlMs` (30 days idle / 180 days absolute).
- VERIFIED: non-persistent privileged sessions remain 30 minutes idle / 8 hours absolute.
- VERIFIED: added generic `createPortalRememberToken`, `restorePortalRememberToken`, and `revokePortalRememberToken`.
- VERIFIED: generic remember token records are keyed by SHA-256 of the opaque token, not by plaintext token.
- VERIFIED: all persistent login response paths can return `rememberToken` and `rememberExpiresAt`, with Preview/TEMP routes capped by their external expiry.
- VERIFIED: added `POST /api/auth/restore-session`, including same-origin guard and auth rate limiting.
- VERIFIED: restore rotates the remember token and returns a replacement HttpOnly session cookie.
- VERIFIED: logout revokes the generic remember token.
- VERIFIED: Portal client stores generic remember credentials in `localStorage`, restores before falling back to the legacy Preview-only path, and clears them when remember-login is unchecked or on logout.
- VERIFIED: successful login remains same-page.
- VERIFIED: reference-inspired motion/background CSS and JS were added to the existing Portal without removing existing feature structure.
- VERIFIED: final GitHub CI run `36846206642` succeeded.
- VERIFIED: Cloudflare Connected Build `4fe5a3b8-9f83-46ff-8c31-767f15ab8531` succeeded for `654d340be94559ba3409a9b6e4de3f8a2eb2c849`.
- VERIFIED: Worker version `2187` / `dad31f97-15a0-482f-b31b-b73008ca1684` was used as the Preview module source.
- VERIFIED: stable Preview deployment #10 `b821dd63-d777-405f-b60c-2ce8d2e76fc0` deployed with safe Preview bindings.
- VERIFIED LIVE: a single Preview login entered the app and stored a generic remember token.
- VERIFIED LIVE WITHOUT SESSION COOKIE: `/api/auth/restore-session` called with `credentials:'omit'` returned 200/ok=true and rotated a new remember token.
- VERIFIED LIVE VISUAL PAYLOAD: stable Preview contains the aurora, page-enter, View Transition and remember-storage implementation markers.
- USER ACCEPTANCE PENDING: refresh plus browser close/reopen on the user's real browser.

## Product Files Changed

- `src/portal/auth.js`
- `worker.js`
- `src/portal/runtime.js`
- `verify-system-admin-auth.mjs`
- `verify-portal-auth-password.mjs`

## Hard Constraints

- Do not merge/update `main`.
- Do not live-test Bot behavior in existing QQ groups.
- Do not enable QQ Open or production QQ/OneBot/AI secrets in the isolated Preview.
- Do not claim automated Browser Rendering proves storage survival across a full browser restart.
- Remember-device tokens are authentication credentials: store no plaintext copy server-side and revoke/rotate them.
- Keep reduced-motion accessibility behavior.

## Current Phase

user_acceptance

## next_exact_action

User signs in once with "keep me signed in" on the stable V4 Preview, refreshes the page, closes/reopens the browser, and confirms the Portal restores without another credential submission; user also reviews whether the new background and transition motion matches the supplied reference closely enough.

last_checkpoint_at: 2026-10-01T18:04:00+08:00
