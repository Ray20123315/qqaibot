# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main, including user-owned AI and persistence resources.

## completed
- capability-first QQ Open / OneBot runtime
- legal, roles, silent whitelist
- dual AI credential onboarding
- D1/KV Storage Connectors
- user-owned private chat persistence
- QQ Open group platform-persistence suppression until group storage ownership exists
- live-membership AI sharing
- layered political guard
- plugin runtime quarantine
- V4 human-readable resource dashboard
- developer-only hidden 00000 mode

## remaining
- modernize plugin security detection/review surface
- same-Worker Cloudflare Preview configuration and isolated live verification
- review remaining QQ Open settings/plugin-data writers for user-storage routing
- fill official QQ 2023 self-test workbook after implementation verification

current_phase: Phase 2
current_step: Modernize plugin security center UI using existing security-center data.
verification_results:
- persistence commit 38b5cbac605e8add9c25e28a8375dea3d6052bb5
- GitHub Actions run 36387088840: success
blockers: []
next_exact_action: Update /plugin-security to a human-readable review center while retaining the existing safe machine-readable API.
resume_rule: Continue only on feature/v4-public-bot; never touch main.
last_checkpoint_at: 2026-09-28T14:46:00+08:00
