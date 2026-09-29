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
- `QQ_OPEN_INTENTS=100663296` for `GROUP_AND_C2C_EVENT (1 << 25) | INTERACTION (1 << 26)`; keyboard callbacks require the Interaction bit.

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

The production baseline is `QQ_OPEN_INTENTS=100663296` because inline-keyboard callbacks require `INTERACTION_CREATE`. If the QQ application lacks the Interaction event permission, the Gateway may close with 4014; enable the permission in the QQ developer console rather than removing the Interaction bit.


## Hybrid ownership

The production design intentionally keeps OneBot/NapCat.

QQ Open owns official interactive side effects. OneBot remains an auxiliary observation/capability source. Ownership is conservative:

- C2C OneBot messages are auxiliary when QQ Open is primary.
- Group messages that explicitly mention the bot are auxiliary because QQ Open receives the corresponding group-at event.
- Ordinary OneBot group messages remain on the legacy path until the mapped QQ Open group has actually emitted `GROUP_MESSAGE_CREATE`.
- Receipt of `GROUP_MESSAGE_CREATE` writes an official-full-group evidence key. After that, mapped OneBot group message events are observation-only.
- Explicit `QQ_HYBRID_GROUP_MAP` remains the authoritative override.
- If no explicit mapping exists, V4 may learn a D1-backed mapping conservatively by correlating short-window OneBot and QQ Open group observations. It requires at least 3 distinct official message ids for one unambiguous numeric-group candidate; generic short text, multi-group ambiguity and mapping conflicts are rejected.
- `GROUP_AT_MESSAGE_CREATE` can contribute mapping evidence, but ordinary OneBot group messages only become auxiliary after that official group has actually emitted `GROUP_MESSAGE_CREATE` and therefore demonstrated receive-all-message capability.

Auxiliary OneBot events continue to update structured observation/history data but stop before V3 plugin dispatch and the AI/application side-effect path.

## Active push ownership

`C2C_MSG_RECEIVE/REJECT` and `GROUP_MSG_RECEIVE/REJECT` update persistent active-push permission records.

Informational group schedules and active-speaking messages prefer QQ Open only when:
1. QQ Open is the hybrid primary;
2. the numeric group has an explicit or confirmed learned `group_openid` mapping;
3. the mapped group currently has official active-push permission;
4. the outgoing legacy message does not contain numeric QQ mentions.

Otherwise the existing OneBot send path remains the fallback.

## Interaction

`INTERACTION_CREATE` support is implemented and enabled in the production intent mask for keyboard callbacks; the QQ application must have the corresponding platform permission.

- types 11/12: ACK once, then decode known callback command and run the existing shared application runtime;
- type 13: record feedback;
- type 14: clear private session history; shared group history is not blindly deleted;
- type 16: map the model action through the existing model-preference logic;
- types 18/19/20: record authorization state/events;
- unknown/unmapped callbacks are acknowledged/recorded but are never guessed into commands.

The current default Intent is `100663296`, combining message and Interaction events so button callbacks can be ACKed. A 4014 close indicates the QQ application still needs the Interaction permission enabled in the developer console.


## Official lifecycle state

The existing `GROUP_AND_C2C_EVENT (1<<25)` baseline also normalizes lifecycle events without requiring the Interaction intent:

- `FRIEND_ADD` / `FRIEND_DEL`
- `GROUP_ADD_ROBOT` / `GROUP_DEL_ROBOT`
- `GROUP_MEMBER_ADD` / `GROUP_MEMBER_REMOVE`

Lifecycle records remain OpenID-native. They are stored separately from the legacy numeric QQ member tables so an OpenID is never mistaken for a QQ number. Gateway diagnostics expose lifecycle count/last event, while the Portal exposes lifecycle activity plus static/learned hybrid mapping counts.
