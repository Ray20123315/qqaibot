# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 5

## Goal

Run QQAIBOT as a hybrid QQ bot: QQ Open handles official interactions/actions while NapCat/OneBot supplements visibility and legacy capabilities without duplicate AI/plugin/moderation behavior.

## Completed

- Added conservative D1-backed dynamic group mapping.
- Static `QQ_HYBRID_GROUP_MAP` remains the authoritative override.
- Dynamic mapping requires 3 distinct official message IDs, one unambiguous OneBot group candidate, matching normalized message/media evidence, and no existing conflict.
- GROUP_AT_MESSAGE_CREATE and GROUP_MESSAGE_CREATE both contribute mapping observations.
- GROUP_MESSAGE_CREATE still gates transition of mapped ordinary OneBot messages to auxiliary-only handling.
- Added official lifecycle normalization/state for:
  - FRIEND_ADD / FRIEND_DEL
  - GROUP_ADD_ROBOT / GROUP_DEL_ROBOT
  - GROUP_MEMBER_ADD / GROUP_MEMBER_REMOVE
- Lifecycle OpenIDs are stored in separate QQ Open records, not legacy numeric QQ member tables.
- Scheduler/active-speaking routing now accepts static or confirmed learned group mappings.
- Portal QQ Open page now shows lifecycle count/last event and static/learned/total mapping counts.
- Updated README, deployment example and V4 docs for learned mapping.
- Full CI `36363693922`: success.
- Isolated Worker build `02ca8a73-cdd4-4ffa-beeb-db3140105a74`: success.
- Fast-forwarded `main` to `a6a5996c2ec33da881e0dbb54725b4ab61ce7037`.
- Production build `5669da1f-77c7-4fb3-8b42-ea26da91ed18`: success.
- Production Worker version: `33538b7c-c04f-4b47-b8eb-82c444c6fe0a`.
- Production read-back confirms OneBotHub, QqOpenGateway, D1, Vectorize, Workers AI, Rate Limiter and existing Secrets are intact.
- Production `QQ_OPEN_INTENTS` remains `33554432`.
- Production `QQ_HYBRID_GROUP_MAP={}`, so automatic mapping can learn safely unless a static override is later added.

## Current Production Behavior

- QQ Open is primary.
- OneBot C2C and explicit @Bot duplicates are auxiliary.
- Unmapped ordinary OneBot group traffic remains functional.
- A learned mapping needs 3 official-message evidence points.
- Even after mapping, ordinary OneBot group traffic only becomes auxiliary once that official group emits GROUP_MESSAGE_CREATE.
- Official active pushes require mapped group + stored GROUP_MSG_RECEIVE/authorization state; otherwise OneBot fallback.
- Interaction implementation is present but dormant until permission is confirmed and the Intent bit is explicitly enabled.

## Known Remaining Work

- Live-test post-deploy Gateway READY and normal C2C/group AI.
- Generate repeated @Bot messages in a test group and verify automatic mapping reaches 3 evidence points.
- If receive-all-message is enabled, verify GROUP_MESSAGE_CREATE flips mapped OneBot ordinary group traffic to observation-only.
- Live-test FRIEND/GROUP_MEMBER lifecycle events and Portal counters.
- Confirm Interaction permission before any Intent change.
- CodexWork local file export still needs an explicit bounded local-to-QQ upload channel; Cloudflare cannot read the bridge filesystem directly.

## next_exact_action

Live-test the production Gateway and one test group: send at least 3 distinctive @Bot messages visible to both transports, confirm the learned mapping appears in Portal, then—if receive-all-message is enabled—verify GROUP_MESSAGE_CREATE ownership. Keep Interaction Intent unchanged unless permission is confirmed.

last_checkpoint_at: 2026-09-28T08:54:00+08:00
