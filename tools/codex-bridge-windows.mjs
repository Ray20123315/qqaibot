import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createInterface} from "node:readline/promises";
import { main as runBridge } from "./codex-work-bridge.mjs";

const TASK_NAME = "QQAIBOT Codex Bridge";
const DEFAULT_CONFIG = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "QQAIBOT", "codex-bridge.json");
const LOG_FILE = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "QQAIBOT", "logs", "codex-bridge.log");
const MISSING_TOKEN = "請在設定檔填入 bridgeToken（沿用 Cloudflare CODEX_BRIDGE_ACCESS_TOKEN），不要把 Token 貼到聊天或日誌。";
function safeMessage(error){
 const raw=String(error?.message||error||"unknown");
 const key=String(process.env.QQAI_CODEX_BRIDGE_TOKEN||"");
 return (key?raw.split(key).join("[REDACTED]"):raw).replace(/Bearer\s+[^\s]+/gi,"Bearer [REDACTED]").slice(0,350);
}
function report(event,detail=""){
 const allowed=/^(START|CONFIG_MISSING|CONFIG_INVALID|TOKEN_MISSING|READY|CONNECTING|CONNECTED|SERVER_READY|DISCONNECTED|ERROR|CODEX_CLI_MISSING|CODEX_CLI_OK|BACKGROUND_STARTED|CONFIG_CREATED|EXIT)$/;
 if(!allowed.test(event))throw Error("INVALID_LOG_EVENT");
 const code=String(detail||"").replace(/[^A-Za-z0-9_.:-]/g,"").slice(0,80);
 const line="["+new Date().toISOString()+"] "+event+(code?" "+code:"");
 const labels={START:"正在啟動",CONFIG_MISSING:"找不到設定檔",CONFIG_INVALID:"設定檔格式錯誤",TOKEN_MISSING:"尚未設定 Bridge Token",READY:"設定檢查通過",CONNECTING:"正在連線 QQ AI Cloudflare",CONNECTED:"WebSocket 已連線",SERVER_READY:"Worker 已回應握手",DISCONNECTED:"WebSocket 已斷線，稍後重新連線",ERROR:"發生錯誤",CODEX_CLI_MISSING:"找不到可執行的 Codex CLI，收到 AI 請求時會失敗",CODEX_CLI_OK:"Codex CLI 可執行",BACKGROUND_STARTED:"背景模式已啟動",CONFIG_CREATED:"已建立設定檔",EXIT:"程式結束"};
 process.stdout.write("[QQAIBOT] "+labels[event]+(code?" ("+code+")":"")+"\n");
 try {
  fs.mkdirSync(path.dirname(LOG_FILE),{recursive:true});
  if(fs.existsSync(LOG_FILE)&&fs.statSync(LOG_FILE).size>512*1024)fs.renameSync(LOG_FILE,LOG_FILE+".previous");
  fs.appendFileSync(LOG_FILE,line+"\n",{encoding:"utf8",mode:0o600});
 }catch{process.stderr.write("[QQAIBOT] 無法寫入本機診斷日誌\n");}
}
async function waitForEnter(message="按 Enter 關閉視窗..."){
 if(!process.stdin.isTTY)return;
 const rl=createInterface({input:process.stdin,output:process.stdout});
 try{await rl.question(message+"\n");}catch{}finally{rl.close();}
}
function validatedConfig(config={},env=process.env){
 const url=String(env.QQAI_CODEX_BRIDGE_URL||config.bridgeUrl||"").trim();
 const token=String(env.QQAI_CODEX_BRIDGE_TOKEN||config.bridgeToken||"").trim();
 if(!url||!/^wss:\/\//i.test(url))return {ok:false,reason:"BRIDGE_URL_REQUIRED"};
 if(!token||/^REPLACE|YOUR[_-]?TOKEN|^<.*>$/i.test(token))return {ok:false,reason:"BRIDGE_TOKEN_REQUIRED"};
 return {ok:true,reason:"READY"};
}
function configFile(configPath){
 if(!fs.existsSync(configPath))return null;
 try{return JSON.parse(fs.readFileSync(configPath,"utf8"));}
 catch{throw new Error("CONFIG_JSON_INVALID");}
}
async function editInNotepad(configPath){
 if(process.platform!=="win32"||!process.stdin.isTTY)return;
 process.stdout.write("即將開啟 Notepad，請填入 bridgeToken 並儲存，關閉 Notepad 後會自動重試。\n");
 await new Promise(resolve=>{
  try{
   const child=spawn("notepad.exe",[configPath],{windowsHide:false,stdio:"ignore"});
   child.on("error",()=>resolve());
   child.on("close",()=>resolve());
  }catch{resolve();}
 });
}
function launchMode(command=""){return command==="--background"?"background":"foreground";}
function checkCodexBin(name="codex"){
 const r=spawnSync(name,["--version"],{encoding:"utf8",windowsHide:true,timeout:4000,stdio:["ignore","pipe","pipe"]});
 return r.status===0;
}

function argsMap(argv = process.argv.slice(2)) {
  const out = { command: "", config: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--config") out.config = String(argv[++i] || "");
    else if (!out.command && arg.startsWith("--")) out.command = arg;
  }
  return out;
}

function rootSpec(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value)
    .map(([alias, target]) => `${String(alias).trim()}=${String(target || "").trim()}`)
    .filter(row => !/=\s*$/.test(row))
    .join(";");
}

function configToEnv(config = {}) {
  const map = {
    QQAI_CODEX_BRIDGE_URL: config.bridgeUrl,
    QQAI_CODEX_BRIDGE_TOKEN: config.bridgeToken,
    QQAI_CODEX_BIN: config.codexBin,
    QQAI_CODEX_HOME: config.codexHome,
    QQAI_CODEX_CHAT_CWD: config.chatCwd,
    QQAI_CODEXWORK_READ_ROOTS: rootSpec(config.readRoots),
    QQAI_CODEXWORK_EDIT_ROOTS: rootSpec(config.editRoots),
    QQAI_CODEXWORK_EXPORT_DIR: config.exportDir,
    QQAI_CODEXWORK_MAX_FILES: config.maxFiles,
    QQAI_CODEXWORK_MAX_BYTES: config.maxBytes,
    QQAI_CODEXWORK_EXPORT_MAX_BYTES: config.exportMaxBytes
  };
  return Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ""));
}

function templateConfig() {
  return {
    bridgeUrl: "wss://aibot.ray2025.com/v3/codex-bridge",
    bridgeToken: "",
    codexBin: "codex",
    codexHome: path.join(os.homedir(), ".qqaibot-codex"),
    chatCwd: os.tmpdir(),
    readRoots: {},
    editRoots: {},
    exportDir: path.join(os.homedir(), "QQAIBOT-exports"),
    maxFiles: 5000,
    maxBytes: 134217728,
    exportMaxBytes: 33554432
  };
}

function resolveConfigPath(value = "") {
  return path.resolve(String(value || process.env.QQAI_CODEX_BRIDGE_CONFIG || DEFAULT_CONFIG));
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return null;
  const parsed = configFile(configPath);
  for (const [key, value] of Object.entries(configToEnv(parsed))) {
    if (!String(process.env[key] || "").trim()) process.env[key] = String(value);
  }
  return parsed;
}

function initConfig(configPath) {
  if (fs.existsSync(configPath)) return { created: false, path: configPath };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(templateConfig(), null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  return { created: true, path: configPath };
}

function requirePackagedExe() {
  if (!process.pkg) throw new Error("CODEX_BRIDGE_EXE_REQUIRED");
}

function taskCommand(configPath) {
  return `"${process.execPath}" --run --config "${configPath}"`;
}

function installStartup(configPath) {
  requirePackagedExe();
  const result = spawnSync("schtasks.exe", ["/Create", "/TN", TASK_NAME, "/TR", taskCommand(configPath), "/SC", "ONLOGON", "/RL", "LIMITED", "/F"], { windowsHide: true, encoding: "utf8" });
  if (result.status !== 0) throw new Error("CODEX_BRIDGE_STARTUP_INSTALL_FAILED:" + String(result.stderr || result.stdout || "").trim());
}

function uninstallStartup() {
  requirePackagedExe();
  const result = spawnSync("schtasks.exe", ["/Delete", "/TN", TASK_NAME, "/F"], { windowsHide: true, encoding: "utf8" });
  if (result.status !== 0 && !/cannot find|找不到/i.test(String(result.stderr || result.stdout || ""))) {
    throw new Error("CODEX_BRIDGE_STARTUP_REMOVE_FAILED:" + String(result.stderr || result.stdout || "").trim());
  }
}

function startBackground(configPath) {
  requirePackagedExe();
  const child = spawn(process.execPath, ["--run", "--config", configPath], {
    detached: true,
    windowsHide: true,
    stdio: "ignore"
  });
  child.unref();
}

function help() {
  return [
    "QQAIBOT Codex Bridge (Windows)",
    "",
    "雙擊 / 無參數              顯示連線狀態，視窗保持開啟",
    "--background              明確切換為隱藏背景模式",
    "--diagnose                檢查設定與 Codex CLI（不顯示 Token）",
    "--run                     前景執行",
    "--init-config             建立本機設定範本",
    "--install-startup         設定 Windows 登入自啟",
    "--uninstall-startup       移除 Windows 登入自啟",
    "--config <path>           指定設定檔",
    "--help                    顯示說明",
    "",
    `預設設定：${DEFAULT_CONFIG}`,
    `診斷日誌：${LOG_FILE}`,
    "bridgeToken 請只保存在本機，不要提交到 Git。"
  ].join("\n");
}

async function cli(argv = process.argv.slice(2)) {
 const parsed=argsMap(argv),configPath=resolveConfigPath(parsed.config);
 if(parsed.command==="--help"){process.stdout.write(help()+"\n");return;}
 if(parsed.command==="--init-config"){
  const state=initConfig(configPath);
  report(state.created?"CONFIG_CREATED":"READY");
  process.stdout.write("設定檔："+state.path+"\n");
  return;
 }
 if(parsed.command==="--uninstall-startup"){uninstallStartup();report("READY");return;}
 const interactive=!parsed.command;
 const diagnose=parsed.command==="--diagnose";
 if(!["","--run","--background","--diagnose","--install-startup"].includes(parsed.command))
  throw Error("UNKNOWN_ARGUMENT_USE_HELP");
 report("START");
 process.stdout.write("設定檔："+configPath+"\n日誌："+LOG_FILE+"\n");
 if(!fs.existsSync(configPath)&&!process.env.QQAI_CODEX_BRIDGE_URL){
  initConfig(configPath);report("CONFIG_CREATED");report("CONFIG_MISSING");
 }
 let cfg;
 try{cfg=configFile(configPath)||{};}
 catch(e){
  report("CONFIG_INVALID",safeMessage(e));
  if(interactive){await editInNotepad(configPath);try{cfg=configFile(configPath)||{};}catch{cfg={};}}
  else {process.exitCode=2;return;}
 }
 let status=validatedConfig(cfg);
 if(!status.ok&&!diagnose&&interactive){
  if(status.reason==="BRIDGE_TOKEN_REQUIRED")process.stdout.write(MISSING_TOKEN+"\n");
  else process.stdout.write("檢查 bridgeUrl（應為 wss://aibot.ray2025.com/v3/codex-bridge）\n");
  await editInNotepad(configPath);
  try{cfg=configFile(configPath)||{};}catch(e){report("CONFIG_INVALID",safeMessage(e));cfg={};}
  status=validatedConfig(cfg);
 }
 if(!status.ok){
  report(status.reason==="BRIDGE_TOKEN_REQUIRED"?"TOKEN_MISSING":"CONFIG_INVALID",status.reason);
  process.stdout.write("設定檔："+configPath+"\n");
  if(diagnose)return;
  process.exitCode=2;
  if(interactive)await waitForEnter();
  return;
 }
 if(parsed.command==="--install-startup"){
  installStartup(configPath);report("READY");return;
 }
 // Merge local configuration with any preexisting environment-based overrides.
 loadConfig(configPath);
 report("READY");
 const codexBin=String(process.env.QQAI_CODEX_BIN||"codex");
 report(checkCodexBin(codexBin)?"CODEX_CLI_OK":"CODEX_CLI_MISSING");
 if(diagnose)return;
 if(launchMode(parsed.command)==="background"){
  startBackground(configPath);report("BACKGROUND_STARTED");return;
 }
 report("CONNECTING");
 try{
  await runBridge({onStatus:state=>{
   if(state==="connected")report("CONNECTED");
   else if(state==="server_ready")report("SERVER_READY");
   else if(state==="disconnected")report("DISCONNECTED");
   else if(state==="connecting")report("CONNECTING");
   else if(state?.startsWith?.("error:"))report("ERROR",state.slice(6));
  }});
 }catch(e){
  report("ERROR",safeMessage(e));
  process.stdout.write("設定檔："+configPath+"\n日誌："+LOG_FILE+"\n");
  process.exitCode=1;
  if(interactive)await waitForEnter();
 }
}

export { DEFAULT_CONFIG, LOG_FILE, TASK_NAME, argsMap, cli, configToEnv, initConfig, loadConfig, resolveConfigPath, rootSpec, templateConfig, validatedConfig, checkCodexBin, launchMode };

const invoked = process.argv[1] ? path.basename(path.resolve(process.argv[1])).toLowerCase() : "";
if (process.pkg || invoked === "codex-bridge-windows.mjs") {
  cli().catch(async error => {
    report("ERROR",safeMessage(error));
    process.stdout.write("請使用 --diagnose 檢查設定，或查看日誌："+LOG_FILE+"\n");
    process.exitCode = 1;
    if(process.argv.slice(2).length===0)await waitForEnter();
  });
}
