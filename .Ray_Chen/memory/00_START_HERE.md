# Ray_Chen Memory Entry

- memory_version: v0.0.17
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 5
- production_product_commit: a6a5996c2ec33da881e0dbb54725b4ab61ce7037
- production_ci_run: 36363693922
- isolated_test_build: 02ca8a73-cdd4-4ffa-beeb-db3140105a74
- production_cloudflare_build: 5669da1f-77c7-4fb3-8b42-ea26da91ed18
- production_worker_version: 33538b7c-c04f-4b47-b8eb-82c444c6fe0a
- production_worker: qqai
- updated_at: 2026-09-28T08:54:00+08:00

## Current Architecture

QQAIBOT runs a hybrid QQ transport:

1. QQ Open is the primary official interaction/action channel.
2. NapCat/OneBot remains deployed as auxiliary observation/capability fallback.
3. Static `QQ_HYBRID_GROUP_MAP` is an authoritative override.
4. When no static mapping exists, group mapping can be learned conservatively from matching OneBot + QQ Open observations. A mapping is confirmed only after at least 3 distinct official message IDs point unambiguously to the same numeric group.
5. Generic short text, ambiguous multi-group matches and mapping conflicts are never auto-learned.
6. GROUP_AT_MESSAGE_CREATE may provide mapping evidence, but ordinary OneBot group traffic becomes observation-only only after the official group actually emits GROUP_MESSAGE_CREATE.
7. QQ Open OpenIDs remain opaque and are never inferred as numeric QQ IDs.

## Official Event State

Implemented under the existing GROUP_AND_C2C_EVENT baseline:
- GROUP_MESSAGE_CREATE full-group ownership evidence
- FRIEND_ADD / FRIEND_DEL
- GROUP_ADD_ROBOT / GROUP_DEL_ROBOT
- GROUP_MEMBER_ADD / GROUP_MEMBER_REMOVE
- C2C_MSG_RECEIVE / C2C_MSG_REJECT
- GROUP_MSG_RECEIVE / GROUP_MSG_REJECT

Interaction parsing/ACK/control is implemented, but production `QQ_OPEN_INTENTS` remains `33554432`; `INTERACTION (1<<26)` remains permission-gated.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, VERIFY.md and FILE_MANIFEST.json.
2. Keep OneBotHub and QqOpenGateway.
3. Do not enable INTERACTION intent without confirmed app permission.
4. Prefer static group mapping when configured; otherwise allow the conservative D1-backed learner.
5. Do not treat post-deploy Gateway READY as verified until observed live; product/build/read-back are verified.
