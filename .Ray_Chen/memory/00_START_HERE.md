# Ray_Chen Memory Entry

- memory_version: v0.0.25
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 2
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- latest_verified_product_commit: c27821b247f3e8bdc35bf6987886b8c5855fcb60
- production_worker: qqai
- updated_at: 2026-09-28T14:25:00+08:00

## Verified Through This Checkpoint

- user-owned AI providers are now in the real chat/provider route;
- own provider is attempted before shared/group provider and before platform AI fallback;
- shared provider use requires live membership validation;
- QQ OpenID and numeric QQ identity remain separate unless explicitly linked;
- political filtering is text-first, classifier-second for ambiguous input, with an output guard before persistence/send;
- BYOK sharing controls exist in Portal API and QQ private settings;
- secure AI onboarding supports model field and direct QQ-DM optional model;
- all regression/V3/V4/V4-test/bundle checks passed for c27821b247f3e8bdc35bf6987886b8c5855fcb60.

## Hard Boundary

- Do not modify or merge main.
- Continue only on feature/v4-public-bot.
- Same qqai Worker preview only; do not create another Worker.
- Do not mutate production D1/KV/DO during preview verification.
- Never store or log raw AI keys / Cloudflare API tokens.
