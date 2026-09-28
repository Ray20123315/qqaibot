# VERIFY

## Verified Product Revision

`fd11cd640cae1124edc03b0fef3d8d8d529cc52b`

## GitHub Actions

Development run `36378926121`: SUCCESS.
Main run `36379048954`: SUCCESS.

Passed on the final product revision:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## New Regression Coverage

- deterministic unsupported QQ Open group action falls back only after old Bot role probing;
- old Bot `member` role is rejected for admin-required fallback and no write is sent;
- mutating QQ Open 500 is not cross-retried through OneBot;
- safe read fallback can use OneBot after presence/role probing;
- V4 catalog has at least 70 entries and representative restored aliases;
- member OpenID mapping hooks are present across QQ Open runtime, Worker and hybrid ownership;
- original QQ Open primary panel still contains the established moderation entries.

## Main Read-back

Verified directly from `main` after CI:
- command entries: 75
- restored aliases present: `!读网页`, `!翻译`, `!活动`, `!投票`, `!排程`, `!关闭ai`, `!改群名`, `!改名片`, `!确认op`, `!群白名单`
- `probeLegacyBotGroupPermission` present
- `hybrid_action_fallback` audit path present
- read-only-only 5xx fallback guard present
- `qqopen_dynamic_member_map` present
- QQ Open runtime and Worker pass `userOpenid` into hybrid observations

Key blob SHAs:
- `src/core/permissions.js`: `aa58867f125ac2f450a07b365b68602e243fb380`
- `src/v4/commands/catalog.js`: `d0854fb4285558ce9b68a95497e4dd905d2a965d`
- `src/v4/hybrid/ownership.js`: `a8f4c81c1a4e4faee659d6ae29b3161b34a5908d`
- `src/v4/qqopen/runtime.js`: `060484618ff9e2883ea9a186672e80398825a20a`
- `worker.js`: `8e585669ae68db2df9e8fb73f8d29ae271bbe18c`
- `README.md`: `0f72880a9dc25f8f877ab2bffb68c7be21de185b`

## Cloudflare Production

Connected Build `53058046-38a3-4ecc-9fbd-581032693db5`:
- commit: `fd11cd640cae1124edc03b0fef3d8d8d529cc52b`
- branch: `main`
- status: stopped/completed
- outcome: success
- deploy command: `npx wrangler deploy worker.js --no-assets`

## Remaining Live Smoke Check

Automated verification cannot prove the actual QQ group currently grants the legacy Bot the desired role. The runtime now checks that at execution time and produces an actionable permission prompt when insufficient.
