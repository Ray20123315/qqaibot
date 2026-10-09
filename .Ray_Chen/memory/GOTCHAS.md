# GOTCHAS

- QQ autocomplete menu /!设置插话率 comes from developer console command configuration, not from Worker. Deleting code won't delete the menu; QQ developer portal must remove old commands.
- QQ official group bot only receives messages that match enabled group event subscription, generally @bot mention. Bare !use alone on NapCat does not produce group_openid on Abot.
- Previous Abot QqOpenGateway DO persisted older source version after Worker deployment; use a new DO name to get current code. Potential competing old Gateway session could be kicked/reconnect; verify new READY and stop stale instance if it interferes.
- NapCat reverse WebSocket Authorization: Bearer token must equal Cloudflare ONEBOT_ACCESS_TOKEN (secret, do not expose).
- Bbot WS not known connected; /health reports limited live status so user can check without revealing secrets.
- Avoid forwarding unrecognized /! or ! commands to other groups.
