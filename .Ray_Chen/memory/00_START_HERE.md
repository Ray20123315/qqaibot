# Ray_Chen Memory Entry

- memory_version: v0.0.44
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-all-categories-direct-callback
- task_status: active
- goal_revision: 1
- base_revision: 6fc678c266e514ee6daad4fd40ea33e9225c0120
- updated_at: 2026-09-29T12:31:00+08:00

## Current Goal

Fix the live keyboard UX completely across every group command category.

## Live Problems

- `help` is marked as direct-send in metadata but the QQ group client still only inserts it into the message input. This proves type=2 + enter=true is not reliable enough for guaranteed immediate execution in the live group client.
- The user reports only the 基础 category rendering buttons; all other categories must be explicitly covered and validated rather than inferred from one generic builder test.

## Implementation Direction

- commands with panel.enter=true become reusable callback buttons (action.type=1, no click_limit) so clicking executes immediately through the existing INTERACTION_CREATE -> ACK -> canonical command handler path;
- parameterized commands remain action.type=2 + enter=false and prefill the canonical command with a trailing space;
- pagination buttons use reusable callback actions so page changes happen immediately;
- every non-empty group category must build a keyboard and every page must satisfy QQ row/column/payload rules;
- tests must cover all categories, not only 基础 and one AI 管理 page.

## next_exact_action

Patch group-panel button behavior and comprehensive all-category regressions, then run full CI.
