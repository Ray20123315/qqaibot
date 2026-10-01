# CURRENT_STATE

## Production

- canonical branch: `main`
- verified product commit: `9f78fc66547d278a72858bbd25a22f00dda7ba2a`
- development CI: `36871773623` — success
- main CI: `36872340755` — success
- Cloudflare Worker: `qqai`
- production Connected Build: `521ccfd8-bc55-4aff-9fdb-f0515f5ebcea` — success
- production deployed commit: `9f78fc66547d278a72858bbd25a22f00dda7ba2a`

## Native Group Discovery

Global group discovery now:
- uses `registry.buildCategorizedPanels("group", ...)`;
- publishes actual canonical command PanelItems;
- partitions commands by discovery category;
- caps each panel at 20 items;
- keeps the combined global-group + developer-C2C panel set within 20;
- omits category placeholder commands such as `!面板 基础` from native group discovery.

Regression requires the native group item union to equal every enabled group command in the registry and explicitly checks representative commands including `!help`, `!status`, `!详细资料`, `!主人功能`, `!戳戳`, `!群公告`, and `!全局限速`.

## Preserved Behavior

- Manual `!面板 <分类>` still produces the inline-keyboard category view.
- Direct child buttons still send normal QQ command messages.
- Parameterized child buttons still prefill without auto-send.
- QQ Open/AIBot remains primary; OneBot remains controlled fallback.
- Runtime authorization remains server-side authoritative.

## Verification State

- product patch: VERIFIED
- development CI: VERIFIED
- main CI: VERIFIED
- production Connected Build: VERIFIED
- live QQ native-panel refresh: PENDING_USER
