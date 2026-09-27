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

Deploy the V4 branch with QQ Open credentials as Cloudflare variables/secrets and run the live `!qqping` / `!qqecho` connectivity probe. After that succeeds, migrate normal command/AI reply handlers onto the Action Dispatcher before expanding moderation/member/media actions.

## Connectivity probe

Phase 2 adds a persistent `QqOpenGateway` Durable Object and a minimal QQ Open Action Dispatcher.

Configuration remains disabled by default:

- `QQ_OPEN_ENABLED=true`
- `QQ_OPEN_APP_ID=<app id>`
- `QQ_OPEN_CLIENT_SECRET=<Cloudflare Secret>`
- `QQ_OPEN_INTENTS=33554432` for the documented `GROUP_AND_C2C_EVENT (1 << 25)` baseline.

The existing minute cron calls the gateway `ensure` endpoint when enabled and configured. Gateway `session_id` and `seq` are persisted in Durable Object storage so a recreated instance can attempt Resume.

System-admin-only diagnostics:

- `GET /api/v4/qqopen/status`
- `POST /api/v4/qqopen/connect`
- `POST /api/v4/qqopen/disconnect`

For the first live end-to-end test, send `!qqping` in C2C or `@机器人 !qqping` in a group. A successful receive/send path replies `QQ Open V4 已连接并可回话。`. `!qqecho 内容` provides a second passive-reply test.

These probe replies are deliberately isolated from legacy AI/command execution. Once the Gateway receive/reply path is proven against the real QQ application, normal commands and AI handlers can migrate behind the same Action Dispatcher.
