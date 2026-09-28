# VERIFY

## Verified Product Revision

`64513e94f6634921f0b1ee8f7c6d5d44a754a6f5`

## GitHub Actions

Development run `36476322049`: SUCCESS.
Main run `36476525721`: SUCCESS.

Passed on both final product revisions:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Slash-Prefixed Group Panel Regression

The V4 regression suite verifies:

- `normalizeGroupPanelSlashInvocation("/!面板 基础")` -> `!面板 基础`
- full-width `／！面板 ...` is also accepted
- CQ-at prefix is preserved
- `normalizeGroupPanelSlashInvocation("/!普通内容")` does not match and does not alter the text
- Worker source order places panel slash normalization before `stripGroupAiOptOutPrefix(userMessage, botId)`
- existing `resolveGroupPanelInput` category/child expansion remains valid

## Cloudflare Production

Connected Build `8aa6ab67-ad80-4ddd-b916-0b76e7bfcf3c`:
- commit: `64513e94f6634921f0b1ee8f7c6d5d44a754a6f5`
- branch: `main`
- status: stopped
- outcome: success

## Remaining Live Verification

Click one actual QQ group command-panel category and confirm that the bot returns the category child list. If not, capture the exact message/event payload shape before further code changes.
