# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 2

## Goal

Rebuild the QQAIBOT backend/control surface around a visually strong but lean QQ Open Native V4. Prioritize online-state visibility, QQ-native group administration, useful media capabilities, and fewer Codex conversations while aggressively retiring nonessential legacy product surfaces.

## Acceptance Criteria

- Portal main navigation is reduced to six V4 areas.
- Portal visibly reports QQ Open enabled/configured/connected/READY, last event, reconnect count, and last error.
- Animation is intentionally rich but respects `prefers-reduced-motion`.
- QQ Open group management surfaces cover member listing/info, remove, blacklist, mute state/actions, and join request approval/decline/decline+blacklist subject to granted QQ permissions.
- QQ image/video/audio/file receive/send capability is represented using the official rich-media flow.
- Direct `!codex`, `!codexchat`, and `!codexwork` use one principal-scoped conversation by default.
- Nonessential V4 activity/vote/schedule command surfaces are retired.
- Old D1 data is not destructively deleted during this first pruning pass.
- Regression, V3, V4, and Worker bundle validation all pass.
- `main` is not modified or deployed without explicit user instruction.

## Current Phase

phase: 2.5 — lean Portal and capability pruning
current_step: product implementation and CI verification complete; live Portal/QQ Open deployment remains pending.

## Completed Steps

- Added `src/v4/portal/lean-dashboard.js` final Portal layer.
- Reduced visible primary navigation to Overview / QQ Open / Group Management / AI-Codex / Plugins / System.
- Added cosmic gradients, star motion, orb animation, glowing online state, animated navigation/cards, pointer tilt, and view transitions.
- Added a stable high-contrast V4 color token set so legacy light mode cannot make the new dark Portal unreadable.
- Added `prefers-reduced-motion` fallback.
- Added `src/v4/portal/api.js` with developer/system-admin authentication, same-origin mutation checks, Gateway controls, and QQ Open group management endpoints.
- Expanded `src/v4/qqopen/api.js` for media upload, group info/bot state, members, blacklist, join requests, mute state/actions.
- Wired lean Portal/API into `worker.js`.
- Confirmed official QQ docs support rich-media send/receive; rich media uses upload → `file_info` → `msg_type=7`.
- Confirmed current QQ changelog includes member management, blacklist, mute and join-request APIs.
- Collapsed direct Codex commands to `qqaibot:principal:<principalId>:codex`; plugin-internal Codex remains isolated.
- Retired activity/vote/schedule from the V4 Command Registry.
- Added/updated V4 Portal, media/group route, Codex session, and bridge packaging tests.
- Final product commit `75483f71fb0707043082f891851581f03ac2c15c` passed CI run `36327804832`.

## Verification Results

- repository regression: success
- V3 regression: success
- V4 QQ Open + lean Portal regression: success
- Worker bundle dry-run: success
- core changed files remote read-back: success
- live browser visual check: not run
- live QQ Open API E2E: not run
- production deployment: not performed

## Known Limitations / Risks

- This is the first pruning pass: retired legacy code/data remains available for rollback, even though the V4 Portal/Registry no longer exposes it.
- The old OneBot path still exists on the feature branch until QQ Open migration is proven.
- QQ group management endpoints can return permission errors if the actual application lacks the necessary QQ platform permissions.
- Rich-media transport is API-wired but not yet live-tested with the user's QQ app.
- Direct Codex uses `principalId` when available; QQ Open C2C/member OpenIDs cannot be assumed to be the same human without a future explicit identity mapping.
- The animated Portal has CI/HTML injection coverage but has not yet been visually inspected in a deployed browser.

## next_exact_action

Deploy/test the V4 branch in a safe QQ Open environment with AppID and AppSecret stored in Cloudflare variables/secrets, visually inspect the lean Portal, verify Gateway READY, exercise group member/join/blacklist/mute operations and image/video send/receive, then use those live results to perform the second pruning pass that physically deletes dead legacy modules.

last_checkpoint_at: 2026-09-27T23:01:00+08:00
