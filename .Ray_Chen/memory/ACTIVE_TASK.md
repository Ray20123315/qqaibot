# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 1
current_phase: implementation and verification
current_step: new standalone Worker staged on feature branch; run CI and manual transport checks before main promotion

acceptance_criteria:
- archive old main immutably at 6a22b06433cfaffcf13abe2b60a917305290b629
- create bridge connection code, multi-group join, QQ ID/group OpenID pairing
- Bbot-only privileged QQ identity, role and roster verification
- protect QQ 3569028262 and 2681167798 from unauthorized stop/leave/revoke
- support delegated manage/stop via /grant and /ungrant
- support /status, /leave, /rename, /revoke, /stop, /resume, /code
- disable AI and protect from duplicate relay and self-relay
- verify tests and Cloudflare bundle
- validate actual QQ active-send/@ before main promotion

blockers:
- QQ official docs say proactive push discontinued 2025-04-21. Destination groups cannot necessarily receive unsolicited Abot sends.
- Need live QQ/NapCat credential-backed sandbox to prove mention/push and OpenID mapping.

next_exact_action: execute feature branch CI and record outcome, then test transport in isolated QQ groups; do not promote main without live evidence.
