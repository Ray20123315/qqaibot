# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified revision: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- Worker: `qqai`
- Cloudflare Connected Build: `09d6a646-a0b2-4e98-b73d-d9f2c74925c0`
- outcome: `success`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- Group discovery uses one managed category-root panel because group PanelItem has no nested submenu.
- Selecting a group category returns a clickable QQ inline-keyboard card.
- Keyboard pages use two command buttons per row, at most five rows, with pagination for large categories.
- Button callback data is the existing canonical `!` command, so permissions and handlers are not duplicated.
- Plain text remains a fallback only when QQ deterministically rejects keyboard capability.
- Developer remains the highest cumulative permission level; runtime authorization is authoritative.

## Portal Authentication

- normal production admin credential remains intact.
- separate TEMP system-admin credentials are secret-backed and self-expiring.
- Cloudflare Rate Limiter remains primary with atomic D1 fallback on limiter invocation failure.
- TEMP credential values are never stored in Git or memory.

## Public V4 Resource Model

- Shared platform infrastructure stays central, while user-owned AI/storage resources are explicit per-principal resources.
- Preview/testing must not share the production table namespace.

## Safety

- Never store secrets in Git or Ray_Chen memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
- Never retry ambiguous mutating writes through a second transport.
