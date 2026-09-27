# USER_REQUIREMENTS

## Active Requirements

- Do not delete legacy systems yet.
- Do not modify or migrate the production Worker/environment while preparing the test version.
- Get the isolated test version correct first.
- Test QQ Open connection/reply before broader cutover.
- Keep the lean animated Portal direction.
- Keep QQ-supported practical features, including member management, join approval/decline/blacklist, mute, and rich media.
- Direct `!codex`, `!codexchat`, and `!codexwork` should normally share one principal conversation.
- Secrets must remain out of GitHub and memory.

## Safety Requirements

- Production `qqai` / `main` requires explicit user authorization for cutover.
- Test resources must not write production QQAIBOT data.
- Do not delete Cloudflare resources to work around account limits without explicit authorization.
