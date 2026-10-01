# Ray_Chen Memory Entry

- memory_version: v0.0.54
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 5
- product_revision: aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce
- updated_at: 2026-10-01T23:02:00+08:00

## Current Goal

Keep all V4 acceptance work off production. Make real-browser reload preserve Portal authentication and reproduce the user-provided reference's obvious transition system, not merely its animated background. Do not live-test Bot behavior in real QQ groups because there is no isolated Bot/canary path.

## Root Causes Confirmed

- Reload logout root cause #1: the Portal script still contained an unconditional `$('runSimulator').onclick=...` binding after the simulator DOM had been removed. That null dereference occurred before the final `boot();`, so a refreshed page never ran authentication restoration and stayed on the initial login screen.
- Reload logout root cause #2: incidental Portal API 401 responses could call `showLogin()` while `/api/portal/me` was still restoring the remember session.
- Transition root cause: page-enter/stagger work was triggered outside the View Transition update callback, allowing the animation to run before the new view became visible.
- Motion mismatch: the supplied reference defaults to its own `full` motion mode; it does not silently disable the transition system based on OS reduced-motion preference.

## Verified Product State

- Feature head: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`.
- Final GitHub CI run `36879734052`: SUCCESS across repository regression, V3, V4 QQ Open, isolated V4 deployment checks and single Worker bundle.
- Cloudflare Connected Build `04d90ceb-db5a-4bab-b9eb-c1f573be583c`: SUCCESS.
- Worker version 2217 / `a371d22a-5dd9-4e82-a9e0-f1cc64553406`.
- Persistent auth still uses HttpOnly `qqai_session` + `qqai_remember`, remember rotation/revocation, and session reconstruction when the original server session is absent.
- Portal boot now applies/binds motion mode, performs the shared `/api/portal/me` auth recovery, and only then runs optional UI bootstrap steps under failure isolation.
- Non-/me Portal API 401s share one `portalAuthRecovery` promise and retry after /me succeeds.
- The stale simulator bootstrap handler is removed.
- Transition rendering now executes page activation, title/subtitle animation, page-enter, stagger, motion bar and nav indicator from inside the View Transition update callback.
- Motion mode defaults to `full` and the topbar exposes `動效：完整／精簡`.
- Numeric counters use reference-style easing.

## Stable Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `3b66f8c8-bd9b-470b-83e7-9c41c3720004`
- deployment number: 19
- source annotation: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`
- isolated D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production-sensitive bindings: absent

## Live Verification

Transition probe on Preview #19:
- `data-motion=full`
- motion toggle bound = 1
- destination: health/system diagnostics
- View Transition invoked = 1
- destination view active = true
- destination had `qqai-view-enter` during the transition
- 36 animations were running at the observation point
- running animations included `qqaiPageInStrong`, multiple `qqaiRiseInStrong`, `qqaiMotionSweepStrong`, `qqaiVtOldStrong` and `qqaiVtNewStrong`
- page title/subtitle changed to 系统诊断 / 快速检查连线、模型与服务状态
- page-enter was removed after completion while the destination remained active

Reload probe on Preview #19:
- login once, then actual `location.reload()`
- final app class: `app`
- final login class: `login hidden`
- final `data-motion=full`
- identity remained `v4-preview-test 系统管理员`
- final HTTP/origin status 200

## Bot / Production Constraints

- No live QQ-group Bot test was run.
- `main` remains untouched.
- Do not merge until the user manually accepts V4.
- Preview-only highest-privilege acceptance login must be removed or disabled before production merge.

## Resume Rule

Resume from v0.0.54. The next exact action is user real-browser acceptance on Preview #19: login once, reload, and switch between multiple sidebar pages to confirm persistent login and the reference-style transitions are visibly correct.
