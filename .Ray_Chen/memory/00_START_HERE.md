# Ray_Chen Canonical Memory
version: v0.0.100
task_id: codex-exe-visible-startup-20261011
task_status: completed
goal_revision: 1
production_main: a71c41a349575f97e51d8b24992f6f002fa7eee0
previous_backup: archive/codex-exe-before-startup-fix-20261011
updated_at: 2026-10-11T04:52:22.393Z

User-uploaded old Windows EXE flashes because no-args used detached background startup and first-run generated config then exited. Source bug repaired and tested with fresh Windows x64 EXE plus main CI and Cloudflare release. New EXE double-click shows foreground status and first-run Notepad, config/token/HTTP 401 diagnostics with local log; --background explicit. Real user desktop double-click has not yet been witnessed. Read ACTIVE_TASK, CURRENT_STATE, USER_REQUIREMENTS, GOTCHAS, VERIFY, FILE_MANIFEST.
