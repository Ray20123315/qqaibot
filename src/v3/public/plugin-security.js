import { createPluginSecurityCenter } from "../../plugins/security-center.js";
import { pluginTrustLabelZh, releaseChannelLabelZh } from "../../plugins/governance.js";
import { createPluginAuthorTrustStore } from "../../plugins/trust.js";
import { createPluginQuarantine } from "../../plugins/quarantine.js";
import { runHourlyPluginSecurityReview } from "../../plugins/security-review.js";

function createSecurityStorageAdapter(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") throw new Error("PLUGIN_SECURITY_STORAGE_UNAVAILABLE");
  return Object.freeze({
    async get(key) {
      const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(String(key)).first();
      return row ? row.value : null;
    },
    async put(key, value) {
      const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(key), String(value)).run();
      if (result?.success === false) throw new Error("PLUGIN_SECURITY_STORAGE_WRITE_FAILED");
    }
  });
}

function securityCenterForEnv(env, overrides = {}) {
  if (overrides.securityCenter) return overrides.securityCenter;
  return createPluginSecurityCenter(overrides.storageAdapter || createSecurityStorageAdapter(env), {
    nowProvider: overrides.nowProvider || Date.now
  });
}

async function buildPluginSecurityPublicState(env, overrides = {}) {
  const rows = await securityCenterForEnv(env, overrides).listPublic();
  return Object.freeze({
    ok: true,
    service: "QQAI 插件安全中心",
    policy: Object.freeze({
      uncertifiedCanAcceptContainedRisk: true,
      systemicRiskOverrideAllowed: false,
      systemicImpacts: Object.freeze(["owner", "other_users", "shared_resources", "core_secrets", "platform_integrity", "cross_plugin", "cross_tenant"]),
      noteZh: "尚未取得認證的插件可在風險只影響安裝者本人時自行承擔；涉及擁有者、其他使用者、共享資源、Core Secret 或平台完整性的風險不可強制載入。"
    }),
    generatedAt: Date.now(),
    count: rows.length,
    entries: rows
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function securityPage(state) {
  const cards = (state.entries || []).map(row => {
    const findings = (row.findings || []).map(f => `<li><strong>${esc(f.severity)} · ${esc(f.code)}</strong> — ${esc(f.summaryZh)}<br><small>影響：${esc((f.impacts || []).join(", "))}｜${f.overrideAllowed ? "可由安裝者自行承擔" : "不可 override"}</small></li>`).join("");
    const statusClass = row.status === "blocked" ? "blocked" : row.status === "clear" ? "clear" : "warning";
    return `<article class="card"><div class="head"><div><h2>${esc(row.pluginId)} <small>v${esc(row.version)}</small></h2><div class="meta">${esc(pluginTrustLabelZh(row.trustStatus))} · ${esc(releaseChannelLabelZh(row.releaseChannel))}</div></div><span class="status ${statusClass}">${esc(row.status)}</span></div><p><strong>SHA-256：</strong><code>${esc(row.sha256)}</code></p><p><strong>風險：</strong>${esc(row.riskLevel)} · ${row.overrideAllowed ? "可由安裝者承擔" : (row.status === "clear" ? "目前無 finding" : "不可自行承擔")}</p>${row.repositoryUrl ? `<p><strong>來源：</strong><a rel="noreferrer noopener" href="${esc(row.repositoryUrl)}">${esc(row.repositoryUrl)}</a></p>` : ""}<ul>${findings || "<li>目前沒有公開 finding。</li>"}</ul><p class="time">首次發現：${esc(row.firstSeenAt ? new Date(row.firstSeenAt).toISOString() : "-")}｜最後掃描：${esc(row.lastCheckedAt ? new Date(row.lastCheckedAt).toISOString() : "-")}｜整點索引：${esc(row.lastHourlyReviewAt ? new Date(row.lastHourlyReviewAt).toISOString() : "-")}</p></article>`;
  }).join("");
  return `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQAI 插件安全中心</title><meta name="robots" content="index,follow"><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f8fb;color:#1f2937}.wrap{max-width:1000px;margin:auto;padding:32px 18px 64px}.hero,.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:20px;margin-bottom:14px}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.meta,.time,small{color:#667085}.status{font-weight:800;border-radius:999px;padding:5px 9px}.status.blocked{background:#fee2e2;color:#991b1b}.status.warning{background:#fef3c7;color:#92400e}.status.clear{background:#dcfce7;color:#166534}code{overflow-wrap:anywhere}li{margin:8px 0}a{color:inherit}</style></head><body><main class="wrap"><section class="hero"><h1>QQAI 插件安全中心</h1><p>公開安全資訊只包含插件身分、版本、SHA-256 與安全 finding；不提供惡意 artifact、API Key、D1、Secret 或可直接執行的攻擊內容。</p><p><strong>規則：</strong>未認證插件若風險只影響安裝者本人，可在明確警告後自行承擔；會影響擁有者、其他使用者、共享資源或平台完整性的風險不可強制載入。</p><p>機器可讀資料：<a href="/api/v3/plugin-security">/api/v3/plugin-security</a></p></section>${cards || '<section class="card"><p>目前沒有已登錄的安全 finding。</p></section>'}</main></body></html>`;
}

async function handleV3PluginSecurityPublic(request, env, url = null, overrides = {}) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (request.method !== "GET") return null;
  if (target.pathname !== "/plugin-security" && target.pathname !== "/api/v3/plugin-security") return null;
  try {
    const state = await buildPluginSecurityPublicState(env, overrides);
    if (target.pathname === "/api/v3/plugin-security") {
      return new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return new Response(securityPage(state), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    const payload = { ok: false, code: String(error?.message || "PLUGIN_SECURITY_UNAVAILABLE").split(":")[0], message: "插件安全中心目前無法讀取。" };
    if (target.pathname === "/api/v3/plugin-security") return new Response(JSON.stringify(payload), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response("<!doctype html><meta charset=utf-8><title>QQAI 插件安全中心</title><h1>插件安全中心目前無法讀取</h1>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
}

async function runV3PluginSecurityScheduled(env, scheduledTime = Date.now(), overrides = {}) {
  const at = Number(scheduledTime || Date.now());
  const date = new Date(at);
  if (date.getUTCMinutes() !== 0) return Object.freeze({ ok: true, skipped: true, reason: "NOT_HOURLY_BOUNDARY", at });
  if (!env?.DB && !overrides.storageAdapter && !overrides.securityCenter) return Object.freeze({ ok: false, skipped: true, reason: "PLUGIN_SECURITY_STORAGE_UNAVAILABLE", at });

  const storageAdapter = overrides.storageAdapter || createSecurityStorageAdapter(env);
  const securityCenter = overrides.securityCenter || createPluginSecurityCenter(storageAdapter, { nowProvider: overrides.nowProvider || (() => at) });
  const trustStore = overrides.trustStore || createPluginAuthorTrustStore(storageAdapter, { nowProvider: overrides.nowProvider || (() => at) });
  const quarantine = overrides.quarantine || createPluginQuarantine(storageAdapter, {
    trustStore,
    securityCenter,
    fetchArtifact: overrides.fetchArtifact || (async () => { throw new Error("PLUGIN_SECURITY_DIRECT_FETCH_ONLY"); }),
    nowProvider: overrides.nowProvider || (() => at)
  });

  const result = await runHourlyPluginSecurityReview(env, {
    quarantine,
    trustStore,
    securityCenter,
    limit: overrides.limit,
    fetchArtifact: overrides.fetchSecurityArtifact,
    gptReview: overrides.gptReview
  });
  return Object.freeze({ ok: true, skipped: false, at, ...result });
}

export {
  buildPluginSecurityPublicState,
  createSecurityStorageAdapter,
  handleV3PluginSecurityPublic,
  runV3PluginSecurityScheduled,
  securityCenterForEnv
};
