# ACTIVE_TASK

task_id: qqaibot-20260928-v4-public-bot
task_status: active
goal_revision: 2
goal: Build isolated V4 public-bot architecture and UI on feature/v4-public-bot without touching main.

## verified
- official-first hybrid routing and safe fallback
- dual BYOK AI + D1/KV onboarding
- user-owned QQ Open private chat persistence
- user-owned QQ Open individual settings persistence
- live membership AI sharing
- layered political guard
- plugin runtime quarantine
- human-readable resource dashboard and plugin-security page
- developer-only hidden 00000 mode

## external-operation checkpoint

run_id: cloudflare-preview-d1-20260928-v1
operation: create dedicated D1 for same-worker Preview
database_name: qqaibot-v4-public-preview
expected_output: one D1 database UUID, distinct from production 569a01fe-3297-40e1-832f-09c3793056ed
done_when:
- Cloudflare create call returns success
- read-back list finds exactly the created database name/UUID
- production qqaibot UUID remains unchanged
rollback:
- if later abandoned and still Preview-only, delete this dedicated Preview database only after explicit state verification
forbidden:
- do not modify production D1
- do not create another Worker
- do not deploy to production
- do not reuse production Vectorize for Preview user-content writes

current_phase: Phase 3
current_step: Create and read-back Preview-only D1, then configure same qqai Worker Preview.
verification_results:
- model-preference commit 820779518c8bf60bcc541182249f651101632080
- GitHub Actions run 36387904014 success
blockers: []
next_exact_action: Create qqaibot-v4-public-preview D1 using Cloudflare API and verify its UUID by read-back.
resume_rule: If create result is ambiguous, list D1 databases by exact name before retrying; never create duplicates blindly.
last_checkpoint_at: 2026-09-28T15:05:00+08:00
