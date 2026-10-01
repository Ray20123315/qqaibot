# Ray_Chen Memory Entry

- memory_version: v0.0.51
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20261001-panel-complete-real-message-send
- task_status: active
- goal_revision: 3
- base_revision: 8beea65b514484e6ed5ec352640492693b4d4901
- verified_product_revision: 9f78fc66547d278a72858bbd25a22f00dda7ba2a
- updated_at: 2026-10-01T22:12:00+08:00

## Current Goal

Return QQ native group discovery to category-entry mode because the native panel has hard visibility/item limits, while keeping the custom inline-keyboard category panels as the complete command surface.

At the same time remove user-rejected features from the public bot surface:
- master/partner relationship system (主人／对象);
- werewolf game (狼人杀／狼人殺) must remain absent.

## Required Architecture

- QQ native group panel: category entries only.
- Sending a category entry returns the custom two-column paginated keyboard containing all commands in that category.
- Direct child commands keep normal QQ send semantics; parameterized child commands keep editable prefill.
- Relationship commands/category/handlers/Portal management are removed.
- Legacy relationship data cleanup and old relationship mute-lock compatibility may remain only to safely retire historical state.

## next_exact_action

Patch discovery, command registry/catalog/group panel, worker relationship handlers, Portal relationship surfaces, and regression tests on v4-qqopen-native.
