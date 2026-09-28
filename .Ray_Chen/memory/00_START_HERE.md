# Ray_Chen Memory Entry

- memory_version: v0.0.27
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-group-panel-hierarchy
- task_status: active
- goal_revision: 4
- base_repository_head: df7958e9e99be0d5724dc4fd24a39da616e1befd
- updated_at: 2026-09-29T03:40:00+08:00

## Current Goal

Repair the live QQ group command panel based on the user's screenshot. Multiple group panels created through /v2/panels are not being presented by the QQ client as a merged categorized command surface; the client currently exposes only one effective group panel.

## Confirmed Platform Limits

- one bot: at most 20 panels;
- one panel: at most 20 PanelItem entries;
- group PanelItem supports command/link only, not nested submenu items;
- group target_type=specific targets group_openids, not individual users.

## Implementation Direction

Use exactly one managed group panel containing category-root commands (well below 20 items). Category roots route to existing registered commands as subcommands, so the full group command surface remains reachable without deleting existing command aliases or bypassing permissions. C2C keeps the native submenu menu.

## Recovery Route

1. Read ACTIVE_TASK.md.
2. Continue on v4-qqopen-native, already fast-forwarded to current main.
3. Add reusable group-panel category/router helper.
4. Sync exactly one QQAIBOT V4 group panel.
5. Route !面板 <分类> <子指令> to the existing handler.
6. Run full CI, then update main and verify production.
