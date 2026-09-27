# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 5

## Goal

Run QQAIBOT as a hybrid QQ bot: QQ Open handles official interactions/actions while NapCat/OneBot supplements visibility and legacy capabilities without duplicate AI/plugin/moderation behavior.

## Completed

- Added hybrid ownership module and explicit numeric-group -> group_openid mapping.
- Added official event normalization for push permission and INTERACTION_CREATE.
- Added interaction acknowledgement API.
- Added OneBot auxiliary observation path and structured observation mirroring.
- Added QQ Open control bridge for:
  - push permission
  - feedback
  - private-session clear
  - model switch
  - authorization/story/observe events
- Added QQ Open Gateway handling for:
  - C2C/GROUP MSG RECEIVE/REJECT
  - INTERACTION_CREATE
  - type 11/12 ACK
  - callback command execution via existing runtime
  - feedback/clear/model/auth control
- Added hybrid Portal diagnostics.
- Added regression suite `verify-v4-hybrid-official.mjs`.
- Added active schedule/active-speaking official-first routing with OneBot fallback.
- Added dynamic GROUP_MESSAGE_CREATE evidence before suppressing ordinary OneBot group side effects.
- Documented hybrid behavior.
- Full CI `36340836211`: success.
- Isolated Worker build `610409e1-41c7-4ef8-a9be-3af4af0042dd`: success.
- Fast-forwarded `main` to `e75dd25ffd7900567bc4938f656b29ffaedcb5da`.
- Production build `f74c53e5-4f75-48b6-b45e-d8d7b7755cce`: success.
- Production read-back confirms required plain vars, all secrets, D1, Vectorize, OneBotHub and QqOpenGateway remain present.
- Cloudflare observability query found zero `QQ Open gateway ensure failed` events in the deployment window.

## Current Production Behavior

- `QQ_HYBRID_PRIMARY=qq-open`
- `QQ_HYBRID_GROUP_MAP={}` by default
- C2C OneBot messages are auxiliary because QQ Open owns C2C.
- OneBot group @ messages are auxiliary because QQ Open owns GROUP_AT_MESSAGE_CREATE.
- Ordinary OneBot group messages continue existing behavior until that numeric group is explicitly mapped and the mapped QQ group has actually emitted GROUP_MESSAGE_CREATE.
- Active scheduled group sends use QQ Open only if group mapping + official push permission exist; otherwise they use OneBot fallback.
- Numeric QQ @mentions remain OneBot sends.
- Interaction code is deployed but production Intent remains `33554432`, so INTERACTION_CREATE is dormant until permission is explicitly enabled.

## Known Remaining Work

- Populate `QQ_HYBRID_GROUP_MAP` for groups that should merge OneBot observation into QQ Open group context.
- Confirm whether QQ Open Platform has granted INTERACTION permission before changing Intent to `100663296`.
- Live-test ordinary AI/Codex after current production deploy.
- Live-test GROUP_MESSAGE_CREATE on a group with receive-all-message capability.
- Live-test RECEIVE/REJECT state changes and official active schedule send.
- CodexWork local file export still requires explicit local/legacy upload handling; Cloudflare cannot directly read the bridge filesystem path.
- Additional official lifecycle events such as FRIEND_ADD/DEL and GROUP_MEMBER_ADD/REMOVE can be added in the next phase.

## next_exact_action

Read the live production Gateway diagnostics and perform a QQ-side ordinary AI message test. Then map a test group explicitly, verify GROUP_MESSAGE_CREATE evidence, and only after QQ Platform confirms INTERACTION permission consider setting `QQ_OPEN_INTENTS=100663296`.

last_checkpoint_at: 2026-09-28T02:35:00+08:00
