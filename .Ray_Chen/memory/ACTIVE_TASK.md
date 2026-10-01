# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 5

## Goal

Make V4 Portal reload preserve authentication and implement the supplied reference's obvious transition behavior: View Transition, page-enter, stagger, title/subtitle motion, numeric easing, moving nav indicator and motion bar. Keep changes on `feature/v4-public-bot`; do not touch `main`; do not live-test the Bot in real QQ groups.

## Acceptance Criteria

- One successful credential submission enters the Portal.
- Checking keep-signed-in persists authentication across actual page reload.
- Persistent auth retains HttpOnly session/remember cookies, hashed remember records, rotation/revocation and missing-session reconstruction.
- Portal boot performs authentication recovery before optional UI bootstrap.
- Optional removed/missing UI cannot abort auth bootstrap.
- Non-/me API 401s serialize through one /me recovery before retry and do not independently consume remember.
- Motion defaults to `full` like the supplied reference; user can explicitly switch to `reduce`.
- View activation and page-enter/stagger run inside the View Transition update callback.
- Page title/subtitle animate; numeric counters ease; nav indicator moves; motion bar sweeps.
- Strong purple/cyan aurora remains visible.
- Full repository/V3/V4/isolated/bundle CI passes.
- Preview remains isolated from production credentials and QQ Open.
- No live Bot/group canary testing.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED: removed stale `runSimulator` binding that threw before `boot();`.
- VERIFIED: authentication is recovered before optional R3/sidebar/security/dashboard bootstrap.
- VERIFIED: optional bootstrap steps are isolated by `safePortalBootstrapStep`.
- VERIFIED: boot and incidental API 401 recovery share `recoverPortalApiSession()`.
- VERIFIED: only /api/portal/me consumes/rotates the remember credential; ordinary APIs retry after shared /me recovery.
- VERIFIED: persistent remember/session reconstruction from v0.0.52 remains intact.
- VERIFIED: added manual motion mode using `qqai-motion-mode`, default `full`, with `動效：完整／精簡` topbar control.
- VERIFIED: removed automatic OS prefers-reduced-motion authority in favor of the supplied reference's explicit motion setting.
- VERIFIED: page title/subtitle animation, integer easing, stagger, nav indicator and motion bar are present.
- VERIFIED: showView starts destination activation and all transition effects inside `document.startViewTransition` update.
- VERIFIED: final GitHub CI `36879734052` SUCCESS.
- VERIFIED: Cloudflare build `04d90ceb-db5a-4bab-b9eb-c1f573be583c` SUCCESS.
- VERIFIED: Worker version 2217 / `a371d22a-5dd9-4e82-a9e0-f1cc64553406`.
- VERIFIED: Preview #19 `3b66f8c8-bd9b-470b-83e7-9c41c3720004` deployed with safe Preview bindings.
- VERIFIED LIVE TRANSITION: health navigation produced 1 View Transition, active destination view, `qqai-view-enter`, 36 concurrent animations and the expected strong transition animation names.
- VERIFIED LIVE RELOAD: after Preview login then actual `location.reload()`, final DOM remained app-visible/login-hidden with the system-admin identity.
- USER ACCEPTANCE PENDING: user real-browser confirmation.

## Product Files Changed Since v0.0.52

- `src/portal/runtime.js`
- `verify-system-admin-auth.mjs`
- `verify-portal-auth-password.mjs`

## Hard Constraints

- Do not merge/update `main`.
- Do not live-test Bot behavior in existing QQ groups.
- Do not enable QQ Open or production QQ/OneBot/AI secrets in the isolated Preview.
- Authentication recovery must not depend on optional UI initialization.
- Removed DOM features must not leave unguarded bootstrap bindings.
- Remember credentials remain bearer credentials and must stay hash-keyed/rotated/revoked server-side.
- Preview acceptance login is not production authentication.

## Current Phase

user_acceptance

## next_exact_action

User logs in once on Preview #19, reloads the page, then switches between several sidebar pages and confirms both persistent login and the visibly strong reference-style transitions.

last_checkpoint_at: 2026-10-01T23:02:00+08:00
