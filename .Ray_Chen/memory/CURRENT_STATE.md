# CURRENT_STATE

## GitHub

- product revision on main: `b86f762000dc6f498340c54696123328d0328db6`
- product revision on v4-qqopen-native: `b86f762000dc6f498340c54696123328d0328db6`
- development CI `36385798148`: success
- main CI `36385930192`: success

## Cloudflare

- Worker: `qqai`
- Connected Build: `435505a0-a118-4830-a4dc-f216b2ace61b`
- commit: `b86f762000dc6f498340c54696123328d0328db6`
- branch: `main`
- status: stopped
- outcome: success
- deploy command: `npx wrangler deploy worker.js --no-assets`

## Command Discovery

- registry entries: 77
- restored QQ voice discovery: `!QQ语音角色`, `!QQ语音`
- Codex entries: `!codex`, `!codexchat`, `!codexwork`
- group discovery uses 8 help-aligned public categories
- privileged group items use QQ `only_admin` where representable
- developer commands are not put in global group panels
- developer C2C panels use `target_type=specific` when `QQ_OPEN_DEVELOPER_OPENIDS` is configured
- C2C custom menu uses native nested `sub_menu_items`, max 5 children each, with automatic category pagination
- discovery is capped to 10 generated panels to remain within the sync request-rate safety budget

## Portal

The original Portal navigation remains visible. V4 adds QQ Open/Hybrid shortcuts without replacing or hiding existing activity, schedule, appeal, history, Bilibili, member/relationship, plugin and system surfaces.

## Transport and Safety

- QQ Open/AIBot remains primary for inbound commands and supported actions.
- Legacy OneBot remains internal fallback only after capability, mapping and role checks.
- Runtime permissions, Portal switches, cooldowns and confirmation flows remain authoritative.
- OpenIDs are never treated as numeric QQ IDs.
- Ambiguous mutating QQ Open timeout/5xx results are never cross-retried through OneBot.
