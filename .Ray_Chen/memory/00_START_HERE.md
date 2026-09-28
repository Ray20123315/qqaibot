# Ray_Chen Memory Entry

- memory_version: v0.0.20
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20260928-v4-public-bot
- task_status: active
- goal_revision: 1
- branch_base_commit: 08ceeb725590d9efb0160ea38733d929e6e7d18c
- production_worker: qqai
- updated_at: 2026-09-28T12:09:00+08:00

## Goal

Build the public V4 product on an isolated branch without modifying main: QQ Open capability-first with automatic OneBot fallback; human-readable portal; QQ-private-message settings; BYOK with authenticated secure-page and direct-message key entry; consent/legal gate; developer-controlled silent group whitelist; layered political blocking; tenant-safe user plugins; and source-available all-rights-reserved licensing.

## Hard Boundary

- Do not merge, fast-forward, deploy over, or otherwise modify main in this task.
- Use feature/v4-public-bot only.
- Cloudflare work must target the same qqai Worker preview/version mechanism rather than creating a second Worker.
- Production D1/KV/DO must not be mutated by preview verification.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, USER_REQUIREMENTS.md, DECISIONS.md, GOTCHAS.md, VERIFY.md and FILE_MANIFEST.json.
2. Verify branch feature/v4-public-bot still descends from base commit above.
3. Never assume a capability from configuration alone; use runtime permission/API evidence.
4. Never expose raw API keys or source code in normal UI.
5. Do not touch main unless the user explicitly changes this task boundary.
