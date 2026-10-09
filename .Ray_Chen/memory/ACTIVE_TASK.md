# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 10
goal: mirror QQ message recalls and fix @, Bilibili card, face/mface and --no receive-only joining and settings on Bbot-only main
current_phase: code deployed, waiting for user NapCat v4 WebSocket reconnect and real QQ acceptance tests
current_step: operator disable/enables NapCat WebSocket Client once and tests in several linked QQ groups
completed_steps:
- Baseline main at start 24a33000916d239caa1b9fcac789213972a5d041; full original archive/legacy-main-20261009 sha 6a22b06433cfaffcf13abe2b60a917305290b629 preserved.
- Added src/recall.js D1 bridge_recalled_sources, bridge_recall_map, bridge_recall_queue, group_recall notice validation and best-effort OneBot delete_msg for verified Bbot-generated target message IDs.
- worker.js now reports OneBot ACK data.message_id and processes group_recall events, flushes recall queue, schedules late recall when source was recalled before send ACK.
- src/bridge.js adds only one additive bridge_groups.receive_only INTEGER NOT NULL DEFAULT 0, cancels pending source messages when recalled, persists source-to-sent target mapping, respects --no source outbound suppression.
- src/napcat-control.js adds !setting/!settings rights/group listing, --no join only receive mode with no broadcast, ordinary join announcing to other existing active linked groups, while respecting protected ACL.
- src/core.js/native relay.js preserve face/mface distinct classes and QQ sticker IDs, native at for verified destination member, source nickname or @群友 fallback, Bilibili/QQ JSON/XML card rendered as text.
- New shared hub identity bridge-bbot-recall-v4 protects rollout from old hot OneBotHub WebSocket code.
- tests/recall-emoji.test.mjs, tests/napcat-control.test.mjs, tests/hub-generation.test.mjs and tests/relay.test.mjs updated; all tests and Wrangler dry-run green on feature CI 37969072123 and main CI 37969193082.
- Feature product commit 61666942ac971a4d52c88105a1970898a180f340 advanced to main without force; Cloudflare qqai deployment 7903d855-69bb-49d1-9d49-2c85ef5fd16a, version ed71a6b6-dbd6-4402-a4f2-e0a311e606d5, build success, 100% traffic, source 61666942ac971a4d52c88105a1970898a180f340.
- Old Abot still disabled, existing D1 and protected QQ 3569028262/2681167798 unchanged.
- Memory-only synchronization now v0.0.88; package CI pending.
verification_results:
- feature and main Node tests PASS, Wrangler dry-run PASS
- Cloudflare program build and deployment PASS
- Live QQ recall, market sticker send, Bilibili card and group notification NOT YET VERIFIED.
known_risks:
- NapCat send_group_msg ACK must contain actual message_id to safely recall a copy; no guessed IDs.
- QQ may reject delete_msg because recall time limit or client permissions; errors logged, not retried ambiguously.
- Mixed market sticker/media segments may be rejected by actual QQ NapCat build.
- New Bbot Hub v4 will appear disconnected until operator reconnects NapCat WebSocket Client; URL/Token unchanged.
- Existing QQ group where Bbot does not receive messages cannot forward; verify bot is present and OneBot group events enabled.
next_exact_action: user restarts NapCat WebSocket Client and checks https://aibot.ray2025.com/health for bbot.hub_generation='recall-v4', bbot.connected=true; then in one linked group send !setting, in another join with !CODE --no, test one native @ and one sticker and recall a forwarded message. If errors obtain Cloudflare logs for new version.
checkpoint_at: 2026-10-09T17:53:01.621Z
