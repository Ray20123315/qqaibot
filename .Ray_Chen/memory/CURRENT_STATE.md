# CURRENT_STATE

## Production

- `main` was not changed by this task.
- Production Worker configuration/deployment was not intentionally modified.
- The user acceptance gate remains active.

## V4 Feature Source

- branch: `feature/v4-public-bot`
- head: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- final GitHub CI: `36804510541` — SUCCESS
- relevant focused successful runs:
  - `36804280773` whitelist-gated plugin dispatch
  - `36804100548` reusable keyboard click limits
  - `36803958243` restored panel command resolution
  - `36803953453` completed panel command handlers
  - `36803908513` activity notification handler
  - `36803887169` memory-list / command-gate implementation

## Command / Keyboard State

- Catalog entries: 77.
- Runtime-owner coverage scan: 77/77.
- Direct/no-parameter keyboard command: QQ message action `type=2`, `enter=true`.
- Parameterized keyboard command: `type=2`, `enter=false`, trailing-space canonical command.
- Pagination: callback `type=1`.
- Reuse limit: explicit `click_limit=10` on command and pagination buttons.
- QQ SDK evidence: omitted/default `click_limit=1` is single-use.

## Identity / Whitelist State

- QQ Open ingress remains OpenID-native for transport.
- Permission/whitelist decisions may use confirmed old-Bot numeric QQ/group mappings.
- Conflicting canonical QQ vs old-Bot mapping causes permission downgrade and audit.
- QQ Open whitelist mutations require a confirmed numeric group; no guessed IDs.
- V3 plugin dispatch is also whitelist-gated, closing the previous bypass path.

## Newly Completed Commands

- `!你记住了什么`
- `!活动通知`
- `!指令开`
- `!指令关`

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `f2ba207c-3a7a-4bd3-a3e6-94150b8f83b4`
- deployment number: 6
- deployed_on: `2026-10-01T02:13:52.753873Z`
- source annotation: `4893adbbb413d6c65f340ae44c80d153d1ddb7fe`
- D1 table: `kv_store_v4public_preview`
- `QQ_OPEN_ENABLED=false`
- Preview test login: still enabled on Preview only
- production sensitive bindings: absent
- live root Browser Rendering: HTTP 200, title `QQAIbot 控制台`

## Known Verification Limit

The isolated Preview deliberately has QQ Open disabled. Therefore actual QQ-client interaction semantics (button reuse, message-send behavior and whitelist mapping under the live QQ platform) are not yet a live Preview proof; they are code/CI verified and require user/canary acceptance before production merge.

## Merge State

BLOCKED by user acceptance gate. No production merge is authorized yet.
