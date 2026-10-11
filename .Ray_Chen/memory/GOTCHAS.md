# GOTCHAS
- Original EXE is valid Windows console PE and matches CI SHA, so "一閃而過" was caused by default detached hidden child and missing config early return, not proven corrupt binary.
- Existing config %APPDATA%/QQAIBOT/codex-bridge.json might be absent or invalid; old default D:/QQAIBOT readRoots path did not exist on all computers and could crash startup when configured. New template defaults readRoots={} but never overwrites an old JSON config.
- No arg should remain foreground for double-click. --background explicitly uses detached --run child, system startup via scheduled --run. Windows exe run --help smoke never tested no-arg before repair.
- Token from local JSON or environment must not be included in logs, error text or screenshots. CLI may be missing or Luna model unavailable even when WebSocket connects.
- Manual double-click on user's actual Windows desktop and connected Codex login state can't be proven in GitHub Windows CI.
