# VERIFY

- CI1 GitHub Actions run 37946376223: SUCCESS, node --test + Wrangler dry run
- CI2 GitHub Actions run 37946659489: SUCCESS, node --test + Wrangler dry run
- npm run check: node test tests/*.test.mjs && npx wrangler deploy --dry-run --outdir dist --no-assets
- final packaging CI: pending, must verify archive test+SHA256+contents
- deployment: NOT EXECUTED
- live QQ sandbox /use, /verify, /code, /stop /grant /@ replies: NOT TESTED
- official API unsolicited send and true @: NOT TESTED
- rollback ref: archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
