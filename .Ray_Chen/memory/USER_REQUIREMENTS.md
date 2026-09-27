# USER_REQUIREMENTS

## Active V4 Requirements

- Rebuild QQAIBOT toward QQ Open Platform native integration rather than maintaining a permanent OneBot compatibility illusion.
- All existing commands should become compatible with the new architecture.
- Use QQ custom menus and command panels where useful, while keeping text-command compatibility.
- Command definitions should be single-source so text commands, AI routing, help, menus and panels do not drift apart.
- If the bot is a QQ group administrator and the official API permits it, member-message recall should remain available under QQAIBOT authorization rules.
- Preserve valuable mature systems: Codex Bridge, AI providers, plugins, D1/Portal data, quota/cooldown and security controls.
- Do not expose or commit AppSecret.
- Migration should be recoverable; keep the current OneBot production path until QQ Open passes verification.

## Existing Codex / Local Work Requirements Still in Force

- `!codex`, `!codexchat`, and `!codexwork` share one conversation for the same user/chat scope; plugin suffix variants keep plugin-scoped continuity.
- Public `!codex` is quota-bound and fixed to GPT-6 Luna with no reasoning; advanced CodexChat/CodexWork remain developer-only.
- CodexWork local files are read-only by default, editing is restricted to explicit local allowlists, and deletion is never allowed.
- CodexWork may export selected allowed files back to QQ.
- Avoid loading unrelated plugins/skills/integrations unless necessary.
- Existing permission/confirmation gates remain authoritative.
- Successful administrator recall remains silent while failures remain visible.
