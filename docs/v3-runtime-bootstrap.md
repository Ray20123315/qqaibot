# QQAI v3 Runtime Bootstrap

The Runtime Bootstrap is the single lifecycle boundary above the v3 Host Adapter.

## Responsibilities

- Assemble explicitly configured official plugins.
- Accept additional bundled/third-party plugin definitions without exposing Worker `env`.
- Start the Plugin Host once and keep lifecycle idempotent.
- Expose message dispatch, commands, settings/status surfaces, public status, and centralized scheduled jobs.
- Cache one started runtime per Worker `env` when `getV3Runtime()` is used.

## Side-effect rule

Importing the runtime does not register or start Bilibili polling. `official.bilibili` must be supplied explicitly to `createV3Runtime()` / `getV3Runtime()`. This prevents a module import or future Worker route from silently creating background jobs.

## Cutover

This module is not yet wired into `worker.js`. The next cutover step can place a feature-flagged route/cron bridge around `getV3Runtime()` without teaching the legacy Worker about individual plugins.
