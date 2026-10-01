# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `6cb891571bdb2744b13bd11e3731c2a267fdf1ed`
- Worker: `qqai`
- Cloudflare Connected Build: `d8abfda4-4595-427a-8fbf-7f0a5ffcd31f`
- outcome: `success`
- QQ_OPEN_INTENTS: `100663296`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- Group discovery uses one managed category-root panel.
- Selecting a group category returns a QQ inline-keyboard card.
- Current group categories include 基础、群聊、关系、互动、记忆、活动、群规、AI管理、群操作、群主、开发者.
- Keyboard pages use two command buttons per row, at most five rows, with pagination.
- Direct/no-argument commands use QQ command buttons with `action.type=2`, `enter=true`, `reply=false`.
- Parameter/target/content commands use `action.type=2`, `enter=false` and an editable trailing-space prefill.
- Normal panel buttons omit `click_limit` and remain reusable.
- Button command data reuses canonical existing `!` commands.
- INTERACTION intent remains enabled for unrelated interaction features, but normal direct panel commands no longer depend on callback execution.
- Runtime authorization remains authoritative.

## Portal Authentication

- normal production admin credential remains intact.
- separate TEMP system-admin credentials are secret-backed and self-expiring.
- Cloudflare Rate Limiter remains primary with atomic D1 fallback.
- TEMP credential values are never stored in Git or memory.

## Safety

- Never store secrets in Git or Ray_Chen memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
- Never retry ambiguous mutating writes through a second transport.
