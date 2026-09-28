# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: blocked
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main.

## verified

- official-first QQ Open / OneBot hybrid routing
- dual BYOK AI + D1/KV onboarding
- user-owned QQ Open private chat persistence
- user-owned QQ Open model preference persistence
- user-owned QQ Open personal style persistence
- user-owned QQ Open do-not-disturb persistence
- user-owned QQ Open manual long-term memory persistence
- QQ Open manual memory does not write platform Vectorize
- live-membership AI sharing
- layered political guard
- runtime plugin quarantine
- human-readable resource dashboard and plugin-security review
- developer-only hidden 00000 mode

## external-operation checkpoint

run_id: cloudflare-preview-d1-20260928-v1
operation: create dedicated D1 for same-worker Preview
database_name: qqaibot-v4-public-preview
expected_output: one D1 database UUID distinct from production 569a01fe-3297-40e1-832f-09c3793056ed
result: blocked
error: Cloudflare API 7406 — System limit reached: databases per account (10)
read_back:
- exact preview database name: not present
- existing D1 count: 10
- production qqaibot UUID unchanged: 569a01fe-3297-40e1-832f-09c3793056ed
- no existing database was modified, deleted or repurposed

forbidden:
- do not retry create blindly
- do not delete an existing D1 automatically
- do not reuse production qqaibot D1 for Preview
- do not create another Worker

current_phase: Phase 3
current_step: Waiting for one safe D1 slot or quota increase before same-worker Preview.
completed_steps:
- product commit 5def3958512fcd45a5219be83a0b77cfe454061d
- GitHub Actions run 36403470105 success
verification_results:
- base regression: success
- V3 regression: success
- V4 regression including user-profile persistence test: success
- isolated V4 dry-run: success
- single Worker bundle: success
known_failures:
- Preview D1 creation failed only because account D1 limit is reached
blockers:
- CLOUDFLARE_D1_ACCOUNT_LIMIT_10
next_exact_action: Free one verified-unused D1 slot or increase the account D1 quota; then list by exact name, create qqaibot-v4-public-preview once, read back its UUID, and continue same-qqai Worker Preview configuration.
resume_rule: Before any new create attempt, query D1 by exact name. Never delete or repurpose an existing database without explicit verification.
last_checkpoint_at: 2026-09-28T17:32:00+08:00
