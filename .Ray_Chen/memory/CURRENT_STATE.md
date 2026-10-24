# CURRENT_STATE
- Repository Ray20123315/qqaibot; main at task start 6172bf1043653fa34634db6494d030d92acc78f0, main code commit 526e199284275fe2e40fc251c3afb4707ce7a58a (promoted feature/manual-cross-group-command-20261015).
- Strict Bbot /跨群 command-only source implemented and verified on main; AI reply path remains Abot passive, Codex GUI source unchanged, Bbot D1/Vectorize memory source unchanged.
- Existing cross-group binding storage: D1 bridge_groups and bridge_rooms; synthetic napcat:<QQ group> IDs remain. No migrations or D1 writes made during this task.
- Cloudflare D1 read-only 2026-10-15: 8 total group binding rows, 4 verified under one room; all 4 verified rows stopped=1 with numeric group IDs; zero active sender/destination. Real send acceptance BLOCKED until authorized resume.
- Feature tests enforce text length 1–1200, exact literal /跨群, all active same-room targets, no self/other-room/stop, recall mapping, manual-v1 outbox-only, no stale auto sends and no unsolicited join broadcast.
- Existing Windows GUI Codex Bridge built by prior Windows CI 38114199372; preserve tools/codex-bridge-gui and package workflow.
- QQ stale official native menu item /!设置插话率 remains UNKNOWN/NOT VERIFIED removed. Cloudflare earlier QQ panel endpoint returned unsupported schema; no broad deletes authorized.

- GitHub main CI 38702611657 PASS; Cloudflare qqai production deployment 57425b2c-a1de-45d3-bc6e-c89626144951 version 113e3cbc-8659-4b59-8acb-16405a6a588b at 100% from commit 526e199284275fe2e40fc251c3afb4707ce7a58a, build success. QQ actual delivery untested pending authorizations and !resume.

## 2026-10-24 independent bot
- PR #82 merged to main commit a365f0c6c391a171154241e82c28f00bfa1eb322, isolated tests and existing AI suite success. New source under `standalone-qq-ai/`; original `qqai` code/DB/DO not modified.
- Cloudflare Worker `qqaibot-unsloth` deployment 4ca53f6f1f6648d097ca1109607d8b9f created. Custom Domain `qqbot-ai.ray2025.com` and workers.dev subdomain enabled; secrets list empty. No live Unsloth or QQ messages verified, custom domain external HTTPS unverified.

- Memory packaging CI issue on hardcoded 0.0.108 resolved; subsequent PR #83 run 40069333964 SUCCESS.

## 2026-10-24 Unsloth model picker
- PR #84 code merged main 16764e1bcc7509f0eb761040e6ed738e05572194; GitHub CI isolated 40072501757 SUCCESS, legacy 40072501794 SUCCESS.
- New CONFIG_KV dedicated `qqaibot-unsloth-config` namespace id 033b241f7377496790d92056d39669ad; encrypted key & chosen model (not yet configured). Worker c179d753-b3f8-4f0f-ac2f-a262379eff14 deployed 100% with binding readback.
- Model listing through fixed /v1/models endpoint; admin chooses from returned IDs; same model used by QQ and web chat. Secrets GET empty; no live Unsloth/QQ verification. Old qqai remains untouched.

## 2026-10-24 Unsloth Secret-only model picker
- User verified public HTTPS /v1/models HTTP 200 with Bearer key, and local HTTP 200. Installed model lilcheaty/flint-abliterated-GGUF loaded.
- PR #87 main 500c7689c199dc5db33f91146dc6e7c78f05f2fd, CI isolated 40075035673 SUCCESS and original 40075035664 SUCCESS.
- Cloudflare qqaibot-unsloth version 678a0b74-800b-47ea-9efe-868fd7e551f0 deployed 100%, global_fetch_strictly_public enabled, ADMIN_TOKEN and CONFIG_KV bindings inherited/readback. Selected model ID alone in KV; API key exclusively Worker Secret (operator must configure). Prior key KV keys empty. Legacy qqai unchanged.

## 2026-10-24 MODEL_UNAVAILABLE diagnostics and fixes
- User admin test returned MODEL_UNAVAILABLE after successful model picker; Worker Secrets ADMIN_TOKEN/UNSLOTH_API_KEY secret_text and selected-model-v2 KV key present, same-zone public flag enabled.
- PR #89 code merged main a974232b6f71991af2d23f654d618ccc0ec72465, GitHub CI 40076227706 and 40076227711 SUCCESS.
- Cloudflare qqaibot-unsloth version 327900f7-5a47-46dc-87ca-ee8988240bdf running 100%, secrets inherited strictly, KV binding preserved; web admin chat 60s, QQ background 22s, minimal no-tools request max_tokens1024, safe granular model errors. Live model POST remains untested; legacy qqai untouched.

## 2026-10-24 confirmed QQ callback / outbound UNKNOWN and classification repair
- User recorded callback_verify OK, event_received GROUP_AT, send_failed UNKNOWN; therefore QQ webhook and event path had worked, although outbound send failed. Prior lack of logs no longer applies. UNKNOWN means missing exception classification; IP block is a hypothesis, not confirmed.
- Prior v0.0.115 local verified archive contained PR #91 and deployment 21f125fc-b566-4e07-8368-cad0490602b3, but remote GitHub memory remained v0.0.114 due safety block. This v0.0.116 reconciles both releases.
- PR #92 main d6997d37bb3861e037dbca4bbb742c6b490ecbc5, isolated CI 40079995888 and legacy 40079995892 pass. New QQ auth/send fetch, timeout, HTTP and safe numeric business codes recorded; no secrets/ids/logs.
- Independent Cloudflare Worker qqaibot-unsloth deployment 9ece06c4-edbc-4055-8a2a-1a7e2f87ecb4 100%, inherited 4 secret_text and CONFIG_KV binding; selected-model-v2 retained. QQ live send remains unverified; original qqai unchanged.
