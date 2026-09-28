# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `0fa643433285df0879878441e846dcfc023054b7`
- Worker: `qqai`
- Cloudflare Connected Build: `0d835129-1a85-413b-9e0a-ec063da9e464`
- outcome: `success`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- Group discovery uses one managed category-root panel.
- Selecting a group category returns a QQ inline-keyboard card.
- Keyboard pages use two command buttons per row, at most five rows, with pagination for large categories.
- Button callback data is the existing canonical `!` command.
- Custom keyboard payload follows Tencent's current SDK DTO shape and is carried in Markdown `msg_type:2` messages.
- Deterministic keyboard rejection may fall back to text and is recorded in keyboard-specific diagnostics.
- Ambiguous failures are never resent.
- Developer remains the highest cumulative permission level; runtime authorization is authoritative.

## Portal Authentication

- normal production admin credential remains intact.
- separate TEMP system-admin credentials are secret-backed and self-expiring.
- Cloudflare Rate Limiter remains primary with atomic D1 fallback.
- TEMP credential values are never stored in Git or memory.

## Public V4 Resource Model

- Shared platform infrastructure stays central, while user-owned AI/storage resources are explicit per-principal resources.
- Preview/testing must not share the production table namespace.

## Safety

- Never store secrets in Git or Ray_Chen memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
- Never retry ambiguous mutating writes through a second transport.
