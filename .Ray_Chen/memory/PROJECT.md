# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using a hybrid transport architecture. QQ Open/AIBot is the primary official transport; NapCat/OneBot remains an auxiliary observation channel and a controlled capability fallback.

## Current Production

- branch: `main`
- verified product revision: `fd11cd640cae1124edc03b0fef3d8d8d529cc52b`
- Worker: `qqai`
- Cloudflare Connected Build: `53058046-38a3-4ecc-9fbd-581032693db5`
- build outcome: `success`
- deploy command: `npx wrangler deploy worker.js --no-assets`
- Durable Objects: `OneBotHub`, `QqOpenGateway`
- Hybrid primary: `qq-open`

## Transport Rules

- QQ Open owns supported official message/action flows and is always attempted first.
- OneBot must not process the same inbound command in parallel while QQ Open is primary.
- A legacy action fallback is allowed only after a deterministic official unsupported/unavailable condition or for a safe read fallback.
- Ambiguous mutating timeout/5xx results are never cross-retried.
- Mutating group fallback requires a confirmed QQ Open group -> numeric OneBot group mapping and a live legacy Bot role check.
- Member-target fallback requires a confirmed member OpenID -> numeric QQ mapping.
- Static group mapping remains authoritative; learned mappings remain conservative and conflict-safe.
- `ONEBOT_READ_ONLY` remains authoritative when enabled.

## Safety

- Never store QQ AppSecret/access tokens in Git or memory.
- Never coerce OpenID/group_openid into numeric QQ IDs.
- Never retry a potentially completed write through another transport after an ambiguous result.
- Keep OneBot auxiliary; do not restore duplicate reply ownership.
