# ACTIVE_TASK

task_id: qqaibot-20260928-full-command-panels-portal
task_status: completed
goal_revision: 1

## Goal

Restore all active QQAI 2.7.12 command/function entry points, categorized QQ official discovery, and the full Portal while keeping QQ Open/AIBot primary and OneBot as an internal fallback only.

## Acceptance Results

- VERIFIED: command registry exposes 77 entries and representative QQAI 2.7.12 families resolve.
- VERIFIED: !codex, !codexchat and !codexwork remain registered; developer commands are excluded from global group discovery.
- VERIFIED: QQ voice Beta commands are registered for C2C and group discovery.
- VERIFIED: group command discovery is split into help-aligned categories instead of one flat panel.
- VERIFIED: C2C custom menu uses native nested sub_menu_items and paginates categories at five children.
- VERIFIED: all C2C member commands enabled for discovery are present in the generated menu.
- VERIFIED: developer C2C discovery uses target_type=specific when developer OpenIDs are configured.
- VERIFIED: owner/admin panel entries keep runtime permission checks and use panel-safe command aliases where QQ name limits require them.
- VERIFIED: Portal full navigation is no longer hidden and active features are no longer presented as retired.
- VERIFIED: QQ Open/AIBot remains primary; previous conservative OneBot fallback behavior is unchanged.
- VERIFIED: development CI, main CI, isolated V4 deployment checks and Worker bundle all pass.
- VERIFIED: production Connected Build succeeds.

## Product Revision

`b86f762000dc6f498340c54696123328d0328db6`

## Verification Evidence

- development CI: `36385798148` — success
- main CI: `36385930192` — success
- production build: `435505a0-a118-4830-a4dc-f216b2ace61b` — success
- command entries: 77
- global group category panels: 8
- developer C2C category panels in regression fixture: 2
- maximum discovery panels with developer fixture: 10
- C2C menu child limit: <= 5, with category pagination

## Resolved Failures

- An intermediate categorized-panel test assumed <=6 group panels; corrected to the help-aligned eight-category design.
- A test-edit syntax error was repaired before product validation.
- Developer commands span two discovery categories, so regression coverage now validates both instead of assuming one developer panel.
- C2C menu generation was changed from truncation to pagination so commands after the fifth child are not lost.

## next_exact_action

Perform one live QQ smoke check after discovery sync: inspect the C2C nested menu, the categorized group panels, and execute one QQ-Open-supported command plus one legacy-fallback group action.

last_checkpoint_at: 2026-09-28T14:24:00+08:00
