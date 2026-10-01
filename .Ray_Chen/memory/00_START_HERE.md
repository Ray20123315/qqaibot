# Ray_Chen Memory Entry

- memory_version: v0.0.50
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 4
- product_revision: d64126c8d39e2bfad23ea6355c8e764573bc0692
- updated_at: 2026-10-01T17:36:00+08:00

## Current Goal

Keep all V4 acceptance work off production. Fix Portal login so one authentication is enough, do not require a page reload to enter the app, and recover the isolated Preview session automatically if the browser loses the HttpOnly session cookie across reload. Do not live-test Bot behavior in real QQ groups because there is no isolated Bot/canary path.

## Verified Product State

- Feature product head: `d64126c8d39e2bfad23ea6355c8e764573bc0692`.
- Final GitHub CI run `36843510857`: SUCCESS across repository regression, V3, V4 QQ Open, isolated V4 deployment checks and single Worker bundle.
- Successful login now stays on the same page, confirms `/api/portal/me`, and enters the control panel directly.
- Preview login issues a separate opaque resume token that is not the HttpOnly session cookie.
- Preview resume records are hash-keyed server-side, exact-Preview-host only, require `QQ_OPEN_ENABLED=false`, rotate after use, expire within the Preview/system-admin security window, and are revoked on logout.
- High-privilege remember-login is no longer silently forced off. Developer/admin/system-admin sessions may use persistent browser cookies while still retaining the 30-minute idle / 8-hour absolute privileged-session security caps.
- Cookie Max-Age is aligned with the actual server session absolute lifetime rather than advertising a longer browser lifetime than the server accepts.

## Stable Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `7e284694-6e51-41f8-8d7f-443454af0b62`
- deployment number: 9
- source annotation: `d64126c8d39e2bfad23ea6355c8e764573bc0692`
- isolated D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Verification

- One-click Preview login: app shown, login hidden, identity `v4-preview-test 系統管理員`.
- Preview resume token is stored client-side only for the isolated Preview; live resume call returned HTTP 200 / ok=true and rotated a new token.
- Integration regression verifies cookie-loss recovery, restored cookie authentication to `/api/portal/me`, one-time token rotation, and logout revocation.
- Browser Rendering is not treated as authoritative across full page navigation because injected storage/context is not guaranteed to survive the tool's navigation boundary. Actual browser reload remains the user's acceptance check.

## Bot Test Constraint

Do not send live Bot test messages or run real QQ-group canaries until an isolated Bot/canary route exists or the user explicitly authorizes a scoped live test.

## Production / Merge Gate

- `main` remains untouched.
- Do not merge until the user accepts V4.
- Preview-only test-login/resume functionality must be removed or disabled before any future production merge.

## Resume Rule

Resume from v0.0.50. The next exact action is the user's real-browser check: log in once on the stable Preview, then refresh/reload and confirm the control panel remains available without credentials. Bot live testing remains paused.
