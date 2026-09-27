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


## Official protocol hardening

The production V4 runtime now treats QQ Open delivery semantics as authoritative:

- Prefer `/gateway/bot` metadata and keep the configured shard explicit.
- Persist Session + seq for Resume; validate heartbeat ACK health.
- Apply close-code-specific Identify/Resume/fatal behavior.
- Deduplicate by event type + message id + message sequence/index.
- Allocate passive reply `msg_seq` centrally, including intermediate/thinking messages.
- Enforce passive reply budgets: group 5 replies within 5 minutes; C2C 4 replies within 60 minutes.
- Upload rich media before sending `msg_type=7`; do not share upload handles across group/C2C.
- Normalize WAV voice URLs, ASR hint text, ARK cards and quoted message elements.
- Support both group and C2C recall for bot messages.
- `!qqid` works only in C2C for OpenID diagnostics.
- Optional `QQ_OPEN_DISCOVERY_SYNC=true` synchronizes the V4 global menu and C2C/group command panels after READY/RESUMED.

The production baseline remains `QQ_OPEN_INTENTS=33554432`. Additional event intents are only enabled after the QQ application is confirmed to have those permissions.
