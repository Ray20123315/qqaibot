# VERIFY
- Node tests tests/qq-panel-cleanup.test.mjs simulate QQ official panel list, exact retirement removal while retaining other commands, all-obsolete deletion and no-match no-write.
- Windows Action builds both GUI WinExe and Engine exe, GUI --self-test and Engine --help/--diagnose/missing-token, verifies SHA256SUMS.
- GitHub CI, Cloudflare dry-run and Windows native compile pending.
- After deployment inspect /health abot.command_panel_cleanup: removed|no_match|failed|pending; only removed with count>0 plus successful QQ API is proof stale panel entry removed. If no_match and screenshot still present, open QQ platform bot admin "發布設定 > 功能配置 > 指令" and delete old command there; app cache may persist until refresh.
- Real Windows user GUI action and Codex CLI login still unverified.
