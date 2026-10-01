# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 4

## Goal

Fix V4 Portal login persistence without relying on a forced page reload. A successful login must enter the control panel in the same page, and the isolated Preview must be able to recover after session-cookie loss/reload without asking for credentials again. Preserve all earlier V4 command/identity/whitelist work, do not touch `main`, and do not live-test the Bot in existing QQ groups.

## Acceptance Criteria

- One successful login submission enters the Portal.
- Successful login does not require `location.reload()`.
- QQ-code, password and Preview test login share the same same-page session handoff.
- "Keep me signed in" is honored by privileged accounts within their existing security caps.
- Preview can recover when the HttpOnly session cookie is unavailable after reload, without a second credential submission.
- Resume tokens are Preview-only, opaque, server-hashed, short-lived/capped, rotated after use and revoked on logout.
- Full repository/V3/V4/isolated/bundle CI passes.
- Preview remains isolated from production credentials and QQ Open.
- No live Bot/group canary testing.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED: removed forced post-login reload and introduced `enterAuthenticatedPortal(me)`.
- VERIFIED: `finishPortalLogin(loginResult)` polls/reads `/api/portal/me` and enters the app in-page.
- VERIFIED: QQ-code, password and Preview login pass the successful login result into the shared handoff.
- VERIFIED: privileged remember-login can persist the browser cookie while privileged session TTL remains 30 minutes idle / 8 hours absolute.
- VERIFIED: browser cookie Max-Age follows the actual absolute server-session lifetime.
- VERIFIED: added Preview-only `POST /api/auth/preview-resume`.
- VERIFIED: Preview login issues a separate resume token; server stores only a hash-keyed resume record.
- VERIFIED: resume consumes and rotates its token; old token reuse returns unauthorized.
- VERIFIED: logout revokes the current resume token.
- VERIFIED: boot automatically attempts Preview resume if `/api/portal/me` is not authenticated.
- VERIFIED: integration regression simulates missing original cookie, resumes, obtains a replacement HttpOnly cookie, then authenticates `/api/portal/me`.
- VERIFIED: final GitHub CI run `36843510857` succeeded.
- VERIFIED: Cloudflare Connected Build `33170c85-6b09-4874-a6c5-8c870968db43` succeeded for `d64126c8d39e2bfad23ea6355c8e764573bc0692`.
- VERIFIED: Worker version `2181` / `a3644fc0-b524-40d4-8b33-51bd994f078b` was used as the Preview module source.
- VERIFIED: stable Preview deployment #9 `7e284694-6e51-41f8-8d7f-443454af0b62` deployed with safe Preview bindings.
- VERIFIED LIVE: a single Preview login click entered the app without reload.
- VERIFIED LIVE: Preview resume token existed and `/api/auth/preview-resume` returned 200/ok=true and rotated a new token.
- LIMITATION: Browser Rendering cross-navigation storage is not reliable enough to prove a full reload result. Real-browser refresh/reload is the remaining user acceptance check.

## Product Files Changed

- `src/portal/runtime.js`
- `src/portal/auth.js`
- `worker.js`
- `verify-system-admin-auth.mjs`
- `verify-portal-auth-password.mjs`

## Hard Constraints

- Do not merge/update `main`.
- Do not live-test Bot behavior in existing QQ groups.
- Do not enable QQ Open or production QQ/OneBot/AI secrets in the isolated Preview.
- Do not claim Browser Rendering cross-reload state as proof.
- Preview resume is acceptance-only and must not silently become a production credential mechanism.

## Current Phase

user_acceptance

## next_exact_action

User logs in once on the stable V4 Preview, manually refreshes/reloads the browser, and confirms whether the control panel remains available without another login. Bot live testing remains paused.

last_checkpoint_at: 2026-10-01T17:36:00+08:00
