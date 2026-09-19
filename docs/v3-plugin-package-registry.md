# QQAI v3 Plugin Package Registry Foundation

## Safety boundary

This phase is a package metadata and validation layer, not a runtime JavaScript loader.

A descriptor can be staged only after SHA-256 artifact verification, and it can be committed only if the plugin ID is in `trustedCandidateIds` supplied by the current Worker build. Unknown third-party code is never imported/evaluated by this module.

## Storage

Exact key: `plugin_packages:lock:v1`

The row contains installed package records, staged transactions, and a bounded rollback history. No prefix scan is used and artifact bytes are not stored.

## Descriptor

Required/validated fields include:

- plugin manifest identity/version/API compatibility
- optional `minQQAI` / `maxQQAI`
- safe relative `entry` path
- mandatory `sha256:<64 hex>` integrity
- requested permissions
- required dependencies and optional dependencies

## Transaction lifecycle

1. `stageInstall()`: verify artifact hash, trusted candidate, compatibility, dependencies, reverse dependency safety.
2. `commit()`: re-check compatibility/dependencies and atomically update lock metadata.
3. `stageUninstall()`: reject when installed dependents still require the target.
4. `rollback()`: restore the pre-change package record or remove an installed package when dependency-safe.
5. Staged transactions expire after 15 minutes.

Install/update/uninstall hooks are deliberately absent. Runtime code execution remains a later trust/sandbox concern.
