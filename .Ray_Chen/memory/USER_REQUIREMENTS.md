# USER_REQUIREMENTS

## Active Requirements

- QQ Open is the primary official bot transport/API surface.
- Keep NapCat/OneBot for full visibility and legacy capabilities not available through QQ Open.
- Prevent duplicate AI replies, plugins, moderation and management side effects between transports.
- QQ Open replies must not expose raw OpenID markup such as `<@OPENID>`.
- Use official QQ reply semantics where supported; do not fake unsupported visible quote/reference UI.
- Automatic group mapping must work without requiring the old bot itself to be @mentioned.
- Mapping must remain conservative and keep a static authoritative override.
- Portal should expose mapping learning progress rather than only final mapping totals.
- Discovery/menu/panel synchronization must use current QQ API-required fields.
- Keep Interaction permission-gated.
- Never treat QQ Open OpenIDs as numeric QQ IDs.
- Keep OneBot until hybrid live verification succeeds.
- Secrets must not be stored in Git or Ray_Chen memory.
