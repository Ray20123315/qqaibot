# VERIFY
- GitHub Action runs npm run check (Node tests) plus Wrangler dry-run. New tests/compact-codex-memory.test.mjs cover plain text, no slicing, Luna/non-think request, offline fallback, D1 memory opt-in, recall, vector 1024 dims.
- Separate EXE Windows build workflow tests packaged executable --help; actual installed CLI model support and WebSocket to deployed Worker require operator smoke test.
- CI pending and source not on main yet. No real QQ / Gemini embedding / Codex requests performed.
