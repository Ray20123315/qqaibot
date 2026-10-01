# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker deployment was not intentionally modified.
- No real QQ-group Bot test messages were sent.

## Feature Source

- branch: `feature/v4-public-bot`
- feature head: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`
- final GitHub CI: `36879734052` — SUCCESS
- Cloudflare feature build: `04d90ceb-db5a-4bab-b9eb-c1f573be583c` — SUCCESS
- Worker version: 2217
- Worker version id: `a371d22a-5dd9-4e82-a9e0-f1cc64553406`

## Reload / Authentication State

Persistent session architecture from v0.0.52 remains:
- `qqai_session` + `qqai_remember` are HttpOnly/Secure/SameSite=Lax;
- persistent lifetime: 30-day idle / 180-day absolute;
- remember records are SHA-256-keyed and can reconstruct a new server session;
- restore rotates remember state; logout revokes it.

Reload-specific fixes:
- removed stale `runSimulator` handler that referenced deleted DOM and aborted the script before `boot();`;
- `boot()` now applies/binds motion mode and performs `recoverPortalApiSession()` before optional UI setup;
- optional UI setup is fault-isolated;
- non-/me Portal API 401s await a shared /me recovery and retry rather than immediately calling `showLogin()`;
- only /me consumes/rotates remember state, preventing concurrent recovery races.

## Transition State

Reference-specific behavior now implemented:
- explicit motion mode key `qqai-motion-mode`, default `full`;
- topbar `動效：完整／精簡` toggle;
- page activation happens inside the View Transition update callback;
- `qqai-view-enter` / `qqaiPageInStrong`;
- card/item `qqaiRiseInStrong` stagger;
- animated page title and subtitle;
- eased integer counters;
- moving nav indicator;
- topbar `qqaiMotionSweepStrong`;
- `qqaiVtOldStrong` / `qqaiVtNewStrong`;
- visible 3-orb purple/cyan aurora and pointer-follow light.

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `3b66f8c8-bd9b-470b-83e7-9c41c3720004`
- deployment number: 19
- source: `aaa7cc3b3a846ea37dc6a7efbfc9db831add29ce`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production-sensitive bindings: absent

## Live Browser Evidence

Transition:
- init `data-motion=full`
- motion toggle bound = `1`
- clicked visible health nav item
- View Transition count = 1
- destination active = true
- `qqai-view-enter` active during transition = true
- running animations = 36
- observed names include `qqaiPageInStrong`, `qqaiRiseInStrong`, `qqaiMotionSweepStrong`, `qqaiVtOldStrong`, `qqaiVtNewStrong`
- destination title/subtitle changed correctly
- destination remains active after transition completion

Reload:
- one Preview login
- actual `location.reload()`
- final app class `app`
- final login class `login hidden`
- final motion `full`
- identity `v4-preview-test 系统管理员`
- HTTP/origin 200

## Bot Testing

Live Bot testing remains paused because no isolated QQ Bot/canary transport exists.

## Merge State

BLOCKED by user acceptance gate. `main` is unchanged.
