# VERIFY

## Product Revision

`aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`

## GitHub

Final CI:
- run: `36879734052`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Regression coverage added in this round:
- removed simulator handler cannot remain as an unguarded bootstrap binding;
- boot authentication recovery must occur before optional UI bootstrap;
- ordinary Portal API calls must not consume remember state directly;
- when an ordinary API returns 401, the client shares a single /me recovery and retries;
- reference transition sequencing requires title/subtitle, stagger, nav indicator and page-enter inside the View Transition update;
- Portal motion defaults to `full` via the explicit motion setting, not OS preference.

## Cloudflare Feature Build

- build UUID: `04d90ceb-db5a-4bab-b9eb-c1f573be583c`
- branch: `feature/v4-public-bot`
- commit: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`
- outcome: SUCCESS
- Worker version: 2217
- Worker version id: `a371d22a-5dd9-4e82-a9e0-f1cc64553406`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `3b66f8c8-bd9b-470b-83e7-9c41c3720004`
- deployment number: 19
- source annotation: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`

Isolation read-back:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ/OneBot/AI/Vectorize/Portal-admin sensitive bindings: absent

## Live Transition Proof

Chromium on Preview #19:
- `data-motion=full`
- `motionToggle.dataset.bound=1`
- selected destination: health
- View Transition invoked once
- `updateCallbackDone=ok`, `finished=ok`
- destination active=true
- destination had `qqai-view-enter` during the observation
- 36 animations running during the transition
- observed: `qqaiPageInStrong`, multiple `qqaiRiseInStrong`, `qqaiMotionSweepStrong`, `qqaiVtOldStrong`, `qqaiVtNewStrong`
- title/subtitle changed to 系统诊断 / 快速检查连线、模型与服务状态
- destination remained active after animation cleanup

## Live Reload Proof

Chromium on Preview #19:
1. Preview login button clicked once.
2. App became visible.
3. Browser executed actual `location.reload()`.
4. Final DOM:
   - app class: `app`
   - login class: `login hidden`
   - motion: `full`
   - identity: `v4-preview-test 系统管理员`
   - root/origin HTTP: 200

This is the first automated full-reload proof in this task that ends on the authenticated app rather than the login page.

## Bot Verification Boundary

No live Bot/group canary was run.

## Production

No merge to `main`.
