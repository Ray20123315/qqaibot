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


## Feature-flagged Worker bridge

The legacy Worker imports `src/v3/runtime/bridge.js`, but the bridge is inert by default. `V3_RUNTIME_ENABLED` must be explicitly true before the `/api/v3/status` route or V3 scheduled execution starts a runtime.

When enabled, `V3_BILIBILI_ENABLED` separately controls registration of the official Bilibili plugin. Creator configuration is read from `V3_BILIBILI_CREATORS_JSON` (JSON array/object) or the simpler `V3_BILIBILI_UIDS` list. The bridge does not reuse legacy Bilibili configuration implicitly.

The scheduled bridge uses the due-indexed V3 Plugin Scheduler. With V3 disabled it performs no D1 reads. With V3 enabled and no due jobs, the steady-state cron path reads only the exact `plugin_scheduler:due` row.
