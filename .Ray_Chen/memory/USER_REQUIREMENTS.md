# USER_REQUIREMENTS

## Active Requirements

- QQ Open is the primary official bot transport/API surface.
- Keep NapCat/OneBot and use it for full visibility / legacy capabilities not available through QQ Open.
- Prevent duplicate AI replies, plugins, moderation and management side effects between transports.
- Use official full group messages where QQ grants receive-all-message capability.
- Add QQ Interaction and active-push permission support without enabling ungranted Intent bits.
- Reuse existing AI/Codex/memory/plugin/command logic.
- Preserve member management, join review, mute and rich media support.
- Preserve scheduled notifications and active speaking with safe official-first / OneBot fallback ownership.
- Never infer numeric QQ from OpenID.
- Keep OneBot until hybrid live verification succeeds.
- Secrets must not be stored in Git or Ray_Chen memory.
