# USER_REQUIREMENTS

## Active V4 Requirements

- Prioritize proving QQ Open connection and native reply before broader migration.
- Rebuild toward QQ Open Native instead of permanently emulating OneBot.
- Keep existing text commands compatible and converge commands into the Command Registry.
- Use QQ custom menus/panels where useful, with backend permissions remaining authoritative.
- If the bot is a QQ group administrator and official APIs permit it, member-message recall should remain available under QQAIBOT authorization rules.
- Preserve mature systems: Codex Bridge, AI providers, plugins, D1/Portal data, quota/cooldown and security controls.
- Do not commit or record AppSecret.
- Keep OneBot production usable until QQ Open is verified.

## Existing Codex / Local Work Requirements Still in Force

- `!codex`, `!codexchat`, and `!codexwork` share a conversation for the same user/chat scope; plugin suffix variants retain plugin-scoped continuity.
- Public `!codex` stays quota-bound and fixed to GPT-6 Luna/no reasoning; advanced modes remain developer-only.
- CodexWork is read-only by default, edit roots are explicit allowlists, and deletion is never allowed.
- Avoid unnecessary plugin/skill/context loading.
- Existing permission/confirmation gates remain authoritative.
- Successful administrator recall remains silent while failures remain visible.
