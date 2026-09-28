# Ray_Chen Memory Entry

- memory_version: v0.0.22
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 1
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- foundation_commit: 21e5a8f00daeb7e465ca927c6f1d6acfadfe1259
- production_worker: qqai
- updated_at: 2026-09-28T13:00:00+08:00

## Current Phase

Phase 1 foundation is VERIFIED by GitHub Actions run 36379116271:
- existing regression checks: success
- V3 regression checks: success
- V4 regression + new public-foundation checks: success
- isolated V4 test deployment dry-run: success
- single Worker bundle: success

Next work is BYOK/authenticated secure entry, QQ private-message settings, provider live-membership integration, political guard integration and V4 user UI.

## Hard Boundary

- Do not modify or merge main.
- Continue only on feature/v4-public-bot.
- Same qqai Worker preview only; do not create another Worker.
- Do not mutate production D1/KV/DO during preview verification.
