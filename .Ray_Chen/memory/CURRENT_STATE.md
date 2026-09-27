# CURRENT_STATE

## Production Baseline Before Full Runtime Bridge

- production Worker `qqai`: V4 deployed
- migration: `v4_qqopen_gateway`
- Durable Objects: `OneBotHub` and `QqOpenGateway`
- QQ Open Gateway: user confirmed READY and `!qqping` response
- QQ Open credentials: configured in production
- AI provider bindings: present
- Gemini / Vision / DeepSeek / Workers AI / D1 / Vectorize: present
- Codex Bridge binding/path: retained

## QQ Open Functional Boundary At Checkpoint

Working:
- Gateway connect/resume/heartbeat
- message normalization
- `!qqping`
- `!qqecho`
- Portal group management APIs
- QQ Open media/group-management API wrappers

Not yet bridged:
- ordinary AI conversation
- existing command monolith
- public `!codex`
- developer `!codexchat` / `!codexwork`
- V3/plugin runtime through QQ Open
- OneBot-style side effects redirected to QQ Open

## Identity Constraint

QQ Open member/user OpenIDs are opaque platform identifiers. They are not treated as numeric QQ IDs. Developer-only commands on QQ Open will require explicit `QQ_OPEN_DEVELOPER_OPENIDS` configuration or a later deliberate account-linking flow.
