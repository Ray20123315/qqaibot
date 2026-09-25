# QQAI v3 Plugin Settings / Status Surface

This layer is the management contract between Plugin API v1 and future Portal/API routes.

## Goals

- Keep Portal independent from individual plugin internals.
- Keep plugins independent from Cloudflare Worker `env` and raw D1 handles.
- Make official and third-party plugins use the same settings/status contract.
- Bound and sanitize all values returned to management clients.

## Settings schema

A plugin declares `manifest.settings` keyed by normalized setting names. Supported field types are `string`, `number`, `boolean`, `select`, and `json`.

Number fields may declare `min`, `max`, and `step`. Select fields require a bounded options array. A setting marked `secret: true` is always redacted by the host during read-back.

## Surface callbacks

`surface.readSettings(ctx)` returns the plugin current normalized settings.

`surface.updateSettings(ctx, input)` validates and persists a settings update. The host does not bypass plugin authorization.

`surface.status(ctx)` returns bounded operational state suitable for diagnostics and Portal rendering.

## Host methods

- `listPlugins()` includes surface capability metadata and the normalized settings schema.
- `getPluginSurface(pluginId, eventContext)` returns descriptor + sanitized settings + status.
- `updatePluginSettings(pluginId, input, eventContext)` executes the plugin update and returns a fresh sanitized surface snapshot.

All serialized settings/status/update payloads are limited to 64 KiB.

## Bilibili proof plugin

`official.bilibili-live` is the first real plugin using the surface. It exposes creator configuration, poll interval, provider health, effective LIVE rows, stale state, and OK/DEGRADED/DISABLED status. Settings mutations continue to require the plugin admin allowlist and reschedule its polling job when the interval changes.
