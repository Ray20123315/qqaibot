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


## Trusted bundled catalog and Portal API

The first trusted catalog entry is the already-bundled official Bilibili plugin. Its catalog record includes the source path and a SHA-256 that is verified in CI against the actual repository source file.

The Portal package manager uses strict exact-key D1 reads/writes for `plugin_packages:lock:v1` and does not depend on the V3 runtime being enabled.

Developer-only routes:

- `GET /api/portal/v3/packages`
- `POST /api/portal/v3/packages/:pluginId/stage` with `install | update | uninstall`
- `POST /api/portal/v3/packages/transactions/:id/commit`
- `DELETE /api/portal/v3/packages/transactions/:id`
- `POST /api/portal/v3/packages/history/:id/rollback`

The API deliberately reports `runtimeCodeLoaded: null`. A committed package record means metadata is registered and integrity metadata is verified; it does not mean runtime code was dynamically loaded. Bundled runtime activation remains a separate lifecycle operation.


## Portal package transaction UI

The existing V3 Plugin Manager page now receives a separate trusted-package panel. It shows:

- bundled catalog version and build-verified source SHA-256
- package metadata installed/not-installed state
- whether runtime code is bundled in the current Worker
- whether the corresponding runtime candidate is configured
- `runtimeCodeLoaded: unknown / not claimed`
- staged transactions with explicit commit/cancel controls
- recent committed transaction history with dependency-safe metadata rollback

Every destructive control says `metadata` explicitly. The UI warns that committing metadata does not load/unload JavaScript and does not change Plugin Lifecycle automatically.

The Worker routes `/api/portal/v3/packages...` before the generic Portal API and injects the package client only after the V3 Plugin Manager shell exists. Portal layout remains the final CSS/layout injector.
