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
- Keyboard child-command buttons must be reusable; explicitly send a multi-click limit instead of relying on the QQ SDK default single-use limit.
- Commands that need no additional data must be sent as real QQ messages immediately; ordinary direct commands must not depend on callback execution.
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

- Old-Bot-verified numeric identity mapping is the authoritative bridge for QQ Open permission/whitelist reuse; OpenIDs themselves are never treated as QQ numbers.
- Group whitelist enforcement must apply before official plugin dispatch as well as before core AI handling.
- `!指令开 / !指令关` must gate both core Worker commands and official plugin commands, while preserving `!指令开` as the recovery path.

- Do not live-test Bot behavior in existing QQ groups while there is no isolated Bot/canary route; such tests create real group-chat side effects.
- Portal login must complete with a single credential submission without requiring a page reload. In the isolated V4 Preview, if the HttpOnly session cookie is unavailable after refresh/reload, the Preview must recover the session automatically without asking for credentials again.

## V4 Preview Acceptance Gate

- V4 Preview must be manually accepted by the user before any Preview-only test-login change is merged into `main`.
- Preview testing must remain isolated from production QQ, OneBot, AI provider secrets, Vectorize and production Portal admin secrets.
- Preview-only highest-privilege test login must be removed or disabled before production merge.
- During V4 Preview testing, report progress frequently and change method immediately when a path is blocked instead of repeatedly retrying the same unsafe approach.

