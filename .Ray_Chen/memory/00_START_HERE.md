# Ray_Chen Memory Entry

- memory_version: v0.0.8
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 2
- latest_verified_product_commit: 75483f71fb0707043082f891851581f03ac2c15c
- latest_verified_ci_run: 36327804832
- updated_at: 2026-09-27T23:01:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md` and `CURRENT_STATE.md`.
2. Verify `v4-qqopen-native` head and the latest CI before further writes.
3. Read `USER_REQUIREMENTS.md`, `DECISIONS.md`, `GOTCHAS.md`, and `VERIFY.md` as needed.
4. Treat `FILE_MANIFEST.json` as the current file-change ledger.
5. Keep `main` and production Cloudflare deployment unchanged until the user explicitly requests cutover.

## Quick Recovery Summary

Goal revision 2 prioritizes a lean, animated V4 Portal and aggressive product-surface pruning before live QQ Open cutover. The V4 Portal now exposes six primary areas: Overview, QQ Open, Group Management, AI/Codex, Plugins, and System. It shows Gateway online/READY/error state, adds QQ-native group member/blacklist/join-request/mute management APIs, records official image/video/audio/file send/receive capability, and collapses direct !codex / !codexchat / !codexwork into one principal-scoped conversation. Legacy activity/vote/schedule surfaces are retired from the V4 navigation and Command Registry; old data/code is retained only as rollback material until QQ Open E2E proves the new path.
