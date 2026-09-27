# USER_REQUIREMENTS

## Active V4 Requirements

- Redesign the backend Portal to look substantially better and allow intentionally heavy animation.
- Keep animation safe for reduced-motion users.
- Show whether QQ Open is online/READY directly in the Portal.
- Aggressively reduce unnecessary features.
- Prefer QQ Open-supported, practical, and required capabilities.
- Keep QQ group member management.
- Support join-request approve, decline, and decline+blacklist when platform permissions allow.
- Determine and support image/video/media send and receive using QQ Open capabilities.
- Avoid excessive Codex conversation fragmentation; direct Codex modes should normally share one conversation.
- Keep plugins as a controlled extensibility layer rather than stuffing optional features into core.
- Do not destructively erase legacy data during the first pruning pass.
- Keep `main` unchanged until explicit cutover.

## Existing Safety / Codex Requirements Still in Force

- Public `!codex` remains quota-bound and fixed to GPT-6 Luna/no reasoning.
- `!codexchat` / `!codexwork` remain developer capabilities.
- CodexWork stays read-only by default, editing is allowlisted, deletion is forbidden, and export is explicit.
- AppSecret and authorization credentials must not be committed or included in memory/notifications.
- Existing permission/confirmation gates remain authoritative.
