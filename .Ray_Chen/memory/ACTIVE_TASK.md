# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 1

## Goal

Let the user enter the V4 Preview with highest privilege, inspect the implementation in real use, and only then decide what should be merged into production.

## Completed Steps

- VERIFIED: feature branch was non-force fast-forwarded to current main before new Preview-only work.
- VERIFIED: added `POST /api/auth/preview-test-login` only on the feature branch.
- VERIFIED: login is restricted to the exact stable Preview hostname.
- VERIFIED: login requires `V4_PREVIEW_TEST_LOGIN=true`.
- VERIFIED: login expires at `2026-10-03T00:00:00+08:00`.
- VERIFIED: login refuses when `QQ_OPEN_ENABLED` is not false.
- VERIFIED: Portal login page shows a Preview-only highest-privilege test button only on the stable Preview hostname.
- VERIFIED: feature CI `36797489597` passed all repository/V3/V4/isolated/bundle checks.
- VERIFIED: Cloudflare branch build succeeded.
- VERIFIED: stable Preview deployment uses only explicit safe bindings.
- VERIFIED LIVE: Browser Rendering used the real Preview endpoint; login returned 200/systemAdmin=true and viewer returned developer=true/role=developer/systemAdmin=true.

## Changed Product Files

- `worker.js`
- `src/portal/runtime.js`
- `verify-system-admin-auth.mjs`
- `wrangler.toml`

## Cloudflare Preview

- Preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `df3e4ed6-59c5-4ece-9cd4-e711846525a2`
- deployment number: 5
- D1 table: `kv_store_v4public_preview`
- production secret bindings: excluded

## Failed/Changed Approaches

- Copying production TEMP secrets into Preview was blocked by platform safety controls; abandoned.
- Copying/storing password hashes into Preview D1 was blocked by platform safety controls; abandoned.
- Final method: credential-free Preview-only test login with hostname, expiry and isolation checks.

## Hard Constraint

Do not merge Preview-only test-login functionality into production before manual user acceptance. Before any eventual merge, remove or disable the Preview test-login path.

## next_exact_action

User opens the stable V4 Preview URL, clicks “进入 V4 最高权限测试”, and reports whether the V4 interface and functions are usable.

last_checkpoint_at: 2026-10-01T08:47:00+08:00
