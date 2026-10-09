# DECISIONS

2026-10-10: User requests primary /!use and !use, avoiding QQ's old slash autocomplete UI. Implement parser normalization while preserving /use compatibility. Bbot's raw QQ events may see bare !use, but official Abot needs an @ event to determine Group OpenID.
2026-10-10: Source in main no longer generates old QQ keyboard. Tencent official bot-docs say command list is configured in QQ developer portal. Programmatic deletion not accessible via GitHub/Cloudflare; clearly require developer console removal, never pretend deleted.
2026-10-10: Old QQ Gateway DO instance was still logging old release 40034024; use distinct durable object idFromName 'bridge-abot-commands-v2' to force new code instance, but watch for old gateway session contention. No secrets logged.
2026-10-10: Provide safe /health Abot/Bbot booleans and added high-level event logs, no QQ message text logged.
