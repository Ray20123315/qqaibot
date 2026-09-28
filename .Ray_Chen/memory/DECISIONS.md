# DECISIONS

## Retained

D-001 through D-045 remain in force unless explicitly superseded below.

## D-046 Isolated V4 public branch
status: accepted
date: 2026-09-28
Decision: All work for the public V4 effort occurs on `feature/v4-public-bot`, created from main commit `08ceeb725590d9efb0160ea38733d929e6e7d18c`. This task does not modify or merge to main.

## D-047 Capability-first transport
status: accepted
date: 2026-09-28
Decision: QQ Open is attempted first for every supported observation/moderation capability when runtime permission/API evidence says it is available. OneBot is fallback/supplement. UNKNOWN destructive outcomes must be resolved before fallback to prevent duplicate actions.

## D-048 Membership-bound AI Provider sharing
status: accepted
date: 2026-09-28
Decision: An AI Provider may share their configured AI only with groups where that provider is currently a member. Membership loss invalidates the authorization path.

## D-049 Dual BYOK onboarding
status: accepted
date: 2026-09-28
Decision: AI credentials support both authenticated one-time secure web entry and direct AIBot private-message entry. Both end in the same credential store; full keys are not redisplayed.

## D-050 Consent and whitelist are distinct
status: accepted
date: 2026-09-28
Decision: User consent evidence and developer group-whitelist override are separate states. Whitelisting does not fabricate user consent and is applied silently in the target group.

## D-051 Layered political block
status: accepted
date: 2026-09-28
Decision: Apply fast text prefilter first; uncertain cases go to a lightweight classifier; generated output is checked again before send.

## D-052 Plugin quarantine
status: accepted
date: 2026-09-28
Decision: User plugins are untrusted. Cross-tenant/global/system-risk behavior triggers forced termination, version quarantine and a dedicated security-review record/page.

## D-053 Source-available copyright
status: accepted
date: 2026-09-28
Decision: Use `Copyright © 2026 Ray Chen. All rights reserved.` and revise repository terms to deny use/deployment/modification/redistribution except rights necessarily granted by hosting-platform terms or explicit written permission.

## D-054 Same Worker preview
status: accepted
date: 2026-09-28
Decision: Development preview uses the existing Cloudflare `qqai` Worker preview/version mechanism and must not create another Worker.
