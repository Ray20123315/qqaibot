# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 2

## Goal

Finish the remaining V4 command-panel and QQ identity/whitelist behavior before production. Login is deferred. Keep work on `feature/v4-public-bot`, deploy only to the isolated stable Preview, and require user acceptance before any main merge.

## Acceptance Criteria

- No-parameter keyboard commands send actual QQ messages.
- Parameterized commands prefill the input and wait for user completion.
- Buttons are reusable instead of one-shot.
- All catalog commands shown in panels have a runtime owner.
- QQ Open permissions and group whitelist can safely reuse old-Bot-verified numeric identity mappings without treating OpenIDs as QQ numbers.
- Non-whitelist groups cannot bypass the gate through V3 official plugins.
- Group command on/off affects both Worker and plugin command paths.
- Feature CI and isolated Preview deployment remain safe and production remains untouched.

## Completed Steps

- VERIFIED: no-parameter group keyboard commands use message-send semantics; pagination alone keeps callback navigation.
- VERIFIED: Tencent SDK evidence shows omitted `click_limit` defaults to 1/single-use; buttons now explicitly use `click_limit: 10`.
- VERIFIED: parameterized commands remain editable prefills.
- VERIFIED: QQ Open derives `permissionUserId` / `permissionGroupId` from confirmed old-Bot mapping when available and downgrades on identity conflict.
- VERIFIED: `!群白名单` and `!删群白名单` only mutate a confirmed numeric group in QQ Open mode.
- VERIFIED: whitelist gate runs before V3 plugin dispatch for OneBot and QQ Open.
- VERIFIED: `!你记住了什么` implemented.
- VERIFIED: `!活动通知` implemented in the official activity plugin.
- VERIFIED: `!指令开` / `!指令关` implemented across Worker and plugin command paths.
- VERIFIED: 77/77 catalog command aliases have a runtime owner in Worker/plugins/parser coverage scan.
- VERIFIED: final GitHub CI run `36804510541` succeeded.
- VERIFIED: Cloudflare Connected Build `5d741839-2095-4ead-b741-461ce13a3aa2` succeeded for commit `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`.
- VERIFIED: uploaded Worker version `2168` corresponds to commit `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`.
- VERIFIED: stable Preview deployment 6 (`f2ba207c-3a7a-4bd3-a3e6-94150b8f83b4`) uses the new modules with the prior isolated Preview env.
- VERIFIED LIVE: stable Preview root returned HTTP 200 through Cloudflare Browser Rendering.

## Product Files Changed

- `src/v4/commands/group-panel.js`
- `worker.js`
- `src/plugins/official/activity.js`
- `verify-v4-qqopen.mjs`
- `verify-v4-runtime-bridge.mjs`
- `.github/workflows/v4-preview-deploy.yml` was temporarily changed only to test a deployment trigger and then restored to manual-only; final content is back to the guarded design.

## Failed / Changed Approaches

- Local direct repository verification path was unavailable because the execution environment could not resolve GitHub; switched to GitHub Actions evidence.
- Temporary Preview workflow `push` trigger was rejected by existing regression `verify-v4-preview-workflow.mjs`; immediately reverted to manual-only.
- Cloudflare Builds Preview API did not own the existing stable Workers Preview; switched to copying modules from the verified feature Worker version into the existing Workers Preview deployment.
- General web fetch could not access the workers.dev Preview; switched to Cloudflare Browser Rendering. Subsequent Browser Rendering requests hit rate limit after the successful root check and were not retried.

## Hard Constraints

- Do not merge to `main` before user acceptance.
- Do not enable production QQ/OneBot/AI secrets in the isolated Preview.
- Do not treat QQ Open OpenIDs as numeric QQ IDs.
- Do not reintroduce callback execution for ordinary direct commands.
- Do not omit `click_limit` for reusable group keyboard buttons.

## Current Phase

acceptance

## next_exact_action

Run real-user/canary QQ-client validation for the updated keyboard and whitelist behavior; if accepted, prepare the production merge with Preview-only test-login functionality removed or disabled.

last_checkpoint_at: 2026-10-01T10:16:00+08:00
