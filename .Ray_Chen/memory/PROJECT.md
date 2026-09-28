# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using a hybrid transport architecture. QQ Open/AIBot is the primary official transport; NapCat/OneBot remains an auxiliary observation channel and controlled capability fallback.

## Current Production

- branch: `main`
- verified product revision: `f44c8118c83e57637a6b0f55f0013ff093b2f1fc`
- Worker: `qqai`
- Cloudflare Connected Build: `e5270c67-4c0e-4eaf-9d1a-3d5feb95cdd5`
- build outcome: `success`
- Durable Objects: `OneBotHub`, `QqOpenGateway`
- Hybrid primary: `qq-open`

## Discovery Model

- C2C public menu: QQ native one-level submenus.
- Group: categorized command panels; `only_admin` used where QQ supports it.
- Developer: specific C2C panels inherit the ordinary member command surface and add Developer-only commands.
- Higher privilege must never remove lower-privilege discoverability.
- Discovery visibility is UX only; runtime authorization is authoritative.

## Transport Rules

- QQ Open is attempted first.
- OneBot must not process the same inbound command in parallel.
- Cross-transport write retry remains conservative.
- `ONEBOT_READ_ONLY` remains authoritative when enabled.

## Safety

- Never store secrets in Git or memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
