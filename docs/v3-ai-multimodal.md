# QQAI v3 AI Multimodal Bridge

Status: implemented on `v3-rewrite`; not cut over to production ingress.

The bridge converts QQAI canonical messages into Gemini `generateContent` parts only after media resolution succeeds.

## Supported canonical input

- `text`: preserved as text.
- `mention` / `reply`: preserved as lightweight semantic text.
- `face`: preserved as semantic text such as `QQ內建表情 face_id=...`; it is not treated as an image.
- `image`: resolved to bounded bytes and emitted as `inlineData`.
- `mface`: preserves the QQ market-face summary/identity semantics and, when resolvable, also emits the image bytes as `inlineData`.
- `audio`: resolved through the Media Resolver and emitted as audio `inlineData`; OneBot `get_record` refresh requests MP3.
- `video`: emitted as video `inlineData` when the request budget permits.
- supported files such as PDF/text: emitted as `inlineData` only when the MIME type is model-supported.
- `forward`: expanded into bounded canonical nodes and compiled in sender order.

## Failure stages

The compiler distinguishes media/compile failures from model-provider failures. Non-strict compilation can keep the rest of a message usable while recording structured issues for failed media. Strict mode rejects the request when a required media part cannot be resolved.

## Request budget

The bridge enforces a separate total inline-media budget in addition to the per-file Media Resolver limits. This prevents multiple individually valid media parts from producing an oversized Gemini request.

## Plugin boundary

Plugin API v1 adds `ai.multimodal`. `ctx.ai.multimodal(input)` requires both `ai.multimodal` and `media.read`, so an AI capability cannot bypass media visibility permissions. The Host passes only the current canonical message into the multimodal service.

The current multimodal runtime reuses the configured Gemini vision key/model pool when inline media is present. No API key is exposed to plugins.

## Production boundary

This bridge is not yet connected to the v2 production AI reply path. Cutover requires shadow/diagnostic evidence from real QQ image/audio/mface traffic first.