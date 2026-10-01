# USER_REQUIREMENTS

## Active Requirements

- QQ Open/AIBot is the primary official bot transport and action path.
- Do not make the old Bot a competing primary command responder.
- Restore and retain the full QQAI 2.7.12 function surface, including !codexchat and !codexwork.
- Group discovery must expose ordinary functions as well as management/developer functions.
- Developer is the top cumulative permission level for commands available in the current scope.
- QQ group discovery must work in the actual client, not merely create API resources successfully.
- Use one managed group category-root panel because QQ group PanelItem has no nested submenu.
- Selecting any non-empty category must return a clickable two-column QQ button card; this applies to 基础、群聊、记忆、活动、群规、AI管理、群操作、群主、开发者.
- Large categories must paginate within QQ keyboard limits.
- Keyboard child-command buttons must be reusable and must not use one-shot click limits.
- Commands that need no additional data must execute immediately without being left in the input box.
- Direct/no-argument keyboard commands must produce a normal QQ message event; callback-only execution is not an acceptable substitute.
- Commands that require parameters/targets/text must prefill the QQ message input and wait for user completion.
- Keyboard buttons must reuse existing canonical ! commands and existing handlers.
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
