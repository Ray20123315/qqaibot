# GOTCHAS

- Historical Abot DO instances can remain hot on old versions after a Worker deploy, so disabling cron alone is insufficient. New code sends legacy /shutdown; real cessation must be verified in Cloudflare logs. Cloudflare cannot delete QQ platform bot menu, separate QQ dashboard action.
- Disabled QQ Open AppID / Secret kept for future user-authorized re-enable. Their mere existence is not a live request.
- Synthetic napcat:<QQgroup> and historical Group OpenID are not native QQ group identifiers. Bbot sends only when verified numeric qq_group_id is known.
- Bbot OneBot ACK timeout is ambiguous; never resend blindly, but Bbot confirmed offline should not consume pending messages.
- Use same authenticated Bbot DO bridge-bbot-napcat-v2. Check /health bbot.connected before QQ tests.
- Numeric QQ 3569028262 and 2681167798 grant/stop restrictions must remain.
- User does not want Abot message replies; if old QQ platform command autocomplete is still shown, that is separate portal configuration.
