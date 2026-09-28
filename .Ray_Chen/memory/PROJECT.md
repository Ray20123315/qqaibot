# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `df7958e9e99be0d5724dc4fd24a39da616e1befd`
- Worker: `qqai`
- Cloudflare Connected Build: `9070f843-d627-4d69-8c03-d3e8c6f751b9`
- outcome: `success`
- Hybrid primary: `qq-open`

## Discovery Model

- C2C global custom menu: ordinary public commands.
- Developer C2C specific panels: every C2C-capable command across all permission classes.
- Group panels: every enabled group-scoped command, categorized by function.
- QQ group panel targeting is by group, not by user; per-user Developer-only group visibility is not representable.
- `only_admin` is used where QQ can represent native group-admin restrictions.
- Runtime authorization remains mandatory for owner/developer/program permissions.

## Permission Principle

Permission discovery is cumulative. Higher privilege adds commands and never removes lower-level commands. Developer is the top level and is authorized by runtime checks, not merely by panel visibility.

## Safety

- Never store secrets in Git or memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.

## Public V4 Resource Model

- Shared platform infrastructure stays central, while user-owned AI/storage resources are modeled as explicit per-principal resources.
- User AI provider accounts may be private or shared to explicit groups, with live membership checks where required.
- Same-Worker Preview uses a dedicated D1 table namespace; production must never inherit the Preview table override.
- Runtime authorization, tenant ownership and storage ownership remain security boundaries.
