# ACTIVE_TASK

task_id: qqaibot-20260928-full-command-panels-portal
task_status: active
goal_revision: 1

## Goal

Restore all active QQAI 2.7.12 command/function entry points, generate categorized QQ official command discovery, keep developer/admin-only entries out of inappropriate discovery surfaces where QQ supports it, and restore the Portal sections previously hidden by the V4 lean overlay.

## Acceptance Criteria

- Existing QQAI 2.7.12 command handlers remain callable; discovery covers the documented active surface including !codex, !codexchat and !codexwork.
- QQ group discovery is grouped by category instead of one flat first-level dump.
- C2C global custom menu uses QQ native submenus where useful and stays within QQ menu limits.
- Developer/owner/admin command metadata is represented consistently; server-side permission checks remain mandatory even when discovery hides an entry.
- QQ Open/AIBot receives all user commands; users never need to command the legacy Bot directly.
- Legacy OneBot fallback semantics from the previous task remain intact.
- Portal no longer presents active modules as retired/removed and does not hide the complete existing navigation.
- Regression tests cover categorized panels/menu, permission visibility metadata, restored web navigation and representative complete command families.
- Full GitHub Actions and Worker bundle checks pass before main is updated.

## Hard Constraints

- Do not remove runtime authorization, confirmation, cooldown or Portal feature switches merely because a panel item is hidden.
- Do not re-enable parallel OneBot command ingress.
- Respect QQ official limits: <=20 panels per bot, <=20 items per panel, panel item name <=14 chars, description <=30 chars; global C2C menu <=10 items and submenu <=5 children.
- Never coerce OpenID into numeric QQ identifiers.
- Do not store secrets.

## Execution Plan

### Phase 1 — IN_PROGRESS
- Recovered v0.0.21 and current main/dev baseline.
- Verified QQ official panel/menu constraints.
- Compare help/handlers/plugins to the V4 discovery catalog and identify missing active entries.

### Phase 2 — PLANNED
- Expand/normalize registry metadata and add categorized panel/menu generation.
- Restore missing discoverable commands, especially plugin-backed commands that are active but absent from catalog.
- Restore complete Portal navigation and remove obsolete "retired" presentation.
- Add regression coverage.

### Phase 3 — PLANNED
- Commit product changes on v4-qqopen-native.
- Run full CI and repair all failures.
- Fast-forward main only after verified success and confirm Connected Build.

### Phase 4 — PLANNED
- Reconcile Ray_Chen memory, create/verify TAR.GZ, send one Gmail notification.

## next_exact_action

Finish command coverage inventory, then implement registry/panel/menu/Portal changes and regression tests on v4-qqopen-native.

last_checkpoint_at: 2026-09-28T13:20:00+08:00
