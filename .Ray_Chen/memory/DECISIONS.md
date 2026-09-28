# DECISIONS

## Retained

D-001 through D-054 remain in force unless explicitly superseded below.

## D-055 User-owned persistence connectors
status: accepted
date: 2026-09-28
Decision: V4 supports user-owned persistence in addition to BYOK AI. Initial connector types are Cloudflare D1 and KV. Connector credentials are encrypted and owned by a single canonical user principal. Internal data keys are tenant-namespaced. The platform does not create a separate Cloudflare Worker or extra shared storage product for this feature.

## D-056 Explicit QQ OpenID -> Portal account linking
status: accepted
date: 2026-09-28
Decision: QQ OpenID and numeric QQ identity are never assumed equivalent. A QQ-DM one-time resource ticket may be claimed by an authenticated Portal session; successful possession of both sides creates the explicit link used by future private resource operations.

## D-057 Credential interception before chat bridge
status: accepted
date: 2026-09-28
Decision: QQ private resource-setting commands must be handled in QqOpenGateway before the general application/chat bridge so raw keys/tokens are not first inserted into ordinary chat history or AI prompts.

## D-058 Low-volume Cloudflare REST persistence
status: accepted
date: 2026-09-28
Decision: Because expected per-user storage volume is low, D1/KV connectors initially use Cloudflare REST APIs. If sustained request volume becomes material, migrate storage access to a dedicated higher-throughput proxy/binding architecture.
