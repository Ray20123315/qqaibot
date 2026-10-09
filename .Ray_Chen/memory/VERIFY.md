# VERIFY

- GitHub Actions workflow npm run check = node --test tests/*.test.mjs and Wrangler dry-run.
- Tests/napcat-control.test.mjs: NapCat two groups joining without OpenID; protected admin block STOP/GRANT; protected grant; Bbot-only outbound no Abot API; direct group event routing.
- CI pending this commit, memory tar verification pending.
- Live acceptance requires Bbot connected (/health bbot.connected), its member roster refreshed, !use -> 12-character invite first group, !CODE alias second group, !status shows 2 groups, one chat message forwarded by Bbot, then verify ACL in two groups.
- Do not deploy or claim QQ live success until GitHub CI + Cloudflare source commit inspected.
- Legacy full archive/legacy-main-20261009 SHA 6a22b06433cfaffcf13abe2b60a917305290b629.
