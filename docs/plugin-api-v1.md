# QQAI Plugin API v1

QQAI v3 treats plugins as first-class extensions. Official and third-party plugins use the same public API.

## Design rules

- Plugins never receive the raw Cloudflare Worker `env` object.
- Plugins declare capabilities in their manifest; privileged host services reject undeclared capabilities.
- Plugin storage is namespaced by plugin ID and uses exact-key access.
- Plugin API compatibility is versioned independently from QQAI application versions.
- Bundled plugins are the baseline runtime. A future sandboxed/dynamic runtime may implement the same API without changing plugin source.
- Message events are fail-closed: plugins without `message.read` are not invoked for message hooks.
- `media.read` is separate from `message.read`; without it, URL/file/path/Base64 identifiers are redacted from canonical media parts.
- Sending image/audio/video/file/market-face content requires `media.send` even when the plugin also has `message.send`.
- `ai.multimodal` additionally requires `media.read`, preventing AI calls from bypassing media visibility permissions.
- `ai.tts` generates speech but does not grant permission to send the generated media; outbound audio still requires `media.send` and a message-send capability.
- Scheduler jobs are plugin-owned; one plugin cannot list, read, cancel, or receive cron events for another plugin's jobs.
- Raw `onebot.call` is capability-gated and additionally restricted by the host action allowlist.

## Manifest

Required fields: `id`, `name`, `version`, `apiVersion`.

`apiVersion` must currently be `1`.

Supported capabilities:

`message.read`, `message.send`, `media.read`, `media.send`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.multimodal`, `ai.tts`, `storage`, `scheduler`, `network`, `group.read`, `group.manage`, `member.read`, `member.manage`, `portal.route`.

## Lifecycle and events

Plugins may implement `onLoad`, `onMessage`, `onGroupMessage`, `onPrivateMessage`, `onNotice`, `onRequest`, `onReaction`, `onMemberJoin`, `onMemberLeave`, `onCron`, and `onUnload`.

Message hooks receive the QQAI canonical message rather than the raw OneBot body. This keeps protocol-specific fields and transport secrets inside the host adapter.

`onCron(ctx, event)` is targeted to the plugin that owns the due scheduler job. Cron events are not broadcast to every installed plugin.

## Commands

Plugins may expose commands with a canonical name, aliases, description, and async `run(ctx, input)` handler.

## Context

The host context exposes only capability-gated services. Initial API surface includes `reply`, `send`, `media.send`, `media.resolve`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.multimodal`, `ai.tts`, `storage`, `scheduler.create/list/get/cancel`, and `network.fetch`.

`ctx.media.resolve(index)` requires `media.read` and only resolves media/forward parts from the current canonical message. It cannot be used as an arbitrary URL downloader.

`ctx.ai.multimodal(input)` compiles the current canonical message into bounded Gemini multimodal input. Native QQ `face` remains semantic text; resolvable `mface` keeps its QQ expression summary and adds image bytes; image/audio/video/supported files are resolved through the v3 Media Resolver. The call requires both `ai.multimodal` and `media.read`.

`ctx.ai.tts(input)` uses the v3 Gemini TTS adapter and returns normalized audio metadata plus a canonical `audio` part. The host requests inline audio through the Gemini Interactions API, normalizes raw L16/PCM to WAV when necessary, and keeps generated audio size-bounded. Sending the returned part still requires outbound media permission. Before the first outbound audio part, the Host Adapter probes OneBot `can_send_record`; an explicit negative result blocks the send, while probe errors remain diagnostic and do not create false negatives.

The `scheduler` capability exposes plugin-owned scheduled code execution. `ctx.scheduler.create()` supports one-time timestamps/delays and bounded recurring intervals; `list()`, `get()`, and `cancel()` are automatically scoped to the calling plugin. Due jobs invoke only that plugin's `onCron`. Payload size, job counts, execution duration, retry backoff, and leases are bounded by the host runtime.

The v3 host adapter currently provides message send/reply, media send/resolve, namespaced D1 storage, safe-network fetch, AI chat/vision/multimodal/TTS, plugin-owned scheduler services, and an allowlisted raw OneBot bridge. `runDuePluginJobs()` is available as the scheduler execution entrypoint, but it is not wired to the production Worker cron until the v3 bootstrap/cutover phase.

The current v3 foundation intentionally does not load arbitrary JavaScript from D1 or remote URLs at runtime. Distribution layout and marketplace repository placement are deferred; the public Plugin API should remain independent from that choice.


## Plugin management surface

Plugin API v1 includes a host-owned management surface for Portal and diagnostics. A plugin may declare a normalized `manifest.settings` schema and optional `surface.readSettings(ctx)`, `surface.updateSettings(ctx, input)`, and `surface.status(ctx)` callbacks.

Supported setting descriptor types are `string`, `number`, `boolean`, `select`, and `json`. The host bounds serialized surface values to 64 KiB, rejects non-serializable output, and redacts top-level settings marked `secret: true` before returning them to a management client.

The host exposes `getPluginSurface(pluginId, eventContext)` and `updatePluginSettings(pluginId, input, eventContext)`. These calls still execute inside the normal capability-scoped plugin context and never reveal the raw Worker `env`. Authentication/authorization belongs to the caller plus any plugin-specific validation; the Bilibili official plugin retains its admin allowlist for mutations.


## Public plugin status

A plugin must explicitly set `manifest.publicStatus: true` and implement `surface.publicStatus(ctx)` before any state can be exposed to an unauthenticated public-status aggregator. The public callback is separate from the authenticated management `surface.status(ctx)` callback so plugins can omit operational errors, actor IDs, secrets, or internal configuration.

The host exposes `getPluginPublicStatus(pluginId)`. Public aggregation code should only call plugins whose manifest and surface descriptor both opt in.


## V3 runtime bootstrap

`createV3Runtime(env, options)` is the lifecycle boundary above the Host Adapter. It assembles explicitly configured official plugins plus caller-supplied plugins, starts the host exactly once, exposes plugin surfaces/public status, and runs the centralized Plugin Scheduler.

`getV3Runtime(env, options)` caches one started runtime per Worker `env` object. The first creation fixes the plugin set for that runtime instance; importing the module alone has no side effects. The official Bilibili plugin is not enabled unless `options.official.bilibili` is supplied.


## Portal Plugin Manager

The v3 Portal Plugin Manager is a developer-authenticated management client over the generic Plugin Surface. It does not read plugin storage directly and does not receive raw Worker `env`.

Routes live under `/api/portal/v3/plugins`. Listing and detail reads use `listPlugins()` / `getPluginSurface()`. Settings updates use `updatePluginSettings()` after a generic schema/type/read-only validation layer, then the plugin's own authorization and normalization still run.

The Portal route is developer-only. When `V3_RUNTIME_ENABLED` is false, the list route reports the disabled state without starting V3 or performing V3 D1 work; mutation routes return a conflict response. Secret setting values remain redacted by the host.


## Persistent Plugin Lifecycle

V3 persists lifecycle metadata in one exact key: `plugin_lifecycle:registry:v1`. The registry tracks installed/available state, desired state, effective state (`enabled | disabled | blocked`), plugin/API/QQAI compatibility, requested permissions and granted permissions.

The Host registers plugin definitions as candidates, while only lifecycle-enabled plugins are activated. `activate()` runs `onLoad`; `deactivate()` runs `onUnload`. Disabled or blocked plugins do not receive events or commands and are excluded from public status. Scheduled records are not prefix-scanned or deleted; when a due job belongs to an inactive plugin, the centralized scheduler advances it as an inactive skip rather than treating it as a plugin failure.

Requested capabilities remain the plugin manifest contract. Granted permissions are an additional runtime gate. Because Plugin API v1 does not yet declare optional permissions, an enabled plugin missing any requested capability becomes `blocked` until the grant is restored or the plugin is disabled.

Compatibility checks cover Plugin API v1 plus optional `minQQAI` and `maxQQAI` manifest bounds. Runtime activation failures are contained per plugin and persist as a blocked lifecycle record instead of crashing the V3 host.


Portal lifecycle management uses the same developer-authenticated manager. State and permission changes call `setPluginEnabled()` and `setPluginPermissions()` on the V3 runtime; the Portal does not mutate the lifecycle D1 row directly.


## Package Registry Foundation

Package installation metadata is intentionally separate from lifecycle state. The package lock uses one exact key, `plugin_packages:lock:v1`, and supports staged install/update/uninstall plus rollback metadata.

This foundation does **not** load arbitrary JavaScript. A package can only commit when its ID is present in the registry's `trustedCandidateIds`, meaning code for that candidate is already bundled/reviewed by the current Worker build.

A package descriptor includes plugin identity/version/API bounds, entry path, requested permissions, dependencies/optional dependencies, and mandatory `sha256:<hex>` artifact integrity. Staging verifies artifact bytes, Plugin API / QQAI compatibility, forward dependencies, and reverse dependency safety before any installed lock record changes.

Staged transactions expire after 15 minutes. Commit persists only descriptor/hash/verification metadata, never package bytes. Update/uninstall commits retain bounded rollback history. No install hooks are executed during validation or commit.


## Trusted Bundled Package Catalog

V3 now has a trusted bundled catalog separate from the generic package registry. Catalog entries point to plugin code already present in the current Worker build and carry a build-verified source SHA-256. CI re-hashes the declared source file and fails if the catalog hash is stale.

Portal package transactions may use `stageTrustedInstall()`, which accepts only IDs already present in `trustedCandidateIds` and requires the descriptor integrity to equal the build-verified source SHA-256. This path does not accept arbitrary third-party JavaScript.

The developer-only package API lives under `/api/portal/v3/packages` and manages only package metadata transactions. It does not start the V3 runtime, load JavaScript, or change lifecycle activation automatically.
