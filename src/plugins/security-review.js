import { PLUGIN_ALLOWED_ARTIFACT_TYPES, verifyDistributionArtifact } from "./distribution.js";
import { normalizeFinding, securitySummary, deterministicScanPluginArtifact } from "./security-center.js";
import { fetchPublicUrl } from "../security/network.js";

const PLUGIN_SECURITY_HOURLY_LIMIT = 20;
const PLUGIN_SECURITY_GPT_MAX_SOURCE_CHARS = 120000;

function envFlag(value, fallback = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(text);
}

async function fetchSecurityArtifact(distribution, fetchImpl = null) {
  const artifact = distribution?.artifact || {};
  const limit = Number(artifact.sizeBytes || 0);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("PLUGIN_SECURITY_ARTIFACT_SIZE_INVALID");
  const requester = typeof fetchImpl === "function"
    ? fetchImpl
    : (url, init) => fetchPublicUrl(url, init, 2);
  const response = await requester(String(artifact.url || ""), {
    method: "GET",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Accept": PLUGIN_ALLOWED_ARTIFACT_TYPES.join(", "),
      "User-Agent": "QQAIbot-V3-PluginSecurity/1.0"
    }
  });
  if (!response?.ok) throw new Error("PLUGIN_SECURITY_ARTIFACT_HTTP:" + Number(response?.status || 0));
  const contentLength = Number(response.headers?.get?.("Content-Length") || 0);
  if (contentLength && contentLength > limit) throw new Error("PLUGIN_ARTIFACT_TOO_LARGE");
  const actualType = String(response.headers?.get?.("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!PLUGIN_ALLOWED_ARTIFACT_TYPES.includes(actualType)) throw new Error("PLUGIN_DISTRIBUTION_MEDIA_TYPE_UNSUPPORTED");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > limit) throw new Error("PLUGIN_ARTIFACT_TOO_LARGE");
  return Object.freeze({ bytes: new Uint8Array(buffer), mediaType: actualType });
}

function responseOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

function parseJsonObject(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  try { return JSON.parse(source); } catch {}
  const start = source.indexOf("{"), end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(source.slice(start, end + 1)); } catch { return null; }
}

async function gptAssistedSecurityReview(env, { bytes, entry }, fetchImpl = fetch) {
  if (!envFlag(env?.PLUGIN_SECURITY_GPT_ENABLED, false)) return Object.freeze({ skipped: true, reason: "GPT_DISABLED", findings: Object.freeze([]) });
  const apiKey = String(env?.OPENAI_API_KEY || "").trim();
  const model = String(env?.PLUGIN_SECURITY_GPT_MODEL || "").trim();
  if (!apiKey || !model) return Object.freeze({ skipped: true, reason: "GPT_NOT_CONFIGURED", findings: Object.freeze([]) });

  let source = "";
  try {
    const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    source = new TextDecoder("utf-8", { fatal: false }).decode(raw).slice(0, PLUGIN_SECURITY_GPT_MAX_SOURCE_CHARS);
  } catch {}
  if (!source) return Object.freeze({ skipped: true, reason: "GPT_SOURCE_NOT_TEXT", findings: Object.freeze([]) });

  const prompt = [
    "You are a defense-in-depth reviewer for a sandboxed QQ bot plugin.",
    "Deterministic static checks are authoritative. Your findings are advisory only and must never downgrade or override deterministic findings.",
    "Review the supplied public plugin source for suspicious data exfiltration, prompt injection, hidden dynamic code, or misleading permission behavior.",
    "Return JSON only: {\"findings\":[{\"code\":\"...\",\"severity\":\"low|medium|high\",\"summaryZh\":\"Traditional Chinese summary\"}]}",
    "Do not include executable exploit steps, payloads, secrets, or long code excerpts.",
    "Plugin: " + String(entry?.pluginId || "") + " v" + String(entry?.version || ""),
    "Repository: " + String(entry?.distribution?.repositoryUrl || ""),
    "Source follows:",
    source
  ].join("\n");

  const body = {
    model,
    input: prompt,
    max_output_tokens: 1400
  };
  if (envFlag(env?.PLUGIN_SECURITY_GPT_WEB_SEARCH_ENABLED, true)) {
    body.tools = [{ type: "web_search" }];
  }
  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    return Object.freeze({ skipped: true, reason: "GPT_REQUEST_FAILED", error: String(error?.message || error).slice(0, 160), findings: Object.freeze([]) });
  }
  if (!response.ok) return Object.freeze({ skipped: true, reason: "GPT_HTTP_" + response.status, findings: Object.freeze([]) });
  let payload;
  try { payload = await response.json(); } catch { return Object.freeze({ skipped: true, reason: "GPT_RESPONSE_INVALID", findings: Object.freeze([]) }); }
  const parsed = parseJsonObject(responseOutputText(payload));
  const findings = [];
  for (const raw of Array.isArray(parsed?.findings) ? parsed.findings.slice(0, 8) : []) {
    findings.push(normalizeFinding({
      code: "GPT_" + String(raw?.code || "REVIEW").toUpperCase().replace(/[^A-Z0-9_.:-]/g, "_"),
      severity: ["low", "medium", "high"].includes(String(raw?.severity || "").toLowerCase()) ? String(raw.severity).toLowerCase() : "medium",
      summaryZh: String(raw?.summaryZh || raw?.summary || "GPT 輔助審查發現需要人工確認的風險。").slice(0, 500),
      impacts: ["installing_user"],
      source: "gpt"
    }));
  }
  return Object.freeze({ skipped: false, model, findings: Object.freeze(findings) });
}

async function reviewQuarantineEntry(entry, { env, trustStore, securityCenter, quarantine, fetchArtifact = fetchSecurityArtifact, gptReview = gptAssistedSecurityReview } = {}) {
  const deterministicFindings = [];
  let bytes = null;
  try {
    await trustStore.requireTrusted(entry?.distribution?.signature?.keyId, entry?.pluginId);
  } catch {
    deterministicFindings.push(normalizeFinding({
      code: "AUTHOR_TRUST_NOT_CURRENT",
      severity: "high",
      summaryZh: "此插件作者金鑰目前不再受信任或已被撤銷；在重新建立可信來源前不可載入。",
      impacts: ["platform_integrity"],
      source: "deterministic"
    }));
  }

  try {
    const fetched = await fetchArtifact(entry.distribution);
    bytes = fetched.bytes;
    await verifyDistributionArtifact(entry.distribution, bytes);
    deterministicFindings.push(...deterministicScanPluginArtifact(bytes, {
      mediaType: fetched.mediaType,
      descriptor: entry.distribution?.descriptor
    }).findings);
  } catch (error) {
    deterministicFindings.push(normalizeFinding({
      code: /HASH|SIZE|INTEGRITY/i.test(String(error?.message || "")) ? "ARTIFACT_INTEGRITY_CHANGED" : "ARTIFACT_RECHECK_FAILED",
      severity: "critical",
      summaryZh: /HASH|SIZE|INTEGRITY/i.test(String(error?.message || ""))
        ? "整點重掃時 artifact 與原先驗證的 SHA-256／大小不一致，已停止信任此版本。"
        : "整點重掃無法重新取得或驗證原 artifact，因此此版本暫時視為不可安全載入。",
      impacts: ["platform_integrity"],
      source: "deterministic"
    }));
  }

  let gpt = Object.freeze({ skipped: true, reason: "NO_VERIFIED_SOURCE", findings: Object.freeze([]) });
  if (bytes) {
    try { gpt = await gptReview(env || {}, { bytes, entry }); }
    catch (error) { gpt = Object.freeze({ skipped: true, reason: "GPT_REVIEW_FAILED", error: String(error?.message || error).slice(0, 160), findings: Object.freeze([]) }); }
  }
  const combined = [...deterministicFindings, ...(gpt.findings || [])];
  const summary = securitySummary(combined);
  const securityId = String(entry?.security?.recordId || "");
  const review = securityId
    ? await securityCenter.markHourlyReview(securityId, { findings: combined, reviewer: gpt.skipped ? "qqai-deterministic-hourly" : "qqai-deterministic+gpt" })
    : null;
  if (typeof quarantine?.applySecurityReview === "function") {
    await quarantine.applySecurityReview(entry.id, summary, { actorId: "scheduled", reviewer: gpt.skipped ? "qqai-deterministic-hourly" : "qqai-deterministic+gpt" });
  }
  return Object.freeze({
    id: String(entry?.id || ""),
    pluginId: String(entry?.pluginId || ""),
    riskLevel: summary.riskLevel,
    blocked: summary.blocked,
    findingCount: summary.findingCount,
    gpt: Object.freeze({ skipped: gpt.skipped === true, reason: String(gpt.reason || ""), model: String(gpt.model || "") }),
    securityRecord: review
  });
}

async function runHourlyPluginSecurityReview(env, { quarantine, trustStore, securityCenter, limit = PLUGIN_SECURITY_HOURLY_LIMIT, fetchArtifact, gptReview } = {}) {
  const entries = (await quarantine.list())
    .filter(entry => entry && entry.state !== "rejected")
    .slice(0, Math.max(1, Math.min(100, Number(limit || PLUGIN_SECURITY_HOURLY_LIMIT))));
  const results = [];
  for (const entry of entries) {
    results.push(await reviewQuarantineEntry(entry, { env, trustStore, securityCenter, quarantine, fetchArtifact, gptReview }));
  }
  return Object.freeze({ checked: results.length, results: Object.freeze(results) });
}

export {
  PLUGIN_SECURITY_GPT_MAX_SOURCE_CHARS,
  PLUGIN_SECURITY_HOURLY_LIMIT,
  envFlag,
  fetchSecurityArtifact,
  gptAssistedSecurityReview,
  parseJsonObject,
  responseOutputText,
  reviewQuarantineEntry,
  runHourlyPluginSecurityReview
};
