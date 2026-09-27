# Ray_Chen Memory Entry

- memory_version: v0.0.7
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 1
- latest_verified_product_commit: 1f12968a00db01518ef33abd7b7df4977b43e676
- latest_verified_ci_run: 36310767685
- updated_at: 2026-09-27T17:58:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md` and `CURRENT_STATE.md`.
2. Verify GitHub `v4-qqopen-native` head and latest CI before further writes.
3. Read `USER_REQUIREMENTS.md`, `DECISIONS.md`, `GOTCHAS.md`, and `VERIFY.md` as needed.
4. Treat `FILE_MANIFEST.json` as the file-change ledger.
5. Keep production `main` untouched until live QQ Open connectivity/reply succeeds and migration gates pass.

## Quick Recovery Summary

V4 Phase 2 now has a deployable QQ Open connectivity path: a `QqOpenGateway` Durable Object opens the outbound QQ Gateway WebSocket, persists session/sequence state, heartbeats, resumes/reconnects, and backs off on repeated failures. Incoming group/C2C messages can be answered natively through the QQ OpenAPI Action Dispatcher. Connectivity probes are `!qqping` and `!qqecho`. Existing OneBot production behavior remains unchanged.
