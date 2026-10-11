# GOTCHAS
- A Windows console PE exe (even if the CLI stays open) is NOT a GUI. The new entrypoint must compile as WinExe and expose a form; Node engine remains hidden child but both EXEs must be in same directory.
- Old CLI --help/missing token smoke did not test user-facing GUI. New Windows CI uses dotnet publish self-contained and GUI --self-test.
- Existing %%APPDATA%%/QQAIBOT/codex-bridge.json contains local Token and potentially unknown fields: always read and preserve, never overwrite whole schema with blank defaults or log Secret. GUI should not use ShellExecute to run Node engine.
- QQ slash command autocomplete panel persisted independently; runtime code ignoring /!设置插话率 does NOT remove it. New QQ official /v2/panels API permits listing and selective PUT/DELETE, but there can also be legacy manually configured commands/QQ client caching.
- DO storage cleanup status one-shot with 15minute backoff, no unknown mass deletion. The only retired match is 设置插话率 / 查看主动插话暂停状态.
