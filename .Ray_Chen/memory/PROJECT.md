# PROJECT
QQAIBOT, Cloudflare Worker qqai at aibot.ray2025.com, NapCat authenticated reverse OneBot WebSocket, D1, legacy QqOpenGateway Durable Object kept inert. Existing old feature-bloated cross-group bridge rebuilt as lean AI assistant core with per-group opt-in bridge plugin.

Canonical archives:
- archive/bbot-bridge-before-ai-20261010 at 13b915d1d4451d4cb15ff91f70a498cede760d40
- archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629

No account secrets in repository. Preserve known protected QQ identities 3569028262 and 2681167798.

## 2026-10-24 independent Unsloth QQ worker
Separate `standalone-qq-ai/` Cloudflare Worker `qqaibot-unsloth`, with custom domain `qqbot-ai.ray2025.com`, serves a QQ official signed Webhook + minimal admin chat; no DO, D1, R2, shell, arbitrary proxy or shared QQ bot callback. Original root `qqai` stays untouched.
