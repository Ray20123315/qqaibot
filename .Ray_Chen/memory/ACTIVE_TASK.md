# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main, including user-owned AI and persistence resources.

## completed
- capability-first official/OneBot runtime foundation
- legal/role/whitelist foundations
- dual BYOK AI + D1/KV onboarding
- live membership AI sharing
- layered political guard
- runtime plugin quarantine
- human-readable Portal resources
- developer-only hidden 00000 progressive reveal

## remaining
- route concrete QQ Open V4 private user content through User Persistence
- prevent QQ Open group long-term chat-history fallback to platform D1 without explicit group storage owner
- modernize plugin security-review surface
- same-Worker Cloudflare preview and live verification
- official QQ self-test workbook after implementation verification

current_phase: Phase 1/2 integration
current_step: Implement concrete QQ Open chat-history persistence boundary.
verification_results:
- Portal commit af89a42aae1219224a2323fc69118ef6c2a94b4c
- GitHub Actions run 36386417711: success
blockers: []
next_exact_action: Replace QQ Open private chat history platform-D1 read/write with User Persistence and disable QQ Open group history platform-D1 persistence unless an explicit group storage route exists.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:38:00+08:00
