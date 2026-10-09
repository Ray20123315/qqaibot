# Ray_Chen Canonical Memory
version: v0.0.91
task_id: qqaibot-ai-rebuild-20261010
task_status: active
goal_revision: 1
canonical_branch: feature/ai-assistant-rebuild-20261010
main_before: 13b915d1d4451d4cb15ff91f70a498cede760d40
bridge_backup_branch: archive/bbot-bridge-before-ai-20261010
original_legacy_backup: archive/legacy-main-20261009
updated_at: 2026-10-09T18:26:04.585Z

New user goal: lean AI assistant and optional cross-group relay plugin disabled by default. Cloudflare deployed qqai already has Secret binding names GEMINI_API_KEYS, GEMINI_VISION_API_KEYS, DEEPSEEK_API_KEY, CODEX_BRIDGE_ACCESS_TOKEN. New AI uses existing Gemini and DeepSeek API Secrets, NOT Cloudflare Workers AI binding. Read ACTIVE_TASK, CURRENT_STATE, USER_REQUIREMENTS, DECISIONS, GOTCHAS, VERIFY, FILE_MANIFEST before any further change.
