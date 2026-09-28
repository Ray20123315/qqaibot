# USER_REQUIREMENTS

## Active Requirements

- QQ Open/AIBot is the primary official bot transport and action path.
- All usable operations should use AIBot first.
- When AIBot cannot deterministically perform an operation, automatically check the legacy Bot as a fallback.
- Before a legacy group write, verify the old Bot is connected, is in the mapped group and has the required QQ group role.
- If the old Bot lacks permission, clearly state which permission/role must be granted.
- If the old Bot has sufficient permission and required identifiers can be safely resolved, execute the action through OneBot.
- Do not make the old Bot a competing primary command responder; avoid duplicate replies and side effects.
- Restore the documented command/function surface instead of exposing only a reduced subset.
- Use categorized QQ official panels and QQ native C2C submenus where applicable.
- Restore the full active QQAI 2.7.12 function surface, including !codexchat and !codexwork.
- Higher permission must be cumulative in discovery: gaining Developer/admin capability adds commands and must not remove ordinary commands.
- Hide privileged discovery entries where QQ can represent the relevant permission, while retaining server-side permission checks.
- Restore the full Portal/web functionality.
- Never treat QQ Open OpenIDs as numeric QQ IDs.
- Member-target legacy actions require confirmed member identity mapping.
- Never retry ambiguous mutating timeout/5xx results across transports.
- Keep `ONEBOT_READ_ONLY` authoritative when configured.
- Keep conservative automatic group/member mapping with conflict rejection.
- Secrets must not be stored in Git or Ray_Chen memory.
