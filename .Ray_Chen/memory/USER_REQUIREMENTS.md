# USER_REQUIREMENTS

## Active Requirements

- QQ Open is the primary official bot transport/API surface.
- Keep NapCat/OneBot for full visibility and legacy capabilities not available through QQ Open.
- Prevent duplicate AI replies, plugins, moderation and management side effects between transports.
- Use official full-group messages where QQ grants receive-all-message capability.
- Support automatic group mapping conservatively; static mapping must remain available as an authoritative override.
- Track official friend/bot-group/member lifecycle events without faking numeric QQ IDs.
- Add QQ Interaction and active-push permission support without enabling ungranted Intent bits.
- Reuse existing AI/Codex/memory/plugin/command logic.
- Preserve member management, join review, mute, rich media, scheduled notifications and active speaking.
- Keep OneBot until hybrid live verification succeeds.
- Secrets must not be stored in Git or Ray_Chen memory.
