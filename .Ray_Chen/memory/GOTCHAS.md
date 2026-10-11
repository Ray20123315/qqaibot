# GOTCHAS
- Old Codex Bridge EXE double-click flashed because launcher used startBackground() for empty args and exited; first-run JSON creation returned early as well. File was not corrupted; old SHA 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7 confirmed.
- Windows GitHub Actions PowerShell retains LASTEXITCODE=2 after *expected* --run missing-token test, causing a CI failure even when all assertions passed; explicitly set $global:LASTEXITCODE = 0 once verified.
- Default Windows configuration previously presumed D:/QQAIBOT exists, which might cause startup path errors. New templates use readRoots {}, existing configs not overwritten; invalid old roots must be explicitly changed by user.
- Windows double-click behavior/Notepad interaction is not definitively proven by CI subprocess smoke tests; local operator QA is next. Node --help test was previously insufficient.
- Existing Codex CLI may not be installed or subscribed to model gpt-6-luna; show warning and keep WebSocket diagnostics, do not mislabel a healthy bridge as a working model.
- Token secrets only locally edited; NEVER put bridgeToken in log, issue, chat or published archive. Errors are restricted to event codes, logs rotate at 512KiB.
