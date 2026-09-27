# CURRENT_STATE

## GitHub

- `main`: `e75dd25ffd7900567bc4938f656b29ffaedcb5da`
- `v4-qqopen-native`: same product revision before this memory checkpoint
- CI: `36340836211` SUCCESS
- all regression, V3, V4, isolated V4 test dry-run and Worker bundle stages succeeded

## Cloudflare Production

Worker: `qqai`
Build: `f74c53e5-4f75-48b6-b45e-d8d7b7755cce`
Outcome: success
Migration: `v4_qqopen_gateway`
Durable Objects:
- OneBotHub
- QqOpenGateway

Retained:
- D1
- Vectorize
- Workers AI binding
- Rate Limiter
- all existing Secrets
- DEVELOPER_IDS
- PORTAL_ADMIN_USERNAME
- plugin security flags

Current official/hybrid vars:
- QQ_OPEN_ENABLED=true
- QQ_OPEN_INTENTS=33554432
- QQ_OPEN_SHARD_ID=0
- QQ_OPEN_SHARD_TOTAL=1
- QQ_OPEN_DISCOVERY_SYNC=true
- QQ_HYBRID_PRIMARY=qq-open
- QQ_HYBRID_GROUP_MAP={}

## Cloudflare Verification

- isolated test build `610409e1-41c7-4ef8-a9be-3af4af0042dd`: success
- production build: success
- post-deploy binding/secrets read-back: success
- observability query for `QQ Open gateway ensure failed` in the deployment window: 0 events

The assistant cannot safely read the authenticated production Gateway status endpoint directly. Pre-deploy Gateway READY and !qqping were user-verified; post-deploy READY remains a live QQ-side verification item.

## Hybrid State

Because QQ_HYBRID_GROUP_MAP is currently empty:
- OneBot C2C and group-at duplicates are suppressed under QQ Open ownership.
- ordinary OneBot group messages remain functional.
- no numeric group is yet mirrored into a corresponding group_openid context.
- official active scheduled sends fall back to OneBot until mapping + push permission exist.

## Interaction

Code support is deployed but INTERACTION intent is intentionally disabled. Do not set `100663296` until QQ application permission is confirmed.
