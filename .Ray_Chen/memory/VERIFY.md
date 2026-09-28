# VERIFY

## Verified Product Revision

`f44c8118c83e57637a6b0f55f0013ff093b2f1fc`

## GitHub Actions

Development run `36400632740`: SUCCESS.
Main run `36400793446`: SUCCESS.

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cumulative Permission Discovery Regression

Developer-specific C2C discovery uses:
- `permissions: ["member", "developer"]`
- `target_type: "specific"`
- configured Developer OpenIDs

Tests require the Developer panel set to contain ordinary commands `!help`, `!codex`, `!QQ语音` plus Developer commands `!codexchat`, `!codexwork`, `!群白名单`, `!重置`.

Every enabled C2C command with permission `member` or `developer` must be present. Discovery now enforces QQ's official 20-panel maximum instead of the previous internal 10-panel limit.

## Cloudflare Production

Connected Build `e5270c67-4c0e-4eaf-9d1a-3d5feb95cdd5`:
- commit: `f44c8118c83e57637a6b0f55f0013ff093b2f1fc`
- branch: `main`
- status: stopped
- outcome: success

## Remaining Live Verification

Confirm on the real QQ client that a configured Developer OpenID sees ordinary commands and Developer-only commands simultaneously after discovery sync.
