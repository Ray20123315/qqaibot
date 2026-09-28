# CURRENT_STATE

## Branch

Development branch: `feature/v4-public-bot`
Base main commit: `08ceeb725590d9efb0160ea38733d929e6e7d18c`
Verified foundation commit: `21e5a8f00daeb7e465ca927c6f1d6acfadfe1259`
Current product commit: `678d6a1d1eb21637fb8c542d90da54c590bce6d0`
Main modified by this task: no.

## Produced Resource Integration

### AI / credential onboarding
- Authenticated web flow uses existing `qqai_session`.
- One-time resource ticket expires and is single-use.
- QQ DM can create a secure ticket or submit an AI key directly.
- Full AI secrets are encrypted in existing Provider Registry and never redisplayed.

### User-owned persistence
- New Storage Connector types: `cloudflare_d1`, `cloudflare_kv`.
- Connector stores owner principal, Cloudflare account/resource IDs, purposes and encrypted API token.
- Supported low-volume internal get/put/delete operations are tenant-namespaced.
- D1 uses the Cloudflare D1 query REST endpoint and a dedicated `qqaibot_kv` table in the user's database.
- KV uses current `/storage/kv/namespaces/` API routes.
- No additional platform D1/KV binding/resource was created.

### Identity / QQ private flow
- QQ Open principal format: `qqopen:<openid>`.
- Portal principal format: `qq:<number>`.
- A QQ-DM secure ticket can be claimed only from an authenticated portal session; that claim creates the explicit identity link.
- Direct QQ-DM credential commands resolve an existing explicit link, otherwise remain scoped to the QQ Open principal.
- QQ private settings are intercepted before `sendApplicationReplies`, preventing credential commands from first entering the general chat bridge.

### Portal
- Added `/connect-resource?ticket=...` human-readable secure page.
- Added authenticated `/api/portal/v4/resources/*` API.
- Secure page uses custom choice buttons, not native select, and does not place secrets/tickets in browser local/session storage.

## Verification

Current product CI: pending.
Production Cloudflare resources: unchanged.
