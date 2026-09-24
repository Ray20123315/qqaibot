# QQAI v3 Message / Media Core v1

Status: foundation contract for `v3-rewrite`; not wired into production `worker.js` yet.

## Canonical message

Every inbound OneBot group/private message is normalized to schema version 1 with stable metadata and ordered `parts`.

Supported first-class part kinds:

- `text`
- `mention`
- `reply`
- `image`
- `audio`
- `video`
- `file`
- `face`
- `mface`
- `forward`
- `unknown`

`unknown` deliberately preserves unsupported OneBot segments so adapters do not silently discard new protocol features.

## Market faces

NapCat may receive QQ market faces as `image` segments carrying `emoji_id`, `emoji_package_id`, or `key`. The adapter normalizes these to canonical `mface` while retaining any media descriptor.

## Media references

Canonical media references preserve `file`, `fileId`, `url`, `path`, `name`, `mimeType`, `size`, and optional Base64. A local NapCat path is metadata only by default: the Cloudflare-safe renderer refuses to treat local paths as sendable sources.

Resolution planning currently defines:

- image / mface with remote URL or Base64 -> direct
- image / mface with only OneBot file handle -> `get_image`
- audio with remote URL or Base64 -> direct
- audio with only OneBot file handle -> `get_record` with MP3 output
- forward with id -> `get_forward_msg`
- file -> requires group/private file context before a download URL can be resolved
- video -> requires a URL or a later message-refresh resolver

## Outbound rendering

Canonical parts render to OneBot array segments. Array segments are the v3 primary transport representation; CQ-string rendering exists only as a compatibility adapter.

## Next step

Build the v3 host adapter that maps canonical messages and capability-gated services into Plugin API v1. Do not route production ingress through v3 until the host adapter and media resolver integration are verified end-to-end.
