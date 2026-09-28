# CURRENT_STATE

## Branch

Development branch: `feature/v4-public-bot`
Base main commit: `08ceeb725590d9efb0160ea38733d929e6e7d18c`
Latest verified product commit: `c27821b247f3e8bdc35bf6987886b8c5855fcb60`
Main was updated independently after this branch was created; this task has not modified main.

## Verified AI Routing

- `callUserProviderRoute` now participates in actual chat generation.
- User-owned provider is attempted before the configured platform route / legacy hybrid model path.
- Shared provider use requires stored group authorization plus live membership checks for provider owner and consumer.
- QQ Open membership is checked through the official QQ Open group-member API path.
- OneBot membership is checked through live `get_group_member_info`.
- Linked identities have an explicit reverse lookup; OpenID is never guessed from a QQ number.

## Verified Political Guard

- Direct political text is rejected by local prefilter before model invocation.
- Ambiguous content uses Gemma classification.
- Compliance/privacy/platform questions can classify NON_POLITICAL rather than being blocked solely for containing words such as government.
- Generated output is checked before it is persisted or returned.
- BYOK providers pass through the same political input/output gate.

## AI Sharing UX

- QQ private settings support `!AI分享 <服務ID> <群組ID> 開/關`.
- QQ private settings support `!AI群友私聊 <服務ID> 開/關`.
- Portal API supports AI sharing updates.
- Secure AI page accepts provider model.
- Direct QQ-DM AI-key entry accepts optional model.

## Verification

GitHub Actions run: `36385372063`
Conclusion: success
Passed: base regression, V3 regression, V4 regression including new routing test, isolated V4 dry-run, single Worker bundle.

## Production

No Cloudflare production resource was changed.
