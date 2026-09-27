# Ray_Chen Memory Entry

- memory_version: v0.0.14
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 4
- safe_production_product_commit: 5ff25e2f97926fd0bfa038b4006427a0fb7f2962
- verified_feature_head: 18160ef97f602a324d5c094b2f15ec2f6ca5a415
- verification_run: 36335909533
- production_worker: qqai
- updated_at: 2026-09-28T01:18:00+08:00

## Current State

The QQ Open full-runtime bridge is implemented and CI-verified on `v4-qqopen-native`.

Implemented:
- QQ Open message normalization into the existing Worker application path.
- Ordinary AI chat, D1 history, Vectorize memory, cooldown, command parsing and public `!codex` share the existing runtime.
- Developer `!codexchat` / `!codexwork` are available only for exact OpenIDs listed in `QQ_OPEN_DEVELOPER_OPENIDS`.
- QQ Open side effects redirect through official QQ Open APIs instead of falling back to NapCat.
- Rich media upload/send and group member/join-request/mute/remove compatibility are included.
- Group join-request events can enter the existing request-assist flow.
- OneBotHub remains available as fallback.

Not done:
- `main` has not been advanced to this feature head.
- production Cloudflare Worker has not been redeployed with this bridge.
- live ordinary AI / Codex / media / management verification has not yet been performed on production.

## Recovery Route

1. Read `ACTIVE_TASK.md`, `CURRENT_STATE.md`, `VERIFY.md`, and `FILE_MANIFEST.json`.
2. Product rollback baseline remains `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`.
3. The feature implementation head is `18160ef97f602a324d5c094b2f15ec2f6ca5a415`.
4. CI run `36335909533` is the verified build evidence.
5. Do not infer numeric QQ identity from QQ Open OpenIDs.
6. Do not move `main` or deploy production without explicit authorization.
