# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`
- Worker: `qqai`
- Cloudflare Connected Build: `16be6f33-cdd1-4e31-9a26-60036dc0f237`
- outcome: `success`
- QQ_OPEN_INTENTS: `100663296`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- Group discovery uses one managed category-root panel.
- Selecting a group category returns a QQ inline-keyboard card.
- Keyboard pages use two command buttons per row, at most five rows, with pagination.
- Button callback data reuses canonical existing `!` commands.
- Keyboard-bearing replies follow Tencent's current SDK DTO/Markdown shape.
- Button callbacks require both GROUP_MESSAGES (1<<25) and INTERACTION (1<<26).
- Gateway sessions record sessionIntents; a stale intent mask cannot be resumed after configuration changes.
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
