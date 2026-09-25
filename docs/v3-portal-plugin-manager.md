# QQAI v3 Portal Plugin Manager

The Portal Plugin Manager is the authenticated management UI for Plugin API v1.

## Security model

- Only a valid Portal session belonging to a configured core developer may access `/api/portal/v3/plugins`.
- Non-developers receive HTTP 403 and the navigation entry stays hidden.
- When `V3_RUNTIME_ENABLED=false`, listing returns a safe disabled state and does not start the V3 runtime or read V3 plugin storage.
- Settings mutations are blocked while V3 is disabled.
- The manager performs generic manifest-schema validation before calling the Plugin Surface.
- The plugin's own `surface.updateSettings()` authorization still runs afterward.
- Secret values are never revealed because `getPluginSurface()` redacts them before the Portal receives them.
- Audit records include only plugin ID and changed setting keys, not setting values.

## Routes

### `GET /api/portal/v3/plugins`

Returns runtime flags plus installed/running plugin descriptors and their sanitized management surface.

### `GET /api/portal/v3/plugins/:pluginId`

Returns one plugin with sanitized settings and status.

### `POST|PATCH|PUT /api/portal/v3/plugins/:pluginId/settings`

Accepts a JSON object under `settings`. Unknown keys, read-only keys, invalid types, invalid select values, and out-of-range numbers are rejected before the plugin callback.

## UI

`injectV3PluginManagerClient()` adds a developer-only 插件管理 view to the existing Portal without modifying the large legacy Portal runtime. The UI is generated from each plugin's normalized settings schema and supports boolean, number, string/secret, select, and JSON fields.

The first proof plugin remains `official.bilibili-live`. Its poll interval and creator JSON can be managed through the same generic surface used by future plugins.

## Current lifecycle scope

This phase manages plugins that are already assembled into the V3 runtime. Install/update/uninstall and persistent enable/disable lifecycle are intentionally the next platform layer; they are not faked by editing Cloudflare environment variables from the Portal.


## Lifecycle controls

The same developer-only Plugin Manager now exposes persistent lifecycle controls backed by `plugin_lifecycle:registry:v1`:

- enable / disable immediately activates or deactivates the live Host plugin
- requested and granted permissions are shown separately
- removing a required Plugin API v1 capability blocks and deactivates a desired-enabled plugin
- restoring the required grants automatically re-activates it when compatible
- compatibility and block reason are visible in the plugin card

Routes:

- `POST|PATCH|PUT /api/portal/v3/plugins/:pluginId/state`
- `POST|PATCH|PUT /api/portal/v3/plugins/:pluginId/permissions`

Lifecycle audit records contain plugin ID, state, and permission names only. They never store plugin setting values or secret values.
