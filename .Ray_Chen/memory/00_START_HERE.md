# Ray_Chen Memory Entry

- memory_version: v0.0.15
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 5
- safe_production_product_commit: 5ff25e2f97926fd0bfa038b4006427a0fb7f2962
- feature_head_before_hybrid_work: e7292b6ba90c3e2228cbdec43cb8cf153e21224e
- production_worker: qqai
- updated_at: 2026-09-28T01:48:00+08:00

## Current Goal

Implement the hybrid QQ transport:
- QQ Open is the primary official message/action channel.
- NapCat/OneBot remains as an auxiliary full-visibility/capability source where official QQ Open does not expose enough data.
- The two transports must have explicit ownership and dedupe so one user event cannot trigger duplicate AI, plugin, moderation or notification side effects.

## Official Capabilities Confirmed

- GROUP_MESSAGE_CREATE is the official all-group-message event when the bot has the "receive all messages" capability; intent remains GROUP_AND_C2C_EVENT (1<<25).
- C2C_MSG_RECEIVE / C2C_MSG_REJECT and GROUP_MSG_RECEIVE / GROUP_MSG_REJECT represent active-push permission state changes.
- INTERACTION_CREATE uses INTERACTION (1<<26). Types 11 and 12 require a one-time interaction acknowledgement; other interaction types do not.
- Do not enable the interaction intent until the QQ application is confirmed to have that permission, to avoid Gateway intent-permission failures.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, VERIFY.md and FILE_MANIFEST.json.
2. Keep OneBot/NapCat available.
3. Implement hybrid event ownership/dedupe before any production cutover.
4. Never infer numeric QQ identity from OpenID.
5. Do not advance main until the feature branch passes full regression and explicit production authorization remains valid.
