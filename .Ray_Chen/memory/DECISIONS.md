# DECISIONS

## Retained

D-001 through D-026 remain in force.

## D-027 Production V4 cutover
status: accepted
date: 2026-09-28
Decision: fast-forward production `main` to the verified V4 commit and deploy it to `qqai` while retaining OneBotHub for compatibility.

## D-028 Conservative variable pruning
status: accepted
date: 2026-09-28
Decision: remove only variables proven dead, empty with an equivalent fallback, or redundant. Preserve all secrets and resource bindings unless separately verified for deletion.

## D-029 Memory-only commits do not redeploy production
status: accepted
date: 2026-09-28
Decision: production Cloudflare Build trigger excludes `.Ray_Chen/**` to prevent memory checkpoint commits from causing needless production deployments.
