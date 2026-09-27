# GOTCHAS

## G-001 Raw structure leakage through report formatters

Risk: even when values are secret-sanitized, `JSON.stringify` of operational/live/stored objects exposes unnecessary internal schema and large payloads.

Avoidance: format only named user-facing fields and source availability/status summaries.

## G-002 Natural-language routing can desynchronize parser inputs

Risk: changing only `cleanMessage` leaves `parseArgs` reading the original `userMessage`, which can break parameterized commands.

Avoidance: when applying a routed command, synchronize the normalized command into the parser's command view while preserving actual quote context from the OneBot event.

## G-003 Model output must not become an execution primitive

Risk: allowing a classifier to emit arbitrary `!` text or OneBot actions could create a permission bypass.

Avoidance: use `AI_COMMAND_TOOL_COMMANDS` + `buildAiCommandToolCommand`; unknown intent returns empty and execution always returns to the existing handler.

## G-004 Interruption can leave delivery claims unverified

Risk: a tool action can complete even when its result message is interrupted.

Avoidance: recovery must read back GitHub/Gmail state before retrying. In this task the Gmail notification was verified in Sent, so it must not be resent.
