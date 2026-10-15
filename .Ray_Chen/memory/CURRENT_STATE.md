# CURRENT_STATE
- Repository Ray20123315/qqaibot; main at task start 6172bf1043653fa34634db6494d030d92acc78f0, main code commit 526e199284275fe2e40fc251c3afb4707ce7a58a (promoted feature/manual-cross-group-command-20261015).
- Strict Bbot /跨群 command-only source implemented and verified on main; AI reply path remains Abot passive, Codex GUI source unchanged, Bbot D1/Vectorize memory source unchanged.
- Existing cross-group binding storage: D1 bridge_groups and bridge_rooms; synthetic napcat:<QQ group> IDs remain. No migrations or D1 writes made during this task.
- Cloudflare D1 read-only 2026-10-15: 8 total group binding rows, 4 verified under one room; all 4 verified rows stopped=1 with numeric group IDs; zero active sender/destination. Real send acceptance BLOCKED until authorized resume.
- Feature tests enforce text length 1–1200, exact literal /跨群, all active same-room targets, no self/other-room/stop, recall mapping, manual-v1 outbox-only, no stale auto sends and no unsolicited join broadcast.
- Existing Windows GUI Codex Bridge built by prior Windows CI 38114199372; preserve tools/codex-bridge-gui and package workflow.
- QQ stale official native menu item /!设置插话率 remains UNKNOWN/NOT VERIFIED removed. Cloudflare earlier QQ panel endpoint returned unsupported schema; no broad deletes authorized.

- GitHub main CI 38702611657 PASS; Cloudflare qqai production deployment 57425b2c-a1de-45d3-bc6e-c89626144951 version 113e3cbc-8659-4b59-8acb-16405a6a588b at 100% from commit 526e199284275fe2e40fc251c3afb4707ce7a58a, build success. QQ actual delivery untested pending authorizations and !resume.

## QQAIBOT comprehensive upgrade branch 2026-10-15
- main HEAD 78d7a8b252cbd12a44599e8c93e1462a524de4a6 preserved; PR #81 draft branch feature/qqaibot-upgrade-phase1-20261015 only.
- Phase 1 changes: model default Gemini when Codex Bridge online or offline; legacy daily Abot quotas removed, replace with atomic D1 short burst limit 4 per 10s per group/user. Bbot dormant assistant quota replaced with short rate window.
- New abot_ai_rate_limit schema is ADDITIVE in code plus migrations/20261015_001_abot_ai_rate_limit.sql; not yet applied to live D1.
- No Agent sandbox, user Luna/Sol/Max authorization, activity/voting plugin, portal UI/API or fallback circuit breaker is finished. Existing main Portal is minimal; full legacy site remains only in archive/legacy-main-20261009.
- CI success 38729107874 predates documentation/memory updates; final CI must be verified on latest PR head. No production/QQ live testing or deploy.
