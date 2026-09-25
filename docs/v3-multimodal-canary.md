# QQAI v3 Multimodal Canary Gate

Status: implemented on `v3-rewrite`; default off; no production deployment has been performed.

The canary is the first ingress gate that can run the complete v3 canonical-message → media-resolver → multimodal-AI chain against real OneBot traffic without globally replacing the v2 reply path.

## Safety gates

All of the following are required before a message is eligible:

- `V3_MULTIMODAL_CANARY_ENABLED=true`
- the message is a group message
- the group ID is explicitly listed in `V3_MULTIMODAL_CANARY_GROUPS`
- if `V3_MULTIMODAL_CANARY_USERS` is non-empty, the sender is explicitly listed there
- the sender is not the bot itself
- the message explicitly mentions the bot
- the canonical message contains at least one of: image, audio, mface, video, file, forward

A native QQ `face` remains useful semantic context but does not trigger the media canary by itself.

## Modes

`V3_MULTIMODAL_CANARY_MODE=observe` is the default. Eligible traffic runs the v3 multimodal path and writes a diagnostic audit, but the result is not sent and v2 continues normally.

`V3_MULTIMODAL_CANARY_MODE=reply` sends the v3 response and returns `handled=true`; only then does the ingress wrapper skip the legacy v2 handler for that message.

If media resolution, model execution, audit, or the v3 canary itself fails, the gate returns `handled=false` and the v2 path remains the fallback.

## Diagnostics

Audit records include only routing metadata, canonical part kinds, model name, compile issue codes, and failure stage/code. They intentionally exclude message text, URLs, Base64 data, NapCat local paths, market-face keys, emoji IDs, and package IDs.

## Current production boundary

The code exists only on `v3-rewrite`. The flags are not enabled in production and this work does not deploy or change the current `main` Worker.