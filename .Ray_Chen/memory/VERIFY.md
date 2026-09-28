# VERIFY

## Verified Product Commit

Commit: `c27821b247f3e8bdc35bf6987886b8c5855fcb60`
GitHub Actions run: `36385372063`
Conclusion: `success`

Passed:
- npm run check
- npm run check:v3
- npm run check:v4
- npm run check:v4test
- npm run check:bundle

New V4 assertions verify:
- Gemini-style contents normalize for BYOK provider calls;
- user provider route is attempted before platform route;
- live membership resolver exists for QQ Open and OneBot;
- explicit QQ OpenID -> QQ link has reverse lookup;
- political prefilter/classifier/output guard are wired;
- political output blocks before chat-history persistence;
- AI sharing commands and Portal endpoint are present.

## Pending

- runtime plugin force-stop/quarantine transaction.
- concrete V4 memory/settings/chat/plugin writes through User Persistence.
- full Portal/developer mode.
- same-Worker Cloudflare preview.
- QQ self-test workbook.
