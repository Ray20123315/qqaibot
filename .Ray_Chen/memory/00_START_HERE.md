# Ray_Chen Memory Entry

- memory_version: v0.0.49
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 3
- product_revision: 262b019b3246ea9fba54975fc3f4954e6cfd432a
- updated_at: 2026-10-01T17:08:00+08:00

## Current Goal

Keep all V4 acceptance work off production. Fix the reported Portal double-login bug, keep the verified command/identity/whitelist work intact, and do not live-test Bot behavior in real QQ groups because there is currently no isolated Bot/canary path and such testing would affect group chat.

## Verified State

- Portal successful login no longer calls `boot()` immediately in the same page/fetch chain.
- QQ code login, password login and Preview test login all call `finishPortalLogin()`, which performs one full page reload after the server has returned the session cookie.
- Login regression test prevents the old `if(r.ok){await boot()}` pattern from returning.
- Final GitHub CI run `36840520274`: SUCCESS.
- Cloudflare branch build `5d11ffad-1a68-48f6-8daa-630246f8c16b`: SUCCESS for commit `262b019b3246ea9fba54975fc3f4954e6cfd432a`.
- Stable Preview deployment #7: `97c695ee-b4f7-4bdd-b353-3b23ad5b56b4`.
- Preview remains isolated with `QQ_OPEN_ENABLED=false`, `QQAI_DB_TABLE=kv_store_v4public_preview`, and no production-sensitive bindings.
- Live same-origin auth probe: first Preview login HTTP 200; the immediately following first `/api/portal/me` also returned HTTP 200 with an authenticated system-admin session.

## Bot Test Constraint

Do not send live Bot test messages or run real QQ group canaries until an isolated Bot/canary route exists or the user explicitly authorizes a specific live test. Current real-group testing would affect normal group chat.

## Production / Merge Gate

- `main` remains untouched.
- Do not merge until the user accepts the V4 Preview.
- Preview-only test-login functionality still must be removed or disabled before any future production merge.

## Resume Rule

Resume from v0.0.49. The next exact action is the user's single-login manual check on the stable Preview. Do not use live QQ group Bot tests as the next verification step.
