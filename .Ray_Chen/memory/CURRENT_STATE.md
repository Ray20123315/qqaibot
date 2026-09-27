# CURRENT_STATE

## Production

Production remains on the last known-good V4 baseline and has not been redeployed by this transaction.

Known live state before this implementation:
- QQ Open Gateway configured, connected and READY
- user verified `!qqping`
- OneBotHub retained
- QqOpenGateway retained
- AI provider bindings, D1, Vectorize and Codex Bridge retained

## Verified Feature Branch State

Branch: `v4-qqopen-native`
Feature head: `18160ef97f602a324d5c094b2f15ec2f6ca5a415`
CI: `36335909533` SUCCESS

The branch now includes a full shared-runtime bridge:

- QQ Open group/private messages → existing `QQAIWorker.fetch` application path
- existing AI conversation logic
- D1 chat history
- Vectorize long-term memory
- AI cooldown/debounce
- natural-language and explicit command parsing
- public `!codex`
- developer Codex via explicit OpenID allowlist
- plugin/V3-compatible execution paths reached through the existing Worker
- platform-aware QQ Open action translation
- text and rich-media send
- group member list/info
- mute/unmute
- remove/blacklist path
- group message recall where QQ Open supports it
- group join-request event/review bridge

## Compatibility Boundary

Operations that have no official QQ Open equivalent fail explicitly with `QQ_OPEN_LEGACY_ACTION_UNSUPPORTED`; they are not sent to NapCat.

QQ Open OpenIDs remain opaque strings. Numeric QQ developer IDs are not reused as QQ Open identities.

## Production Gap

Live production has not yet received this feature head. No claim is made that ordinary production AI/Codex/media/group-management traffic has been live-tested through the new bridge yet.
