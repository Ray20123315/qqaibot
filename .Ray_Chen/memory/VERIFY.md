# VERIFY
- User EXE read as PE32+ Windows console AMD64 7 sections, valid, SHA256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7 matches prior packaged CI executable.
- Node feature CI 38112718727 SUCCESS; Node main CI 38112831921 SUCCESS. tests/codex-exe-startup.test.mjs covers launcher mode, template no invalid D root, placeholder Token detection; all earlier Node tests and Wrangler dry-run green.
- Windows EXE feature CI 38112718730 SUCCESS and main CI 38112831914 SUCCESS; Windows workflow smoke tests --help, --diagnose missing config template generation, --run missing Token expected exit code 2, and SHA256 artifact generation.
- Artifact main exe zip QQAIBOT-CodexBridge-Windows-x64-fixed-main.zip, exe PE32+ Windows x86_64, SHA256 897845fa5104703abf205a33da32f2e92584113d630315b424575703dc896e21, verified against zip embedded SHA256SUMS with sha256sum -c OK.
- Cloudflare qqai latest product build SHA a71c41a349575f97e51d8b24992f6f002fa7eee0 outcome success 100%, deployment 0044dbc3-218f-47da-842f-70cbcfda3f92, version a3d7fc6e-6b77-4e44-907a-0338b2cd2236.
- Final memory v0.0.100 archive CI pending.
- Human Windows Explorer double-click, local Codex authentication, bridge WebSocket connection not yet observed; ask user for redacted status/log if not connected.
