# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product code revision: `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe`
- deployed main trigger revision: `aebde1ca3e43cc809645803456b639e659d56fc5`
- Worker: `qqai`
- Cloudflare Connected Build: `6f36a019-e50f-4907-af27-6197b5088e8b`
- outcome: `success`
- QQ_OPEN_INTENTS: `100663296`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- QQ native group discovery uses one compact category-root panel because the native client cannot reliably display the full command surface.
- Selecting a retained category sends `!面板 <分类>` and returns a bot-managed two-column paginated inline keyboard.
- Inline keyboard pagination stays within QQ keyboard row/button limits.
- Direct/no-argument child commands use `action.type=2`, `enter=true`, `reply=false`.
- Parameter/target/content child commands use `action.type=2`, `enter=false` and a trailing-space prefill.
- Normal buttons omit `click_limit` and remain reusable.
- Runtime authorization remains authoritative.

## Retired Features

- master/partner relationship command and Portal functionality is retired.
- Historical relationship rows can only be deleted for cleanup.
- Historical master/partner mute-lock sources remain readable only to expire or unlock safely.
- Werewolf functionality remains removed.

## Safety

- Never store secrets in Git or Ray_Chen memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
- Never retry ambiguous mutating writes through a second transport.
