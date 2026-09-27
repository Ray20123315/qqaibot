# Ray_Chen Memory Entry

- memory_version: v0.0.16
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 5
- production_product_commit: e75dd25ffd7900567bc4938f656b29ffaedcb5da
- production_ci_run: 36340836211
- isolated_test_build: 610409e1-41c7-4ef8-a9be-3af4af0042dd
- production_cloudflare_build: f74c53e5-4f75-48b6-b45e-d8d7b7755cce
- production_worker: qqai
- updated_at: 2026-09-28T02:35:00+08:00

## Current Architecture

QQAIBOT now uses a hybrid QQ transport:

1. QQ Open is the primary official interaction/action channel.
2. NapCat/OneBot remains deployed and connected as auxiliary observation/capability fallback.
3. C2C and explicit group @ interactions are owned by QQ Open.
4. Ordinary OneBot group messages remain active until the mapped QQ Open group has actually emitted GROUP_MESSAGE_CREATE; after official full-group evidence exists, mapped OneBot group messages become observation-only.
5. Active scheduled/group messages prefer QQ Open only when a numeric group is explicitly mapped to group_openid and official active-push permission is currently allowed; otherwise OneBot remains fallback.
6. OpenID values remain opaque and are never inferred from numeric QQ IDs.

## Official Event State

Implemented:
- GROUP_MESSAGE_CREATE support and dynamic full-group ownership evidence
- C2C_MSG_RECEIVE / C2C_MSG_REJECT
- GROUP_MSG_RECEIVE / GROUP_MSG_REJECT
- INTERACTION_CREATE parsing/ACK/control path
- hybrid Portal diagnostics
- active-push transport ownership

Important: production `QQ_OPEN_INTENTS` remains `33554432`. INTERACTION intent `1<<26` is implemented in code but NOT enabled until QQ Open Platform permission is confirmed.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, VERIFY.md and FILE_MANIFEST.json.
2. Keep OneBotHub and QqOpenGateway.
3. Do not enable INTERACTION intent without confirmed app permission.
4. Populate QQ_HYBRID_GROUP_MAP explicitly before expecting OneBot full-group events to merge into matching QQ Open group context.
5. Do not claim post-deploy READY unless the live Gateway status is observed; deployment and telemetry currently show no Gateway ensure/reconnect error.
