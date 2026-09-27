# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 1

## Goal

Build QQAIBOT V4 as a QQ Open Native architecture while preserving mature non-transport functionality. Replace transport, identity, message/action integration, and command presentation incrementally instead of emulating QQ Open as OneBot.

## Acceptance Criteria

- QQ Open WebSocket lifecycle supports Identify, Heartbeat, Resume, reconnect and persisted session/sequence state.
- QQ Open events normalize into the canonical message model using OpenID identities.
- QQ OpenAPI actions cover messaging, media, member operations, moderation, join approval, menus and panels needed by existing features.
- A single Command Registry becomes the source for text commands, AI routing, help, QQ custom menu and QQ command panels.
- Existing command aliases remain compatible unless explicitly retired.
- Backend permissions remain authoritative even when QQ panels use `only_admin`.
- Codex Bridge, AI providers, plugin runtime, D1/Portal data, quotas and cooldowns remain preserved unless migration requires an adapter.
- Production does not switch until regression, Worker bundle, and live QQ Open end-to-end tests pass.

## Current Phase

phase: 1 — foundation
current_step: Phase 1 foundation written, remotely read back, and CI-verified.

## Completed Steps

- Created branch `v4-qqopen-native` from `main` commit `523d2138ae413206eb8fe7aa85d45c5b8d7404c9`.
- Added QQ Open gateway protocol helpers for opcodes, Identify, Heartbeat, Resume and session state.
- Added QQ Open message-event normalization for C2C/group/channel/direct-message event shapes.
- Added QQ OpenAPI client with access-token caching, one-time 401 refresh, menu/panel/message/recall methods.
- Made canonical messages accept an explicit platform while preserving OneBot as the default.
- Added Command Registry and initial 24-command compatibility catalog.
- Added automatic multi-panel paging so commands are not silently truncated at QQ's per-panel item limit.
- Added `npm run check:v4` and wired V4 validation into branch CI.
- Added `docs/v4-qqopen-native.md`.
- No AppSecret or real credential was committed.

## Files Created

- `src/v4/qqopen/gateway.js`
- `src/v4/qqopen/events.js`
- `src/v4/qqopen/api.js`
- `src/v4/commands/registry.js`
- `src/v4/commands/catalog.js`
- `src/v4/index.js`
- `verify-v4-qqopen.mjs`
- `docs/v4-qqopen-native.md`

## Files Modified

- `src/v3/message/core.js`
- `package.json`
- `.dev.vars.example`
- `.github/workflows/validate.yml`

## Verification Results

- isolated `npm run check:v4`: success (`verify-v4-qqopen: ok`) before remote publication.
- remote branch read-back of all Phase 1 product files: success.
- branch CI: success; latest product run `36309169883` passed regression, V3, V4 and Worker bundle.
- production/live QQ Open end-to-end: not run.

## Known Limitations / Blockers

- No persistent Gateway runtime is connected to Worker/Durable Object yet.
- No production QQ Open credential has been configured or used.
- Action coverage is intentionally incomplete; current client is Phase 1 only.
- Initial registry covers 24 key commands, not the complete legacy command surface yet.
- `main` remains OneBot/NapCat and has not been changed by this migration phase.

## next_exact_action

Implement a persistent QQ Gateway runtime with Durable Object lifecycle/session persistence, then add a platform action dispatcher so existing handlers can migrate from OneBot actions to native QQ OpenAPI one capability at a time.

last_checkpoint_at: 2026-09-27T17:25:00+08:00
