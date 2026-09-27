import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTOCOL = "qqai-codex-bridge-v1";
const SENSITIVE_DIRS = new Set([".git", ".codex", ".agents", "node_modules"]);
const SENSITIVE_FILE = /^(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?|.*\.(?:pem|p12|pfx|key|kdbx))$/i;

function clampInt(v, fallback, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

function parseRootSpec(value) {
  const text = Array.isArray(value) ? value.join(";") : String(value || "");
  return text.split(";").map(v => v.trim()).filter(Boolean).map(raw => {
    const eq = raw.indexOf("=");
    const target = (eq >= 0 ? raw.slice(eq + 1) : raw).trim();
    const alias = (eq >= 0 ? raw.slice(0, eq) : path.basename(target)).trim();
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(alias)) throw new Error("CODEXWORK_ROOT_ALIAS_INVALID");
    if (!target) throw new Error("CODEXWORK_ROOT_PATH_REQUIRED");
    return { alias, path: path.resolve(target) };
  });
}

function isPathInside(target, root) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

function relativeSlash(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function isSensitiveRelativePath(relative) {
  const clean = String(relative || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean || clean === ".") return false;
  const parts = clean.split("/").filter(Boolean);
  if (parts.some(p => SENSITIVE_DIRS.has(p.toLowerCase()))) return true;
  return SENSITIVE_FILE.test(parts.at(-1) || "");
}

async function canonicalDir(value) {
  const real = await fs.realpath(path.resolve(value));
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) throw new Error("CODEXWORK_ROOT_NOT_DIRECTORY");
  return real;
}

async function normalizeRoots(readSpecs, editSpecs = []) {
  const reads = [];
  for (const spec of readSpecs || []) reads.push({ alias: String(spec.alias), path: await canonicalDir(spec.path) });
  if (!reads.length) throw new Error("CODEXWORK_READ_ROOTS_REQUIRED");
  const edits = [];
  for (const spec of editSpecs || []) {
    const real = await canonicalDir(spec.path);
    if (!reads.some(r => isPathInside(real, r.path))) throw new Error("CODEXWORK_EDIT_ROOT_OUTSIDE_READ_ROOT");
    edits.push({ alias: String(spec.alias), path: real });
  }
  return { reads, edits };
}

function rootByAlias(roots, alias = "") {
  const list = Array.isArray(roots) ? roots : [];
  if (alias) {
    const hit = list.find(r => r.alias === alias);
    if (!hit) throw new Error("CODEXWORK_ROOT_NOT_FOUND");
    return hit;
  }
  if (list.length === 1) return list[0];
  throw new Error("CODEXWORK_ROOT_REQUIRED");
}

function matchingRoot(target, roots) {
  return (roots || []).filter(r => isPathInside(target, r.path)).sort((a, b) => b.path.length - a.path.length)[0] || null;
}

async function assertAllowedPath(target, roots, { mode = "read", allowMissing = false } = {}) {
  const resolved = path.resolve(target);
  const root = matchingRoot(resolved, roots);
  if (!root) throw new Error(mode === "edit" ? "CODEXWORK_EDIT_PATH_DENIED" : "CODEXWORK_READ_PATH_DENIED");
  const rel = relativeSlash(root.path, resolved);
  if (isSensitiveRelativePath(rel)) throw new Error("CODEXWORK_SENSITIVE_PATH_DENIED");
  if (!allowMissing) {
    const real = await fs.realpath(resolved);
    if (!isPathInside(real, root.path)) throw new Error(mode === "edit" ? "CODEXWORK_EDIT_PATH_DENIED" : "CODEXWORK_READ_PATH_DENIED");
  }
  return { root, path: resolved, relative: rel };
}

function fileHash(buf) { return createHash("sha256").update(buf).digest("hex"); }

async function walkFiles(root, { maxFiles = 5000, maxBytes = 128 * 1024 * 1024 } = {}) {
  const rows = [];
  let bytes = 0;
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = relativeSlash(root, abs);
      if (isSensitiveRelativePath(rel) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { await walk(abs); continue; }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(abs);
      if (rows.length + 1 > maxFiles) throw new Error("CODEXWORK_SNAPSHOT_FILE_LIMIT");
      bytes += stat.size;
      if (bytes > maxBytes) throw new Error("CODEXWORK_SNAPSHOT_BYTE_LIMIT");
      rows.push({ absolute: abs, relative: rel, size: stat.size });
    }
  }
  await walk(root);
  return { files: rows, bytes };
}

async function copySnapshot(originalRoot, staging, limits = {}) {
  const root = await canonicalDir(originalRoot);
  await fs.mkdir(staging, { recursive: true });
  const scan = await walkFiles(root, limits);
  const baseline = {};
  const files = [];
  for (const row of scan.files) {
    const data = await fs.readFile(row.absolute);
    const dst = path.join(staging, ...row.relative.split("/"));
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.writeFile(dst, data);
    baseline[row.relative] = fileHash(data);
    files.push({ relative: row.relative, size: data.length });
  }
  return { files, bytes: scan.bytes, baseline };
}

async function applyStagedChanges({ originalRoot, staging, baseline = {}, editRoots = [], limits = {} }) {
  const root = await canonicalDir(originalRoot);
  const scan = await walkFiles(path.resolve(staging), limits);
  const applied = [], skipped = [], present = new Set();
  for (const row of scan.files) {
    const rel = String(row.relative).replace(/\\/g, "/");
    present.add(rel);
    if (isSensitiveRelativePath(rel)) { skipped.push({ path: rel, reason: "sensitive" }); continue; }
    const data = await fs.readFile(row.absolute);
    if (baseline[rel] === fileHash(data)) continue;
    const target = path.join(root, ...rel.split("/"));
    try { await assertAllowedPath(target, editRoots, { mode: "edit", allowMissing: true }); }
    catch (error) { skipped.push({ path: rel, reason: String(error?.message || error) }); continue; }
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = target + `.qqaibot-tmp-${process.pid}-${randomUUID()}`;
    await fs.writeFile(tmp, data);
    try { await fs.rename(tmp, target); }
    catch { await fs.copyFile(tmp, target); await fs.rm(tmp, { force: true }); }
    applied.push(rel);
  }
  const deletedIgnored = Object.keys(baseline).filter(rel => !present.has(rel));
  return { applied, skipped, deletedIgnored, deletionApplied: false };
}

function exportMarkers(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/\[\[QQAI_EXPORT:([^\]\r\n]{1,500})\]\]/g)) {
    const rel = String(m[1]).trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (rel && !out.includes(rel)) out.push(rel);
  }
  return out.slice(0, 10);
}

async function collectExports({ staging, exportDir, text, maxBytes = 32 * 1024 * 1024 }) {
  const root = await canonicalDir(staging);
  const outDir = path.resolve(exportDir);
  await fs.mkdir(outDir, { recursive: true });
  const result = [];
  let total = 0;
  for (const rel of exportMarkers(text)) {
    if (isSensitiveRelativePath(rel)) continue;
    const candidate = path.resolve(root, ...rel.split("/"));
    if (!isPathInside(candidate, root)) continue;
    let real;
    try { real = await fs.realpath(candidate); } catch { continue; }
    if (!isPathInside(real, root)) continue;
    const stat = await fs.lstat(real);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    total += stat.size;
    if (total > maxBytes) break;
    const safe = path.basename(rel).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 160) || "output";
    const dst = path.join(outDir, `${Date.now()}-${randomUUID().slice(0,8)}-${safe}`);
    await fs.copyFile(real, dst);
    result.push({ name: path.basename(rel), path: dst, size: stat.size });
  }
  return result;
}

function sessionPath(home) { return path.join(home, "qqaibot-sessions.json"); }
async function readSessions(home) { try { return JSON.parse(await fs.readFile(sessionPath(home), "utf8")); } catch { return {}; } }
async function writeSessions(home, data) {
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  const tmp = sessionPath(home) + `.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, sessionPath(home));
}

async function ensureCodexHome(home) {
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  const cfg = path.join(home, "config.toml");
  try { await fs.access(cfg); } catch { await fs.writeFile(cfg, 'approval_policy = "never"\n', { encoding: "utf8", mode: 0o600 }); }
}

function eventText(event) {
  const item = event?.item;
  if (item?.type === "agent_message") {
    if (typeof item.text === "string") return item.text;
    if (Array.isArray(item.content)) return item.content.map(x => x?.text || x?.content || "").join("");
  }
  if (event?.type === "message" && typeof event.text === "string") return event.text;
  return "";
}

function parseJsonl(stdout) {
  let threadId = "", text = "", usage = null;
  for (const line of String(stdout || "").split(/\r?\n/).filter(Boolean)) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e?.type === "thread.started") threadId = String(e.thread_id || e.threadId || "");
    const t = eventText(e).trim(); if (t) text = t;
    if (e?.type === "turn.completed" && e.usage) usage = e.usage;
  }
  return { threadId, text, usage };
}

function runProcess(command, args, { cwd, env, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("CODEX_BRIDGE_TIMEOUT")); }, clampInt(timeoutMs, 120000, 3000, 600000));
    child.stdout.on("data", c => { stdout += String(c); if (stdout.length > 8*1024*1024) child.kill("SIGKILL"); });
    child.stderr.on("data", c => { stderr += String(c); if (stderr.length > 2*1024*1024) child.kill("SIGKILL"); });
    child.on("error", e => { clearTimeout(timer); reject(e); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`CODEX_EXEC_FAILED:${String(stderr || stdout).slice(-1200)}`)); });
  });
}

function compactMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map(r => `${String(r?.role || "user").toUpperCase()}:\n${String(r?.content || "")}`).join("\n\n");
}

async function runCodexRequest(request, config) {
  const sessions = await readSessions(config.codexHome);
  const key = String(request.sessionKey || "");
  const previous = key ? String(sessions[key] || "") : "";
  const work = request.task === "work";
  let staging = "", snapshot = null, selected = null, cwd = config.chatCwd;
  try {
    if (work) {
      selected = rootByAlias(config.roots.reads, request.work?.rootAlias || "");
      if (request.work?.edit && !config.roots.edits.length) throw new Error("CODEXWORK_EDIT_ROOTS_REQUIRED");
      staging = await fs.mkdtemp(path.join(os.tmpdir(), "qqaibot-codexwork-"));
      snapshot = await copySnapshot(selected.path, staging, config.snapshotLimits);
      cwd = staging;
    }
    const safety = work ? [
      "You are in a QQAIBOT CodexWork staging snapshot.",
      "Never delete source data. Deletions in staging are ignored and never applied.",
      request.work?.edit ? "You may edit staging files; the bridge only writes back files inside the explicit edit allowlist." : "This request is read-only. Do not modify files.",
      "Do not load unrelated skills, plugins, MCP servers, .codex, or .agents context. Use only what is necessary.",
      request.work?.exportFiles ? "For each file that should be sent to QQ, add [[QQAI_EXPORT:relative/path]] at the end." : "Do not emit QQAI_EXPORT markers."
    ].join("\n") : "Do not load unrelated skills, plugins, MCP servers, or local project files. Use only the provided conversation context.";
    const prompt = safety + "\n\n" + compactMessages(request.messages);
    const sandbox = work && request.work?.edit ? "workspace-write" : "read-only";
    const common = ["--json", "--model", String(request.model || "gpt-6-luna"), "--sandbox", sandbox, "-c", 'approval_policy="never"'];
    const args = previous ? ["exec", "resume", ...common, previous, prompt] : ["exec", ...common, prompt];
    const run = await runProcess(config.codexBin, args, { cwd, env: { ...process.env, CODEX_HOME: config.codexHome }, timeoutMs: request.timeoutMs });
    const parsed = parseJsonl(run.stdout);
    if (!parsed.text) throw new Error("CODEX_EMPTY_RESPONSE");
    if (key && !previous && parsed.threadId) { sessions[key] = parsed.threadId; await writeSessions(config.codexHome, sessions); }
    if (key && previous && parsed.threadId && parsed.threadId !== previous) throw new Error("CODEX_SESSION_CHANGED_UNEXPECTEDLY");
    let attachments = [], workResult = null;
    if (work) {
      const changes = request.work?.edit ? await applyStagedChanges({ originalRoot: selected.path, staging, baseline: snapshot.baseline, editRoots: config.roots.edits, limits: config.snapshotLimits }) : { applied: [], skipped: [], deletedIgnored: [], deletionApplied: false };
      if (request.work?.exportFiles) attachments = await collectExports({ staging, exportDir: config.exportDir, text: parsed.text, maxBytes: config.exportMaxBytes });
      workResult = { mode: request.work?.edit ? "restricted-write" : "read-only", rootAlias: selected.alias, snapshottedFiles: snapshot.files.length, snapshottedBytes: snapshot.bytes, ...changes, exportCount: attachments.length, contextPolicy: "on_demand_minimal" };
    }
    return { text: parsed.text, model: String(request.model || "gpt-6-luna"), usage: parsed.usage, attachments, work: workResult };
  } finally { if (staging) await fs.rm(staging, { recursive: true, force: true }).catch(() => {}); }
}

function bridgeConfig(env = process.env) {
  return {
    url: String(env.QQAI_CODEX_BRIDGE_URL || "").trim(),
    token: String(env.QQAI_CODEX_BRIDGE_TOKEN || "").trim(),
    codexBin: String(env.QQAI_CODEX_BIN || "codex").trim() || "codex",
    codexHome: path.resolve(String(env.QQAI_CODEX_HOME || path.join(os.homedir(), ".qqaibot-codex"))),
    exportDir: path.resolve(String(env.QQAI_CODEXWORK_EXPORT_DIR || path.join(os.homedir(), "QQAIBOT-exports"))),
    chatCwd: path.resolve(String(env.QQAI_CODEX_CHAT_CWD || os.tmpdir())),
    readSpecs: parseRootSpec(env.QQAI_CODEXWORK_READ_ROOTS || ""),
    editSpecs: parseRootSpec(env.QQAI_CODEXWORK_EDIT_ROOTS || ""),
    snapshotLimits: { maxFiles: clampInt(env.QQAI_CODEXWORK_MAX_FILES, 5000, 1, 50000), maxBytes: clampInt(env.QQAI_CODEXWORK_MAX_BYTES, 128*1024*1024, 1024, 1024*1024*1024) },
    exportMaxBytes: clampInt(env.QQAI_CODEXWORK_EXPORT_MAX_BYTES, 32*1024*1024, 1024, 512*1024*1024)
  };
}

async function main() {
  const config = bridgeConfig();
  if (!config.url || !/^wss?:\/\//i.test(config.url)) throw new Error("QQAI_CODEX_BRIDGE_URL_REQUIRED");
  if (!config.token) throw new Error("QQAI_CODEX_BRIDGE_TOKEN_REQUIRED");
  try { config.roots = await normalizeRoots(config.readSpecs, config.editSpecs); }
  catch (e) { if (String(e?.message||e) === "CODEXWORK_READ_ROOTS_REQUIRED") config.roots = { reads: [], edits: [] }; else throw e; }
  await ensureCodexHome(config.codexHome); await fs.mkdir(config.exportDir, { recursive: true });
  const { WebSocket } = await import("ws");
  let retry = 1000;
  const connect = () => {
    const ws = new WebSocket(config.url, { headers: { Authorization: `Bearer ${config.token}` }, maxPayload: 2*1024*1024 });
    ws.on("open", () => { retry = 1000; ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL, role: "local-codex-bridge", at: Date.now() })); });
    ws.on("message", async raw => {
      let p; try { p = JSON.parse(String(raw)); } catch { return; }
      if (p?.type === "ping") return ws.send(JSON.stringify({ type: "pong", protocol: PROTOCOL, at: Date.now() }));
      if (p?.type === "hello") return;
      if (p?.type === "quota.request") return ws.send(JSON.stringify({ type: "quota.response", protocol: PROTOCOL, id: String(p.id||""), quota: { available: false, sampledAt: Date.now(), source: "qqaibot_local_bridge", error: "PLAN_QUOTA_NOT_QUERIED_BY_BRIDGE" } }));
      if (p?.type !== "request" || !p?.id) return;
      try {
        if (p.task === "work" && !config.roots.reads.length) throw new Error("CODEXWORK_READ_ROOTS_REQUIRED");
        const result = await runCodexRequest(p, config);
        ws.send(JSON.stringify({ type: "response", protocol: PROTOCOL, id: String(p.id), ok: true, ...result }));
      } catch (e) { ws.send(JSON.stringify({ type: "response", protocol: PROTOCOL, id: String(p.id), ok: false, error: String(e?.message || e).slice(0,1200) })); }
    });
    ws.on("close", () => setTimeout(connect, retry = Math.min(30000, retry*2)));
    ws.on("error", () => {});
  };
  connect();
}

export { applyStagedChanges, assertAllowedPath, bridgeConfig, collectExports, copySnapshot, exportMarkers, isPathInside, isSensitiveRelativePath, normalizeRoots, parseRootSpec, rootByAlias, runCodexRequest };

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invoked && import.meta.url === invoked) main().catch(e => { console.error("[qqai-codex-bridge]", e?.stack || e); process.exitCode = 1; });
