# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 11
goal: respond to user's request for --no private destination behavior and directly copyable Bilibili-card text, plus roadmap suggestions
current_phase: safe subset implementation, with privacy-affecting remainder withheld
current_step: verify new Bilibili plain text and link behavior via CI, fast-forward main after passing

completed_steps:
- verified latest main d0e45d2a02d4183bdda227371042eca7212f3d6a with Bbot-only recall-v4, existing --no receive-only, !setting and !help behavior
- user's requested combination: hide receive-only recipient from permission/list/help views AND retain all copies after source recall. This removes origin users' awareness and source recall control; do NOT implement without a transparent, appropriately authorized audit/retention model
- Bilibili readableCard now keeps HTTPS links from exact bilibili.com or b23.tv domains as directly copyable text; no raw JSON/XML card resend; other providers' links retain non-clickable obfuscation
- tests/recall-emoji.test.mjs now checks raw usable Bilibili link and non-Bilibili link restraint
- README and DEPLOY document that QQ may still auto-preview plain URL, and that covert receive-only retention is not enabled

verification_results: feature CI pending
known_risks:
- QQ itself may auto-preview a literal HTTPS URL; not controllable solely by Worker
- hidden receive-only/undeletable recalled copies are unimplemented on purpose
- no change to recall engine, QQ administrative permissions, or existing group topology
next_exact_action: Run feature CI, advance main if green; create/verify v0.0.89 archive and send one Gmail notice; recommend transparent privacy policy for future --no and feature prioritization.
checkpoint_at: 2026-10-09T18:00:36.245Z
