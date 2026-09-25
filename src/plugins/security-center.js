import { findingOverrideAllowed } from "./governance.js";

const PLUGIN_SECURITY_CENTER_KEY = "plugin_security:center:v1";
const PLUGIN_SECURITY_CENTER_SCHEMA_VERSION = 1;
const PLUGIN_SECURITY_MAX_FINDINGS = 32;

function cleanText(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeImpacts(values = []) {
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map(value => cleanText(value, 60).toLowerCase()).filter(Boolean))].slice(0, 16));
}

function normalizeFinding(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const impacts = normalizeImpacts(source.impacts);
  const finding = {
    code: cleanText(source.code || "PLUGIN_SECURITY_FINDING", 100).toUpperCase().replace(/[^A-Z0-9_.:-]/g, "_"),
    severity: ["low", "medium", "high", "critical"].includes(String(source.severity || "").toLowerCase()) ? String(source.severity).toLowerCase() : "medium",
    summaryZh: cleanText(source.summaryZh || source.summary || "偵測到需要人工確認的插件安全風險。", 500),
    impacts,
    source: cleanText(source.source || "deterministic", 40).toLowerCase()
  };
  return Object.freeze({ ...finding, overrideAllowed: findingOverrideAllowed(finding) });
}

function riskLevel(findings = []) {
  const levels = { low: 1, medium: 2, high: 3, critical: 4 };
  let highest = 0, label = "none";
  for (const finding of findings) {
    const score = levels[finding?.severity] || 0;
    if (score > highest) { highest = score; label = finding.severity; }
  }
  return label;
}

function securitySummary(findings = []) {
  const normalized = Object.freeze((Array.isArray(findings) ? findings : []).slice(0, PLUGIN_SECURITY_MAX_FINDINGS).map(normalizeFinding));
  return Object.freeze({
    findings: normalized,
    findingCount: normalized.length,
    riskLevel: riskLevel(normalized),
    overrideAllowed: normalized.length > 0 && normalized.every(finding => finding.overrideAllowed === true),
    blocked: normalized.some(finding => finding.overrideAllowed !== true)
  });
}

function textArtifact(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const max = Math.min(input.byteLength, 2 * 1024 * 1024);
  try { return new TextDecoder("utf-8", { fatal: false }).decode(input.subarray(0, max)); }
  catch { return ""; }
}

function deterministicScanPluginArtifact(bytes, context = {}) {
  const text = textArtifact(bytes);
  const findings = [];
  const add = finding => findings.push(normalizeFinding({ source: "deterministic", ...finding }));

  if (/\b(?:process\.env|env\.(?:DB|AI|ONEBOT_HUB|VECTORIZE|MY_RATE_LIMITER)|CLOUDFLARE_[A-Z0-9_]*TOKEN|PORTAL_AUTH_SECRET|ONEBOT_ACCESS_TOKEN)\b/i.test(text)) {
    add({ code: "CORE_SECRET_OR_BINDING_ACCESS", severity: "critical", summaryZh: "插件內容疑似嘗試直接取得 QQAI Core binding、Token 或 Secret；這類風險不可由單一安裝者自行承擔。", impacts: ["core_secrets", "platform_integrity", "owner"] });
  }
  if (/\b(?:child_process|node:vm|vm\.runIn|Deno\.(?:run|Command)|Bun\.spawn|unsafeEval)\b/i.test(text)) {
    add({ code: "SANDBOX_ESCAPE_PRIMITIVE", severity: "critical", summaryZh: "插件內容包含高風險執行／逃逸 primitive，可能影響平台完整性。", impacts: ["platform_integrity"] });
  }
  if (/\b(?:cross[_-]?tenant|other[_-]?users?|all[_-]?users?|global[_-]?storage|plugin:[a-z0-9._-]+:)\b/i.test(text) && /\b(?:delete|update|insert|write|put|set|exfil|fetch)\b/i.test(text)) {
    add({ code: "CROSS_SCOPE_DATA_ACCESS", severity: "critical", summaryZh: "插件內容疑似嘗試跨使用者、跨租戶或跨插件操作資料。", impacts: ["other_users", "cross_tenant", "cross_plugin"] });
  }
  if (/\b(?:shared[_-]?api|owner[_-]?(?:quota|key|token)|free[_-]?pool)\b/i.test(text) && /\b(?:loop|while\s*\(|Promise\.all|fetch|request)\b/i.test(text)) {
    add({ code: "SHARED_RESOURCE_ABUSE", severity: "high", summaryZh: "插件內容疑似可能大量消耗擁有者或共享資源額度。", impacts: ["shared_resources", "owner"] });
  }
  if (/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|rules?)|(?:reveal|print|dump)\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message)|越過.*(?:系統|開發者).*指令|忽略.*(?:先前|之前).*指令/i.test(text)) {
    add({ code: "PROMPT_INJECTION_PATTERN", severity: "high", summaryZh: "插件內容含有常見 Prompt Injection／系統提示詞擷取語句。若只影響安裝者自己的互動，可在明確承擔風險後繼續。", impacts: ["installing_user"] });
  }
  if (/(?:document\.cookie|localStorage|sessionStorage|authorization|bearer|api[_-]?key|access[_-]?token)/i.test(text) && /\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(/i.test(text)) {
    add({ code: "POTENTIAL_DATA_EXFILTRATION", severity: "high", summaryZh: "插件內容同時出現憑證／使用者資料字樣與外部傳輸程式碼，需要確認資料是否會被送往第三方。", impacts: ["installing_user"] });
  }
  if ((text.match(/\batob\s*\(/g) || []).length >= 3 || (text.match(/String\.fromCharCode/g) || []).length >= 3 || /eval\s*\(|new\s+Function\s*\(/.test(text)) {
    add({ code: "OBFUSCATED_OR_DYNAMIC_CODE", severity: "medium", summaryZh: "插件含較高程度的動態執行或字串解碼特徵，建議人工確認來源與用途。", impacts: ["installing_user"] });
  }

  const summary = securitySummary(findings);
  return Object.freeze({
    ...summary,
    scanner: "qqai-deterministic-v1",
    scannedBytes: bytes instanceof Uint8Array ? bytes.byteLength : Number(bytes?.byteLength || 0),
    mediaType: cleanText(context.mediaType || "", 100)
  });
}

function normalizeStore(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    schemaVersion: PLUGIN_SECURITY_CENTER_SCHEMA_VERSION,
    updatedAt: Number(source.updatedAt || 0) || null,
    entries: source.entries && typeof source.entries === "object" && !Array.isArray(source.entries) ? { ...source.entries } : {}
  };
}

function securityRecordId({ pluginId, version, hash }) {
  return [cleanText(pluginId, 80).toLowerCase(), cleanText(version, 80), cleanText(hash, 80).toLowerCase()].join("@");
}

function createPluginSecurityCenter(storageAdapter, { nowProvider = Date.now } = {}) {
  if (!storageAdapter || typeof storageAdapter.get !== "function" || typeof storageAdapter.put !== "function") throw new Error("PLUGIN_SECURITY_STORAGE_INVALID");
  let cached = null;

  async function read() {
    if (cached) return cached;
    const raw = await storageAdapter.get(PLUGIN_SECURITY_CENTER_KEY);
    if (raw === null || raw === undefined || raw === "") { cached = normalizeStore(null); return cached; }
    try { cached = normalizeStore(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { cached = normalizeStore(null); }
    return cached;
  }

  async function write(next) {
    const frozen = Object.freeze({
      schemaVersion: PLUGIN_SECURITY_CENTER_SCHEMA_VERSION,
      updatedAt: Number(next.updatedAt || nowProvider()),
      entries: Object.freeze({ ...(next.entries || {}) })
    });
    await storageAdapter.put(PLUGIN_SECURITY_CENTER_KEY, JSON.stringify(frozen));
    cached = frozen;
    return frozen;
  }

  async function report(input = {}) {
    const now = Number(nowProvider());
    const summary = securitySummary(input.findings || []);
    const id = securityRecordId(input);
    const state = await read();
    const previous = state.entries?.[id] || {};
    const status = summary.blocked ? "blocked" : summary.findingCount ? "warning" : "clear";
    const record = Object.freeze({
      id,
      pluginId: cleanText(input.pluginId, 80).toLowerCase(),
      version: cleanText(input.version, 80),
      hash: cleanText(input.hash, 80).toLowerCase(),
      authorKeyId: cleanText(input.authorKeyId, 120).toLowerCase(),
      repositoryUrl: cleanText(input.repositoryUrl, 500),
      trustStatus: cleanText(input.trustStatus || "uncertified", 40).toLowerCase(),
      releaseChannel: cleanText(input.releaseChannel || "stable", 40).toLowerCase(),
      status,
      riskLevel: summary.riskLevel,
      overrideAllowed: summary.overrideAllowed,
      findings: summary.findings,
      firstSeenAt: Number(previous.firstSeenAt || now),
      lastCheckedAt: now,
      lastHourlyReviewAt: Number(previous.lastHourlyReviewAt || 0) || null,
      riskAcceptedAt: null,
      riskAcceptedBy: "",
      updatedAt: now
    });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [id]: record } });
    return record;
  }

  async function list() {
    const state = await read();
    return Object.freeze(Object.values(state.entries || {}).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)));
  }

  async function get(id) {
    const state = await read();
    return state.entries?.[String(id || "")] || null;
  }

  async function acceptRisk(id, actorId = "") {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) throw new Error("PLUGIN_SECURITY_NOT_FOUND:" + key);
    if (existing.status === "blocked" || existing.overrideAllowed !== true) throw new Error("PLUGIN_SECURITY_OVERRIDE_FORBIDDEN");
    if (!existing.findings?.length) throw new Error("PLUGIN_SECURITY_OVERRIDE_NOT_REQUIRED");
    const now = Number(nowProvider());
    const record = Object.freeze({ ...existing, status: "risk_accepted", riskAcceptedAt: now, riskAcceptedBy: cleanText(actorId, 80), updatedAt: now });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function markHourlyReview(id, { findings = null, reviewer = "qqai-hourly" } = {}) {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) return null;
    const now = Number(nowProvider());
    const nextSummary = securitySummary(Array.isArray(findings) ? findings : existing.findings || []);
    const previousSignature = JSON.stringify((existing.findings || []).map(f => [f.code, f.severity, f.summaryZh, f.impacts]));
    const nextSignature = JSON.stringify((nextSummary.findings || []).map(f => [f.code, f.severity, f.summaryZh, f.impacts]));
    const findingsUnchanged = previousSignature === nextSignature;
    const preserveAcceptance = existing.status === "risk_accepted" && findingsUnchanged && nextSummary.overrideAllowed && !nextSummary.blocked;
    const record = Object.freeze({
      ...existing,
      status: nextSummary.blocked ? "blocked" : preserveAcceptance ? "risk_accepted" : nextSummary.findingCount ? "warning" : "clear",
      riskLevel: nextSummary.riskLevel,
      overrideAllowed: nextSummary.overrideAllowed,
      findings: nextSummary.findings,
      lastCheckedAt: now,
      lastHourlyReviewAt: now,
      lastReviewer: cleanText(reviewer, 80),
      updatedAt: now,
      ...(!preserveAcceptance ? { riskAcceptedAt: null, riskAcceptedBy: "" } : {})
    });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function touchHourlyReview(now = Number(nowProvider())) {
    const state = await read();
    const entries = {};
    for (const [id, row] of Object.entries(state.entries || {})) {
      if (!row) continue;
      entries[id] = Object.freeze({ ...row, lastHourlyReviewAt: Number(now), updatedAt: Number(now), lastReviewer: "qqai-hourly-index" });
    }
    if (Object.keys(entries).length) await write({ ...state, entries, updatedAt: Number(now) });
    return Object.freeze({ checked: Object.keys(entries).length, at: Number(now) });
  }

  function publicRecord(row) {
    return Object.freeze({
      id: String(row?.id || ""),
      pluginId: String(row?.pluginId || ""),
      version: String(row?.version || ""),
      sha256: String(row?.hash || ""),
      repositoryUrl: String(row?.repositoryUrl || ""),
      trustStatus: String(row?.trustStatus || "uncertified"),
      releaseChannel: String(row?.releaseChannel || "stable"),
      status: String(row?.status || "unknown"),
      riskLevel: String(row?.riskLevel || "none"),
      overrideAllowed: row?.overrideAllowed === true,
      findings: Object.freeze((row?.findings || []).map(f => Object.freeze({ code: f.code, severity: f.severity, summaryZh: f.summaryZh, impacts: Object.freeze([...(f.impacts || [])]), overrideAllowed: f.overrideAllowed === true, source: f.source }))),
      firstSeenAt: Number(row?.firstSeenAt || 0) || null,
      lastCheckedAt: Number(row?.lastCheckedAt || 0) || null,
      lastHourlyReviewAt: Number(row?.lastHourlyReviewAt || 0) || null
    });
  }

  async function listPublic() {
    return Object.freeze((await list()).map(publicRecord));
  }

  return Object.freeze({ acceptRisk, get, list, listPublic, markHourlyReview, read, report, touchHourlyReview });
}

export {
  PLUGIN_SECURITY_CENTER_KEY,
  PLUGIN_SECURITY_CENTER_SCHEMA_VERSION,
  PLUGIN_SECURITY_MAX_FINDINGS,
  createPluginSecurityCenter,
  deterministicScanPluginArtifact,
  normalizeFinding,
  securityRecordId,
  securitySummary
};
