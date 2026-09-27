# VERIFY

## V4 Phase 1 Verification

- branch: `v4-qqopen-native`
- base main at task start: `523d2138ae413206eb8fe7aa85d45c5b8d7404c9`
- latest Phase 1 product commit: `685f6923bec7a010af8802ccd6e8ada3adc7242f`
- isolated command: `npm run check:v4`
- isolated result: success (`verify-v4-qqopen: ok`)
- remote read-back of all Phase 1 product/config/doc files: success
- CI workflow now includes `npm run check:v4`
- CI run `36309168038`: success
- latest product CI run `36309169883`: success

## V4 Test Coverage Present

- GROUP message event -> canonical message with `platform=qq-open` and OpenID identity.
- C2C event -> private canonical message.
- non-message event rejection.
- Identify / Heartbeat / Resume payloads.
- Gateway Hello/READY/ACK state transitions.
- AccessToken caching and `QQBot` authorization header.
- URL path encoding and group-message recall route.
- command alias resolution.
- `only_admin` panel metadata for moderation.
- multi-panel paging and custom menu generation.

## Existing Security Invariants Retained

- Backend permission/confirmation logic remains authoritative.
- CodexWork read/edit allowlists, staging, sensitive/symlink exclusions, no-delete, writeback validation and explicit export remain authoritative on the local bridge.
- No AppSecret/access token is stored in repository memory.

## Live Verification Still Needed

- persistent QQ Gateway connection from the chosen Cloudflare runtime.
- authorized intents against the actual QQ application.
- real group/C2C receive and reply.
- group admin recall of a member message within the official time window.
- media upload/send, member management, mute/kick, join-request operations.
- full legacy-command compatibility and final production cutover.
