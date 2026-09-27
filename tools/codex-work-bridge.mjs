#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTOCOL = "qqai-codex-bridge-v1";
const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;
const DEFAULT_EXPORT_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120000;

const ALWAYS_EXCLUDED_DIRS = new Set([
  ".git", ".codex", ".agents", ".idea", ".vscode",
  "node_modules", ".next", "dist", "build", "coverage",
  ".cache", "__pycache__", ".venv", "venv"
]);

const SENSITIVE_BASENAME_PATTERNS = Object.freeze([
  /^\.env(?:\.|$)/i,
  /^auth\.json$/i,
  /^credentials?(?:\.|$)/i,
  /^secrets?(?:\.|$)/i,
  /^id_[a-z0-9_-]+$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.kdbx$/i
]);

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function parseRootSpec(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[;\n]+/g);
  const rows = [];
  for (const item of source) {
    const text = String(item || "").trim();
    if (!text) continue;
    const eq = text.indexOf("=");
    const alias = (eq > 0 ? text.slice(0, eq) : path.basename(text)).trim();
    const target = (eq > 0 ? text.slice(eq + 1) : text).trim();
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(alias) || !target) throw new Error("CODEXWORK_ROOT_SPEC_INVALID");
    rows.push({ alias, path: path.resolve(target) });
  }
  const unique = new Map();
  for (const row of rows) {
    if (unique.has(row.alias)) throw new Error(`CODEXWORK_ROOT_ALIAS_DUPLICATE:${row.alias}`);
    unique.set(row.alias, row);
  }
  return [...unique.values()];
}

function normalizeForCompare(value) {
  let resolved = path.resolve(String(value || ""));
  if (process.platform === "win32") resolved = resolved.toLowerCase();
  return resolved.replace(/[\\/]+$/, "");
}

function isPathInside(candidate, root) {
  const child = normalizeForCompare(candidate);
  const parent = normalizeForCompare(root);
  return child === parent || child.startsWith(parent + path.sep);
}

function isSensitiveRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return false;
  if (parts.some(part => ALWAYS_EXCLUDED_DIRS.has(part))) return true;
  const base = parts.at(-1) || "";
  return SENSITIVE_BASENAME_PATTERNS.some(pattern => pattern.test(base));
}

async function canonicalExistingPath(target) {
  return path.resolve(await fs.realpath(path.resolve(target)));
}

async function canonicalParentTarget(target) {
  const absolute = path.resolve(target);
  try {
    return await canonicalExistingPath(absolute);
  } catch {
    const parent = await canonicalExistingPath(path.dirname(absolute));
    return path.join(parent, path.basename(absolute));
  }
}

async function normalizeRoots(readSpecs, editSpecs) {
  const reads = [];
  for (const row of readSpecs) reads.push({ ...row, path: await canonicalExistingPath(row.path) });
  const edits = [];
  for (const row of editSpecs) {
    const resolved = await canonicalExistingPath(row.path);
    if (!reads.some(read => isPathInside(resolved, read.path))) {
      throw new Error(`CODEXWORK_EDIT_ROOT_OUTSIDE_READ_ROOT:${row.alias}`);
    }
    edits.push({ ...row, path: resolved });
  }
  return { reads, edits };
}

function rootByAlias(roots, alias = "") {
  if (!roots.length) throw new Error("CODEXWORK_READ_ROOTS_REQUIRED");
  if (!alias) {
    if (roots.length !== 1) throw new Error("CODEXWORK_ROOT_REQUIRED");
    return roots[0];
  }
  const found = roots.find(row => row.alias === alias);
  if (!found) throw new Error(`CODEXWORK_ROOT_NOT_FOUND:${alias}`);
  return found;
}

async function assertAllowedPath(target, roots, { mode = "read", allowMissing = false } = {}) {
  const checked = allowMissing ? await canonicalParentTarget(target) : await canonicalExistingPath(target);
  const root = roots.find(row => isPathInside(checked, row.path));
  if (!root) throw new Error(`CODEXWORK_${mode.toUpperCase()}_PATH_DENIED`);
  const relative = path.relative(root.path, checked);
  if (isSensitiveRelativePath(relative)) throw new Error(`CODEXWORK_${mode.toUpperCase()}_SENSITIVE_PATH_DENIED`);
  return { root, path: checked, relative };
}

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  const stream = fsSync.createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function listSafeFiles(rootPath, limits = {}) {
  const maxFiles = clampInteger(limits.maxFiles, DEFAULT_MAX_FILES, 1, 50000);
  const maxBytes = clampInteger(limits.maxBytes, DEFAULT_MAX_BYTES, 1024, 1024 * 1024 * 1024);
  const files = [];
  let totalBytes = 0;

  async function walk(current, relativeBase = "") {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const relative = path.join(relativeBase, entry.name);
      if (isSensitiveRelativePath(relative)) continue;
      const source = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(source, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(source);
      if (files.length + 1 > maxFiles) throw new Error("CODEXWORK_SNAPSHOT_FILE_LIMIT");
      if (totalBytes + stat.size > maxBytes) throw new Error("CODEXWORK_SNAPSHOT_BYTE_LIMIT");
      totalBytes += stat.size;
      files.push({ source, relative, size: stat.size });
    }
  }

  await walk(rootPath);
  return { files, totalBytes };
}

async function copySnapshot(rootPath, destination, limits = {}) {
  const inventory = await listSafeFiles(rootPath, limits);
  const baseline = new Map();
  for (const item of inventory.files) {
    const target = path.join(destination, item.relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(item.source, target);
    baseline.set(item.relative.replace(/\\/g, "/"), {
      size: item.size,
      sha256: await sha256File(item.source)
    });
  }
  return { ...inventory, baseline };
}

async function changedSnapshotFiles(staging, baseline, limits = {}) {
  const inventory = await listSafeFiles(staging, limits);
  const changed = [];
  for (const item of inventory.files) {
    const key = item.relative.replace(/\\/g, "/");
    const hash = await sha256File(item.source);
    const prior = baseline.get(key);
    if (!prior || prior.sha256 !== hash) changed.push({ ...item, sha256: hash, existed: Boolean(prior) });
  }
  const deleted = [];
  for (const key of baseline.keys()) {
    if (!inventory.files.some(item => item.relative.replace(/\\/g, "/") === key)) deleted.push(key);
  }
  return { changed, deleted, inventory };
}

async function atomicCopy(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.qqaibot-${crypto.randomUUID()}.tmp`;
  await fs.copyFile(source, temp);
  await fs.rename(temp, target);
}

async function applyStagedChanges({ originalRoot, staging, baseline, editRoots, limits = {} }) {
  const diff = await changedSnapshotFiles(staging, baseline, limits);
  const applied = [];
  const skipped = [];
  for (const item of diff.changed) {
    const target = path.join(originalRoot, item.relative);
    try {
      const allowed = await assertAllowedPath(target, editRoots, { mode: "edit", allowMissing: true });
      if (isSensitiveRelativePath(allowed.relative)) throw new Error("CODEXWORK_EDIT_SENSITIVE_PATH_DENIED");
      await atomicCopy(item.source, target);
      applied.push(item.relative.replace(/\\/g, "/"));
    } catch (error) {
      skipped.push({ path: item.relative.replace(/\\/g, "/"), reason: String(error?.message || error) });
    }
  }
  return {
    applied,
    skipped,
    deletedIgnored: diff.deleted,
    deletionApplied: false
  };
}

function exportMarkers(text) {
  const source = String(text || "");
  const rows = [];
  const pattern = /\[\[QQAI_EXPORT:([^\]\r\n]+)\]\]/g;
  let match;
  while ((match = pattern.exec(source)) !== null && rows.length < 10) rows.push(match[1].trim());
  return [...new Set(rows.filter(Boolean))];
}

async function collectExports({ staging, exportDir, text, maxBytes = DEFAULT_EXPORT_MAX_BYTES }) {
  if (!exportDir) return [];
  const root = await canonicalExistingPath(staging);
  const outDir = path.resolve(exportDir);
  await fs.mkdir(outDir, { recursive: true });
  const attachments = [];
  let total = 0;
  for (const requested of exportMarkers(text)) {
    if (path.isAbsolute(requested)) continue;
    const source = await canonicalExistingPath(path.join(root, requested)).catch(() => "");
    if (!source || !isPathInside(source, root)) continue;
    if (isSensitiveRelativePath(path.relative(root, source))) continue;
    const stat = await fs.stat(source).catch(() => null);
    if (!stat?.isFile()) continue;
    total += stat.size;
    if (total > maxBytes) throw new Error("CODEXWORK_EXPORT_BYTE_LIMIT");
    const safeName = path.basename(source).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180) || "codexwork-output";
    const target = path.join(outDir, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`);
    await atomicCopy(source, target);
    attachments.push({ name: safeName, path: target, size: stat.size });
  }
  return attachments;
}

async function ensureCodexHome(base = "") {
  const home = path.resolve(base || process.env.QQAI_CODEX_HOME || path.join(os.homedir(), ".qqaibot-codex"));
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  const configPath = path.join(home, "config.toml");
  const config = [
    'approval_policy = "never"',
    'sandbox_mode = "read-only"',
    '',
    '[memories]',
    'use_memories = false',
    ''
  ].join("\n");
  await fs.writeFile(configPath, config, { encoding: "utf8", mode: 0o600 });
  return home;
}

function codexProcessEnv(codexHome) {
  const allowed = [
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "HOME", "USERPROFILE",
    "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL",
    "CODEX_API_KEY", "CODEX_ACCESS_TOKEN",
    "OPENAI_FEDERATION_RULE_ID", "OPENAI_IDENTITY_TOKEN_FILE", "OPENAI_WORKLOAD_IDENTITY_CONTEXT"
  ];
  const env = { CODEX_HOME: codexHome, NO_COLOR: "1" };
  for (const key of allowed) if (process.env[key]) env[key] = process.env[key];
  return env;
}

function parseCodexJsonl(stdout) {
  const events = [];
  let text = "";
  let threadId = "";
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    events.push(event);
    threadId ||= String(
      event.thread_id || event.threadId || event.session_id || event.sessionId ||
      event?.thread?.id || event?.session?.id || ""
    );
    const type = String(event.type || "");
    if (type === "item.completed" && event?.item?.type === "agent_message") {
      text = String(event.item.text || event.item.content || text);
    } else if (type === "agent_message" || type === "message.output_text" || type === "response.output_text.done") {
      text = String(event.text || event.output_text || event.content || text);
    } else if (event?.message?.role === "assistant") {
      text = String(event.message.content || event.message.text || text);
    }
  }
  return { events, text: text.trim(), threadId };
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const maxOutput = 16 * 1024 * 1024;
    child.stdout.on("data", chunk => {
      stdout += String(chunk);
      if (stdout.length > maxOutput) child.kill();
    });
    child.stderr.on("data", chunk => {
      stderr += String(chunk);
      if (stderr.length > maxOutput) child.kill();
    });
    const timeout = setTimeout(() => child.kill(), clampInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 3000, 10 * 60 * 1000));
    child.on("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timeout);
      if (code !== 0) {
        const error = new Error(`CODEX_PROCESS_FAILED:${code}:${stderr.slice(-1000)}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function readSessionState(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSessionState(file, state) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, file);
}

function modelArgs(payload) {
  const args = [];
  const model = String(payload.model || "gpt-6-luna").trim();
  if (model) args.push("--model", model);
  const reasoning = String(payload.reasoningEffort || "none").trim().toLowerCase();
  if (reasoning) args.push("-c", `model_reasoning_effort="${reasoning}"`);
  return args;
}

async function runCodexTurn({ payload, cwd, sandboxMode, codexHome, sessionState, stateFile }) {
  const sessionKey = String(payload.sessionKey || "").slice(0, 240);
  const priorThread = sessionKey ? String(sessionState[sessionKey] || "") : "";
  const prompt = (Array.isArray(payload.messages) ? payload.messages : [])
    .map(row => `${String(row.role || "user").toUpperCase()}:\n${String(row.content || "")}`)
    .join("\n\n")
    .slice(0, 120000);
  if (!prompt) throw new Error("CODEX_INPUT_REQUIRED");

  const common = [
    "--json",
    "--skip-git-repo-check",
    "--sandbox", sandboxMode,
    "-c", 'approval_policy="never"',
    ...modelArgs(payload)
  ];
  const args = priorThread
    ? ["exec", ...common, "resume", priorThread, prompt]
    : ["exec", ...common, prompt];

  let run;
  try {
    run = await runCommand(process.env.QQAI_CODEX_BIN || "codex", args, {
      cwd,
      env: codexProcessEnv(codexHome),
      timeoutMs: payload.timeoutMs
    });
  } catch (error) {
    if (priorThread && /session|thread|resume|not found/i.test(String(error?.message || "") + String(error?.stderr || ""))) {
      delete sessionState[sessionKey];
      run = await runCommand(process.env.QQAI_CODEX_BIN || "codex", ["exec", ...common, prompt], {
        cwd,
        env: codexProcessEnv(codexHome),
        timeoutMs: payload.timeoutMs
      });
    } else {
      throw error;
    }
  }

  const parsed = parseCodexJsonl(run.stdout);
  if (!parsed.text) throw new Error("CODEX_EMPTY_RESPONSE");
  if (sessionKey && parsed.threadId) {
    sessionState[sessionKey] = parsed.threadId;
    await saveSessionState(stateFile, sessionState);
  }
  return parsed;
}

async function handleChatRequest(payload, runtime) {
  const emptyWorkspace = path.join(runtime.tempRoot, "chat-workspace");
  await fs.mkdir(emptyWorkspace, { recursive: true });
  const result = await runCodexTurn({
    payload,
    cwd: emptyWorkspace,
    sandboxMode: "read-only",
    codexHome: runtime.codexHome,
    sessionState: runtime.sessionState,
    stateFile: runtime.stateFile
  });
  return {
    ok: true,
    text: result.text,
    model: String(payload.model || "gpt-6-luna"),
    attachments: [],
    work: { mode: "chat", contextPolicy: "isolated_on_demand" }
  };
}

async function handleWorkRequest(payload, runtime) {
  const work = payload.work && typeof payload.work === "object" ? payload.work : {};
  const selected = rootByAlias(runtime.readRoots, String(work.rootAlias || ""));
  const canEdit = work.edit === true;
  if (canEdit && !runtime.editRoots.length) throw new Error("CODEXWORK_EDIT_ROOTS_REQUIRED");

  const jobDir = await fs.mkdtemp(path.join(runtime.tempRoot, "work-"));
  const staging = path.join(jobDir, "workspace");
  await fs.mkdir(staging, { recursive: true });

  const snapshot = await copySnapshot(selected.path, staging, {
    maxFiles: runtime.maxFiles,
    maxBytes: runtime.maxBytes
  });

  const guard = [
    "QQAIBOT CodexWork safety boundary:",
    "- Work only with files visible in this staging workspace.",
    "- Never attempt deletion. If deletion seems necessary, explain it instead.",
    canEdit
      ? "- You may edit staging files. The trusted bridge will independently apply only changes whose original targets are inside configured edit roots."
      : "- This task is read-only. Do not write or modify files.",
    work.exportFiles
      ? "- To return a file to QQ, finish your response with [[QQAI_EXPORT:relative/path]] for each file that should be exported."
      : "- Do not request file export unless the user explicitly asked for it.",
    "- Do not ask for or reveal credentials, tokens, .env files, private keys, auth files, or excluded metadata.",
    "- Do not load unrelated plugins, MCP servers, or skills."
  ].join("\n");

  const request = {
    ...payload,
    messages: [
      { role: "system", content: guard },
      ...(Array.isArray(payload.messages) ? payload.messages : [])
    ]
  };

  try {
    const result = await runCodexTurn({
      payload: request,
      cwd: staging,
      sandboxMode: canEdit ? "workspace-write" : "read-only",
      codexHome: runtime.codexHome,
      sessionState: runtime.sessionState,
      stateFile: runtime.stateFile
    });

    const changes = canEdit
      ? await applyStagedChanges({
          originalRoot: selected.path,
          staging,
          baseline: snapshot.baseline,
          editRoots: runtime.editRoots,
          limits: { maxFiles: runtime.maxFiles, maxBytes: runtime.maxBytes }
        })
      : { applied: [], skipped: [], deletedIgnored: [], deletionApplied: false };

    const attachments = work.exportFiles
      ? await collectExports({
          staging,
          exportDir: runtime.exportDir,
          text: result.text,
          maxBytes: runtime.exportMaxBytes
        })
      : [];

    return {
      ok: true,
      text: result.text,
      model: String(payload.model || "gpt-6-luna"),
      attachments,
      work: {
        mode: canEdit ? "bounded_edit" : "read_only",
        rootAlias: selected.alias,
        snapshottedFiles: snapshot.files.length,
        snapshottedBytes: snapshot.totalBytes,
        applied: changes.applied,
        skipped: changes.skipped,
        deletedIgnored: changes.deletedIgnored,
        deletionApplied: false,
        exportCount: attachments.length
      }
    };
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

function normalizeBridgePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("CODEX_BRIDGE_INVALID_REQUEST");
  if (payload.protocol && payload.protocol !== PROTOCOL) throw new Error("CODEX_BRIDGE_PROTOCOL_UNSUPPORTED");
  return payload;
}

async function buildRuntime() {
  const readSpecs = parseRootSpec(process.env.QQAI_CODEXWORK_READ_ROOTS || "");
  const editSpecs = parseRootSpec(process.env.QQAI_CODEXWORK_EDIT_ROOTS || "");
  const roots = readSpecs.length ? await normalizeRoots(readSpecs, editSpecs) : { reads: [], edits: [] };
  const stateRoot = path.resolve(process.env.QQAI_CODEX_STATE_DIR || path.join(os.homedir(), ".qqaibot-codex-bridge"));
  const tempRoot = path.join(stateRoot, "tmp");
  const exportDir = path.resolve(process.env.QQAI_CODEXWORK_EXPORT_DIR || path.join(stateRoot, "exports"));
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(exportDir, { recursive: true });
  const codexHome = await ensureCodexHome();
  const stateFile = path.join(stateRoot, "sessions.json");
  return {
    readRoots: roots.reads,
    editRoots: roots.edits,
    stateRoot,
    tempRoot,
    exportDir,
    codexHome,
    stateFile,
    sessionState: await readSessionState(stateFile),
    maxFiles: clampInteger(process.env.QQAI_CODEXWORK_MAX_FILES, DEFAULT_MAX_FILES, 1, 50000),
    maxBytes: clampInteger(process.env.QQAI_CODEXWORK_MAX_BYTES, DEFAULT_MAX_BYTES, 1024, 1024 * 1024 * 1024),
    exportMaxBytes: clampInteger(process.env.QQAI_CODEXWORK_EXPORT_MAX_BYTES, DEFAULT_EXPORT_MAX_BYTES, 1024, 512 * 1024 * 1024)
  };
}

async function handleBridgeRequest(payload, runtime) {
  const input = normalizeBridgePayload(payload);
  if (input.type === "quota.request") {
    return { type: "quota.response", id: input.id, protocol: PROTOCOL, quota: { available: false, source: "not_exposed_by_local_bridge" } };
  }
  if (input.type !== "request") return null;
  const task = String(input.task || "chat").toLowerCase();
  const result = task === "work"
    ? await handleWorkRequest(input, runtime)
    : await handleChatRequest(input, runtime);
  return { ...result, id: input.id, type: "response", protocol: PROTOCOL };
}

async function main() {
  const url = String(process.env.QQAI_CODEX_BRIDGE_URL || "").trim();
  const token = String(process.env.QQAI_CODEX_BRIDGE_TOKEN || process.env.CODEX_BRIDGE_ACCESS_TOKEN || "").trim();
  if (!/^wss?:\/\//i.test(url)) throw new Error("QQAI_CODEX_BRIDGE_URL_REQUIRED");
  if (!token) throw new Error("QQAI_CODEX_BRIDGE_TOKEN_REQUIRED");

  let WebSocket;
  try {
    ({ WebSocket } = await import("ws"));
  } catch {
    throw new Error("WS_PACKAGE_REQUIRED: install with `npm install --no-save ws@8.21.3`");
  }

  const runtime = await buildRuntime();
  let reconnectMs = 1000;

  const connect = () => {
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
    ws.on("open", () => {
      reconnectMs = 1000;
      ws.send(JSON.stringify({
        type: "hello",
        protocol: PROTOCOL,
        role: "local-codex-work-bridge",
        capabilities: {
          chat: true,
          work: runtime.readRoots.length > 0,
          workEdit: runtime.editRoots.length > 0,
          delete: false,
          exports: true,
          rootAliases: runtime.readRoots.map(row => row.alias),
          editAliases: runtime.editRoots.map(row => row.alias)
        }
      }));
    });
    ws.on("message", async data => {
      let payload;
      try { payload = JSON.parse(String(data)); } catch { return; }
      if (payload?.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", protocol: PROTOCOL, at: Date.now() }));
        return;
      }
      try {
        const result = await handleBridgeRequest(payload, runtime);
        if (result) ws.send(JSON.stringify(result));
      } catch (error) {
        ws.send(JSON.stringify({
          type: "response",
          protocol: PROTOCOL,
          id: String(payload?.id || ""),
          ok: false,
          error: { code: String(error?.code || "CODEX_BRIDGE_LOCAL_ERROR"), message: String(error?.message || error).slice(0, 800) }
        }));
      }
    });
    ws.on("close", () => {
      setTimeout(connect, reconnectMs);
      reconnectMs = Math.min(30000, reconnectMs * 2);
    });
    ws.on("error", () => {});
  };

  connect();
}

const directRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (directRun) {
  main().catch(error => {
    console.error(`[codex-work-bridge] ${String(error?.message || error)}`);
    process.exitCode = 1;
  });
}

export {
  ALWAYS_EXCLUDED_DIRS,
  SENSITIVE_BASENAME_PATTERNS,
  applyStagedChanges,
  assertAllowedPath,
  buildRuntime,
  changedSnapshotFiles,
  collectExports,
  copySnapshot,
  exportMarkers,
  handleBridgeRequest,
  isPathInside,
  isSensitiveRelativePath,
  normalizeRoots,
  parseCodexJsonl,
  parseRootSpec,
  rootByAlias
};