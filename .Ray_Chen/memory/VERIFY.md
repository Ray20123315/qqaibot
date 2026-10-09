# VERIFY
- previous CI 37963398835 33/35; CI 37963624474 34/35 passed. Failures limited to mock test assertions.
- latest test replacement captures either string or Request URL for mocked old DO shutdown. Expected gateway names and /shutdown validated.
- next full npm run check and Wrangler dry-run required.
- post-main: compare GitHub SHA with Cloudflare build, confirm no ABOT_GATEWAY_READY or official outbound send from new version, inspect Bbot health and QQ test.
