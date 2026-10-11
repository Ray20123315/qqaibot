# DECISIONS
2026-10-11 new task: diagnose uploaded EXE by PE format + SHA, then source rather than inventing Windows execution results. Match found existing CI binary.
2026-10-11: Default no-arg EXE now VISIBLE foreground. Hiding process requires explicit --background; existing --install-startup scheduled task remains available.
2026-10-11: First-run JSON is created but not silently dismissed: open Notepad to edit locally, retry config on close, if missing token wait Enter in interactive console. Do not ask user to paste Secret.
2026-10-11: Restrict status logging to fixed events/short alphanumeric diagnostics only; no credentials, raw URLs, QQ chat or system stack traces in logs. Preserve existing config; no invented D: read root.
