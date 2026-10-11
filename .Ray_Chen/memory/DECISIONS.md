# DECISIONS
2026-10-11: Native Windows Forms WinExe frontend is the deliverable; hidden existing Node pkg CLI preserved as sibling backend for compatibility, not directly shown to users.
2026-10-11: GUI masks token, atomically saves only its own three fields, never prints arbitrary Codex stdout or Secrets, supports tray minimize and true start/stop.
2026-10-11: QQ native slash entry may be platform publisher config, separate from Worker source. Do not falsely claim it was deleted by a Worker deploy; provide accurate developer console removal.
