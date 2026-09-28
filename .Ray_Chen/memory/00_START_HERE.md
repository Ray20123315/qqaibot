# Ray_Chen Memory Entry

- memory_version: v0.0.23
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-full-command-panels-portal
- task_status: completed
- goal_revision: 1
- product_revision: b86f762000dc6f498340c54696123328d0328db6
- updated_at: 2026-09-28T14:24:00+08:00

## Quick Recovery

The full command-discovery and Portal restoration task is complete and verified.

- QQAI 2.7.12 discovery now exposes 77 registered command entries, including QQ voice Beta, !codex, !codexchat and !codexwork.
- Group discovery is category-oriented instead of a flat command dump.
- C2C uses QQ native custom-menu submenus; categories paginate instead of silently dropping commands after the five-child limit.
- Developer commands stay out of global group panels and use specific C2C panels when developer OpenIDs are configured.
- Runtime permission, feature-switch, cooldown and confirmation checks remain authoritative.
- QQ Open/AIBot remains the only user-facing command path; legacy OneBot remains an internal permission-checked fallback.
- The full pre-existing Portal navigation is visible again; V4 is an additive control surface rather than a replacement.
- Development CI 36385798148 and main CI 36385930192 both succeeded.
- Cloudflare production Connected Build 435505a0-a118-4830-a4dc-f216b2ace61b succeeded for b86f762000dc6f498340c54696123328d0328db6.

## Recovery Route

1. Read ACTIVE_TASK.md and CURRENT_STATE.md.
2. Treat b86f762000dc6f498340c54696123328d0328db6 as the verified product revision.
3. If live QQ discovery differs, inspect QQ_OPEN_DISCOVERY_SYNC status and official menu/panel API errors before changing the registry.
4. Keep QQ Open primary and OneBot auxiliary.
