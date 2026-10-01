# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 3

## Goal

Use the native QQ command panel only as a category launcher so all commands remain reachable through custom paginated keyboards; remove unwanted relationship features and keep werewolf removed.

## Acceptance Criteria

- Native group discovery contains category entries rather than trying to publish every concrete command.
- Every non-empty retained category resolves to a clickable paginated inline keyboard.
- All retained group commands are covered across category pages.
- Direct commands use type=2 + enter=true; parameterized commands use type=2 + enter=false.
- No relationship category or relationship command appears in catalog/panel.
- Relationship command handlers are not executable from worker.js.
- Portal relationship policy endpoints and relationship display/control surfaces are removed.
- Legacy relationship cleanup/mute-lock compatibility may remain but cannot create new relationship state.
- Worker/catalog/help regressions assert 狼人杀/狼人殺 is absent.
- Development CI, main CI and production Connected Build must pass before completion.

## Current Phase

IN_PROGRESS — recovery/checkpoint completed; implementation next.

## Blockers

None.

## next_exact_action

Implement the product changes on v4-qqopen-native, then run full CI.

last_checkpoint_at: 2026-10-01T22:12:00+08:00
