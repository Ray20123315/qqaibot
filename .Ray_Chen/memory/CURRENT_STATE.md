# CURRENT_STATE

## Branch

Development branch: `feature/v4-public-bot`
Base main commit: `08ceeb725590d9efb0160ea38733d929e6e7d18c`
Verified foundation commit: `21e5a8f00daeb7e465ca927c6f1d6acfadfe1259`
Main modified by this task: no.

## Verified Foundation

- QQ Open capability failures are classified; only explicit unsupported/unavailable or denied states may fall back to OneBot.
- Timeout/network/5xx outcomes remain UNKNOWN and never trigger destructive replay.
- OneBot group fallback requires an explicit mapped numeric group.
- OpenID is never coerced into numeric QQ; member-target fallback requires an independently known numeric identity.
- Official message IDs are never reused for OneBot recall/get-message.
- Roles: 授權成員 / AI 提供者 / 管理員 / 開發者.
- Legal consent is versioned and separate from silent developer group-whitelist override.
- User AI Provider accounts have owner principal, shared-group list and group-member private-chat preference.
- Shared-provider access requires live membership of provider owner and consumer; provider departure revokes access.
- Political guard contract is text-first, classifier-second for ambiguous content, with conservative unknown handling.
- Plugin global/cross-tenant runtime violations have a forced-stop/security-report hook.
- License now states Copyright © 2026 Ray Chen. All rights reserved. with no software-use license beyond unavoidable host-platform rights or written permission.
- No new Cloudflare storage product was added.

## Verification Evidence

GitHub Actions run: `36379116271`
Result: success
Passed stages: base regression, V3 regression, V4 regression, isolated V4 dry-run, single Worker bundle.

## Production

No Cloudflare production resource was changed.
