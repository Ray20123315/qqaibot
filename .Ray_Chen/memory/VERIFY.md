# VERIFY

## Verified Revisions

Product revision:
`a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`

Final main/dev memory head:
`806af06ba56f0d8f9741bb2520b58be60069126f`

## Keyboard Regression

Verified by V4 regression:
- category reply includes keyboard rows;
- basic category contains clickable `help` / `status` callbacks;
- AI-management category paginates;
- navigation callbacks use `!面板 ... --page=N`;
- QQ Open group endpoint receives keyboard payload;
- runtime normalizes/sanitizes keyboard payloads;
- deterministic keyboard capability failures may fall back to text;
- ambiguous failures are not duplicated;
- Worker exposes `qq_inline_keyboard` for category-only replies.

## GitHub Actions

- original keyboard branch `36477960735`: SUCCESS
- keyboard/main product merge `36478691850`: SUCCESS
- latest dev head before promotion `36479102835`: SUCCESS
- product main `36479310886`: SUCCESS
- final memory-head `36479807514`: SUCCESS
- duplicate final validation `36479804549`: SUCCESS
- v0.0.35 packaging `36479807508`: SUCCESS

All passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle
- system-admin auth regression

## Cloudflare Production

Connected Build `09d6a646-a0b2-4e98-b73d-d9f2c74925c0`:
- commit: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- branch: `main`
- outcome: success

## Remaining Live Verification

Automated tests cannot render QQ's actual client. Live-click one group category and one child button.
