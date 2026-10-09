# VERIFY
- Prior parallel feature CI 37965452837 and main CI 37965524681 passed npm check (including 3-group concurrency tests) and Wrangler dry-run.
- Cloudflare deployed previous main source 95057385c5822e6e355066c273f7475b06d32d87 successfully, but live log GET /internal/flush on old DO returned HTTP 404 at 2026-10-09T17:21:04Z.
- New test/hub-generation.test.mjs asserts hub ID bridge-bbot-parallel-v3 and health route and OneBot send stub use same.
- Feature CI pending, then fast-forward main and verify Cloudflare source sha, /health hub_generation parallel-v3.
- User must disconnect/reconnect NapCat after deployment; live functional timing validation deferred to next QQ messages.
