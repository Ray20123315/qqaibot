import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { main as runBridge } from "./codex-work-bridge.mjs";

const TASK_NAME = "QQAIBOT Codex Bridge";
const DEFAULT_CONFIG = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "QQAIBOT", "codex-bridge.json");

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
    readRoots: { project: "D:\\QQAIBOT" },
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
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
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
    "雙擊 / 無參數              隱藏背景啟動",
    "--run                     前景執行",
    "--init-config             建立本機設定範本",
    "--install-startup         設定 Windows 登入自啟",
    "--uninstall-startup       移除 Windows 登入自啟",
    "--config <path>           指定設定檔",
    "--help                    顯示說明",
    "",
    `預設設定：${DEFAULT_CONFIG}`,
    "bridgeToken 請只保存在本機，不要提交到 Git。"
  ].join("\n");
}

async function cli(argv = process.argv.slice(2)) {
  const parsed = argsMap(argv);
  const configPath = resolveConfigPath(parsed.config);
  if (parsed.command === "--help") { process.stdout.write(help() + "\n"); return; }
  if (parsed.command === "--init-config") {
    const state = initConfig(configPath);
    process.stdout.write((state.created ? "已建立：" : "已存在：") + state.path + "\n");
    return;
  }
  if (!fs.existsSync(configPath) && !process.env.QQAI_CODEX_BRIDGE_URL) {
    const state = initConfig(configPath);
    process.stdout.write("尚未設定 Bridge，已建立設定範本：" + state.path + "\n請填入 bridgeToken 與允許的資料夾後再啟動。\n");
    return;
  }
  loadConfig(configPath);
  if (parsed.command === "--install-startup") { installStartup(configPath); process.stdout.write("已設定登入自啟。\n"); return; }
  if (parsed.command === "--uninstall-startup") { uninstallStartup(); process.stdout.write("已移除登入自啟。\n"); return; }
  if (parsed.command === "--run") { await runBridge(); return; }
  startBackground(configPath);
  process.stdout.write("QQAIBOT Codex Bridge 已在背景啟動。\n");
}

export { DEFAULT_CONFIG, TASK_NAME, argsMap, cli, configToEnv, initConfig, loadConfig, resolveConfigPath, rootSpec, templateConfig };

const invoked = process.argv[1] ? path.basename(path.resolve(process.argv[1])).toLowerCase() : "";
if (process.pkg || invoked === "codex-bridge-windows.mjs") {
  cli().catch(error => {
    console.error("[qqaibot-codex-bridge-exe]", error?.stack || error);
    process.exitCode = 1;
  });
}
