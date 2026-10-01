# CURRENT_STATE

## GitHub / Production

- canonical branch: main
- product revision: `6cb891571bdb2744b13bd11e3731c2a267fdf1ed`
- development validation: GitHub Actions `36848544391` — success
- main validation: GitHub Actions `36848826594` — success
- Cloudflare Worker: `qqai`
- production Connected Build: `d8abfda4-4595-427a-8fbf-7f0a5ffcd31f` — success
- deployed branch/commit: `main` / `6cb891571bdb2744b13bd11e3731c2a267fdf1ed`

## Command Panel Behavior

- Direct/no-argument: `action.type=2`, `enter=true`, `reply=false`, exact canonical command.
- Parameterized/target/content: `action.type=2`, `enter=false`, canonical command plus trailing space.
- Pagination: `action.type=2`, `enter=true`.
- Normal buttons: reusable; no `click_limit`.
- Direct group commands no longer use synthetic INTERACTION_CREATE callback dispatch.

## Discovery Coverage

New root categories:
- 关系
- 互动

Restored standalone command families include self mute, relationship/master/partner operations, group announcement/todo/file entry points, bot-interaction allowlist, sticker/whitelist application, poke/reaction/favorite-face/mall-face plugin commands, TTS, mimic/interjection settings, developer rate limits and private appeal status.

Intentional exclusions remain dynamic/non-standalone commands such as automatic check-in scheduling controls, relationship approval commands requiring request IDs, and the intentionally unavailable master-kick operation.

## Preserved State

- QQ Open/AIBot remains primary.
- OneBot remains controlled fallback only.
- QQ_OPEN_INTENTS stays `100663296`; Interaction support remains available for unrelated features.
- Server-side authorization and moderation confirmation remain authoritative.
- `/!普通内容` remains AI bypass.

## Verification State

- product patch: VERIFIED
- development CI: VERIFIED
- main update: VERIFIED
- main CI: VERIFIED
- production Connected Build: VERIFIED
- live QQ client direct-send/prefill smoke: PENDING_USER
