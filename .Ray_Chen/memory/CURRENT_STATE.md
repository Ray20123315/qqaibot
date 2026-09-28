# CURRENT_STATE

## GitHub

- main: `fd11cd640cae1124edc03b0fef3d8d8d529cc52b`
- v4-qqopen-native product revision: `fd11cd640cae1124edc03b0fef3d8d8d529cc52b`
- development CI `36378926121`: success
- main CI `36379048954`: success

## Cloudflare

- Worker: `qqai`
- Connected Build: `53058046-38a3-4ecc-9fbd-581032693db5`
- commit: `fd11cd640cae1124edc03b0fef3d8d8d529cc52b`
- branch: `main`
- outcome: `success`
- deploy command: `npx wrangler deploy worker.js --no-assets`

## Command Surface

`src/v4/commands/catalog.js` contains 75 entries.

Representative restored aliases verified from main:
- `!读网页`, `!翻译`
- `!活动`, `!投票`, `!排程`
- `!关闭ai`
- `!改群名`, `!改名片`, `!确认op`
- `!群白名单`

The original first 20 command ordering is retained so the primary official panel behavior remains compatible with existing tests.

## Capability Fallback

`src/core/permissions.js` now:
1. attempts QQ Open first;
2. classifies whether fallback is safe;
3. resolves the confirmed OneBot group mapping;
4. checks the old Bot is connected and present in the group;
5. verifies the action-required role;
6. resolves member OpenID to numeric QQ when required;
7. executes through OneBot only after those checks.

Owner-required fallback includes actions such as setting group administrators/special titles.
Admin-or-owner fallback includes moderation/group-management operations such as mute, kick, whole-group mute, group rename and group card changes.

## Safety Guards

- Mutating QQ Open timeout/5xx failures are not automatically replayed through OneBot.
- QQ Open message/request IDs that cannot be safely translated are not sent to OneBot.
- `ONEBOT_READ_ONLY` blocks write fallback when enabled.
- OneBot remains auxiliary at ingress, preventing duplicate command execution.

## Hybrid Identity Mapping

`src/v4/hybrid/ownership.js` now stores conflict-safe member mappings after group mapping is confirmed and a matching cross-transport observation identifies a numeric QQ account.

D1 member mapping key:
- `qqopen_dynamic_member_map`
