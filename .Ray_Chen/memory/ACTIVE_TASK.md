# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 3

## Goal

Fix the V4 Portal double-login bug while preserving the already-verified V4 command/identity/whitelist work. Keep all work on `feature/v4-public-bot`; do not touch `main`; do not live-test the Bot in real QQ groups because there is no isolated Bot/canary environment.

## Acceptance Criteria

- One successful login attempt must establish the session and transition through a clean page reload instead of requiring the user to submit credentials again.
- The fix must cover QQ code login, password login and Preview test login.
- Backend session/cookie semantics must remain valid.
- Full repository/V3/V4/isolated/bundle CI must pass.
- Stable Preview must receive only the verified code while retaining Preview-safe bindings.
- No live Bot messages or group-side canary testing in existing QQ groups.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED: identified all three successful login paths as immediately calling `boot()` after `Set-Cookie`.
- VERIFIED: added `finishPortalLogin()` to perform a full page reload after successful authentication.
- VERIFIED: QQ code, password, and Preview login now all use the new completion path.
- VERIFIED: regression assertions reject the old same-page `await boot()` pattern and require `finishPortalLogin()`.
- VERIFIED: GitHub CI run `36840520274` succeeded across repository, V3, V4, isolated V4 deployment checks and bundle.
- VERIFIED: Cloudflare Connected Build `5d11ffad-1a68-48f6-8daa-630246f8c16b` succeeded for `262b019b3246ea9fba54975fc3f4954e6cfd432a`.
- VERIFIED: Worker version `2171` / `9c24fac6-664c-439e-b005-2f5496ffe81f` is the latest feature version used for Preview modules.
- VERIFIED: stable Preview deployment #7 `97c695ee-b4f7-4bdd-b353-3b23ad5b56b4` was created from the verified feature modules.
- VERIFIED: Preview bindings read back as isolated; no production-sensitive bindings were introduced.
- VERIFIED LIVE BACKEND: same-origin Browser Rendering probe returned login 200/ok=true followed immediately by `/api/portal/me` 200/ok=true/systemAdmin=true.
- NOT CLAIMED: Browser Rendering DOM-click/reload observation was inconclusive because injected-script state does not survive the navigation cleanly. It is not counted as live UI proof.

## Product Files Changed

- `src/portal/runtime.js`
- `verify-portal-auth-password.mjs`

## Hard Constraints

- Do not merge or update `main`.
- Do not live-test Bot behavior in existing QQ groups.
- Do not enable QQ Open or production QQ/OneBot/AI secrets in the isolated Preview.
- Do not claim a Browser Rendering DOM-click result as proof when navigation instrumentation is inconclusive.

## Current Phase

user_acceptance

## next_exact_action

User opens the stable V4 Preview and confirms that a single login attempt now enters the control panel. Bot live testing remains paused until an isolated test route exists or the user explicitly authorizes a specific real-group test.

last_checkpoint_at: 2026-10-01T17:08:00+08:00
