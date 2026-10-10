# VERIFY
- Run npm run check through GitHub Actions: node --test tests/*.test.mjs and Wrangler deploy --dry-run.
- tests/political-policy.test.mjs tests Traditional/Simplified/English keywords, normal questions and output filtering.
- tests/abot-ai.test.mjs adds model call suppression for political input, output replace-before-persist checks and safe official message ID.
- tests/assistant.test.mjs adds equivalent dormant Bbot AI guard tests.
- Feature CI, main CI and Cloudflare deployment pending. No live QQ text sent by assistant.
