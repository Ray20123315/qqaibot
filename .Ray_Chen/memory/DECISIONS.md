# DECISIONS

## D-001 Curated member-detail output
status: accepted
date: 2026-09-27
Decision: retain underlying collection for functionality/audit, but expose curated fields and source-state summaries rather than raw OneBot/D1 objects.

## D-002 Silent successful recall
status: accepted
date: 2026-09-27
Decision: keep recall errors visible, but successful administrator `!撤回` sends no additional success chat message.

## D-003 AI selects commands, handlers execute them
status: accepted
date: 2026-09-27
Decision: AI routing selects only from an allowlist and returns to the normal command path; existing permission and confirmation checks remain the executor boundary.

## D-004 Ground sensitive parameters
status: accepted
date: 2026-09-27
Decision: sensitive target parameters must be grounded in the actual user message/mentions/quote context.

## D-005 Split public and developer Codex surfaces
status: accepted
date: 2026-09-27
Decision: public `!codex` is quota-bound, fixed to GPT-6 Luna and reasoning `none`; developer-only advanced controls move to `!codexchat`; local filesystem work is developer-only via `!codexwork`.

## D-006 Public quota is per user and per Taipei day
status: accepted
date: 2026-09-27
Decision: use D1-backed counters with a deployment-configurable default of 5 requests/day/user. Reserve before invocation and refund failed bridge calls where possible.

## D-007 Filesystem authority lives on the local host
status: accepted
date: 2026-09-27
Decision: Worker-supplied work metadata and model prompts are not sufficient authorization. The local bridge independently canonicalizes roots, excludes sensitive/symlink paths, snapshots into staging, validates every write destination against edit roots, and never applies deletions.

## D-008 Isolate CodexWork context and integrations
status: accepted
date: 2026-09-27
Decision: use a dedicated `QQAI_CODEX_HOME`, do not copy `.codex`/`.agents`/`node_modules` or sensitive credential files into the work snapshot, and instruct Codex to use only necessary/on-demand context rather than loading unrelated integrations.

## D-009 Deterministic diagnostics before AI repair
status: accepted
date: 2026-09-27
Decision: Portal self-check and safe repair are deterministic/no-AI. Repair is limited to reversible runtime housekeeping such as socket restoration and queue scheduler kick; it does not modify user computer files.

## D-010 One direct Codex thread across capability modes
status: accepted
date: 2026-09-27
Decision: for the same QQ user and direct chat scope, `!codex`, `!codexchat`, and `!codexwork` use one session key. Command mode changes capabilities/policy, not conversation identity. Plugin/suffix routes use the same principle while retaining plugin isolation.

## D-011 Windows EXE wraps the existing bridge core
status: accepted
date: 2026-09-27
Decision: the Windows executable is a packaging/config/startup layer around `tools/codex-work-bridge.mjs`. Filesystem allowlists, staging, export, and no-delete enforcement remain single-owned by the existing bridge core. Local config lives under `%APPDATA%\QQAIBOT` by default and Task Scheduler is used for logon startup.
