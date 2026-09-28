# DECISIONS

## Retained

D-001 through D-059 remain in force unless explicitly superseded below.

## D-060 User AI routing precedence
status: accepted
date: 2026-09-28
Decision: For normal chat without unsupported media, V4 attempts an eligible user-owned AI Provider first. A provider owned by the current user is eligible directly; a provider shared by another user requires group authorization and live membership proof. If no eligible user route succeeds, the platform-configured route and existing hybrid AI fallback remain available.

## D-061 Live membership is authoritative for shared AI
status: accepted
date: 2026-09-28
Decision: Stored sharedGroupIds only express sharing intent. The runtime must verify current group membership before use. If provider membership cannot be proven, shared-provider access is denied.

## D-062 Political guard applies to BYOK and platform AI
status: accepted
date: 2026-09-28
Decision: Political content policy is transport/provider independent. Text prefilter runs first, ambiguous cases use a lightweight Gemma classifier, and generated output is checked before persistence or send.
