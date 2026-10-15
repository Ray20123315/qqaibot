# ACTIVE_TASK
task_id: manual-cross-group-command-20261015
task_status: active
goal_revision: 1
goal: Preserve all existing verified D1 cross-group bindings but allow forwarding only for an exact /跨群 <文字> command, never ordinary conversation.
acceptance_criteria:
- Only a literal /跨群 with whitespace and 1–1200 characters of nonempty text enqueues one native Bbot relay per eligible connected target in same room.
- No auto forwarding from normal messages, AI mentions or obsolete !plugin bridge toggles; source group excluded; receive-only sender and stopped groups blocked; all eligible receive-only targets included.
- Duplicate QQ message IDs cannot create duplicate sends; only manual-v1: outbox entries flush; old queued auto messages cancelled; no cross-group join broadcast.
- No D1 binding reset, no auto-resume, no AI/Codex GUI/Bbot memory model change, protected admin rules unchanged.
- GitHub feature/main CI, deployment verification and real QQ acceptance as possible.
current_phase: Feature CI green; memory checkpoint and safe main promotion pending.
current_step: Verify feature memory CI, then lease-check main and fast-forward, verify Cloudflare deployment and QQ group stoppage.
completed_steps:
- GitHub baseline main 6172bf1043653fa34634db6494d030d92acc78f0 inspected; prior relay auto-sent ordinary group messages when bridge plugin enabled.
- Implemented src/manual-relay.js strict parser; src/assistant.js explicit routing; src/bridge.js command-only outbox with all matching active bindings and automatic backlog suppression; src/napcat-control.js no join broadcasts and updated UX.
- Added tests/manual-cross-group.test.mjs and adjusted parallel fixture; CI 38701967374 SUCCESS (node tests and Wrangler dry-run).
- Read-only Cloudflare D1 counts: 8 binding rows, 4 verified in one room, all four stopped=1 and have numeric QQ group IDs. No binding rows were changed.
verification_results: Feature CI success, new memory CI pending, production deployment pending, real QQ command transmission not observed.
blockers: All verified live bindings are stopped, so authorized per-group !resume needed before real command can deliver. QQ official stale native slash config removal also remains unverified.
next_exact_action: After memory archive CI success, promote branch to main non-force fast-forward if unchanged; verify deployment; report group !resume requirement and ask user to test in controlled QQ group.
resume_rule: Confirm main SHA, feature SHA, latest memory version and CI. Do not reset D1, re-enable stopped groups or bulk alter QQ command panels.
last_checkpoint_date: 2026-10-15
