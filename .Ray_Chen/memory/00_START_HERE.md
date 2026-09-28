# Ray_Chen Memory Entry

- memory_version: v0.0.24
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 2
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- verified_resource_commit: 678d6a1d1eb21637fb8c542d90da54c590bce6d0
- current_product_commit: fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea
- production_worker: qqai
- updated_at: 2026-09-28T14:10:00+08:00

## Current Phase

V4 user-resource onboarding is verified at commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0.
A new persistence-policy commit fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea is produced and awaiting CI.

The V4 persistence boundary is now explicit:
- platform control-plane state stays in QQAIBOT D1;
- user content persistence requires a user-owned Storage Connector;
- there is no silent platform-D1 fallback for V4 user content.

## Hard Boundary

- Do not modify or merge main.
- Continue only on feature/v4-public-bot.
- Same qqai Worker preview only; do not create another Worker.
- Do not mutate production D1/KV/DO during preview verification.
- Never store or log raw AI keys / Cloudflare API tokens.
