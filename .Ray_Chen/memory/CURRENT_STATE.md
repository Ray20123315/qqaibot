# CURRENT_STATE

- main product code SHA c641a11ad8cd03f74f6321091e01375eb0ce6a60; this memory-only follow-up does not change command runtime source.
- backup archive/legacy-main-20261009 SHA 6a22b06433cfaffcf13abe2b60a917305290b629
- GitHub feature CI 37958408119 PASS, node tests & Wrangler dry-run
- Cloudflare deployment 20e8ce43-f056-4acf-9e89-1a04b006fd01, version 9c690db5-2681-4586-9047-e200cf3090f6, sourced from main c641a11ad8cd03f74f6321091e01375eb0ce6a60, build outcome success, 100% traffic
- commands: /!use, !use, /use normalized to use; unknown ! or / commands not relayed; old panel absent from Worker
- QQ platform autocomplete menu old commands remain configured separately; deletion requires QQ developer console action
- Bbot NapCat attempted reverse WebSocket GET https://aibot.ray2025.com/onebot repeatedly, received HTTP 401 in Cloudflare Worker Logs on new runtime. Not connected until Token matches secret.
- Cloudflare qqai has ONEBOT_ACCESS_TOKEN binding (present; secret contents never read) and QQ_OPEN_CLIENT_SECRET
- health /health gives Abot/Bbot connected booleans and command prefix; direct public health not tested after deploy due inspection network restriction
- Abot group Gateway new DO identity; READY and QQ actual messages still require verification
- AI chat disabled; protected account ACL unchanged
