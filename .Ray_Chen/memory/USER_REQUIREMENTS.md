# USER_REQUIREMENTS

## Active Requirements

- QQ Open/AIBot is the primary official bot transport and action path.
- All usable operations should use AIBot first.
- When AIBot cannot deterministically perform an operation, automatically check the legacy Bot as fallback.
- Do not make the old Bot a competing primary command responder.
- Restore the full active QQAI 2.7.12 function surface, including !codexchat and !codexwork.
- Use categorized QQ official panels and QQ native C2C submenus where applicable.
- Group panels must include ordinary group commands together with management commands.
- Higher permissions are cumulative; Developer is the top level and should have every command available in the current scope.
- Because QQ group panels cannot target an individual user, Developer-only group commands may be visible to others, but runtime authorization must reject unauthorized execution.
- Keep server-side permission checks, confirmations, cooldowns and Portal switches authoritative.
- Restore and retain the full Portal/web functionality.
- Never treat QQ Open OpenIDs as numeric QQ IDs.
- Never retry ambiguous mutating timeout/5xx results across transports.
- Keep `ONEBOT_READ_ONLY` authoritative.
- Secrets must not be stored in Git or Ray_Chen memory.

## Public-Service Requirements

- The service is intended for public use rather than only the developer's own QQ account.
- Public users should connect their own external AI/storage resources instead of relying on unrestricted shared credentials.
- Public-user data and resources must be isolated by principal/tenant ownership.
- Preview/testing must not write to the production `kv_store` table.
- Production QQ Open stays primary; the legacy QQ/OneBot account remains a guarded fallback where official capability is unavailable.
