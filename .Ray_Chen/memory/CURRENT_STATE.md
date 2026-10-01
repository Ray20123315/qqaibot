# CURRENT_STATE

## Production Before Repair

- main: `2d861802c955cbae7224ee391b25abaf5ad39cd2`
- prior product code: `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe`
- prior main CI: `36879346744` — success
- prior production Connected Build: `6f36a019-e50f-4907-af27-6197b5088e8b` — success

## Live Evidence

- 2026-10-01 23:09:35 +08: `/!面板 群聊` returned only text fallback.
- No clickable keyboard was visible.
- Therefore the previous "keyboard inline card verified" state is invalid as a live acceptance claim.

## Code Evidence

- worker returns `qq_inline_keyboard` for category routes.
- QQ Open runtime receives and normalizes that keyboard.
- runtime currently sends keyboard replies as `msg_type:2` with a `markdown` body.
- on QQ API 4xx capability errors, runtime retries as plain text without keyboard.
- Tencent official Node SDK supports text + inline keyboard using `msg_type:0 + content + keyboard` when Markdown support is disabled.

## Target

Use plain-text keyboard payloads for the panel path and verify the exact outbound body in tests.

## Verification

- product patch: PENDING
- development CI: PENDING
- main CI: PENDING
- production build: PENDING
- live QQ retest: PENDING
