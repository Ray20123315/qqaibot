# VERIFY
- Previous feature CI 37963398835: 33/35 pass, failures only tests/abot-disabled String URL expectation and tests/pairing ignored reason
- Fixed test expectations; rerun npm run check and Wrangler dry-run via GitHub CI
- Check no QQ Open API import in worker.js, src/bridge.js or src/delivery.js. Gateway class inert; /shutdown deletes alarm
- Check shutdown attempts from cron, Bbot-only health response, Bbot delivery to historical OpenID group
- Require Cloudflare deployment evidence and real QQ group tests after main promotion
- Original archive/legacy-main-20261009 intact
