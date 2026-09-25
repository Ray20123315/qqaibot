# Self-made QQAI Plugin Example

This directory is a source template for a third-party/self-made QQAI Plugin API v1 plugin.

1. Implement the plugin against `@qqai/plugin-sdk`.
2. Build an immutable artifact (for example `plugin.zip`) containing `qqai-plugin.json`, `dist/index.js`, README and LICENSE.
3. Generate your own Ed25519 author key with `tools/qqai-plugin-author.mjs keygen`.
4. Keep the private JWK outside Git. Import only the public JWK into QQAI's developer trust store.
5. Sign the exact artifact URL/ref/hash with `tools/qqai-plugin-author.mjs sign`.
6. Submit `qqai-distribution.json` to QQAI's external package quarantine flow.

Verification/approval does not execute the plugin. Arbitrary third-party runtime loading remains sandbox-gated.
