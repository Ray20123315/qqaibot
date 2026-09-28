# GOTCHAS

## Retained

All prior QQ Open, OpenID, Gateway, Portal, permissions, D1/Cron, Connected Builds and hybrid risks remain relevant.

## G-029 Dual-observation duplicates
Risk: QQ Open and OneBot can observe one human action.
Mitigation: explicit interactions are QQ Open-owned; mapped ordinary OneBot traffic becomes observation-only only after GROUP_MESSAGE_CREATE evidence.

## G-030 Interaction permission failure
Risk: enabling INTERACTION intent without permission can make Gateway Identify fail.
Mitigation: production remains at `33554432`; enable the extra bit only after permission confirmation.

## G-031 Group identifier domains differ
Risk: numeric OneBot group id and QQ group_openid are not interchangeable.
Mitigation: static mapping overrides; automatic mapping requires 3 unambiguous message evidence points and never infers user IDs.

## G-032 Active push authorization
Risk: official active group sends can fail if a group disabled bot active messages.
Mitigation: persist RECEIVE/REJECT state and use QQ Open active send only when allowed; otherwise OneBot fallback.

## G-033 Numeric mentions cannot be translated safely
Risk: OneBot payloads may contain numeric QQ mentions while QQ Open requires OpenID mention identities.
Mitigation: such sends remain on OneBot until explicit user linking exists.

## G-034 CodexWork export filesystem boundary
Risk: Cloudflare cannot read local Codex Bridge filesystem paths.
Mitigation: retain local/legacy upload helper or build an explicit bounded transfer channel.

## G-035 Auto-map false positive
Risk: identical short messages can occur in multiple groups.
Mitigation: generic text is rejected, ambiguous candidates are rejected, a short time window is used, media types are included, and 3 distinct official message IDs are required.

## G-036 Lifecycle ID contamination
Risk: member/friend OpenIDs could accidentally be inserted into legacy numeric QQ tables.
Mitigation: official lifecycle state is stored under dedicated QQ Open keys only.
