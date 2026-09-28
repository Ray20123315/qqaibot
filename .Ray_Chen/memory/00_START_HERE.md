# Ray_Chen Memory Entry

- memory_version: v0.0.30
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 2
- latest_verified_product_commit: 820779518c8bf60bcc541182249f651101632080
- updated_at: 2026-09-28T15:05:00+08:00

## Verified Through This Checkpoint

- QQ Open model preference no longer persists to platform D1.
- QQ Open !模型 reads/writes the user's Storage Connector settings purpose.
- Official switch-model interaction uses explicit canonical principal and user storage.
- Without user storage, model preference remains default/non-durable and UI states that it was not saved.
- OneBot legacy model preference behavior remains unchanged.
- Full regression/V3/V4/V4-test/bundle checks passed.

## Next Checkpointed Operation

Create one Preview-only D1 database named `qqaibot-v4-public-preview` for the existing `qqai` Worker Preview. Do not create another Worker. Do not bind or mutate production D1 `qqaibot`.
