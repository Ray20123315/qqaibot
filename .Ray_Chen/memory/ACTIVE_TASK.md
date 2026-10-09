# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 10
goal: mirror source group message recall across linked groups; fix QQ @ rendering, Bilibili card, native QQ emojis; implement --no one-way join, !setting, !help and join notifications
acceptance_criteria:
- Authenticated OneBot group_recall notice triggers delete_msg ONLY for previously sent Bbot relay message IDs backed by successful OneBot ACK mapping; preserve group and source message ID in D1.
- Pending sends from recalled source canceled; race between recall and send ACK triggers late recall; ambiguous send/delete results never blindly replayed.
- Native at QQ member present destination sends OneBot at; absent dest member prints source nickname or @群友, never leaked bare QQ number.
- QQ standard face kept face, QQ market sticker mface kept mface not image; image stays image, missing mface IDs become explanatory text.
- Bilibili / QQ JSON/XML share card parsed into descriptive plain text, no raw card replay or auto-preview links.
- !CODE --no [alias] creates receive-only group with no outgoing own-chat forwarding and NO join notice in other groups.
- Normal !CODE alias join queues join notices to all other active linked QQ groups and confirms locally.
- !setting / !settings displays current group status, mode, caller verified role/scopes/rights and linked groups; !help lists commands.
- Bbot-only main, protected QQ 3569028262 and 2681167798 rules preserved, original branch archived.
- Tests and dry-run passed; Cloudflare latest source version deployed, true QQ acceptance remains separate.
current_phase: feature implementation staged
current_step: run Github Actions for feature/recall-and-group-controls-20261010, fix any problems before main promotion
completed_steps:
- inspected main 24a33000916d239caa1b9fcac789213972a5d041, OneBot msg segments/ack and NapCat documentation for native face/mface and group_recall/delete_msg.
- src/core.js preserves market emoji package fields; accepts !setting/!settings.
- src/relay.js native @ with roster; absent targets show source nickname; mface never image; Bilibili card converted to plain text.
- src/napcat-control.js handles !setting, --no one-way, join notifications to other linked active groups.
- src/bridge.js additive D1 group receive_only migration, recall map and queue; only verified ACK target message IDs can be revoked.
- src/recall.js stores recalled sources, message mapping, ordered recall queue, seven-day cleanup; late ACK recovers race.
- worker.js direct OneBot delete_msg ACK handling and notice routing; alarm handles recall and normal sends; new hub ID recall-v4.
- regression tests added/updated for recall notice, safe mappings, emojis, card, settings, --no and hub generation.
verification_results: feature CI pending. Production / QQ live not tested.
known_risks:
- Real NapCat response data.message_id must be present to revoke safely; no invented message ID.
- QQ/NapCat can reject delete_msg after platform recall deadline, especially admin moderation.
- Mixed native mface plus media may not be supported in all NapCat builds; no live guarantee.
- v4 hot Durable Object requires operator to reconnect existing NapCat WebSocket Client once after deploy.
next_exact_action: Run feature CI and fix failures; when green fast-forward main with expected SHA, confirm Cloudflare source and deployment, package v0.0.87 memory, email once, then user reconnects NapCat and tests /health + !setting + --no + recall.
checkpoint_at: 2026-10-09T17:50:04.063Z
