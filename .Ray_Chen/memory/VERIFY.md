# VERIFY
- New feature commit 4e9924729598d556b5030acd91561a9bba6d6f2d, branch feature/manual-cross-group-command-20261015: GitHub Actions 38701967374 SUCCESS (npm run check: 102 node tests and Wrangler dry-run, current-memory archive v0.0.106 during feature code test).
- Strict parser tests: /跨群 文字 valid; /跨群 empty error; /跨群測試, /!跨群, !跨群, @AIBot + normal text never forwarded; >1200 characters rejected without truncation.
- End-to-end unit with fake D1: all active targets within source room (including receive-only destination) enqueued once; source excluded, stopped group excluded, other room excluded; replayed message ID creates no new outbox entries.
- Bbot flush test: manual-v1: IDs sent, historical queued auto IDs cancelled. NapCat command tests retained, parallel outgoing batch mock unchanged.
- Cloudflare D1 READ ONLY: SELECT aggregate returned 8 total bindings, 4 verified in 1 room; 4 verified rows stopped=1. No DB changes and no QQ messages sent by these checks.
- Outstanding: memory v0.0.107 CI, main promotion, Cloudflare new build/deploy, real QQ group acceptance. Prior QQ native slash entry deletion still UNKNOWN.
