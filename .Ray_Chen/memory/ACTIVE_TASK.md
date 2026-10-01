# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 2

## Goal

Make the QQ native group command panel directly contain the real commands instead of only category placeholders.

## Acceptance Criteria

- Native group discovery contains every enabled group command from the canonical registry.
- Group native panels are categorized and split at 20 items per panel.
- No native group discovery item is merely `!面板 <分类>` in place of real commands.
- The existing `!面板 <分类>` chat command and inline keyboard remain functional.
- Developer-targeted C2C discovery remains cumulative and unchanged.
- Total discovery panels stay within the QQ/Open implementation limit of 20.
- Existing permission enforcement remains server-side authoritative.
- Development CI, main CI and production Connected Build must pass before completion.

## Current Phase

IN_PROGRESS — Recovery Gate complete; product patch pending.

## Evidence

- VERIFIED: main = 5b7f3c5e1c75d98150d794b2d2c689c77a145bfc before this repair.
- VERIFIED: product revision 6cb891571bdb2744b13bd11e3731c2a267fdf1ed is deployed successfully.
- VERIFIED: current discovery.js creates exactly one global group root panel via buildGroupRootPanel().
- VERIFIED: live QQ screenshot shows those category placeholder items and no concrete native commands.

## Blockers

None.

## next_exact_action

Change group discovery to registry.buildCategorizedPanels("group", ...) and update regressions.

last_checkpoint_at: 2026-10-01T21:45:00+08:00
