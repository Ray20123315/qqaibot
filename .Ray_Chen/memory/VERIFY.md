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

## 2026-10-24 QQ outbound UNKNOWN cause classification
- Actual user QQ diagnostic: callback_verify OK (08:50:51.404Z), event_received GROUP_AT (08:47:16.871Z), send_failed UNKNOWN (08:47:17.621Z), earlier event_ignored (08:46:40.007Z). Evidence proves callback and incoming event, NOT outbound success.
- PR #92 isolated CI 40079995888 PASS, original QQAIBOT AI CI 40079995892 PASS, merged main d6997d37bb3861e037dbca4bbb742c6b490ecbc5. Tests cover QQ token fetch exception/timeout, QQ send fetch exception/timeout, safe business codes for HTTP200 and no secret/raw error logging.
- Cloudflare strict-inherit deployment 9ece06c4-edbc-4055-8a2a-1a7e2f87ecb4 100% readback with 4 secret_text names, CONFIG_KV, flag global_fetch_strictly_public, source has new codes; selected-model-v2 and older diag keys remained. No real QQ send attempt triggered by tool actions.
- Tencent official docs show production outbound IP allowlist; actual cause remains UNKNOWN until next QQ real message diagnostic. Real reply_sent not evidenced.
- Previous local archive v0.0.115 checksum 330f5cef91ad35c3708e01724ff37d460053518ddb2e3778c0c5ecd0a0765603; GitHub remote v0.0.114 until this v116 reconciliation.

## 2026-10-24 Modern Qwen QQ console
- PR #94 isolated CI 40082915685 SUCCESS; legacy QQ AI CI 40082915660 SUCCESS, merged main 8741abb9ea524adfb77dd3d7629ace6dda5b5fd3. Initial CI uncovered dashboard text label mismatch with previous test; fixed and reran PASS.
- Tests cover dashboard presence, admin login cookie flags, authorized cookie model listing and save, wrong admin key, cross-origin requests, revoked secret, logout cookie deletion, preserving Qwen chat newlines and tabs; all on Node test runner. Original QQ callback/token tests passed.
- Cloudflare qqaibot-unsloth module script upload HTTP 200, version 68e38e2c-da07-4c2b-a9d7-1e959f89e4d2 deployment 100%. Readback flags global_fetch_strictly_public, 4 secret_text bindings retained, CONFIG_KV namespace 033b241f7377496790d92056d39669ad and selected-model-v2 key persisted. Source includes Qwen Console, __Host-qqai_session, /api/session, /webhook, /api/qq/diagnostics.
- NOT VERIFIED: external browser screenshot/visual test, real admin cookie via actual public HTTPS, QQ sent/replied post new deployment, end-to-end image/audio/web forwarding. No image generation changes.

## 2026-10-24 Unsloth multi-role release PR #96
- Authenticated GitHub normal create_file succeeded on feature/unsloth-multirole-routing-20261024. PR #96 merged main dfc771c6e39e53fe316d75039fc834d0f2af87a4.
- Isolated worker CI 40087298832 SUCCESS, legacy QQ CI 40087298901 SUCCESS; first isolated CI 40087225904 failed 4 compatibility errors (MODEL_HTTP/MODEL_CONNECTION_FAILED/MODEL_EMPTY_RESPONSE), repaired wrapper and reran PASS. New test/role-router.test.mjs covers legacy migration, safe config validation, explicit web_search only SSE, ASR/TTS fixed API routing, admin auth, no image routing, UI roles.
- Cloudflare strict-inherit five-module upload HTTP 200, deployment 365a232a-ad3b-49ab-aecb-e150a3214c4c at 100%. Readback verified 4 secret_text ADMIN_TOKEN/QQ_APP_ID/QQ_APP_SECRET/UNSLOTH_API_KEY, CONFIG_KV namespace 033b241f7377496790d92056d39669ad, global_fetch_strictly_public, source has model-roles-v3, /api/model-roles, /api/audio/speech, /api/audio/transcriptions, web_search and existing QQ webhook. selected-model-v2 key remains, new role key not yet saved.
- NOT VERIFIED: authenticated real browser operation, web_search actual streaming/permissions for user's Unsloth version, real audio TTS/ASR, QQ voice media, simultaneous model VRAM residency. No screenshot/live QQ proof for new release.

## 2026-10-24 always-search and QQ Markdown release
- Official Tencent bot-docs v2 send.md and markdown.md: group/C2C msg_type 2 accepts markdown.content, QQ Markdown/native/passive permission may require application. Unsloth official inference smoke tests show enable_tools and enabled_tools web_search, but GitHub issue #9730 documents GGUF hosted-tool filtering problem.
- PR #98 isolated CI 40089303664 SUCCESS and old QQ AI CI 40089303680 SUCCESS, merged main 03f829edebff295cb5953ad5636e41db2c5527ce. New tests validate native QQ MD payload, structured headings/ordered lists, cleaned fallback, rejection cache, no duplicate retry after timeout, role config legacy webSearch:false always effective true, fixed upstream/tool allowlist.
- Cloudflare six-module PUT HTTP 200, version cdfea900-f08a-4df0-9363-d80a5abad14c 100% readback, unchanged 4 secret_text + CONFIG_KV 033b241f7377496790d92056d39669ad, global_fetch_strictly_public, KV model-roles-v3 and selected-model-v2 retained, source includes withSearch true, qq-markdown-denied-v1 and existing webhook. Original qqai not altered.
- NOT VERIFIED: live Unsloth web_search execution, actual QQ platform Markdown privilege/format, mobile list font sizing, or real QQ message after release. Do not overclaim based on CI mocks.

## 2026-10-24 natural QQ persona no technical disclosure
- PR #101 merged main 218809ad9d2670a405b1a8ed1e6578c30183ed01. Isolated Worker CI 40091803676 SUCCESS and legacy QQAIBOT AI CI 40091803666 SUCCESS; initial CI failures due stale persona phrase assertion fixed.
- Cloudflare independent qqaibot-unsloth deployment 79cef349-a2b2-4c13-91d1-5dcb38e40326 at 100%; readback confirms new persona and nondisclosure strings, unchanged 4 Secret bindings, CONFIG_KV selected-model-v2/model-roles-v3, QQ webhook and global_fetch_strictly_public.
- NOT VERIFIED: real QQ generated replies consistently Simplified, never contain model details under adversarial questioning, and sound natural. Worker hardcoded Chinese refusal/error messages are unchanged.
