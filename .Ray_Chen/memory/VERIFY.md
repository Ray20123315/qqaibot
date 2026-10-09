# VERIFY

- npm run check: node --test tests/*.test.mjs && Wrangler deploy --dry-run.
- Tests verify no Abot message transport even on former real OpenID destinations, no credentials loaded by new gateway, 2 historical gateway DO /shutdown signals, Bbot native ACK and group controls.
- Verify GitHub Actions on feature/bbot-only-20261010 before main push, CI main after, and Cloudflare Worker source SHA and success.
- Worker /health must return mode bbot-only, abot.enabled=false, bbot.connected boolean; no access to Abot tokens.
- Monitor Cloudflare old ABOT_GATEWAY_READY / GROUP_EVENT telemetry after deployment; any continued events are a blocker.
- Check real QQ !use, !CODE alias, !status and one normal cross-group message. No live QQ user result yet.
