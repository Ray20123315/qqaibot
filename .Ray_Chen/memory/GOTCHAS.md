# GOTCHAS
- Original EXE connects wss://aibot.ray2025.com/v3/codex-bridge with Authorization Bearer Token, protocol qqai-codex-bridge-v1. New Worker must never treat Codex frames as NapCat OneBot events.
- Windows EXE stays connected, but codex exec is started per request. Requested model gpt-6-luna may not be available in installed Codex CLI; live compatibility must be confirmed.
- QQ official API replies include incoming msg_id; old implementation sliced answer at 1800, now send must reject too-long text not silently cut.
- Bbot numeric QQ group differs from Abot opaque group_openid. Never infer mapping.
- Vectorize qqai index dimensions=1024. Existing VECTORIZE_GEMINI_KEYS supports embedding API, no cross-group retrieval; avoid storing Secrets.
- Memory only group admin opt-in. On source recall remove D1 and vector, expire records on cron, suppress politics and attachments.
