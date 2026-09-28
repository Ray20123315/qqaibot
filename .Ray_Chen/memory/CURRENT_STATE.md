# CURRENT_STATE

## Latest Verified Product

Commit: `5def3958512fcd45a5219be83a0b77cfe454061d`
GitHub Actions run: `36403470105`
Conclusion: `success`

## QQ Open Personal Persistence

The following V4 personal data now uses the canonical user's own Storage Connector and does not silently fall back to platform D1:

- private chat history — `chat_history`
- model preference — `settings`
- personal style — `settings`
- do-not-disturb state — `settings`
- manual long-term memories — `memory`

QQ Open manual memories are not inserted into platform Vectorize. Runtime prompt injection reads those memories from the user's own connector. QQ Open DND and personal-style runtime reads use the same user-owned setting path.

OneBot keeps the previous platform persistence path for legacy compatibility.

## Preview Preflight

Attempted to create `qqaibot-v4-public-preview` through the Cloudflare API. Creation failed with code 7406 because the account already has 10 D1 databases.

Read-back inventory confirms:
- no `qqaibot-v4-public-preview` exists;
- production `qqaibot` remains UUID `569a01fe-3297-40e1-832f-09c3793056ed`;
- none of the ten existing D1 databases was changed.

## Production

No production Cloudflare Worker, D1, KV, Vectorize or Durable Object resource was modified by this transaction.
