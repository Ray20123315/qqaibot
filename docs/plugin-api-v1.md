# QQAI Plugin API v1

QQAI v3 treats plugins as first-class extensions. Official and third-party plugins use the same public API.

## Design rules

- Plugins never receive the raw Cloudflare Worker `env` object.
- Plugins declare capabilities in their manifest; privileged host services reject undeclared capabilities.
- Plugin storage is namespaced by plugin ID and uses exact-key access.
- Plugin API compatibility is versioned independently from QQAI application versions.
- Bundled plugins are the baseline runtime. A future sandboxed/dynamic runtime may implement the same API without changing plugin source.

## Manifest

Required fields: `id`, `name`, `version`, `apiVersion`.

`apiVersion` must currently be `1`.

Supported capabilities:

`message.read`, `message.send`, `media.read`, `media.send`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.tts`, `storage`, `scheduler`, `network`, `group.read`, `group.manage`, `member.read`, `member.manage`, `portal.route`.

## Lifecycle and events

Plugins may implement `onLoad`, `onMessage`, `onGroupMessage`, `onPrivateMessage`, `onNotice`, `onRequest`, `onReaction`, `onMemberJoin`, `onMemberLeave`, `onCron`, and `onUnload`.

## Commands

Plugins may expose commands with a canonical name, aliases, description, and async `run(ctx, input)` handler.

## Context

The host context exposes only capability-gated services. Initial API surface includes `reply`, `send`, `media.send`, `onebot.call`, `ai.chat`, `ai.vision`, `ai.tts`, `storage`, `scheduler.create`, and `network.fetch`.

The current v3 foundation intentionally does not load arbitrary JavaScript from D1 or remote URLs at runtime. Distribution layout and marketplace repository placement are deferred; the public Plugin API should remain independent from that choice.
