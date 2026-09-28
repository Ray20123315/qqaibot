# CURRENT_STATE

## Branch Isolation

Development branch: `feature/v4-public-bot`
Base main commit: `08ceeb725590d9efb0160ea38733d929e6e7d18c`
Main modification by this task: none.

## Existing V4 Foundation

Existing repository already contains:
- `src/v4/qqopen/*`
- `src/v4/hybrid/ownership.js`
- `src/v4/portal/*`
- QQ Open group/C2C send, deletion, group info/member, member removal, blacklist, join-request and restrict-chat API wrappers
- OneBot/QQ Open hybrid mapping and duplicate-side-effect protections
- V4 verification scripts

## New Product Direction

- QQ Open becomes capability-first for both observation and moderation where permission/API support exists.
- OneBot remains the automatic fallback and full-visibility supplement.
- AI access is split between platform-limited quota and user-owned provider credentials.
- AI Provider sharing is membership-bound to groups where the provider is currently a member.
- User settings must be available from the authenticated web backend and AIBot private messages.
- Normal UI must expose human concepts only; raw internals belong only in developer diagnostics.
- Plugin execution must be tenant-isolated with forced termination/quarantine on global-risk behavior.
- Legal consent and developer whitelist override are separate auditable states.
- Political filtering starts with text rules before classifier escalation.

## Cloudflare Constraint

Use the existing `qqai` Worker preview/version mechanism. Do not create another Worker and do not mutate production D1/KV/DO during preview tests.

## Verification State

Task bootstrap verified.
Product implementation: not started in this task yet.
