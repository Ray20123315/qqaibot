# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using a hybrid transport architecture. QQ Open/AIBot is the primary official transport; NapCat/OneBot remains an auxiliary observation channel and a controlled capability fallback.

## Current Production

- branch: `main`
- verified product revision: `b86f762000dc6f498340c54696123328d0328db6`
- Worker: `qqai`
- Cloudflare Connected Build: `435505a0-a118-4830-a4dc-f216b2ace61b`
- build outcome: `success`
- deploy command: `npx wrangler deploy worker.js --no-assets`
- Durable Objects: `OneBotHub`, `QqOpenGateway`
- Hybrid primary: `qq-open`

## Discovery Model

- C2C: QQ global custom menu with one-level native submenus; category pages keep every public member command discoverable within QQ limits.
- Group: help-aligned category command panels; admin-capable entries use QQ `only_admin` when applicable.
- Developer: not exposed globally in group discovery; specific C2C developer panels may be generated for configured developer OpenIDs.
- Discovery visibility is UX only. Runtime authorization remains mandatory.

## Transport Rules

- QQ Open owns supported official message/action flows and is always attempted first.
- OneBot must not process the same inbound command in parallel while QQ Open is primary.
- A legacy action fallback is allowed only after a deterministic official unsupported/unavailable condition or for a safe read fallback.
- Ambiguous mutating timeout/5xx results are never cross-retried.
- Mutating group fallback requires a confirmed QQ Open group -> numeric OneBot group mapping and a live legacy Bot role check.
- Member-target fallback requires a confirmed member OpenID -> numeric QQ mapping.
- `ONEBOT_READ_ONLY` remains authoritative when enabled.

## Safety

- Never store QQ AppSecret/access tokens in Git or memory.
- Never coerce OpenID/group_openid into numeric QQ IDs.
- Never retry a potentially completed write through another transport after an ambiguous result.
- Keep OneBot auxiliary; do not restore duplicate reply ownership.
