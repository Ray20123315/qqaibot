# VERIFY

## Product Revision

`95af14b3d66b0ac22ddc05f638e74186285f1601`

## GitHub

Final CI:
- run: `36988519024`
- conclusion: SUCCESS
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- isolated V4 deployment checks: success
- single Worker bundle: success

Transition regression coverage:
- no motionToggle/motion-mode control is rendered;
- no document.startViewTransition path remains;
- deterministic view leave/enter classes are required;
- leave cadence is 0.22s;
- page entry cadence is 0.55s and starts at translateY(18px) scale(.985);
- card/content entry keyframes remain present;
- view activation waits 220ms after leave begins;
- ripple cadence is 0.55s ease-out;
- toast must be bottom-center, max width 360px and slide/fade when visible;
- auth/reload regressions from v0.0.54 remain intact.

## Cloudflare Feature Build

- build UUID: `4e7b2549-b0c3-4c8c-bede-25f219b4ba98`
- branch: `feature/v4-public-bot`
- commit: `95af14b3d66b0ac22ddc05f638e74186285f1601`
- outcome: SUCCESS
- Worker version: 2227
- Worker version id: `e9301249-0cd6-453f-951e-7a5e5ecee9d9`

## Stable Preview

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `6ba45208-40af-44b4-b0fb-d0097ca96b56`
- deployment number: 25
- source annotation: `95af14b3d66b0ac22ddc05f638e74186285f1601`

Isolation read-back:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ/OneBot/AI/Codex/Portal-admin sensitive bindings: absent

## Live Transition Proof

Chromium on Preview #25:
1. One Preview login completed; app visible.
2. Health nav received pointerdown and click.
3. At ~80ms: old overview had `qqai-view-leave=true`, health active=false, ripple count=1.
4. After activation: health active=true, `qqai-view-enter=true`, 7 subtree animations running.
5. Observed animation names included `qqaiPageInRef`, `qqaiCardInRef`, `qqaiContentFade`.
6. Final title/subtitle changed correctly.

## Live Toast Proof

On 1440px viewport:
- width: 360px
- height: 64px
- position: fixed
- horizontal center: x=720 with translateX(-180px)
- bottom: 26px
- opacity: 1 while shown

This fixes the screenshot issue where notification/control UI visually occupied a large content strip.

## Live Reload Proof

On Preview #25 after login then actual reload:
- final app class: `app`
- final login class: `login hidden`
- HTTP/origin status: 200

## Bot Verification Boundary

No live Bot/group canary was run.

## Production

No merge to `main`.
