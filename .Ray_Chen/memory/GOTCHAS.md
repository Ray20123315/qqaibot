# GOTCHAS
- PE Subsystem 2=Windows GUI vs 3=console. Previous 2026-10-11 EXE was console despite visible status, incorrect for explicit GUI requirement.
- GUI exe and Backend.exe must be in same directory. Windows GUI auto starts backend only when original settings are valid. Backend is hidden with CreateNoWindow and existing Bridge token/URL.
- Preserve user local config at %APPDATA%/QQAIBOT/codex-bridge.json incl advanced read/edit roots. Do not leak Token in GUI logs or support messages; status data restricted to known fixed labels.
- Minimize to tray retains connection; close GUI stops its spawned backend. CLI model availability and real Windows environment not verifiable by CI alone.
- QQ slash menu published at developer portal may persist independently of program. Source search passing does not remove server-published QQ command entry.
