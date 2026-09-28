# DECISIONS

## Retained

D-001 through D-066 remain in force.

## D-067 QQ Open private persistence is BYO-storage only
status: accepted
date: 2026-09-28
Decision: QQ Open private chat history may be persisted only through the canonical user's Storage Connector with chat_history purpose. Absence of a connector means no durable chat history and no platform-D1 fallback.

## D-068 QQ Open group content is non-durable until group storage ownership exists
status: accepted
date: 2026-09-28
Decision: QQ Open group conversation content is not persisted into platform chat history, recent_logs, per-message snapshots or Vectorize. Long-term group storage remains disabled until QQAIBOT has an explicit group storage-owner/connector authorization model.
