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

## 2026-10-24 Unsloth model picker
- GitHub PR #84: isolated test CI 40072501757 SUCCESS; legacy test CI 40072501794 SUCCESS; merged main 16764e1bcc7509f0eb761040e6ed738e05572194 with worker and model-config.js readback.
- Cloudflare API: dedicated KV namespace 033b241f7377496790d92056d39669ad created. qqaibot-unsloth script upload success; version c179d753-b3f8-4f0f-ac2f-a262379eff14 at 100% deployed, settings readback CONFIG_KV mapped to that ID; domain qqbot-ai.ray2025.com enabled.
- Verified tests cover model listing URL/Authorization and no redirect, deduplicated IDs, list errors, authenticated settings, unlisted selection refusal, AES-GCM ciphertext not exposing key or model, rotated admin secret fails decrypt, selected model used for /v1/chat/completions without tool calls.
- Limit: Secrets list still EMPTY. Web tool cannot access public HTTPS URL; no actual API key, model listing, chat completion or QQ platform event tested.

## 2026-10-24 Secret-only deployment
- GitHub merged PR #87 main 500c7689c199dc5db33f91146dc6e7c78f05f2fd; isolated CI 40075035673 SUCCESS; existing AI CI 40075035664 SUCCESS.
- Cloudflare Worker qqaibot-unsloth PUT HTTP 200 version 678a0b74-800b-47ea-9efe-868fd7e551f0 deployed 100%; settings readback shows global_fetch_strictly_public, original ADMIN_TOKEN plain_text and CONFIG_KV namespace 033b241f7377496790d92056d39669ad.
- Source readback includes selected-model-v2 and no crypto.subtle.encrypt call; KV keys listing zero prior to change. User verified Unsloth local HTTP 200, public HTTP 200 with Bearer. Public live Worker model list/QQ message not yet tested (missing Worker Secret); platform web URL tool cannot reach endpoint.

## 2026-10-24 Admin chat failure diagnostics
- GitHub PR #89 tests: CI 40076227706 isolated Worker SUCCESS, 40076227711 existing AI SUCCESS, main merge a974232b6f71991af2d23f654d618ccc0ec72465 readback.
- Tested no-tool request, 60s web timeout/22s QQ budget, HTTP 400 sanitization, network vs timeout, JSON invalid/empty response and text array responses. CI initially failed on outdated test assumptions, corrected and rerun PASS.
- Cloudflare PUT HTTP 200 with strict inherit ADMIN_TOKEN/UNSLOTH_API_KEY and dedicated CONFIG_KV; deployment 327900f7-5a47-46dc-87ca-ee8988240bdf at 100%; source contains MODEL_TIMEOUT, MODEL_EMPTY_RESPONSE and max_tokens:1024. Secret types remain secret_text. global_fetch_strictly_public still active, selected-model-v2 KV key exists.
- NOT VERIFIED: live POST /v1/chat/completions from Cloudflare Worker, real model response, QQ platform E2E. Need user web chat retest and safe error code.
