# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using a hybrid transport architecture. QQ Open is the primary official transport while NapCat/OneBot is retained for additional visibility and legacy-only capabilities.

## Production

- branch: `main`
- Worker: `qqai`
- product revision: `a6a5996c2ec33da881e0dbb54725b4ab61ce7037`
- Durable Objects: `OneBotHub` and `QqOpenGateway`
- D1: `qqaibot`
- Vectorize: `qqai`
- QQ Open Intent baseline: `33554432`
- Hybrid primary: `qq-open`

## Transport Rules

- QQ Open owns supported official message/action flows.
- OneBot supplements missing visibility/capabilities and must not duplicate QQ Open-owned side effects.
- Static numeric-group -> group_openid mapping is authoritative.
- A missing group mapping may be learned only through repeated, unambiguous, time-correlated evidence; 3 distinct official message IDs are required.
- GROUP_MESSAGE_CREATE is the switch proving official full-group observation is actually live for that official group.
- Official active pushes require a confirmed group mapping and stored QQ push permission.
- Numeric QQ mentions remain OneBot-owned until explicit user identity linking exists.
- Interaction support exists but the Intent remains permission-gated.

## Safety

- Never store QQ AppSecret/access tokens in Git or memory.
- Never coerce OpenID into numeric QQ.
- Keep OneBotHub until hybrid operation is live-verified.
- Never silently route a QQ Open side effect to NapCat.
