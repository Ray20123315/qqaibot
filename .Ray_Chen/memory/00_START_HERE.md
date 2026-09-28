# Ray_Chen Memory Entry

- memory_version: v0.0.18
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 5
- production_product_commit: edeacf6cf8c215cc3987b86a4a0d5220c7f581d9
- feature_product_commit: 535804857f530dd8bf16d221422a6ed095300fe8
- feature_ci_run: 36366534308
- main_ci_run: 36366701774
- isolated_test_build: e280d9fb-bb0d-4659-91e8-cb2db205e1a3
- production_cloudflare_build: 2f3fa902-2e60-44a2-8355-7459a5ef9db4
- production_worker_version: 4d8fff7e-5713-4e5c-83e2-7caa9bcbb633
- production_worker: qqai
- updated_at: 2026-09-28T09:40:00+08:00

## Current State

The user reported four live issues after the first hybrid rollout:
1. AI group replies contained a literal `<@OpenID>`.
2. QQ did not show a classic quote/reply box.
3. Three test messages did not create an automatic group mapping.
4. Discovery sync reported `QQ_OPEN_API_400:必填字段缺失`.

All four were investigated. The first, third and fourth were code bugs and are fixed/deployed. For the second, QQ Open group/C2C passive reply remains implemented with official `msg_id + msg_seq`; current QQ APIs still do not support forcing a classic visible `message_reference` quote box.

## Deployed Fixes

- Removed QQ Open AI reply injection derived from `reply_plan.mentionIds`, so raw `<@OpenID>` text is no longer prepended.
- Kept every QQ Open passive reply bound to the source message via `msg_id` and centrally allocated `msg_seq`.
- Added required placeholder content for rich-media `msg_type=7` sends.
- Fixed global custom menu update payload to `{ menu }`.
- Fixed command-panel listing to require `scope`, query C2C and group separately, paginate, and handle `records`.
- Fixed command-panel update payload to `{ panel }`.
- Decoupled OneBot mapping observation from OneBot ownership. Every human OneBot group message can now provide mapping evidence without making OneBot the reply/action owner.
- Added order-independent correlation: QQ Open observations are retained while waiting for OneBot, and OneBot arrivals re-check recent official observations.
- Kept the 3-distinct-official-message evidence requirement.
- Expanded the correlation window to 12 seconds while retaining generic-message and ambiguity rejection.
- Portal now reports pending mapping candidates and learning progress such as `2/3`.

## Important Live Evidence

Before the fix, production D1 was queried read-only for:
- `hybrid_aux_recent`
- `qqopen_dynamic_group_map`
- `qqopen_group_map_evidence:%`

No rows existed. This proved the mapping failure was not merely an unmet 3-message threshold; OneBot observations were not entering the learner because observation was incorrectly gated by ownership.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, VERIFY.md and FILE_MANIFEST.json.
2. Keep OneBotHub and QqOpenGateway.
3. Do not reintroduce `reply_plan.mentionIds` prefixing for QQ Open replies.
4. Keep mapping observation independent from action ownership.
5. Do not enable INTERACTION intent without confirmed app permission.
6. Next live verification requires new distinctive messages after this deploy; old pre-fix messages were never stored as mapping evidence.
