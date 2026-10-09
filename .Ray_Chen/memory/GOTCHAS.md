# GOTCHAS

- Stale QQ command panel /!设置插话率 is QQ platform developer-command configuration; GitHub cannot remove it. Delete/disable in QQ developer portal and close/reopen QQ client.
- /!use and !use are ordinary text commands; official QQ bot GROUP_AT events generally need @AIBot mention so Abot receives Group OpenID. Bare !use on Bbot does not prove official group openid.
- OneBot reverse WS handshake returns HTTP 401 if Token missing/mismatched, repeated every ~5 seconds at user's reconnect interval. URL wss://aibot.ray2025.com/onebot and Array format; Token equals ONEBOT_ACCESS_TOKEN secret in Cloudflare.
- Never reveal or hardcode existing secret token; account owner must set equivalent values.
- Old Abot Gateway DO may run an older version across Worker deployments; new object identity bypasses it, but two gateway sessions can interfere. Confirm ABOT_GATEWAY_READY from new instance before claiming official event processing.
- Do not claim QQ live messages verified solely from CI/deploy.
