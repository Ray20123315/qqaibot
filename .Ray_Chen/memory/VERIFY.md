# VERIFY
- GitHub Actions workflow .github/workflows/bridge-check.yml runs npm test (node --test tests/*.test.mjs) and Wrangler deploy --dry-run, archives canonical .Ray_Chen/memory.
- New tests/assistant.test.mjs verify cloud Secret name presence, Gemini HTTP x-goog-api-key header with no key in URL, DeepSeek only when explicit, quiet unmentioned QQ, !help local, !ai model response and duplicate suppression, unauthorized plugin switch.
- Updated tests/command-routing.test.mjs, tests/hub-generation.test.mjs, tests/abot-disabled.test.mjs for AI mode, new hub generation and cron no sending with bridge off.
- Feature CI pending. Post CI: verify main source, Cloudflare Build source and Worker mode, manual safe QQ test; never claim live model success based on mocks.
