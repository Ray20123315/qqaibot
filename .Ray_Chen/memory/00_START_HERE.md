# Ray_Chen Memory Entry

- memory_version: v0.0.6
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 1
- latest_verified_product_commit: 685f6923bec7a010af8802ccd6e8ada3adc7242f
- latest_verified_ci_run: 36309169883
- updated_at: 2026-09-27T17:25:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md` and `CURRENT_STATE.md`.
2. Verify GitHub `v4-qqopen-native` head and CI before further writes.
3. Read `USER_REQUIREMENTS.md`, `DECISIONS.md`, `GOTCHAS.md`, and `VERIFY.md` as needed.
4. Treat `FILE_MANIFEST.json` as the current file-change ledger.
5. Do not switch production `main` or QQ Open credentials until the migration gates pass.

## Quick Recovery Summary

QQAIBOT V4 QQ Open Native development has started on `v4-qqopen-native` without switching production. Phase 1 adds QQ Open gateway protocol helpers, OpenID event normalization, an OpenAPI client, and a single-source Command Registry that can generate text-command compatibility, QQ menus, and paged command panels. Existing Codex Bridge, AI providers, plugins, D1 data, Portal, quotas, and cooldowns are intentionally retained. `main` remains on the existing OneBot/NapCat runtime.
