# VERIFY

## Previously verified

Foundation commit `21e5a8f00daeb7e465ca927c6f1d6acfadfe1259` passed GitHub Actions run `36379116271`:
- npm run check
- npm run check:v3
- npm run check:v4
- npm run check:v4test
- npm run check:bundle

## Resource integration produced

Product commit: `678d6a1d1eb21637fb8c542d90da54c590bce6d0`

New test `verify-v4-user-resources.mjs` asserts:
- D1/KV connector normalization and tenant key namespace;
- invalid storage type rejection;
- portal / QQ Open principal separation;
- private settings menu contains AI and storage flows;
- secure page uses password fields and custom choices;
- secure page does not use localStorage/sessionStorage;
- KV uses current `/storage/kv/namespaces/` route and not deprecated `/workers/namespaces/`;
- D1 client uses `/d1/database/` path and bearer token;
- resource API requires portal session and one-time ticket consumption;
- QQ private settings interception occurs before the general chat bridge;
- Worker exposes authenticated resource API and secure page.

## Pending

- GitHub CI/bundle for product commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0.
- Live provider membership routing.
- Actual V4 persistence routing into user connectors.
- Political classifier/output integration.
- Plugin runtime wiring.
- Full Portal/developer mode.
- Same-Worker Cloudflare preview.
- QQ self-test workbook.
