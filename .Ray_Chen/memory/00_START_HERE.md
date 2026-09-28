# Ray_Chen Memory Entry

- memory_version: v0.0.23
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 2
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- verified_foundation_commit: 21e5a8f00daeb7e465ca927c6f1d6acfadfe1259
- current_product_commit: 678d6a1d1eb21637fb8c542d90da54c590bce6d0
- production_worker: qqai
- updated_at: 2026-09-28T13:55:00+08:00

## Current Phase

Phase 1 resource integration is PRODUCED and awaiting CI:
- BYOK remains dual-entry: authenticated one-time secure page + direct AIBot private message.
- Added BYO Storage Connector abstraction for Cloudflare D1 and KV.
- Added session-bound / QQ-DM one-time resource tickets with optional QQ OpenID -> logged-in QQ identity claim.
- QQ private resource commands intercept before the general chat bridge, so direct credentials do not enter ordinary chat history/AI prompts first.
- Added authenticated V4 resource API and human-readable secure resource page.
- No new Cloudflare storage product was added to the platform itself.

## Hard Boundary

- Do not modify or merge main.
- Continue only on feature/v4-public-bot.
- Same qqai Worker preview only; do not create another Worker.
- Do not mutate production D1/KV/DO during preview verification.
- Never store or log raw AI keys / Cloudflare API tokens.
