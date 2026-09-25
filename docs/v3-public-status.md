# QQAI v3 Public Status Service

This module turns explicit plugin public-status surfaces into a stable public JSON payload without reading plugin storage directly.

## Safety boundary

- A plugin is ignored unless `manifest.publicStatus === true`.
- The plugin must implement `surface.publicStatus(ctx)`.
- Public status is separate from authenticated management status.
- Per-plugin failures are contained and reported only as a generic DEGRADED/unavailable state.
- The public aggregator never receives Worker `env`, D1 handles, plugin settings, or admin context.

## Live summary

`buildV3PublicStatus()` aggregates provider rows into `live.rows` and current live entries into `live.entries`. This is provider-neutral: Bilibili is the first implementation, and future YouTube/live providers can use the same contract.

`v3PublicStatusResponse()` returns a no-store JSON `Response`. It is intentionally not wired into the production Worker route yet; that happens during the v3 bootstrap/cutover phase.
