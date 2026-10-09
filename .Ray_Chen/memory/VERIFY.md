# VERIFY

- Feature 37965452837 success: bounded fanout concurrency, nativeBatch message and diagnostic health tests, Wrangler dry-run.
- Main CI for first parallel 37965524681 success.
- Cloudflare observed stale OneBotHub /flush 404 on 2026-10-09T17:21:04Z after first parallel deploy; new hub key fix required.
- Fix feature CI 37965979192 success, main CI 37966044948 success; new test/hub-generation ensures Worker health and delivery both use shared id bridge-bbot-parallel-v3.
- Cloudflare latest deployed main SHA 5b36ddcd8106f4566fcc15f2c63706cd5febd8dc, build outcome SUCCESS, deployment 11d869b9-a305-4e0a-ad60-7be82a616293, version 77ce16ed-350d-4b7f-ad55-e8c2309f4d01, traffic 100%.
- v0.0.86 archival CI, tar+SHA pending this final checkpoint.
- Live NapCat /health hub_generation parallel-v3 and connected true requires operator reconnect; QQ 3-group real-time latency still unknown.
