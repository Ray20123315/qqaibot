# Ray_Chen Memory
version: v0.0.119
task_id: unsloth-multirole-routing-20261024
task_status: completed
goal_revision: 9
canonical_branch: main
verified_code_commit: dfc771c6e39e53fe316d75039fc834d0f2af87a4
updated_at: 2026-10-24

## Quick resume
- User asked to RETRY GitHub writes for Unsloth multi-model QQ router, after an earlier platform safety rejection. Normal GitHub create_file succeeded on existing feature/unsloth-multirole-routing-20261024 branch; no safety bypass was used.
- PR #96 merged to main dfc771c6e39e53fe316d75039fc834d0f2af87a4. New standalone-qq-ai/role-router.js with three roles (chat/asr/tts) and opt-in Unsloth web_search (not a model). Image understanding and image generation are explicitly EXCLUDED by latest user request.
- Worker routes fixed https://msiai.ray2025.com/v1, no arbitrary URLs or command/file/MCP tools. Ordinary Qwen chat disables tools, explicit search when enabled only permits web_search. QQ /search and /web commands are allowed while other command prefixes still refused. Admin audio speech/transcriptions API tests available; QQ rich media is NOT YET integrated/verified.
- New responsive dashboard model roles page; stores IDs + webSearch bool in dedicated CONFIG_KV model-roles-v3, keeps selected-model-v2 synchronized. API key stays solely in UNSLOTH_API_KEY Worker Secret.
- Isolated CI run 40087298832 SUCCESS and original QQAIBOT CI run 40087298901 SUCCESS after fixing 4 diagnostic-code backward compatibility regressions. Existing MODEL_* error codes remain unchanged.
- Cloudflare qqaibot-unsloth deployment 365a232a-ad3b-49ab-aecb-e150a3214c4c at 100%; source readback confirms role router/admin audio/QQ callback. All 4 Secret bindings, CONFIG_KV, original Qwen selected model and global_fetch_strictly_public preserved. Original production qqai untouched.
- Existing GitHub memory was v0.0.117 while prior verified local package v0.0.118 was not synchronized due earlier safety rejection. This version v0.0.119 supersedes v0.0.118 release handoff and records successful deployed version.
- Live authenticated browser/API E2E, web-search SSE against user's exact Unsloth version, ASR/TTS model calls and simultaneous VRAM residence are NOT VERIFIED. Search toggle defaults false, ASR and TTS IDs unset. Unsloth Studio Settings/API handles automatic model switch/unload, not Worker.
- NEXT: Owner opens https://qqbot-ai.ray2025.com/ -> 多模型路由, enters installed Qwen chat/ASR/TTS model IDs, enables web search if desired, saves and tests admin audio/search; checks QQ group @ replies.
