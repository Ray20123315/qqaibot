import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("src/v3/ai/codex-command-runtime.js", "utf8");
const adapter = fs.readFileSync("src/v3/host/adapter.js", "utf8");
const wrapper = fs.readFileSync("tools/codex-bridge-windows.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/build-codex-bridge-exe.yml", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(runtime, /sessionKey = `qqaibot:\$\{scope\}:user:\$\{context\.userId\}:codex`/);
assert.doesNotMatch(runtime, /sessionKey = mode === "public"/);
assert.match(adapter, /sessionKey = `qqaibot:plugin:\$\{pluginId\}:\$\{scope\}:\$\{peer\}:user:\$\{actorId\}:codex`/);
assert.doesNotMatch(adapter, /sessionKey = mode === "public"/);
assert.match(wrapper, /from "\.\/codex-work-bridge\.mjs"/);
assert.match(wrapper, /--install-startup/);
assert.match(wrapper, /schtasks\.exe/);
assert.match(wrapper, /windowsHide: true/);
assert.match(wrapper, /bridgeToken/);
assert.match(wrapper, /readRoots/);
assert.match(wrapper, /editRoots/);
assert.match(wrapper, /process\.pkg/);
assert.match(workflow, /runs-on: windows-latest/);
assert.match(workflow, /@yao-pkg\/pkg@6\.22\.0/);
assert.match(workflow, /QQAIBOT-CodexBridge\.exe/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(pkg.scripts["codex:bridge:exe"], /QQAIBOT-CodexBridge\.exe/);
assert.match(pkg.scripts["check:v3"], /verify-codex-bridge-exe\.mjs/);

console.log("Shared Codex session and Windows Codex Bridge EXE packaging checks passed.");
