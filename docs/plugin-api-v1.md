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
- Raw `onebot.call` is capability-gated and additionally restricted by the host action allowlist.

## Manifest

Required fields: `id`, `name`, `version`, `apiVersion`.

`apiVersion` must currently be `1`.

Supported capabilities:

`message.read`, `message.send`, `media.read`, `media.send`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.tts`, `storage`, `scheduler`, `network`, `group.read`, `group.manage`, `member.read`, `member.manage`, `portal.route`.

## Lifecycle and events

Plugins may implement `onLoad`, `onMessage`, `onGroupMessage`, `onPrivateMessage`, `onNotice`, `onRequest`, `onReaction`, `onMemberJoin`, `onMemberLeave`, `onCron`, and `onUnload`.

Message hooks receive the QQAI canonical message rather than the raw OneBot body. This keeps protocol-specific fields and transport secrets inside the host adapter.

## Commands

Plugins may expose commands with a canonical name, aliases, description, and async `run(ctx, input)` handler.

## Context

The host context exposes only capability-gated services. Initial API surface includes `reply`, `send`, `media.send`, `media.resolve`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.tts`, `storage`, `scheduler.create`, and `network.fetch`.

`ctx.media.resolve(index)` requires `media.read` and can only resolve a media/forward part from the current canonical message. Plugins cannot submit an arbitrary URL or file token to this service. The host performs bounded media resolution through QQAI's OneBot refresh and SSRF-safe download pipeline.

The v3 host adapter currently provides message send/reply, media send/resolve, namespaced D1 storage, safe-network fetch, AI chat/vision, and an allowlisted raw OneBot bridge. TTS and scheduler services are only exposed when the host supplies an implementation, so unavailable features fail explicitly instead of silently degrading.

The current v3 foundation intentionally does not load arbitrary JavaScript from D1 or remote URLs at runtime. Distribution layout and marketplace repository placement are deferred; the public Plugin API should remain independent from that choice.
