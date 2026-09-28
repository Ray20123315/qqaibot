# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main, including user-owned AI and persistence resources.

## completed
- official-first hybrid runtime
- legal/role/whitelist foundation
- dual BYOK AI + D1/KV onboarding
- user-owned QQ Open private chat persistence
- group durable-history suppression until explicit group storage ownership
- live-membership AI sharing
- layered political guard
- runtime plugin quarantine
- human-readable V4 resource dashboard
- developer-only hidden 00000 mode
- human-readable plugin security review center

## remaining
- move QQ Open individual persistent settings such as model preference to user-owned storage
- same-Worker Cloudflare Preview and isolated live verification
- final remaining persistence audit
- QQ official 2023 self-test workbook after implementation verification

current_phase: Phase 1/3 integration
current_step: Move QQ Open model preference to User Persistence.
verification_results:
- plugin security page commit e080b4f9a2a1d6b621092facf5e90fb0518bb5d1
- GitHub Actions run 36387524570: success
blockers: []
next_exact_action: Implement user-storage-backed model preference for QQ Open command, generation and official switch-model interaction.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:55:00+08:00
