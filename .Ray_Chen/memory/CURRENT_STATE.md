# CURRENT_STATE

## GitHub

- verified product revision: `d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`
- development CI `36403191041`: success
- main CI `36403381999`: success

## Cloudflare

- Worker: `qqai`
- Connected Build: `005556b2-9747-4bb4-852c-e3157e5c7069`
- commit: `d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`
- branch: `main`
- outcome: success

## Command Discovery

- registry entries: 77
- group discovery includes all enabled group-scoped commands across `member`, `group_ops`, `ai_admin`, `owner`, and `developer`
- ordinary group commands and management commands coexist
- Developer is the highest cumulative permission level
- Developer-specific C2C discovery uses all permission classes, filtered only by C2C scope
- group Developer commands are visible in the group panel because QQ cannot target a group panel to one individual user
- runtime authorization remains authoritative

## Transport and Safety

- QQ Open/AIBot remains primary.
- OneBot remains internal fallback only.
- OpenIDs are never treated as numeric QQ IDs.
- Discovery visibility never grants runtime permission.
