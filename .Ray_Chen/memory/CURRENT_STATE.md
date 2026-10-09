# CURRENT_STATE

- main at product SHA 16a1391457e64f3909ccc997ca771d21fbd27542 before Bbot hot-instance fix, Cloudflare deployment confirmed.
- legacy full archive: archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629.
- NapCat-native group control and direct Bbot routing: all unit tests green in CI 37960960301.
- new worker.js and src/delivery.js both now use ONEBOT_HUB.idFromName('bridge-bbot-napcat-v2'); current CI pending.
- new synthetic group ID prefix napcat: routes native to Bbot, no official Group OpenID required.
- real Bbot WebSocket switch to new DO needs manual disable/re-enable Client; no server-side old socket termination API provided.
- actual QQ end-to-end not proven.
