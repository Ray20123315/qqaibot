# CURRENT_STATE

## Repository State

- production branch: `main`
- production base observed at migration start: `523d2138ae413206eb8fe7aa85d45c5b8d7404c9`
- V4 development branch: `v4-qqopen-native`
- latest Phase 1 product commit: `685f6923bec7a010af8802ccd6e8ada3adc7242f`
- latest Phase 1 CI run: `36309169883` — success
- production runtime switch: not performed
- Cloudflare deployment: not changed
- QQ Open console configuration: not changed

## V4 Phase 1

Implemented:
- QQ Open WebSocket protocol payload/state helpers.
- QQ Open message-event to canonical-message normalization using OpenID values.
- QQ OpenAPI access-token caching and initial API wrappers.
- Command Registry with aliases, scopes, permissions, menu metadata, panel metadata, and automatic multi-panel paging.
- Initial 24-command compatibility catalog.
- V4 isolated verification and CI hook.

Not yet implemented:
- live persistent QQ Gateway client in Worker/Durable Object.
- platform action dispatcher replacing OneBot RPC calls.
- full legacy-command catalog migration.
- full moderation/member/media/join-request API coverage.
- live QQ Open end-to-end verification.

## Preserved Systems

Existing Codex Bridge EXE/security model, shared Codex conversation design, AI providers, plugin runtime, D1 data, Portal, quota/cooldown logic and current OneBot production path remain intact.

## Credential State

No QQ AppSecret or live access token is present in the repository or Ray_Chen memory. `.dev.vars.example` contains placeholders only.
