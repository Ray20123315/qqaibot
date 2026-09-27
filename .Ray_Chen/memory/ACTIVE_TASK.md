# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 2

## Goal

Build and verify QQ Open V4 in a fully isolated test Worker before any production cutover.

## Acceptance Criteria

- V4 test Worker must be distinct from production `qqai`.
- No production D1/custom domain/Vectorize/OneBot binding in test config.
- New QqOpenGateway migration must apply only to `qqai-v4test`.
- Cloudflare production trigger must not deploy `v4-qqopen-native`.
- V4 branch CI and isolated test bundle checks must pass.
- Test Worker must deploy successfully on workers.dev.
- Live QQ connection requires only the AppSecret to be added to the test Worker Secret store.

## Completed

- Created `worker.v4test.js` minimal isolated test entrypoint.
- Created `wrangler.v4test.toml` with `qqai-v4test`, workers.dev, and QqOpenGateway only.
- Added `verify-v4-test-deployment.mjs` and `npm run check:v4test`.
- Added V4 test validation to the normal GitHub CI workflow.
- Attempt to create a separate V4 D1 was blocked by the account limit of 10 databases; no database was deleted or modified.
- Switched design to no-D1 test Worker.
- Cloudflare production preview trigger now excludes `v4-qqopen-native` and retains `npx wrangler versions upload`.
- Production main trigger remains `npx wrangler deploy worker.js --no-assets` on branch `main`.
- Created Cloudflare Worker `qqai-v4test`.
- Created dedicated Cloudflare Builds trigger `522507cc-658f-4361-8e90-9a98e65b92d7` for branch `v4-qqopen-native`.
- Initial test deploy proved code/DO upload but failed only while adding a Cron because the Free account already uses 5 Cron triggers.
- Removed the test Cron and added a manual “連接 / 重試” button.
- Removed the temporary GitHub Actions deployment workflow because repository Cloudflare credentials were not configured.
- Final Cloudflare test build `d92e427e-ee8c-48b8-92a7-0773cdc870c0`: success.
- Final GitHub CI `36330424094`: success for regression, V3, V4, V4-test dry-run and Worker bundle.
- Test trigger excludes `.Ray_Chen/**` to avoid redeploying on memory-only commits.

## Production Verification

Production `qqai` after test setup:
- migration tag: `v3_remove_budget_guard`
- named Durable Object: `OneBotHub`
- modified_on remained `2026-09-27T09:46:34.642897Z`

No production code/deployment migration occurred.

## Current Blocker

`qqai-v4test` has no `QQ_OPEN_CLIENT_SECRET` Secret yet. This is intentionally not copied from production or stored in GitHub.

## next_exact_action

In Cloudflare, open Worker `qqai-v4test` only and add `QQ_OPEN_CLIENT_SECRET` as a Secret. Then open `https://qqai-v4test.ray20123315.workers.dev`, press “連接 / 重試”, confirm READY, and test `!qqping` / `!qqecho hello`.

last_checkpoint_at: 2026-09-27T23:43:00+08:00
