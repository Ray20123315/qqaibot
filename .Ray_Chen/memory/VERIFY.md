# VERIFY
- Uploaded old PE file inspected via container file/read and SHA256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7.
- New Node tests in tests/codex-exe-startup.test.mjs cover default no-arg foreground, explicit background, first-run no default invalid readRoot and Secret placeholder rejection.
- Windows executable CI smoke: bundled exe --help, --diagnose with missing custom config creates JSON, --run missing token must exit code 2 without connecting; upload EXE/SHA.
- GitHub feature CI and Windows Build pending. After passes promote main and verify artifacts, no Cloudflare Worker source touched; confirm no unintended deployment changes.
