# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 5

## Goal

Make V4 Portal persistence survive refresh and missing server-session state across all persistent login paths, and align Portal motion with the user-provided dark glass / purple-cyan aurora reference. Keep all changes on `feature/v4-public-bot`; do not touch `main`; do not live-test the Bot in existing QQ groups.

## Acceptance Criteria

- One successful credential submission enters the Portal without a forced page reload.
- Checking "keep me signed in" creates a persistent server session for ordinary and privileged accounts.
- Persistent privileged sessions use the configured 30-day idle / 180-day absolute limits.
- Unchecked privileged sessions retain the short 30-minute idle / 8-hour absolute limits.
- Persistent login issues a separate opaque remember credential as an HttpOnly browser cookie.
- Remember records are hash-keyed server-side, rotated after restore and revocable on logout.
- Missing/invalid ordinary server session can be rebuilt from the remember record without another credential submission.
- QQ-code, QQ-password, environment-admin, temporary-admin and Preview test login share the persistent-login behavior where allowed.
- The Portal background visibly uses moving purple/cyan aurora fields and glass surfaces in both dark and light themes.
- Page/view changes use visible enter transitions, button sheen, card hover glow/lift and View Transition when supported.
- `prefers-reduced-motion` disables nonessential motion.
- Full repository/V3/V4/isolated/bundle CI passes.
- Preview remains isolated from production credentials and QQ Open.
- No live Bot/group canary testing.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED: persistent privileged/system-admin sessions use 30-day idle / 180-day absolute limits when remember-login is selected.
- VERIFIED: non-persistent privileged sessions remain 30 minutes idle / 8 hours absolute.
- VERIFIED: successful persistent login sets `qqai_session` and `qqai_remember` as HttpOnly/Secure/SameSite=Lax cookies.
- VERIFIED: generic remember records are SHA-256-keyed; plaintext remember credentials are not stored server-side.
- VERIFIED: remember records contain a minimal session seed so the server can reconstruct a fresh persistent session if the referenced session record disappears.
- VERIFIED: `GET /api/portal/me` performs server-side remember recovery before returning SESSION_INVALID.
- VERIFIED: remember restore rotates the credential, caps reconstructed session lifetime to remember expiry and returns replacement cookies.
- VERIFIED: logout revokes remember state and clears both cookies.
- VERIFIED: successful login remains same-page and confirms through `/api/portal/me`.
- VERIFIED: strong aurora implementation uses an actual `.qqai-aurora` DOM layer with three moving orbs, moving ribbon and pointer-follow light.
- VERIFIED: light theme aurora opacity is `.58`, not the previous low-visibility `.34`.
- VERIFIED: final GitHub CI run `36871158902` succeeded.
- VERIFIED: Cloudflare Connected Build `5b74a8a1-ef8c-4246-889a-4ee425e0017c` succeeded for `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`.
- VERIFIED: Worker version `2207` / `49b8b3d4-a907-49b0-9448-9fce34b99d74` was used as the final Preview module source.
- VERIFIED: stable Preview deployment #16 `9e54bef0-0af0-47be-abd4-9f4841c70318` deployed with safe Preview bindings.
- VERIFIED LIVE FAILURE INJECTION: deleting the active server session changed sessionValid true -> false while remember remained valid; the next `/api/portal/me` returned 200/systemAdmin=true and restored sessionValid=true.
- VERIFIED: temporary Preview cookie diagnostic endpoints used for the fault injection were removed before final deployment.
- VERIFIED LIVE FINAL: Preview #16 login enters the app; `/api/portal/me` is 200/systemAdmin=true.
- VERIFIED LIVE MOTION: Chromium reports `qqaiFloatOrbA`, aurora opacity `0.58`, three orbs and a changing transform.
- USER ACCEPTANCE PENDING: user real-browser refresh and visual review.

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
- Remember-device credentials are authentication credentials: never persist plaintext server-side; rotate and revoke them.
- Preview fault-injection/diagnostic endpoints must not remain in the final acceptance deployment.
- Keep reduced-motion accessibility behavior.

## Current Phase

user_acceptance

## next_exact_action

User signs in once on the stable V4 Preview, refreshes the page, confirms authentication survives, and checks whether the stronger purple/cyan aurora and page transitions are visually obvious enough. Bot live testing remains paused.

last_checkpoint_at: 2026-10-01T21:50:00+08:00
