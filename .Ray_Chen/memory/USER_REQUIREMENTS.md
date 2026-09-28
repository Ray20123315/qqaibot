# USER_REQUIREMENTS

## Active Requirements

- QQ Open/AIBot is the primary official bot transport and action path.
- Do not make the old Bot a competing primary command responder.
- Restore and retain the full QQAI 2.7.12 function surface, including !codexchat and !codexwork.
- Group discovery must expose ordinary functions as well as management/developer functions.
- Developer is the top cumulative permission level for commands available in the current scope.
- QQ group discovery must work in the actual client, not merely create API resources successfully.
- Use one managed group category-root panel because QQ group PanelItem has no nested submenu.
- Selecting a category should return a clickable two-column QQ button card similar to the user's reference UX; plain text is fallback, not the primary UX.
- Large categories must paginate within QQ keyboard limits.
- Button callbacks must reuse the existing canonical ! commands and existing handlers.
- QQ-rendered `/!面板 ...` is reserved for panel routing.
- Ordinary manual `/!普通内容` must continue to bypass AI.
- Existing server-side permission checks, confirmations, cooldowns and Portal switches remain authoritative.
- Restore and retain the full Portal/web functionality.
- Never treat QQ Open OpenIDs as numeric QQ IDs.
- Never retry ambiguous mutating timeout/5xx results across transports.
- Keep `ONEBOT_READ_ONLY` authoritative.
- Secrets must not be stored in Git or Ray_Chen memory.

## Public-Service Requirements

- Public users should connect their own external AI/storage resources instead of relying on unrestricted shared credentials.
- Public-user data and resources must remain principal/tenant isolated.
- Preview/testing must not write to the production `kv_store` table.
