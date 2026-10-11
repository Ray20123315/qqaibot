# CURRENT_STATE
- QQAIBOT GitHub production main code a71c41a349575f97e51d8b24992f6f002fa7eee0. Backup archive/codex-exe-before-startup-fix-20261011 remains at 80d3cb38ce18fc44f3e77170ce8ff5ea4beff7be.
- Prior EXE from user identical to previous x64 PE 57625775 bytes SHA 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7; originally flashes due hidden detach and first-run config exit.
- New source exe launcher tools/codex-bridge-windows.mjs default foreground, first-run config+Notepad and detailed safe console/file diagnostics, explicit --background only.
- Windows packaged executable built on main SHA256 897845fa5104703abf205a33da32f2e92584113d630315b424575703dc896e21, artifact ID 11692173286, verified zip extraction and SHA256 manifest. Actual local user's Windows runtime untested.
- CI feature 38112718727 and main 38112831921 success, Windows EXE feature 38112718730 and main 38112831914 success.
- Cloudflare qqai deployed main product source a71c41a349575f97e51d8b24992f6f002fa7eee0, deployment 0044dbc3-218f-47da-842f-70cbcfda3f92, worker version a3d7fc6e-6b77-4e44-907a-0338b2cd2236, 100% traffic, build success. Official QQ Worker message logic & Secrets unmodified.
- Current CodeX/Abot/Bbot/D1/Vectorize behavior remains as previous release. No known successful live local EXE connection yet.
