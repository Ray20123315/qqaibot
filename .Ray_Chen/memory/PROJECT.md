# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product revision: `d0b4a610c68a4736abdc5f71f8e35a4e82b45b4a`
- Worker: `qqai`
- Cloudflare Connected Build: `005556b2-9747-4bb4-852c-e3157e5c7069`
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
