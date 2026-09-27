# Ray_Chen Memory Entry

- memory_version: v0.0.9
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 2
- latest_verified_product_commit: 7ddfc56495d58a101626ad6911ac0c673c433a1f
- latest_verified_ci_run: 36330424094
- isolated_test_worker: qqai-v4test
- isolated_test_build: d92e427e-ee8c-48b8-92a7-0773cdc870c0
- updated_at: 2026-09-27T23:43:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md` and `CURRENT_STATE.md`.
2. Verify `v4-qqopen-native`, GitHub CI, and Cloudflare `qqai-v4test` before writes.
3. Keep production `qqai` / `main` untouched unless the user explicitly authorizes cutover.
4. Read `FILE_MANIFEST.json` for GitHub and Cloudflare resource changes.

## Quick Recovery Summary

An isolated Cloudflare Worker named `qqai-v4test` now exists and is connected to the `v4-qqopen-native` branch through its own Cloudflare Builds trigger. It has only `QqOpenGateway`, workers.dev access, and the minimal QQ Open test dashboard; it has no D1, Vectorize, OneBot binding, production routes, or Cron trigger. Production `qqai` remains unchanged at migration tag `v3_remove_budget_guard` with only `OneBotHub`. The test Worker deployment succeeded; the only remaining manual prerequisite for live QQ connection is adding `QQ_OPEN_CLIENT_SECRET` as a Secret on `qqai-v4test`, then pressing “連接 / 重試”.
