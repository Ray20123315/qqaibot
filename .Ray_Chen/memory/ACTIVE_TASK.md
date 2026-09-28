# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-keyboard
task_status: active
goal_revision: 1

## Goal

Deploy clickable QQ button cards for group command categories while preserving all current main work.

## Keyboard Acceptance Criteria

- category-only group-panel reply carries inline keyboard metadata;
- two buttons per row, maximum five rows;
- categories with more than ten commands paginate;
- callback data uses existing canonical ! commands;
- page-navigation callbacks return the next/previous keyboard page;
- passive QQ Open replies and INTERACTION_CREATE replies can carry keyboards;
- deterministic keyboard-capability 4xx errors may fall back to text;
- ambiguous 5xx/timeouts are not resent;
- direct commands, runtime authorization and /!普通内容 semantics remain unchanged.

## Preserved TEMP Admin Work

The TEMP system-admin hotfix completed on main is retained:
- Cloudflare limiter first, D1 CAS fallback;
- TEMP admin separate from normal admin;
- explicit max-seven-day expiry;
- secrets excluded from Git/memory;
- prior CI/deploy/health evidence retained.

## Verification So Far

- original keyboard branch CI 36477960735: success
- non-destructive keyboard/main product merge CI 36478691850: success
- latest memory-reconciled development-head CI: pending

## next_exact_action

Wait for latest development-head CI; if green, fast-forward main and verify production.

last_checkpoint_at: 2026-09-29T04:55:00+08:00
