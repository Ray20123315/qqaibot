# Ray_Chen Memory Entry

- memory_version: v0.0.51
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 5
- product_revision: 654d340be94559ba3409a9b6e4de3f8a2eb2c849
- updated_at: 2026-10-01T18:04:00+08:00

## Current Goal

Keep all V4 acceptance work off production. Make "keep me signed in" a real persistent-login path across all Portal login modes, not a Preview-only workaround, and bring the Portal background/transition motion toward the user-provided OneDrive Vault reference. Do not live-test Bot behavior in real QQ groups because there is no isolated Bot/canary path.

## Verified Product State

- Feature product head: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`.
- Final GitHub CI run `36846206642`: SUCCESS across repository regression, V3, V4 QQ Open, isolated V4 deployment checks and single Worker bundle.
- Persistent sessions now use the project-wide 30-day idle / 180-day absolute limits even for developer/admin/system-admin accounts when "keep me signed in" is selected.
- Unchecked privileged sessions keep the shorter 30-minute idle / 8-hour absolute limits.
- All successful persistent login modes can issue a separate opaque remember-device token in addition to the HttpOnly session cookie.
- Remember records are hash-keyed server-side, rotate after successful restore, and can be revoked on logout.
- `POST /api/auth/restore-session` can restore a persistent session and set a replacement HttpOnly cookie even when the original session cookie is absent.
- Successful login remains same-page; forced reload is not part of login completion.
- Portal visuals now include the reference-inspired dark aurora background, purple/cyan blurred light fields, glass surfaces, button sheen, card hover glow/lift, page-enter motion, topbar sweep and View Transition support, with reduced-motion fallback.

## Stable Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `b821dd63-d777-405f-b60c-2ce8d2e76fc0`
- deployment number: 10
- source annotation: `654d340be94559ba3409a9b6e4de3f8a2eb2c849`
- isolated D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Verification

- One-click Preview login entered the control panel.
- Generic `qqai_portal_remember` token was created in client storage.
- A live `POST /api/auth/restore-session` made with `credentials:'omit'` (no original session cookie) returned HTTP 200 / ok=true and a rotated remember token.
- Live Preview HTML contains `qqai-reference-motion-v1`, aurora animation, page-enter animation, View Transition logic and generic remember storage code.
- The automated browser tool is not considered authoritative for preserving browser storage across a full navigation/restart. Real-browser refresh/close/reopen remains the user's acceptance check.

## Bot Test Constraint

Do not send live Bot test messages or run real QQ-group canaries until an isolated Bot/canary route exists or the user explicitly authorizes a scoped live test.

## Production / Merge Gate

- `main` remains untouched.
- Do not merge until the user accepts V4.
- Preview-only highest-privilege test login and legacy Preview resume path must be removed or disabled before any production merge.

## Resume Rule

Resume from v0.0.51. The next exact action is the user's real-browser acceptance check: sign in with "keep me signed in", refresh, then close/reopen the browser and confirm the Portal restores without credentials. Also visually review the new background and transition motion on the stable Preview. Bot live testing remains paused.
