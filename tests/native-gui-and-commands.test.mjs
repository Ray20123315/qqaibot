import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../tools/codex-bridge-gui/Program.cs",import.meta.url),"utf8");
const project=readFileSync(new URL("../tools/codex-bridge-gui/QQAIBOT-CodexBridge.csproj",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../.github/workflows/build-codex-bridge-exe.yml",import.meta.url),"utf8");
test("Windows deliverable is a native GUI with actual controls, not just a foreground CLI",()=>{
 assert.match(project,/<OutputType>WinExe<\/OutputType>/);
 assert.match(project,/<UseWindowsForms>true<\/UseWindowsForms>/);
 for(const flag of ["啟動連線","停止連線","Bridge Token","連線與診斷資訊","NotifyIcon","UseSystemPasswordChar = true"])
  assert.ok(source.includes(flag),flag);
 assert.match(source,/ProcessStartInfo\(backend\)/);
 assert.match(source,/CreateNoWindow = true/);
 assert.match(source,/SaveSettings\(showSuccess/);
});
test("new executable package includes both native GUI and hidden backend, with smoke validation",()=>{
 assert.match(workflow,/dotnet publish tools\/codex-bridge-gui/);
 assert.match(workflow,/QQAIBOT-CodexBridge-Backend.exe/);
 assert.match(workflow,/QQAIBOT-CodexBridge.exe --self-test/);
 assert.match(workflow,/Windows GUI \(2\)/);
 assert.match(workflow,/QQAIBOT-CodexBridge_SHA256SUMS.txt/);
});
test("source does not register deprecated unsolicited interjection slash command",()=>{
 for(const p of ["worker.js","src/abot-ai.js","src/assistant.js","src/core.js"]){
  const text=readFileSync(new URL("../"+p,import.meta.url),"utf8");
  assert.doesNotMatch(text,/设置插话率|設置插話率|查看主动插话暂停状态|主動插話暫停狀態/,p);
 }
});
