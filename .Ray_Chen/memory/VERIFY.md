# VERIFY
- New feature commit 4e9924729598d556b5030acd91561a9bba6d6f2d, branch feature/manual-cross-group-command-20261015: GitHub Actions 38701967374 SUCCESS (npm run check: 102 node tests and Wrangler dry-run, current-memory archive v0.0.106 during feature code test).
- Strict parser tests: /跨群 文字 valid; /跨群 empty error; /跨群測試, /!跨群, !跨群, @AIBot + normal text never forwarded; >1200 characters rejected without truncation.
- End-to-end unit with fake D1: all active targets within source room (including receive-only destination) enqueued once; source excluded, stopped group excluded, other room excluded; replayed message ID creates no new outbox entries.
- Bbot flush test: manual-v1: IDs sent, historical queued auto IDs cancelled. NapCat command tests retained, parallel outgoing batch mock unchanged.
- Cloudflare D1 READ ONLY: SELECT aggregate returned 8 total bindings, 4 verified in 1 room; 4 verified rows stopped=1. No DB changes and no QQ messages sent by these checks.
- Outstanding: memory v0.0.107 CI, main promotion, Cloudflare new build/deploy, real QQ group acceptance. Prior QQ native slash entry deletion still UNKNOWN.
- Feature memory CI 38702516128 SUCCESS; main code CI 38702611657 SUCCESS; deployed Cloudflare Worker build confirmed matching main code commit 526e199284275fe2e40fc251c3afb4707ce7a58a at 100% with deployment 57425b2c-a1de-45d3-bc6e-c89626144951/version 113e3cbc-8659-4b59-8acb-16405a6a588b.
- Pending live acceptance: group !resume under existing protected-account ACL and actual /跨群 hello from bound active sender to active target. Do not claim sent from CI alone.

## 2026-10-15 QQAIBOT upgrade Phase 1
- PR #81 initial head CI 38728955414: 105/106 tests PASSED, one prior behavior ("old EXE preferred over Gemini") FAIL; updated obsolete test to latest spec.
- Follow-up CI 38729107874: SUCCESS on commit 8dca089cf2f6f9f330fe909ff6934869a4deab9e (before upgrade plan / D1 migration / Ray_Chen memory changes); npm run check = node tests + Wrangler dry-run.
- Added tests: Bridge online does not preempt Gemini, Gemini failures fail closed without unguarded Luna, 25 messages within a day with 11-second spacing not daily-capped, fifth burst message is rate-limited.
- NOT verified: latest docs/memory CI, live Cloudflare D1 migration or atomic concurrency under production load, official QQ reply, real Windows Codex/VM, Agent isolation, portal sessions, activities, proposals, 17-item end-to-end matrix.
