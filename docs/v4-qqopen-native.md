# QQAIBOT V4 — QQ Open Native

## Status

Phase 1 foundation is isolated on `v4-qqopen-native`. Production `main` still uses the existing OneBot/NapCat path.

## Design

```text
QQ Open WebSocket -> Event Normalizer -> Canonical Message -> QQAIBOT Core
QQAIBOT Core -> Command Registry -> Action Layer -> QQ OpenAPI
Command Registry -> text commands / AI routing / QQ menu / QQ command panels
```

## Phase 1 modules

- `src/v4/qqopen/gateway.js`: Identify, Heartbeat, Resume and gateway state helpers.
- `src/v4/qqopen/events.js`: QQ Open message events to canonical messages using OpenID identities.
- `src/v4/qqopen/api.js`: access-token cache and initial QQ OpenAPI methods.
- `src/v4/commands/registry.js`: single-source command definitions, resolution, menus and paged panels.
- `src/v4/commands/catalog.js`: first compatibility catalog for existing QQAIBOT commands.
- `verify-v4-qqopen.mjs`: isolated regression coverage.

## Migration rules

1. Keep Codex Bridge, AI providers, plugins, D1 data and Portal unless a QQ-specific dependency requires an adapter.
2. Do not translate OpenID into fake numeric QQ IDs.
3. Backend permissions remain authoritative even when QQ panel items use `only_admin`.
4. Keep OneBot production path available until QQ Open receive/send/permissions/moderation pass end-to-end tests.
5. Never commit AppSecret. Production credentials belong in Cloudflare Secrets.

## Next phase

Implement the persistent QQ Gateway runtime and its Worker/Durable Object lifecycle, then introduce a platform action dispatcher so existing handlers can migrate incrementally from OneBot actions to native QQ OpenAPI.
