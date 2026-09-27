# CURRENT_STATE

## Repository State

- production branch: `main`
- V4 branch: `v4-qqopen-native`
- latest verified V4 product commit: `75483f71fb0707043082f891851581f03ac2c15c`
- latest verified product CI run: `36327804832` — success
- production main switch: not performed
- Cloudflare deployment/config: not changed
- QQ Open console configuration: not changed

## V4 Portal

Visible primary areas are now:
1. Overview
2. QQ Open
3. Group Management
4. AI / Codex
5. Plugins
6. System

The final V4 Portal layer hides the legacy navigation, forces Overview as the initial lean view, polls QQ Open status, and keeps system diagnostics accessible through the System section. Motion-heavy effects automatically disable for reduced-motion users.

## QQ Open Capability State

Implemented in code:
- Gateway online/READY/status controls.
- group info and bot state.
- member list and member detail API wrappers.
- batch member removal.
- blacklist read/update.
- join request list and approve/decline/decline+blacklist.
- mute state and member mute operations.
- group/C2C rich-media upload wrappers.

Officially confirmed:
- text send/receive.
- Markdown send.
- rich-media send/receive.
- image, video, audio/voice, and file rich-media flow via `file_info`.
- 2026-09 group member/blacklist APIs.
- 2026-08 mute and join-request APIs.

## Pruning State

Retired from the V4 main Portal/product surface:
- activity / poll
- schedule
- standalone appeals/history pages
- Bilibili monitor
- relationship management
- platform feature catalog
- event simulator / legacy OneBot-oriented tools

Activity/vote/schedule entries are also removed from the V4 Command Registry. The underlying historical data/code is intentionally retained for rollback until live QQ Open verification.

## Codex State

Direct `!codex`, `!codexchat`, and `!codexwork` now use one principal-scoped session key:
`qqaibot:principal:<principalId>:codex`.

Plugin-internal Codex calls remain plugin/scope isolated. If no internal principal mapping exists, the current platform user identifier is used as fallback.

## Credential State

No real QQ AppSecret or live token is stored in the repository or Ray_Chen memory.
