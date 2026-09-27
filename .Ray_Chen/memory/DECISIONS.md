# DECISIONS

## D-001 to D-011 — retained prior decisions

The prior accepted decisions remain in force: curated member-detail output; silent successful recall; AI selects registered commands while handlers execute them; sensitive parameters must be grounded; public/developer Codex surfaces are separate; public quota is per-user/per-Taipei-day; local host owns filesystem authorization; CodexWork context is isolated; deterministic diagnostics precede AI repair; direct Codex modes share a thread; Windows EXE wraps the existing bridge core.

## D-012 QQ Open Native V4
status: accepted
date: 2026-09-27
Decision: build a native QQ Open transport/action architecture instead of permanently translating QQ Open into fake OneBot semantics.

## D-013 Command Registry is the command source of truth
status: accepted
date: 2026-09-27
Decision: command aliases, scope, permission and QQ UI metadata converge in a registry that can drive text parsing, AI routing, help, custom menu and command panels.

## D-014 Preserve mature non-transport systems
status: accepted
date: 2026-09-27
Decision: retain Codex Bridge, AI providers, plugin runtime, D1/Portal data, quotas and cooldowns unless a concrete QQ-specific dependency requires an adapter.

## D-015 Feature branch before production cutover
status: accepted
date: 2026-09-27
Decision: develop V4 on `v4-qqopen-native`; keep `main` and production OneBot path unchanged until V4 migration gates and live QQ Open tests pass.
