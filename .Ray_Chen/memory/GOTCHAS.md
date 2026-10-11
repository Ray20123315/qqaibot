# GOTCHAS
- Native Windows GUI requires PE Subsystem 2. Preserve tools/codex-bridge-gui and packaged Node backend, side by side, and %APPDATA%/QQAIBOT/codex-bridge.json including read/edit root allowlists. Previous console-only EXE was not acceptable.
- Do not publish QQ_OPEN_CLIENT_SECRET, Codex tokens, raw QQ API responses, panel items, user/group IDs or any full exception bodies in diagnostics.
- QQ official developer portal old published slash entries may be independent of new /v2/panels. API returned no documented records at runtime; a no_match or unknown response does not prove an old client menu was removed.
- QQ /v2/panels mutations affect other live commands. Delete only an exact command named 设置插话率 after removing /! prefix; preserve all other items and metadata. Unexpected response schema must fail closed.
- Cloudflare cron is every minute but command cleanup Durable Object has 15-minute retry and one-shot success state. CI success does not verify QQ endpoint behavior; inspect version-specific production logs.
