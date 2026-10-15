# Ray_Chen Memory
version: v0.0.107
task_id: manual-cross-group-command-20261015
task_status: active
goal_revision: 1
canonical_branch: main
feature_branch: feature/manual-cross-group-command-20261015
verified_feature_commit: 4e9924729598d556b5030acd91561a9bba6d6f2d
previous_main_commit: 6172bf1043653fa34634db6494d030d92acc78f0
updated_at: 2026-10-15T08:00:00Z

## Quick resume
- Only exact Bbot OneBot command /跨群 <文字> sends cross-group. Ordinary QQ chat, AI @ messages, and old bridge toggle must NEVER auto-forward.
- Preserve D1 bridge rooms/bindings, target only same room, verified=1, stopped=0, target not source; receive_only groups may receive but not originate. Group join no longer broadcasts notices.
- Feature commit 4e9924729598d556b5030acd91561a9bba6d6f2d; CI 38701967374 SUCCESS npm run check (102 tests, Wrangler dry-run), memory checkpoint CI pending.
- Cloudflare D1 read-only observed 8 bindings total, 4 verified in one room, ALL 4 stopped. Never change stopped without authorized !resume; end-to-end delivery remains BLOCKED until resumed.
- Existing Windows native Codex GUI, Abot AI, Bbot memory D1/Vectorize, secret settings and old backups untouched.
- QQ official stale /!设置插话率 published command still unverified removed; old API returned QQ_PANEL_RECORDS_MISSING_OBJECT_ABSENT_ABSENT. Do not claim native QQ slash menu has been changed.
- Read ACTIVE_TASK.md CURRENT_STATE.md USER_REQUIREMENTS.md DECISIONS.md GOTCHAS.md VERIFY.md FILE_MANIFEST.json. Check GitHub branch and CI before further changes.
