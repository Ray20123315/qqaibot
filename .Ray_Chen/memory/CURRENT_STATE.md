# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker deployment was not intentionally modified.
- No real QQ-group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- feature head: `95af14b3d66b0ac22ddc05f638e74186285f1601`
- final GitHub CI: `36988519024` — SUCCESS
- Cloudflare feature build: `4e7b2549-b0c3-4c8c-bede-25f219b4ba98` — SUCCESS
- Worker version: 2227
- Worker version id: `e9301249-0cd6-453f-951e-7a5e5ecee9d9`

## Authentication State

- User has confirmed persistent login works.
- HttpOnly `qqai_session` + `qqai_remember`, remember rotation/revocation and missing-session reconstruction remain unchanged.
- Portal bootstrap authentication recovery remains serialized through `/api/portal/me`.
- Latest Preview #25 reload smoke ended authenticated: app visible, login hidden.

## Transition State

Current deterministic transition system:
- no `motionToggle` UI;
- no document.startViewTransition path;
- old view: `qqaiPageOutRef` 0.22s;
- new view: `qqaiPageInRef` 0.55s from translateY(18px) scale(.985);
- card/grid/hero/status entry: 0.52s;
- stagger delays: 0.03 / 0.09 / 0.15 / 0.21 / 0.27s;
- content fade: 0.46s;
- ripple: 0.55s ease-out;
- nav click pop, title/subtitle animation, numeric easing, nav indicator and topbar motion sweep retained;
- strong three-orb aurora and pointer-follow glow retained;
- prefers-reduced-motion still collapses nonessential motion.

Toast:
- fixed overlay;
- bottom-center;
- bottom 26px;
- max width 360px;
- 0.24s slide/fade;
- no layout participation.

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `6ba45208-40af-44b4-b0fb-d0097ca96b56`
- deployment number: 25
- source: `95af14b3d66b0ac22ddc05f638e74186285f1601`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production-sensitive bindings: absent

## Live Browser Evidence

Transition:
- early probe: old overview leave=true, destination active=false, ripple count=1;
- mid probe: destination active=true, destination enter=true, running animation count=7;
- observed animation names: `qqaiPageInRef`, `qqaiCardInRef`, `qqaiContentFade`;
- final title/subtitle: 系统诊断 / 快速检查连线、模型与服务状态.

Toast:
- live rect left=540, width=360, height=64 on 1440px viewport;
- CSS position=fixed, left=720px/50%, bottom=26px, opacity=1;
- transform centers by -180px.

Reload:
- final app class: `app`;
- final login class: `login hidden`.

## Bot Testing

Live Bot testing remains paused because no isolated QQ Bot/canary transport exists.

## Merge State

BLOCKED by user visual acceptance gate. `main` is unchanged.
