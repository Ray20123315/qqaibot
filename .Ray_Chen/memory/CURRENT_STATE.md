# CURRENT_STATE

## Latest Verified Product

Commit: `820779518c8bf60bcc541182249f651101632080`
GitHub Actions run: `36387904014`
Conclusion: success.

## QQ Open Individual Settings

Model preference is now a user-content setting:
- QQ Open reads it from user Storage Connector `settings`;
- QQ Open writes it only to user Storage Connector;
- official interaction switch-model uses the same storage path;
- missing connector returns USER_STORAGE_REQUIRED/non-durable behavior;
- OneBot retains the old platform DB behavior for compatibility.

## Cloudflare Preview Discovery

Read-only Cloudflare inventory shows:
- production D1 `qqaibot`: `569a01fe-3297-40e1-832f-09c3793056ed`;
- no existing `qqaibot-v4-public-preview` database;
- production Vectorize indexes include `qqai` and `qq-ai`;
- Worker scripts include `qqai`, `qqai-v3test`, `qqai-v4test`.

Cloudflare documentation confirms Workers Previews use the same Worker, require a `previews` block, isolate Durable Objects automatically, and require D1/Vectorize bindings to point at Preview-safe resources.

## Production

No production Cloudflare resource was changed yet.
