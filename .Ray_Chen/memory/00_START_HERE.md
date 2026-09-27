# Ray_Chen Memory Entry

- memory_version: v0.0.5
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- task_id: qqaibot-20260927-codex-shared-session-exe
- task_status: completed
- goal_revision: 1
- latest_verified_product_commit: e2956f001e1c6263aa58b7224c2645dd6a2c91cf
- latest_verified_ci_run: 36305191852
- latest_verified_exe_run: 36305191806
- updated_at: 2026-09-27T16:10:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md`.
2. Read `CURRENT_STATE.md`.
3. Read `USER_REQUIREMENTS.md`, `DECISIONS.md`, and `GOTCHAS.md` when relevant.
4. Verify actual GitHub `main`, file SHAs, CI, Windows EXE artifact, and live bridge/NapCat evidence before modifying.
5. Treat `FILE_MANIFEST.json` as the file-change ledger for this snapshot.

## Quick Recovery Summary

The existing outbound CodexWork bridge remains the filesystem security authority. A Windows x64 EXE wrapper now packages that same bridge core, supports a local JSON config, hidden background launch, and Windows logon startup through Task Scheduler. Direct `!codex`, `!codexchat`, and `!codexwork` now share one stable Codex thread for the same QQ user and chat scope; suffix/plugin Codex modes also share one thread within their plugin scope. GitHub Actions run `36305191852` passed regression, V3 regression, and Worker dry-run bundle. Windows run `36305191806` built and smoke-tested `QQAIBOT-CodexBridge.exe`.
