# Ray_Chen Memory Entry

- memory_version: v0.0.4
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- task_id: qqaibot-20260927-codexwork-public-quota-diagnostics
- task_status: completed
- goal_revision: 1
- latest_verified_product_commit: b6d757261f2c5ceffda09e78b20bfc466456640f
- latest_verified_ci_run: 36304035160
- updated_at: 2026-09-27T15:49:15+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md`.
2. Read `CURRENT_STATE.md`.
3. Read `USER_REQUIREMENTS.md`, `DECISIONS.md`, and `GOTCHAS.md` when relevant.
4. Verify actual GitHub `main`, file SHAs, CI, and live bridge/NapCat evidence before modifying.
5. Treat `FILE_MANIFEST.json` as the file-change ledger for this snapshot.

## Quick Recovery Summary

The Codex access model was split into public `!codex`, developer `!codexchat`, and developer `!codexwork`. Public Codex is quota-bound and fixed to GPT-6 Luna with no reasoning. CodexWork is enforced by a local outbound bridge that snapshots only allowlisted roots, never propagates deletions, and writes back only into explicit edit roots. Portal diagnostics now includes terminal-style log view/download plus deterministic self-check and no-AI safe repair. GitHub Actions run `36304035160` passed regression, V3 regression, and Worker dry-run bundle.
