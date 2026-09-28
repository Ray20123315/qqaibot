# Ray_Chen Memory Entry

- memory_version: v0.0.21
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 1
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- production_worker: qqai
- updated_at: 2026-09-28T12:45:00+08:00

## Current Phase

Phase 1 foundation has been produced on the isolated branch:
- capability-first QQ Open with safe OneBot fallback contract;
- role/legal-access state;
- membership-bound AI Provider sharing model;
- text-first political guard contract;
- runtime plugin boundary hook;
- restrictive source-available copyright notice.

GitHub CI for the foundation commit is the next gate. Production Cloudflare resources and main remain untouched.

## Hard Boundary

- Do not merge, fast-forward, deploy over, or otherwise modify main in this task.
- Use feature/v4-public-bot only.
- Cloudflare work must target the same qqai Worker preview/version mechanism rather than creating a second Worker.
- Production D1/KV/DO must not be mutated by preview verification.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, USER_REQUIREMENTS.md, DECISIONS.md, GOTCHAS.md, VERIFY.md and FILE_MANIFEST.json.
2. Verify branch feature/v4-public-bot still descends from base commit above.
3. Check foundation CI before adding BYOK/DM/UI integration.
4. Never fall back destructive operations after UNKNOWN timeout/network/5xx outcome.
5. Never coerce QQ Open OpenID into numeric QQ.
