# Ray_Chen Memory Entry

- memory_version: v0.0.31
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: blocked
- goal_revision: 2
- latest_verified_product_commit: 5def3958512fcd45a5219be83a0b77cfe454061d
- latest_verified_ci_run: 36403470105
- production_worker: qqai
- updated_at: 2026-09-28T17:32:00+08:00

## Verified Through This Checkpoint

- QQ Open private chat history uses user-owned storage only.
- QQ Open model preference uses user-owned storage only.
- QQ Open personal style, do-not-disturb state and manual long-term memories now use the user's Storage Connector.
- QQ Open manual memory no longer writes platform D1 content or platform Vectorize.
- QQ Open personal-setting reads use the same user-owned storage path, so there is no hidden platform-D1 read fallback.
- OneBot legacy persistence remains unchanged for compatibility.
- Full base/V3/V4/V4-test/bundle checks passed for product commit 5def3958512fcd45a5219be83a0b77cfe454061d.

## Current Blocker

Cloudflare D1 create for `qqaibot-v4-public-preview` failed with API code 7406: account database limit reached (10 databases). Read-back confirms no dedicated V4 Preview D1 exists. No existing D1 was modified or repurposed.

## Hard Boundary

- Do not modify or merge main.
- Do not deploy production.
- Do not reuse production D1 or production Vectorize for Preview user-content testing.
- Do not delete or repurpose any existing D1 without an explicit, separately verified ownership decision.
