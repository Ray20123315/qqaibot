# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers based QQ AI bot that now supports a hybrid transport architecture. QQ Open is the primary official bot transport and NapCat/OneBot remains available for additional visibility and legacy-only capabilities.

## Production

- branch: `main`
- Worker: `qqai`
- product revision: `e75dd25ffd7900567bc4938f656b29ffaedcb5da`
- Durable Objects: `OneBotHub` and `QqOpenGateway`
- D1: `qqaibot`
- Vectorize: `qqai`
- custom domains retained
- QQ Open Intent baseline: `33554432`

## Transport Rules

- QQ Open owns official C2C and group-at interactions.
- OneBot remains auxiliary and must not duplicate a QQ Open-owned side effect.
- Official full-group ownership is activated dynamically only after actual GROUP_MESSAGE_CREATE evidence for a group; mapping to numeric OneBot group ids remains explicit.
- Official active pushes require both explicit group mapping and stored QQ push permission.
- OneBot fallback remains available for unmapped groups, numeric QQ mentions, unsupported official operations and client-level visibility unavailable from QQ Open.
- Interaction support exists but its Intent remains permission-gated.

## Safety

- Never store QQ AppSecret or access tokens in Git/memory.
- Do not infer numeric QQ from OpenID.
- Do not remove OneBotHub until hybrid operation is live-verified.
- Do not silently route a QQ Open side effect to NapCat.
