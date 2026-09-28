# VERIFY

## Verified Product Revision

`b86f762000dc6f498340c54696123328d0328db6`

## GitHub Actions

Development run `36385798148`: SUCCESS.
Main run `36385930192`: SUCCESS.

Passed on the final product revision:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Command / Discovery Regression Coverage

- command registry has at least 77 entries;
- `!QQ语音角色` and `!QQ语音` resolve;
- `!codexchat` and `!codexwork` resolve;
- group categorized panels include 基础与多模态, 活动投票与排程, AI 管理 and 群操作;
- developer commands are absent from global group panels;
- developer C2C panels target configured OpenIDs and cover both AI/Codex and developer categories;
- C2C menu is nested, each submenu has <=5 children, and every discoverable member C2C command is present;
- discovery generates <=10 panels in the developer test fixture;
- sync preserves foreign panels and replaces only QQAIBOT-managed panels.

## Portal Regression Coverage

- full Portal navigation remains visible;
- V4 no longer hides legacy nav groups;
- overview states that complete functionality is restored;
- active activity/poll, schedule, appeal, history, Bilibili, member/relationship, plugin and system entries are not shown as retired.

## Runtime / Fallback Coverage

Previous capability-fallback regression remains green:
- QQ Open attempted first;
- legacy role/group/member mapping checks remain required;
- mutating ambiguous 5xx/timeout is not cross-retried;
- OneBot ingress remains auxiliary.

## Cloudflare Production

Connected Build `435505a0-a118-4830-a4dc-f216b2ace61b`:
- commit: `b86f762000dc6f498340c54696123328d0328db6`
- branch: `main`
- status: stopped
- outcome: success
- deploy command: `npx wrangler deploy worker.js --no-assets`

## Remaining Live Verification

Automated tests cannot prove QQ has already refreshed the official menu/panels for the live Bot account, or that each live group grants the legacy Bot the required role. The runtime checks legacy permission at action time.
