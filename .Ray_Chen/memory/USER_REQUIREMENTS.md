# USER_REQUIREMENTS

## Active Requirements

- V4 runs in the formal production environment.
- Do not delete legacy OneBot systems yet.
- Add the existing bot functionality to QQ Open rather than keeping QQ Open as a ping-only path.
- Reuse existing AI/Codex/memory/plugin/command logic rather than duplicating it.
- Keep QQ Open practical features: member management, join approval/decline/blacklist, mute, image/video/audio/file receive and send.
- Direct `!codex`, `!codexchat`, and `!codexwork` should normally share one principal conversation when identity is genuinely the same.
- Do not pretend QQ Open OpenIDs are numeric QQ IDs.
- Secrets must never be committed or written into Ray_Chen memory.

## Production Safety

- Production resource removal must be evidence-based.
- OneBotHub remains until QQ Open live AI and management verification succeeds.
- QQ Open credentials are configured and Gateway READY has been user-verified.
