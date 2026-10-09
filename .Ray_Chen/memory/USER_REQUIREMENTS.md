# USER_REQUIREMENTS
- Change product from noisy cross-group bridge to lean AI assistant; keep optional bridge plugin default disabled.
- Avoid giant plugin/skill loading and spontaneous chat; only respond to intentional @Bot, reply to Bot or !ai; group histories isolated.
- Reuse existing model API Secrets already present; user specifically objected to making up new Workers AI binding/asking for API key. Confirmed GEMINI_API_KEYS and DEEPSEEK_API_KEY exist in Cloudflare qqai settings. Gemini primary, DeepSeek explicit option.
- Preserve old app code, D1 records, original backups, protected QQ identities.
- Rebuild clean commands, no legacy QQ slash keyboard dependency, account and usage guardrails.
