# VERIFY

## Verified Foundation Commit

- branch: `feature/v4-public-bot`
- commit: `21e5a8f00daeb7e465ca927c6f1d6acfadfe1259`
- GitHub Actions run: `36379116271`
- conclusion: `success`

Passed:
- `npm run check`
- `npm run check:v3`
- `npm run check:v4`
- `npm run check:v4test`
- `npm run check:bundle`

The V4 suite includes `verify-v4-public-foundation.mjs`, covering:
- role and legal state helpers;
- text-first political prefilter/classifier contract;
- official capability fallback classification;
- refusal to fallback on timeout/5xx;
- group mapping and OpenID identity safety;
- membership-bound user provider sharing;
- plugin non-overridable runtime risk;
- license notice.

## Pending Verification

- BYOK secure-page and QQ-DM flows.
- Live provider membership resolver.
- Political guard integration in AI runtime.
- Plugin runtime guard wiring.
- Human-readable Portal/developer mode.
- Same-Worker Cloudflare preview.
- Official QQ self-test workbook.
