# ACTIVE_TASK
task_id: manual-cross-group-command-20261015
task_status: blocked
goal_revision: 1
goal: Preserve all existing verified D1 cross-group bindings but allow forwarding only for an exact /跨群 <文字> command, never ordinary conversation.
acceptance_criteria:
- Only a literal /跨群 with whitespace and 1–1200 characters of nonempty text enqueues one native Bbot relay per eligible connected target in same room.
- No auto forwarding from normal messages, AI mentions or obsolete !plugin bridge toggles; source group excluded; receive-only sender and stopped groups blocked; all eligible receive-only targets included.
- Duplicate QQ message IDs cannot create duplicate sends; only manual-v1: outbox entries flush; old queued auto messages cancelled; no cross-group join broadcast.
- No D1 binding reset, no auto-resume, no AI/Codex GUI/Bbot memory model change, protected admin rules unchanged.
- GitHub feature/main CI, deployment verification and real QQ acceptance as possible.
current_phase: Main code verified and Cloudflare deployed; live QQ acceptance blocked by existing group stopped state.
current_step: Require authorized group owners/protected QQ account to use !resume on applicable groups, then send one /跨群 測試 for end-to-end confirmation.
completed_steps:
- GitHub baseline main 6172bf1043653fa34634db6494d030d92acc78f0 inspected; prior relay auto-sent ordinary group messages when bridge plugin enabled.
- Implemented src/manual-relay.js strict parser; src/assistant.js explicit routing; src/bridge.js command-only outbox with all matching active bindings and automatic backlog suppression; src/napcat-control.js no join broadcasts and updated UX.
- Added tests/manual-cross-group.test.mjs and adjusted parallel fixture; CI 38701967374 SUCCESS (node tests and Wrangler dry-run).
- Read-only Cloudflare D1 counts: 8 binding rows, 4 verified in one room, all four stopped=1 and have numeric QQ group IDs. No binding rows were changed.
verification_results: Feature code CI 38701967374 SUCCESS; memory feature CI 38702516128 SUCCESS; main CI 38702611657 SUCCESS; Cloudflare 57425b2c-a1de-45d3-bc6e-c89626144951 version 113e3cbc-8659-4b59-8acb-16405a6a588b 100%, build SHA 526e199284275fe2e40fc251c3afb4707ce7a58a SUCCESS; real QQ sending NOT observed.
blockers: All verified live bindings are stopped, so authorized per-group !resume needed before real command can deliver. QQ official stale native slash config removal also remains unverified.
next_exact_action: In one or more verified QQ groups, authorized administrator must issue !resume (per protected QQ restrictions), then /跨群 測試 from an active source; confirm delivery to an active linked destination.
resume_rule: Confirm main SHA, feature SHA, latest memory version and CI. Do not reset D1, re-enable stopped groups or bulk alter QQ command panels.
last_checkpoint_date: 2026-10-15
