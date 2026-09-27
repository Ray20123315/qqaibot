# DECISIONS

## Retained decisions

D-001 through D-018 remain accepted, including execution/permission safety, Codex bridge restrictions, QQ Open Native V4, Command Registry as the source of truth, preservation of mature systems, feature-branch-first migration, conservative intents, and persistent Gateway resume state.

## D-019 Lean Portal becomes the V4 control surface
status: accepted
date: 2026-09-27
Decision: the primary Portal is reduced to six areas — Overview, QQ Open, Group Management, AI/Codex, Plugins, System — with legacy surfaces hidden from normal navigation.

## D-020 Prune product surface before physical data deletion
status: accepted
date: 2026-09-27
Decision: retire nonessential V4 features from navigation/registry immediately, but keep historical data/code as rollback material until live QQ Open verification proves replacements. A later second pruning pass may physically remove dead modules.

## D-021 Direct Codex is principal-scoped
status: accepted
date: 2026-09-27
Decision: direct `!codex`, `!codexchat`, and `!codexwork` share one session per stable principal instead of splitting by group/private scope. Plugin-internal Codex remains isolated.

## D-022 Rich media is a native QQ Open capability
status: accepted
date: 2026-09-27
Decision: V4 treats image/video/audio/file as supported native rich media. Sending uses the QQ upload flow to obtain `file_info`, then sends a `msg_type=7` message.
