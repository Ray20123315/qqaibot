# CURRENT_STATE

## Repository State

- production branch: `main`
- V4 branch: `v4-qqopen-native`
- latest verified V4 product commit: `1f12968a00db01518ef33abd7b7df4977b43e676`
- latest verified CI run: `36310767685` — success
- production main switch: not performed
- Cloudflare deployment/config: not changed
- QQ Open console configuration: not changed

## Phase 2 Connectivity State

Implemented:
- persistent QQ Open Gateway Durable Object with AccessToken + outbound WebSocket.
- Identify/Heartbeat/ACK/READY/Resume/Reconnect/Invalid Session handling.
- persisted `session_id` / `seq`.
- connection timeout and exponential-ish reconnect backoff capped at 60s.
- native group/C2C passive message reply Action Dispatcher.
- `!qqping` and `!qqecho` E2E probes.
- System Admin status/connect/disconnect endpoints.
- developer `!status` QQ Open diagnostics.
- Wrangler binding/migration and CI coverage.

Not yet verified live:
- actual Gateway READY against the user's QQ application.
- real C2C/group receive and native reply.
- full command/AI routing through QQ Open.
- moderation/member/media/join request actions.

## Preserved Systems

Codex Bridge EXE/security model, shared Codex conversations, AI providers, plugins, D1/Portal data, quotas/cooldowns, and OneBot production path remain intact.

## Credential State

No QQ AppSecret or live access token is stored in GitHub or Ray_Chen memory. Production should use Cloudflare Secrets for `QQ_OPEN_CLIENT_SECRET`.
