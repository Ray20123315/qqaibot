# QQAI v3 Host Adapter

Status: implemented on `v3-rewrite`, not connected to production ingress.

The host adapter is the security boundary between Plugin API v1 and existing QQAI internals.

## Responsibilities

- Normalize OneBot message events through Message / Media Core v1 before dispatch.
- Build Plugin Runtime contexts without exposing raw Worker `env` or credentials.
- Map plugin storage to exact-key D1 operations.
- Render canonical outbound messages to OneBot array segments.
- Enforce `media.send` independently from `message.send`.
- Expose a read/probe-only raw OneBot allowlist by default.
- Route plugin network access through QQAI's public-URL / SSRF protection.
- Route plugin AI chat and vision through existing model pools without revealing API keys.

## Default raw OneBot allowlist

The initial allowlist contains login/status/version probes, message/media retrieval, image/record capability probes, group/member reads, forward retrieval, and OCR. Destructive actions such as kick, mute, admin changes, raw sends, and credential APIs are denied even when a plugin declares `onebot.call`.

Dedicated high-risk capabilities should be added later instead of expanding raw access.

## Media visibility

`message.read` allows a plugin to observe canonical message structure. `media.read` additionally exposes media transport references. Without `media.read`, file handles, URLs, local paths, Base64 payloads, market-face identifiers, and similar transport data are redacted while safe metadata such as type/name/MIME/size may remain.

## Current integration boundary

The adapter can be instantiated and tested, but `worker.js` does not route production events through it yet. The next integration step should add a v3-only shadow/diagnostic path before any user-facing cutover.
