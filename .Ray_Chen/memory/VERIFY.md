# VERIFY

## Product Revision

`4893adbbb413d6c65f340ae44c80d153d1ddb7fe`

## GitHub Verification

Final branch CI:
- run: `36804510541`
- branch: `feature/v4-public-bot`
- commit: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- conclusion: SUCCESS
- covers repository regression, V3 regression, full V4 checks, isolated V4 test deployment checks and single Worker bundle.

Focused successful runs:
- `36804280773`: whitelist-gated plugin dispatch
- `36804100548`: reusable keyboard click limits
- `36803958243`: restored panel command resolution
- `36803953453`: completed panel command handlers
- `36803908513`: activity notification
- `36803887169`: memory list and group command gate
- `36800446426`: send-message semantics for no-parameter keyboard commands

Expected/understood intermediate failures:
- `36804096124`: click_limit implementation landed before updated assertions; superseded by successful `36804100548`.
- `36804331392` / `36804331377`: temporary push trigger was rejected by `verify-v4-preview-workflow.mjs`; trigger restored and final `36804510541` passed.

## Catalog / Handler Coverage

- catalog entries: 77
- Worker/plugins/moderation parser/normalization coverage: 77/77 runtime owners
- completed handlers: `!你记住了什么`, `!活动通知`, `!指令开`, `!指令关`

## Keyboard Evidence

- direct/no-parameter: `action.type=2`, `enter=true`
- parameterized: `action.type=2`, `enter=false`
- pagination: `action.type=1`
- reusable buttons: `click_limit=10`
- Tencent current SDK documents default `click_limit=1` as single-use; Tencent botpy example uses `click_limit=10`.

## Identity / Whitelist Evidence

- verified old-Bot group/user mapping feeds permission identity
- `getEffectivePermissions` uses `permissionGroupId / permissionUserId`
- QQ Open whitelist mutation refuses unverified numeric groups
- OneBot and QQ Open plugin dispatch are whitelist-gated
- identity conflicts downgrade authorization and are audited

## Cloudflare Feature Build

- build UUID: `5d741839-2095-4ead-b741-461ce13a3aa2`
- branch: `feature/v4-public-bot`
- commit: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- outcome: SUCCESS
- uploaded Worker version: `2168`
- version id: `c6695790-ba16-4eab-97c1-9b1c46825118`

## Stable Preview Deployment

- preview id: `068adb610f4d47daa65c1376e021787f`
- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `f2ba207c-3a7a-4bd3-a3e6-94150b8f83b4`
- deployment number: 6
- source annotation: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- created/deployed: `2026-10-01T02:13:52.753873Z`

Deployment method:
- modules copied from verified feature Worker version 2168
- prior stable Preview safe environment reused
- production secret bindings not copied

Read-back:
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- `V4_PREVIEW_TEST_LOGIN=true`
- production QQ/OneBot/Gemini/DeepSeek/Codex/Vectorize/Portal admin sensitive bindings: absent

## Live Preview

Cloudflare Browser Rendering:
- root origin HTTP 200
- final URL is the stable Preview URL
- title `QQAIbot 控制台`
- rendered HTML ~384 KB
- QQAI and V4/Preview content present

Two subsequent Browser Rendering calls hit Cloudflare error 2001 (rate limit) and were not retried.

## Remaining Acceptance Limit

The isolated Preview intentionally has `QQ_OPEN_ENABLED=false`, so actual QQ-client button/whitelist behavior remains a user/canary acceptance item. It is code/CI verified but not claimed as live QQ-platform verification.

## Production

No merge to `main` and no production rollout is authorized by this checkpoint.
