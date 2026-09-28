# CURRENT_STATE

## GitHub

- `main`: `a6a5996c2ec33da881e0dbb54725b4ab61ce7037`
- `v4-qqopen-native`: same product revision before this memory checkpoint
- CI: `36363693922` SUCCESS
- repository / V3 / V4 / isolated test dry-run / Worker bundle all succeeded

## Cloudflare Production

Worker: `qqai`
Build: `5669da1f-77c7-4fb3-8b42-ea26da91ed18`
Outcome: success
Worker version: `33538b7c-c04f-4b47-b8eb-82c444c6fe0a`
Migration: `v4_qqopen_gateway`

Retained:
- OneBotHub
- QqOpenGateway
- D1
- Vectorize
- Workers AI
- Rate Limiter
- existing Secrets including QQ_OPEN_CLIENT_SECRET

Current hybrid vars:
- QQ_OPEN_ENABLED=true
- QQ_OPEN_INTENTS=33554432
- QQ_OPEN_DISCOVERY_SYNC=true
- QQ_HYBRID_PRIMARY=qq-open
- QQ_HYBRID_GROUP_MAP={}

## Dynamic Group Mapping

D1 key: `qqopen_dynamic_group_map`.

Rules:
- static map wins;
- otherwise exact normalized text + media types are correlated in a short time window;
- generic low-information messages are ignored;
- multi-group ambiguity is rejected;
- 3 distinct official message IDs are required;
- conflicts never overwrite an existing mapping.

Portal status reports static, dynamic and total mapped-group counts.

## Lifecycle State

Gateway normalizes FRIEND_ADD/DEL, GROUP_ADD/DEL_ROBOT and GROUP_MEMBER_ADD/REMOVE. Worker stores these as QQ Open-native state records and event history without writing OpenIDs into legacy numeric QQ tables.

## Interaction

Code support remains deployed but `INTERACTION (1<<26)` is intentionally disabled. Production stays at `33554432` until QQ permission is confirmed.

## Live Status Gap

Production deployment/build/bindings are verified. Post-deploy live Gateway READY and live event behavior still require QQ-side observation.
