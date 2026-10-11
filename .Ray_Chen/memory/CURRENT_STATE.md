# CURRENT_STATE
- Official GitHub QQAIBOT main 80d3cb38ce18fc44f3e77170ce8ff5ea4beff7be (pre repair); deployed Cloudflare Worker supports authenticated /v3/codex-bridge.
- Uploaded EXE is identical to prior artifact (x64 Windows console, SHA256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7). Not an invalid PE file.
- Source confirmed no-args EXE unconditionally launches detached hidden background process then immediately exits, while no config auto-created JSON template and immediately exits. Hence observed flashing is by design, with failure hidden.
- Existing config path %APPDATA%/QQAIBOT/codex-bridge.json, bridge URL wss://aibot.ray2025.com/v3/codex-bridge, Secret CODEX_BRIDGE_ACCESS_TOKEN, prior security unchanged.
- Feature fix/codex-exe-visible-startup-20261011 adjusts Windows launcher, status callbacks and safe local logfile, Node and Windows EXE smoke tests. CI pending.
- No live QQ messages, Worker deployments or EXE connection yet in this task.
