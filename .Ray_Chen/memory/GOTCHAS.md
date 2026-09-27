# GOTCHAS

## G-001 Raw structure leakage through report formatters
Risk: even secret-sanitized `JSON.stringify` can expose internal schema and oversized operational payloads.
Avoidance: expose named user-facing fields and concise state summaries only.

## G-002 Natural-language routing can desynchronize parser inputs
Risk: changing only normalized command text while parameter parsing still reads the original message can break routed commands.
Avoidance: synchronize routed command text into the existing parser view while preserving real OneBot quote/mention context.

## G-003 Model output must not become an execution primitive
Risk: arbitrary model-produced command/action text could bypass permissions.
Avoidance: fixed command allowlists plus existing handlers remain authoritative.

## G-004 Host filesystem safety cannot rely on prompts
Risk: a prompt saying “read only” does not technically prevent path traversal, symlink escape, deletion, or writeback outside the intended folders.
Avoidance: canonicalize locally, require read/edit allowlists, skip symlinks/sensitive paths, work in staging, validate every destination, and never propagate deletion.

## G-005 Public Codex needs atomic-ish quota behavior
Risk: checking quota separately from incrementing allows races and failed calls can consume user allowance unfairly.
Avoidance: reserve with D1 update/verification and refund failed bridge calls where possible; fail closed when quota storage is unavailable.

## G-006 Conversation continuity must survive bridge process restarts
Risk: a stable Worker session key alone does not resume a Codex CLI thread after the bridge restarts.
Avoidance: map session keys to Codex thread IDs in the dedicated bridge home and use `codex exec resume`; treat unexpected thread changes as an error.

## G-007 Context isolation is part of the safety/performance boundary
Risk: using the user's normal Codex home or copying project integration directories can silently load unrelated MCP/plugin/skill context and consume context window or expose capabilities.
Avoidance: dedicated `QQAI_CODEX_HOME`, excluded integration directories, and explicit on-demand-minimal policy.

## G-008 Large feature edits can leave duplicated source/test fragments
Risk: sequential automated replacements in a large file produced duplicated declarations (`const statusMsg`, `rawPlugin`, `statusStart`) that blocked CI before functional tests ran.
Avoidance: always treat syntax/CI failures as blockers, inspect exact failure lines, repair only the duplicated fragment, and rerun the full workflow through bundle success.
