# VERIFY

- GitHub actions npm run check: node --test tests/*.test.mjs && Wrangler dry-run.
- New regression tests: /!use, !use, /use, @AIBot syntaxes, join code and admin commands, unknown commands excluded from group relay, health secret redaction.
- /health should expose only booleans Bbot.connected Abot.connected Abot.session_ready.
- Current code CI: PENDING
- Need confirm main fast-forward, Cloudflare deployment source SHA, Gateway READY and NapCat WS (not yet verified). No real QQ test claimed.
- Old QQ panel requires developer console action.
