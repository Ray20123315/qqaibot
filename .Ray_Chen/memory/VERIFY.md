# VERIFY
- Feature Node CI 38114026195 SUCCESS and main Node CI 38114199375 SUCCESS; tests/native-gui-and-commands.test.mjs verifies GUI source/settings, package workflow, old command not registered in active worker.
- Feature Windows CI 38114026126 SUCCESS, main Windows CI 38114199372 SUCCESS; .NET8 self-contained WinForms GUI built and --self-test returns success, PE Subsystem=2, backend first-run smoke and token-missing guard pass.
- Main artifact ID 11693066002 ZIP locally opened; SHA manifest exactly matches GUI 5cb47bb16e252e9c871d26e17cd01ab939e80836c57df9bab52f4b0b47a3eeb9 and backend 9501d9e055d6e2b7e0cf8a165603712e33fc830d752d092d52fba3c1b33febff. Actual Windows user UI not yet tested.
- Cloudflare Worker source SHA ed944543d4a265101a7abafa2ff9eeee84f28c63 100% build success deployment c92451d0-bdc5-470b-bc49-24cab00837ae version f50fed87-5265-478d-84b3-1c6fc85d269c.
- Official QQ slash entry removal UNVERIFIED: platform publishing backend not accessed. Tencent documentation says publish settings -> commands configuration. See docs/QQ_COMMAND_PANEL_CLEANUP.md.
- Final memory v0.0.102 tar archive CI pending.
