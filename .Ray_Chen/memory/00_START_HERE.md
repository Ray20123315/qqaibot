# Ray_Chen Memory Entry

- memory_version: v0.0.48
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 2
- product_revision: 4893adbbb413d6c65f340ae44c80d153d1ddb7fe
- updated_at: 2026-10-01T10:16:00+08:00

## Current Goal

Keep all new V4 acceptance work off production. Login is not the current priority. Finish and verify the remaining QQ command-panel, identity, whitelist and missing-command behavior on the feature branch, deploy the verified code to the isolated stable Preview, then wait for real-user acceptance before any production merge.

## Verified Product State

- Feature head: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`.
- GitHub CI run `36804510541`: SUCCESS on the final product/workflow-restored head.
- All 77 catalog commands have a runtime owner across Worker, official plugins or moderation parser.
- No-parameter group keyboard commands now send real QQ messages; parameterized commands still prefill the input.
- All group keyboard buttons and pagination buttons explicitly use `click_limit: 10`.
- QQ Open permissions/whitelist use old-Bot-verified numeric QQ/group mappings when available; identity conflicts downgrade authorization.
- Whitelist gating now runs before V3 official plugin dispatch.
- `!你记住了什么`, `!活动通知`, `!指令开` and `!指令关` now have real runtime behavior.
- The group command gate covers both core Worker commands and V3 plugin commands; `!指令开` remains the recovery path.

## Stable Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- Preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `f2ba207c-3a7a-4bd3-a3e6-94150b8f83b4`
- deployment number: 6
- source commit annotation: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- isolated D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- production QQ/OneBot/AI/Vectorize/admin sensitive bindings: absent
- Browser Rendering live check: root HTTP 200, title `QQAIbot 控制台`.

## Acceptance Gate

Do not merge this feature/Preview-only work into `main` until the user manually accepts it. The isolated Preview intentionally has QQ Open disabled, so actual QQ-client button/whitelist behavior remains a user/canary acceptance item even though code and CI are verified.

## Resume Rule

Resume from v0.0.48. Do not revert to callback-based direct commands or omitted `click_limit`. The next exact action is real-user/canary validation of the updated QQ command panel and whitelist behavior before any main merge.
