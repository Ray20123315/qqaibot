# QQAI Plugin API v1 — Self-made Plugin Authoring

QQAI V3 supports plugins made by users, not only official plugins.

## Author model

Every external author controls their own Ed25519 key pair.

- The **private key stays with the plugin author** and must never be uploaded to QQAI.
- The **public key** is imported by a QQAI developer/admin into the author trust store.
- A trusted key may optionally be scoped to specific plugin IDs.
- Revoking a public key blocks future verification for that author key.

QQAI stores author public keys under the exact key `plugin_trust:authors:v1`. No prefix scan is used.

## Package contents

Recommended source/release layout:

```text
qqai-plugin-example/
├─ qqai-plugin.json
├─ src/index.js
├─ dist/index.js
├─ README.md
├─ LICENSE
└─ plugin.zip
```

`qqai-plugin.json` is the Plugin API v1 package descriptor. The built artifact is immutable release content; the signed distribution envelope binds the exact HTTPS URL, immutable release ref, byte size and SHA-256.

## Author CLI

Generate a key pair:

```bash
node tools/qqai-plugin-author.mjs keygen --out .qqai-author
```

This creates:

- `.qqai-author.private.jwk` — secret; never commit/upload.
- `.qqai-author.public.jwk` — safe to import into QQAI trust settings.

Sign an artifact:

```bash
node tools/qqai-plugin-author.mjs sign \
  --manifest qqai-plugin.json \
  --artifact plugin.zip \
  --artifact-url https://example.com/releases/v1.0.0/plugin.zip \
  --immutable-ref v1.0.0 \
  --key .qqai-author.private.jwk \
  --key-id yourname:key1 \
  --repository-url https://github.com/yourname/qqai-plugin-example \
  --out qqai-distribution.json
```

Verify locally before publishing:

```bash
node tools/qqai-plugin-author.mjs verify \
  --distribution qqai-distribution.json \
  --public-key .qqai-author.public.jwk \
  --artifact plugin.zip
```

## Signed distribution contract

`qqai-distribution.json` contains:

- normalized Plugin API package descriptor
- artifact HTTPS URL
- immutable release ref
- exact artifact byte length
- SHA-256
- publisher key ID
- optional repository URL
- Ed25519 signature over canonical JSON

The signature covers the descriptor, permissions, dependencies, URL/ref/hash/size and publisher identity. Modifying any signed field invalidates verification.

## Quarantine flow

External/self-made packages never skip quarantine:

1. developer trusts the author's public Ed25519 key
2. QQAI normalizes the signed distribution envelope
3. QQAI checks key status and plugin-ID scope
4. QQAI verifies Ed25519 signature
5. QQAI fetches the HTTPS artifact through SSRF-safe public URL handling
6. size/media type/SHA-256 are verified
7. only verification metadata is persisted in `plugin_quarantine:registry:v1`; artifact bytes are discarded
8. developer may approve/reject the quarantined metadata

Approval is **not** runtime execution. External JS remains blocked until a sandboxed runtime loader is implemented.

## Security invariants

- HTTPS only; credentials/private/local destinations are rejected.
- Redirect targets must be revalidated by the network layer.
- Maximum artifact size is 5 MiB for the v1 acquisition contract.
- Private JWK fields are rejected by QQAI trust storage.
- Unknown/untrusted/revoked/out-of-scope keys fail closed.
- Artifact bytes are never stored in D1 by quarantine.
- Signature validity does not grant plugin capabilities; runtime permissions remain a separate lifecycle gate.


## Portal workflow for your own plugin

The developer-only V3 package panel now includes **Self-made / External Plugins**.

1. Paste/import the author's Ed25519 **public JWK** and assign a key ID.
2. Optionally scope that key to specific plugin IDs.
3. Paste the signed `qqai-distribution.json`.
4. QQAI downloads the artifact through the public-URL network guard, revalidating manual redirects and refusing local/private destinations.
5. Signature, declared byte size and SHA-256 must all pass before the record enters quarantine.
6. A developer can approve, reject or delete the quarantine metadata.
7. Revoking the author key immediately prevents future packages signed by that key from being verified.

Approval remains a review state only. The current same-Worker runtime never evals/imports this external JavaScript.
