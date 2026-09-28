# VERIFY

## Verified Product Revision

`d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`

## GitHub Actions

Development run `36403191041`: SUCCESS.
Main run `36403381999`: SUCCESS.

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Group Discovery Regression

The test suite verifies that every enabled `scope:"group"` command appears in categorized group panels.

Representative ordinary commands required:
- `!help`
- `!status`
- `!codex`
- `!模型`
- `!群状态`
- `!群规`
- `!成员发言分析`
- `!活动`
- `!投票`

Representative privileged commands required:
- `!禁言`
- `!关闭ai`
- `!授权AI踢出`
- `!群白名单`
- `!授权`
- `!撤销授权`
- `!禁记忆`

Developer C2C panels are generated from all permission classes and include every enabled C2C command.

## Cloudflare Production

Connected Build `005556b2-9747-4bb4-852c-e3157e5c7069`:
- commit: `d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`
- branch: `main`
- outcome: success

## Remaining Live Verification

Confirm the live QQ group command panel refreshes after discovery sync and shows ordinary categories plus management/developer categories.
