# Ray_Chen Memory Entry

- memory_version: v0.0.52
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 5
- product_revision: ca92f9a0628ac57a14ec8ffe505a79c79a01793c
- updated_at: 2026-10-01T21:50:00+08:00

## Current Goal

Keep all V4 acceptance work off production. Make persistent Portal login survive refresh even if the ordinary server session record disappears, and make the Portal animation visibly match the supplied dark-glass purple/cyan aurora reference. Do not live-test Bot behavior in real QQ groups because there is no isolated Bot/canary path.

## Verified Product State

- Feature product head: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`.
- Final GitHub CI run `36871158902`: SUCCESS across repository regression, V3, V4 QQ Open, isolated V4 deployment checks and single Worker bundle.
- Persistent login now sets both `qqai_session` and a separate `qqai_remember` as HttpOnly, Secure, SameSite=Lax cookies.
- Remember records are keyed by SHA-256 of the opaque remember credential and now carry only the minimum session seed needed to reconstruct a new persistent server session.
- `GET /api/portal/me` automatically attempts remember-cookie recovery when the ordinary session is absent or invalid.
- If the remember record still points to a server session that no longer exists, the server rebuilds a new session from the stored seed, caps it to the remember expiry, rotates the remember credential and returns replacement cookies.
- Logout revokes the active remember credential and clears both session and remember cookies.
- Persistent sessions use the configured 30-day idle / 180-day absolute limits; unchecked privileged sessions retain the short 30-minute idle / 8-hour absolute limits.
- Successful login remains in-page; no forced reload is part of login completion.
- The Portal now uses a real foreground aurora layer with three large moving orbs, a moving light ribbon, pointer-follow glow, stronger page transitions and glass effects. Light theme keeps the aurora at `opacity:.58` rather than suppressing it.

## Stable Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `9e54bef0-0af0-47be-abd4-9f4841c70318`
- deployment number: 16
- source annotation: `ca92f9a0628ac57a14ec8ffe505a79c79a01793c`
- Worker version: 2207 / `49b8b3d4-a907-49b0-9448-9fce34b99d74`
- isolated D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Verification

- Failure-injection Preview deployment #15 was used only to prove recovery and its temporary diagnostics were then removed.
- Before invalidation: session cookie present/valid and remember cookie/record present.
- After deliberately deleting the server session: the browser still had both cookies, the session was invalid, and the remember record was valid.
- The next `/api/portal/me` returned HTTP 200 with `systemAdmin=true`; a new server session existed afterwards and the remember credential remained valid after rotation.
- Final Preview #16: one-click Preview login shows the app and hides the login page; `/api/portal/me` returns HTTP 200 / ok=true / systemAdmin=true.
- Final Chromium visual probe: `qqaiFloatOrbA` is running, light-theme aurora opacity is `0.58`, three orbs are present, and the orb transform changes over time.

## Bot Test Constraint

Do not send live Bot test messages or run real QQ-group canaries until an isolated Bot/canary route exists or the user explicitly authorizes a scoped live test.

## Production / Merge Gate

- `main` remains untouched.
- Do not merge until the user accepts V4.
- Preview-only highest-privilege test login and legacy Preview resume path must be removed or disabled before any production merge.

## Resume Rule

Resume from v0.0.52. The next exact action is the user's real-browser acceptance check on the stable Preview: sign in once, refresh the page, confirm it stays authenticated, and visually confirm the stronger aurora/page motion matches the supplied reference closely enough. Bot live testing remains paused.
