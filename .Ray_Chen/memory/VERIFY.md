# VERIFY
- CI 37963768519 34/35 tests pass. Single fake Bbot fetch request uses URL string; corrected this revision.
- Full npm run check and Wrangler dry-run pending.
- Confirm CI green before main update; after main update confirm Cloudflare connected build source SHA and Bbot-only health.
- Old Gateway shutdown calls should stop historical Abot sessions, but must verify actual runtime.
