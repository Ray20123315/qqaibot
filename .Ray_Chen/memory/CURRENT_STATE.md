# CURRENT_STATE

## Production

No new V4 Preview acceptance code from this task has been merged into `main`.

## V4 Preview Source

- branch: `feature/v4-public-bot`
- head: `18f254cc18fe599ca27a89106fa4e87759776165`
- GitHub CI: `36797489597` success
- Cloudflare Connected Build: `5fc78ebc-9f14-4f61-8f2c-a347252f09b2` success

## Stable V4 Preview

- URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- deployment: `df3e4ed6-59c5-4ece-9cd4-e711846525a2`
- deployment number: 5
- D1: shared physical database, isolated table `kv_store_v4public_preview`
- Preview test login: enabled
- test-login expiry: `2026-10-03T00:00:00+08:00`
- QQ Open: disabled
- production QQ/OneBot/Gemini/Vectorize/admin secrets: absent

## Live Login Evidence

A browser-side request on the stable Preview URL returned:
- login HTTP 200
- `systemAdmin=true`
- `preview=true`
- viewer HTTP 200
- `developer=true`
- role `developer`
- `systemAdmin=true`

## User Acceptance

pending_user_manual_test

## Merge State

Blocked by acceptance gate. No production merge is authorized until the user confirms the V4 Preview is usable.
