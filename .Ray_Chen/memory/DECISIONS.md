# DECISIONS

## Retained

D-001 through D-073 remain in force.

## D-074 Normal child-command button split
status: superseded
superseded_by: D-077
date: 2026-09-29
Previous decision: use action.type=2 for all normal child-command buttons and panel.enter=true for direct send.
Reason superseded: live QQ group clients can still place type=2 commands into the input box despite enter=true.

## D-075 Normal command buttons are reusable by default
status: accepted
date: 2026-09-29
Decision: omit action.click_limit from normal child-command buttons. Unrelated features may still set an explicit limit if they truly need one.

## D-076 Unknown commands default to prefill
status: accepted
date: 2026-09-29
Decision: new or unclassified commands default to editable prefill so a new command cannot accidentally become a one-click execution path.

## D-077 Direct commands use reusable callbacks
status: superseded
superseded_by: D-080
date: 2026-09-29
Previous decision: group keyboard commands explicitly marked direct use action.type=1 reusable callbacks. QqOpenGateway ACKs INTERACTION_CREATE first, then dispatches the existing canonical command handler. This guarantees immediate execution independently of QQ group type=2 enter behavior.

## D-078 Parameterized commands stay command-button prefills
status: accepted
date: 2026-09-29
Decision: commands needing parameters, targets or content use action.type=2 with enter=false and a trailing-space canonical command. Existing handler authorization remains unchanged.

## D-079 Every active group category is regression-owned
status: accepted
date: 2026-09-29
Decision: tests enumerate every non-empty GROUP_PANEL_CATEGORY_META category and every keyboard page, requiring full command coverage and valid row/button limits. Single-category success is not sufficient evidence.


## D-080 Direct panel commands must be real QQ messages
status: accepted
date: 2026-10-01
supersedes: D-077
Decision: group panel commands that need no additional input use QQ command buttons with action.type=2 and enter=true so the client sends the canonical command as a normal QQ message. Commands needing parameters remain action.type=2 with enter=false. Interaction callbacks remain available for unrelated interaction features but are no longer the direct-command primitive.
Reason: live user verification showed the callback path executes server-side without creating the required QQ message.


## D-081 Native group discovery exposes real commands
status: accepted
date: 2026-10-01
Decision: QQ native group discovery uses categorized real-command panels generated from the canonical registry. The manual `!面板 <分类>` inline keyboard remains a supplemental/fallback UI, but native discovery must not be reduced to category placeholder commands.
Reason: live QQ client evidence showed that a root-only panel made the concrete commands appear missing.


## D-082 Native group discovery is a category launcher
status: accepted
date: 2026-10-01
supersedes: D-081
Decision: QQ native group discovery uses a compact category-root panel. Sending a category command returns the bot-managed paginated inline keyboard for that category. This avoids native QQ panel visibility/item limits while preserving complete command access.

## D-083 Relationship feature retired
status: accepted
date: 2026-10-01
Decision: master/partner relationship commands, handlers, categories and Portal management surfaces are removed. Legacy stored bindings and legacy relationship mute-lock types may remain only for safe cleanup/expiry compatibility and must not provide a path to create or manage new relationships.


## D-084 Inline keyboard cards use plain-text QQ messages
status: accepted
date: 2026-10-02
Decision: QQ category-panel replies carrying an inline keyboard use `msg_type:0 + content + keyboard`. They must not require Markdown permission. The normal card copy contains only the panel title/prompt; fallback command text is stored separately and is sent only after a real keyboard capability rejection.
Reason: live QQ evidence on 2026-10-01 showed the forced Markdown keyboard path falling back to plain text without buttons.


## D-085 Native real-command panels are the reliable clickable fallback
status: accepted
date: 2026-10-02
supersedes: D-082 as the sole group discovery strategy
Decision: retain the compact group category launcher, and also publish categorized concrete group-command panels generated from the canonical registry. Custom inline keyboards are optional enhancement only when `QQ_OPEN_CUSTOM_KEYBOARD_ENABLED=true` and the QQ AppID capability is explicitly confirmed.
Reason: two production live tests rendered category reply text with no inline buttons, while Tencent documentation identifies custom buttons as a gated capability. The QQ native `/` command panel is therefore the primary clickable discovery surface.
