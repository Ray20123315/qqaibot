# USER_REQUIREMENTS

## Active Requirements

- QQ Open is the primary official bot transport/API surface.
- Keep the old NapCat/OneBot bot and use it to supplement visibility/capabilities that QQ Open cannot expose.
- Add official full-group-message support when the bot has the QQ "receive all messages" capability.
- Add QQ interaction events and active-message permission state handling.
- Prevent duplicate AI replies, plugin execution, moderation and notifications when both QQ Open and OneBot observe related activity.
- Reuse existing AI/Codex/memory/plugin/command logic.
- Preserve QQ Open member management, join review, mute and rich-media support where official permissions allow.
- Keep `!codex`, `!codexchat`, `!codexwork` on one principal conversation only when identity is genuinely linked.
- Never treat QQ Open OpenIDs as numeric QQ IDs.
- Do not delete OneBot until hybrid live verification succeeds.
- Secrets must never be committed or written into Ray_Chen memory.
