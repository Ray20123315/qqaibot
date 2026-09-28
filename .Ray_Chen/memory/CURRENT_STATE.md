# CURRENT_STATE

## Latest Verified Product

Commit: `38b5cbac605e8add9c25e28a8375dea3d6052bb5`
GitHub Actions: `36387088840` success.

## QQ Open User Content Persistence

Private:
- canonical QQ Open/portal principal is resolved explicitly;
- `chat_history` reads and writes use `User Persistence`;
- no connector means no durable history, not platform-D1 fallback.

Group:
- platform conversation history is disabled for QQ Open;
- `recent_logs`, per-message D1 snapshots and Vectorize conversational archiving are skipped on QQ Open path;
- group durable context remains disabled until an explicit group storage-owner/connector relationship exists.

Legacy cleanup:
- QQ Open clear-session removes user-storage chat history if configured;
- old platform-D1 private history is deleted for backwards privacy cleanup.

OneBot:
- existing persistence behavior remains unchanged by this transaction.

## Verification

Passed base regression, V3, V4 including `verify-v4-user-persistence-routing.mjs`, V4 test dry-run and Worker bundle.

## Production

No production Cloudflare resource was changed. main remains untouched by this task.
