# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 5

## Goal

Fix the live QQ category panel so `/!面板 <分类>` renders an actually clickable command keyboard in the QQ client. The live 2026-10-02 17:50 test proved that the current payload produces title text only.

## Acceptance Criteria

- PLANNED: keyboard serialization follows the current Tencent Node SDK minimum shape.
- PLANNED: direct/no-argument commands still use `action.type=2` with `enter=true`.
- PLANNED: parameterized commands use `action.type=2` without auto-send and remain editable.
- PLANNED: pagination stays reusable and clickable.
- PLANNED: every retained non-empty group category remains covered.
- PLANNED: development CI passes.
- PLANNED: main CI passes after verified promotion.
- PLANNED: production deployment succeeds.
- NEEDS_REVIEW: live QQ must show visible buttons after deployment.

## Live Evidence

- 2026-10-02T17:50:41+08:00: user sent `/!面板 群聊`.
- Bot returned exactly the category prompt text but no visible keyboard.
- No `备用文字` fallback appeared, so this is not the explicit keyboard-error fallback path.
- Cloudflare account-level observability does not currently expose the `qqai` Worker dataset, so there is no usable centralized payload log for that event.

## Current Phase

Phase 1 — inline-keyboard compatibility repair.

## Execution Plan

1. Compare deployed keyboard JSON against current Tencent SDK/documented keyboard shape.
2. Minimize optional button fields while preserving required direct-send/prefill semantics.
3. Extend regression assertions for exact serialized payloads and all categories.
4. Run development CI; repair any failure before promotion.
5. Promote the verified revision to `main`, verify main CI/deployment, then require one live QQ smoke.

## Product Files Expected

- src/v4/commands/group-panel.js
- src/v4/qqopen/runtime.js
- verify-v4-qqopen.mjs

## Known Risk

QQ custom inline keyboards are an application capability. If the minimal officially documented payload is still silently omitted by the client, the remaining blocker is the QQ application button capability/approval rather than command registry contents.

## next_exact_action

Patch the keyboard serializer/generator to the minimal current Tencent SDK-compatible shape and add exact regression checks.

last_checkpoint_at: 2026-10-02T18:25:39+08:00
