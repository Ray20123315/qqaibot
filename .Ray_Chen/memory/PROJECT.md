# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `9f78fc66547d278a72858bbd25a22f00dda7ba2a`
- Worker: `qqai`
- Cloudflare Connected Build: `521ccfd8-bc55-4aff-9fdb-f0515f5ebcea`
- outcome: `success`
- QQ_OPEN_INTENTS: `100663296`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- QQ native group discovery directly publishes concrete commands across categorized panels generated from the canonical registry.
- Native group panels contain at most 20 items each and are kept within the overall discovery panel limit.
- Category placeholder commands such as `!面板 群聊` do not replace the real native command list.
- Manual `!面板 <分类>` remains available and returns the two-column inline-keyboard category view.
- Large inline-keyboard categories paginate within QQ keyboard limits.
- Direct/no-argument inline-keyboard child commands use `action.type=2`, `enter=true`, `reply=false`.
- Parameter/target/content child commands use `action.type=2`, `enter=false` and an editable trailing-space prefill.
- Normal inline-keyboard buttons omit `click_limit` and remain reusable.
- Native and inline command data reuse canonical existing `!` commands.
- INTERACTION intent remains enabled for unrelated interaction features.
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
