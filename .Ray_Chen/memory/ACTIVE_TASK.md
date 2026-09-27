# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 1

## Goal

Build QQAIBOT V4 as a QQ Open Native architecture while preserving mature non-transport functionality. Current priority is proving real Gateway connectivity and native receive/reply before migrating the rest of the command surface.

## Acceptance Criteria

- QQ Open WebSocket supports Identify, Heartbeat, Resume, reconnect and persisted session/sequence state.
- Group/C2C events normalize into canonical messages using OpenID identities.
- Native QQ OpenAPI can passively reply to the triggering group/C2C message.
- Reconnect failures use timeout/backoff instead of hammering session creation.
- Developer diagnostics expose Gateway enabled/configured/connected/READY/error state.
- Production remains on OneBot until live QQ Open E2E succeeds.
- No real AppSecret is committed or recorded in Ray_Chen memory.

## Current Phase

phase: 2 — connectivity and native reply
current_step: deployable connectivity implementation complete; live QQ Open E2E awaits Cloudflare credential/config setup.

## Completed Steps

- Added `src/v4/qqopen/runtime.js` with persistent `QqOpenGateway` Durable Object.
- Gateway obtains AccessToken, fetches `/gateway`, opens outbound WebSocket, handles Hello/Identify/Heartbeat/ACK/READY/Resume/Reconnect/Invalid Session.
- Persists QQ Gateway `session_id` and `seq` in Durable Object storage.
- Added 20-second connection timeout and reconnect backoff 5s → 10s → 20s → 40s → 60s cap.
- Added `src/v4/platform/actions.js` with native canonical `message.reply` / `message.send`.
- Added passive probe replies: C2C `!qqping`, group `@机器人 !qqping`, and `!qqecho 内容`.
- Added `QQ_OPEN_GATEWAY` binding and `v4_qqopen_gateway` Durable Object migration.
- Existing minute cron calls Gateway `ensure` only when QQ Open is enabled/configured.
- Added System Admin-only status/connect/disconnect HTTP endpoints.
- Developer `!status` now reports QQ Open READY/connected/configured/last event/error.
- Added config examples; AppSecret remains a secret-only value.
- Updated V4/migration/config regression tests.
- Final product CI run `36310767685`: success for regression, V3, V4 and Worker bundle.
- Intermediate CI failures were test-assertion escaping mistakes and were repaired; they did not represent Gateway runtime failures.

## Verification Results

- latest product commit: `1f12968a00db01518ef33abd7b7df4977b43e676`
- latest CI run: `36310767685` — success
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- Worker dry-run bundle: success
- remote read-back of core connectivity files: success
- live QQ Open E2E: not run because production credentials/config were not changed in this task

## Known Limitations

- No real QQ Gateway connection has been attempted from deployed Cloudflare yet.
- Only connectivity probe replies use the new Action Dispatcher; normal AI and legacy commands still use existing paths.
- Moderation/member/media/join-request action coverage remains Phase 3+.
- Outbound WebSocket lifetime cannot be assumed permanent; persisted Resume state plus cron/watchdog reconnect is required.

## next_exact_action

Set Cloudflare `QQ_OPEN_APP_ID` as a variable, `QQ_OPEN_CLIENT_SECRET` as a Secret, `QQ_OPEN_ENABLED=true`, and baseline `QQ_OPEN_INTENTS=33554432`; deploy the V4 build in a safe test/cutover context; confirm developer `!status` shows QQ Open READY; then send C2C `!qqping` and group `@机器人 !qqping` / `!qqecho hello`. Only after these pass, route normal AI/command replies through the Action Dispatcher.

last_checkpoint_at: 2026-09-27T17:58:00+08:00
