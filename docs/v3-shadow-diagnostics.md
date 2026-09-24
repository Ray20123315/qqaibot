# QQAI v3 Shadow Diagnostics

Shadow diagnostics mirror real OneBot events into the v3 canonical message and Plugin Host path without replacing v2 behavior.

## Safety model

- Disabled by default (`V3_SHADOW_ENABLED=false`).
- The diagnostic plugin is read-only and only declares `message.read` + `media.read`.
- The shadow Host uses deny stubs for D1 writes, OneBot calls, network, AI, TTS, and scheduler operations.
- No shadow path sends messages or mutates plugin storage.
- Diagnostic logs contain metadata only: event name, canonical part kinds/counts, IDs, and booleans. They do not log message text, URLs, Base64, local NapCat paths, or mface keys.
- Media messages may be sampled at 100% while ordinary text messages use deterministic sampling.

## Flags

- `V3_SHADOW_ENABLED`: opt in; defaults to false.
- `V3_SHADOW_SAMPLE_RATE`: deterministic ordinary-event sampling, defaults to `0.02`.
- `V3_SHADOW_CAPTURE_ALL_MEDIA`: capture every media-bearing message while enabled, defaults to true.

## Legacy bridge

During the v3 migration, `src/games/werewolf.js` is a tiny compatibility wrapper around `werewolf-legacy.js`. The wrapper invokes the shadow observer before delegating to the unchanged v2 Werewolf event handler. This is deliberately temporary: it avoids rewriting the large `worker.js` merely to insert one diagnostic hook. When OneBotHub is extracted into the v3 ingress layer, the bridge must move there and the original Werewolf module path can be restored.

Because the flag defaults off, existing v2 behavior is unchanged unless shadow diagnostics are explicitly enabled.
