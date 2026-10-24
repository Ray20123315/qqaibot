# VERIFY
- New feature commit 4e9924729598d556b5030acd91561a9bba6d6f2d, branch feature/manual-cross-group-command-20261015: GitHub Actions 38701967374 SUCCESS (npm run check: 102 node tests and Wrangler dry-run, current-memory archive v0.0.106 during feature code test).
- Strict parser tests: /跨群 文字 valid; /跨群 empty error; /跨群測試, /!跨群, !跨群, @AIBot + normal text never forwarded; >1200 characters rejected without truncation.
- End-to-end unit with fake D1: all active targets within source room (including receive-only destination) enqueued once; source excluded, stopped group excluded, other room excluded; replayed message ID creates no new outbox entries.
- Bbot flush test: manual-v1: IDs sent, historical queued auto IDs cancelled. NapCat command tests retained, parallel outgoing batch mock unchanged.
- Cloudflare D1 READ ONLY: SELECT aggregate returned 8 total bindings, 4 verified in 1 room; 4 verified rows stopped=1. No DB changes and no QQ messages sent by these checks.
- Outstanding: memory v0.0.107 CI, main promotion, Cloudflare new build/deploy, real QQ group acceptance. Prior QQ native slash entry deletion still UNKNOWN.
- Feature memory CI 38702516128 SUCCESS; main code CI 38702611657 SUCCESS; deployed Cloudflare Worker build confirmed matching main code commit 526e199284275fe2e40fc251c3afb4707ce7a58a at 100% with deployment 57425b2c-a1de-45d3-bc6e-c89626144951/version 113e3cbc-8659-4b59-8acb-16405a6a588b.
- Pending live acceptance: group !resume under existing protected-account ACL and actual /跨群 hello from bound active sender to active target. Do not claim sent from CI alone.

## 2026-10-24 new standalone QQ Unsloth Worker
- Local 5/5 Node tests PASS; GitHub PR #82 isolated Worker CI 40068743188 SUCCESS and old AI CI 40068743122 SUCCESS. PR merge main a365f0c6c391a171154241e82c28f00bfa1eb322 read back with new worker source.
- Cloudflare API script PUT success HTTP 200, deployment 4ca53f6f1f6648d097ca1109607d8b9f; workers.dev route enabled; Custom Domain qqbot-ai.ray2025.com API read-back enabled true. New Worker Secrets GET returned []. Public HTTP request tool could not validate reachability.
- NOT VERIFIED: credentials, Unsloth live chat, signed QQ callback from platform, QQ C2C/group @ reply, fixed IP whitelist.

- Legacy main CI failed on memory PR initial run 40069118447 because archive step pinned v0.0.108; npm run check passed. Updated `.github/workflows/bridge-check.yml` to read MEMORY_VERSION.txt, validate FILE_MANIFEST version, and archive dynamically. Revalidated SUCCESS in PR CI run 40069333964 (npm run check, dynamic TAR creation, sha256 and artifact upload).
