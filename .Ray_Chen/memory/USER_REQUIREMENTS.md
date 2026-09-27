# USER_REQUIREMENTS

## Current Codex / Local Work Requirements

- `!codexwork` and `--codexwork` may access the user's computer only through explicitly permitted folders.
- Local files are read-only by default; no delete capability is permitted.
- Restricted editing is allowed only for explicitly configured folders and must not imply general computer access.
- CodexWork should be able to return selected local/generated files through the bridge and send them to QQ.
- Avoid loading unrelated plugins, skills, MCP servers, or other context unless the request actually needs them.
- Public `!codex` / `--codex` is available to everyone with bounded quota and always uses GPT-6 Luna with no reasoning, including developers.
- Public Codex should continue the same conversation/session instead of intentionally opening a new one on each request.
- Developers use `!codexchat` / `--codexchat` for the former advanced Codex behavior.
- The computer must remain protected by explicit local folder boundaries.
- Portal needs terminal-style logs that can be viewed and downloaded.
- Portal needs self-check and safe automatic repair; prefer deterministic/no-AI repair.
- Changes requested in this task go directly to `main` after verification.

## Existing Durable Requirements Still in Force

- Existing command permissions and confirmation gates remain authoritative; AI routing must not bypass them.
- User-visible member-detail output should remain curated instead of dumping raw OneBot/D1 structures.
- Successful administrator recall remains silent while failures remain visible.
