# VERIFY

## V4 Phase 2 Verification

- branch: `v4-qqopen-native`
- latest verified product commit: `1f12968a00db01518ef33abd7b7df4977b43e676`
- GitHub Actions run: `36310767685`
- repository regression: success
- V3 regression: success
- V4 QQ Open regression: success
- Worker dry-run bundle: success
- remote read-back of runtime/action/worker/wrangler/test blobs: success

## Connectivity Test Coverage

- Gateway Identify, Heartbeat and Resume payload/state helpers.
- canonical GROUP/C2C event normalization with OpenID identities.
- native group/C2C passive reply Action Dispatcher with triggering `msg_id`.
- `!qqping` and group-at `!qqecho` parsing.
- default `GROUP_AND_C2C_EVENT` intent value `33554432`.
- connection timeout helper wiring.
- reconnect backoff sequence 5/5/10/20/40/60 seconds.
- Wrangler `QQ_OPEN_GATEWAY` binding and `v4_qqopen_gateway` migration.
- worker bundle includes QqOpenGateway export.

## Repaired Intermediate Failures

Runs associated with commits before `090db336...` failed because a newly added test assertion used invalid RegExp escaping and because the following migration assertion had not yet been updated. These were test-code defects; the final product runs `36310584966`, `36310710245`, `36310756139`, and `36310767685` are successful.

## Live Verification Still Required

- configure Cloudflare AppID/Secret/enabled/intents without committing the Secret.
- deploy a V4 test/cutover build.
- confirm `!status` reports QQ Open READY.
- C2C `!qqping` returns `QQ Open V4 已连接并可回话。`.
- group `@机器人 !qqping` and `!qqecho hello` return via native QQ OpenAPI.
- after connectivity success, migrate normal AI/command replies.
