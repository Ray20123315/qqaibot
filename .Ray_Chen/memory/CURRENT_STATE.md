# CURRENT_STATE

- main before new fix: 827921036139c3b24a8c6e1c1d9025655c45f399, Cloudflare deployed; older QQ gateway DO observations still showed 40034024 on older versions
- archived old application in archive/legacy-main-20261009 at SHA 6a22b06433cfaffcf13abe2b60a917305290b629
- new code ready on fix/qq-bang-commands-20261010, CI not yet checked
- commands now intended to accept @AIBot /!use, @AIBot !use, legacy @AIBot /use. Bare !use needs Bbot and does not independently provide Group OpenID to Abot
- worker no custom keyboard or old QQ panel; existing QQ developer-console configured commands can persist until removed there
- new named Abot Gateway Durable Object bridge-abot-commands-v2 to bypass old hot instance; actual session READY still UNKNOWN
- GET /health intended to show Abot/Bbot connection booleans without leaking auth tokens
- original QQ bot's Group OpenID mapping, rich media, protected identity logic unchanged
