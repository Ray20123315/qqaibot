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

function securityStatusLabel(row = {}) {
  if (row.status === "blocked") return "已阻止";
  if (row.status === "warning") return "需要检查";
  if (row.status === "risk_accepted") return "已知风险";
  if (row.status === "clear") return "检查正常";
  return "等待检查";
}

function securityRiskLabel(value) {
  return ({ none: "未发现风险", low: "低风险", medium: "中等风险", high: "高风险", critical: "严重风险" })[String(value || "")] || "待确认";
}

function securityImpactLabel(value) {
  const labels = {
    installing_user: "只影响安装者本人",
    owner: "可能影响平台拥有者",
    other_users: "可能影响其他使用者",
    shared_resources: "可能影响共享资源",
    core_secrets: "可能接触平台核心凭证",
    platform_integrity: "可能影响系统安全",
    cross_plugin: "可能影响其他插件",
    cross_tenant: "可能跨越其他账号或群组"
  };
  return labels[String(value || "")] || "需要进一步检查";
}

function securityPage(state) {
  const entries = Array.isArray(state?.entries) ? state.entries : [];
  const counts = entries.reduce((acc, row) => {
    if (row.status === "blocked") acc.blocked += 1;
    else if (row.status === "clear") acc.clear += 1;
    else acc.review += 1;
    return acc;
  }, { blocked: 0, review: 0, clear: 0 });

  const cards = entries.map(row => {
    const findings = (row.findings || []).map(f => {
      const impacts = [...new Set((f.impacts || []).map(securityImpactLabel))];
      return `<div class="finding"><div class="finding-title">${esc(f.summaryZh || "检测到需要确认的插件风险。")}</div>${impacts.length ? `<div class="chips">${impacts.map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}</div>`;
    }).join("");
    const statusClass = row.status === "blocked" ? "blocked" : row.status === "clear" ? "clear" : "warning";
    const actionText = row.status === "blocked"
      ? "这个版本已被平台阻止执行，不能由使用者强制开启。"
      : row.status === "warning"
        ? (row.overrideAllowed ? "风险目前只影响安装者本人，可在充分理解后自行决定。" : "这项风险不能由一般使用者忽略。")
        : row.status === "risk_accepted"
          ? "安装者已明确接受仅影响自己的风险；平台级安全边界仍然生效。"
          : "目前未发现需要阻止这个版本的风险。";
    const source = row.repositoryUrl ? `<a class="source" rel="noreferrer noopener" href="${esc(row.repositoryUrl)}">查看插件来源</a>` : "";
    const lastChecked = row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "尚未完成";
    return `<article class="card">
      <div class="card-head"><div><div class="eyebrow">插件版本</div><h2>${esc(row.pluginId || "未知插件")}</h2><div class="meta">版本 ${esc(row.version || "未知")} · ${esc(pluginTrustLabelZh(row.trustStatus))} · ${esc(releaseChannelLabelZh(row.releaseChannel))}</div></div><span class="status ${statusClass}">${esc(securityStatusLabel(row))}</span></div>
      <div class="risk-line"><strong>${esc(securityRiskLabel(row.riskLevel))}</strong><span>${esc(actionText)}</span></div>
      <div class="findings">${findings || '<div class="finding clear-note">没有需要显示的风险项目。</div>'}</div>
      <div class="card-foot"><span>最后检查：${esc(lastChecked)}</span>${source}</div>
    </article>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="index,follow">
<title>AIBot 插件安全检测中心</title>
<style>
:root{font-family:Inter,"Noto Sans TC",system-ui,-apple-system,sans-serif;color:#191b22;background:#f5f6f9}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 8%,rgba(111,122,255,.14),transparent 30%),radial-gradient(circle at 90% 72%,rgba(62,201,181,.10),transparent 28%),#f5f6f9;color:#191b22}
.wrap{width:min(1060px,calc(100% - 32px));margin:0 auto;padding:42px 0 70px}
.hero,.card{border:1px solid rgba(27,34,51,.09);background:rgba(255,255,255,.84);backdrop-filter:blur(20px);box-shadow:0 18px 60px rgba(26,34,50,.08)}
.hero{border-radius:28px;padding:30px;margin-bottom:16px}.eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;opacity:.55;font-weight:800}.hero h1{font-size:clamp(28px,5vw,44px);margin:8px 0 10px;letter-spacing:-.035em}.hero p{max-width:760px;line-height:1.7;margin:0;color:#5f6676}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}.metric{border-radius:18px;padding:15px;background:rgba(34,40,58,.045)}.metric b{display:block;font-size:28px;letter-spacing:-.03em}.metric span{font-size:12px;color:#6d7483}
.policy{margin-top:18px;border-radius:18px;padding:15px 17px;background:rgba(88,104,255,.075);font-size:13px;line-height:1.65;color:#535b6c}
.card{border-radius:22px;padding:21px;margin:13px 0}.card-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.card h2{font-size:20px;margin:5px 0}.meta,.card-foot{font-size:12px;color:#737a89}.status{white-space:nowrap;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}.status.blocked{background:#fee7e7;color:#9d2626}.status.warning{background:#fff3cf;color:#825c00}.status.clear{background:#def7eb;color:#156447}
.risk-line{display:grid;gap:5px;margin:18px 0 12px}.risk-line span{font-size:13px;color:#606879}.findings{display:grid;gap:10px}.finding{border-radius:15px;background:rgba(34,40,58,.04);padding:13px 14px}.finding-title{font-size:14px;line-height:1.55;font-weight:650}.clear-note{color:#647061}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.chip{padding:5px 8px;border-radius:999px;font-size:11px;background:rgba(87,98,128,.09);color:#5f6676}.card-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:15px;padding-top:13px;border-top:1px solid rgba(27,34,51,.07)}.source{color:inherit;text-decoration:none;font-weight:700}.source:hover{text-decoration:underline}.empty{border-radius:22px;padding:28px;background:rgba(255,255,255,.78);border:1px dashed rgba(27,34,51,.15);text-align:center;color:#6a7180}
@media(max-width:680px){.summary{grid-template-columns:1fr}.card-head,.card-foot{align-items:flex-start;flex-direction:column}.wrap{width:min(100% - 22px,1060px);padding-top:20px}.hero{padding:22px}.card{padding:17px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
@media(prefers-color-scheme:dark){:root{color:#eef1f7;background:#090d15}body{color:#eef1f7;background:radial-gradient(circle at 10% 5%,rgba(93,105,255,.17),transparent 30%),#090d15}.hero,.card{background:rgba(15,20,31,.88);border-color:rgba(205,215,255,.09);box-shadow:none}.hero p,.risk-line span,.meta,.card-foot,.chip{color:#9ca6b8}.metric,.finding{background:rgba(255,255,255,.04)}.policy{color:#b8c0d0;background:rgba(104,117,255,.09)}.card-foot{border-color:rgba(205,215,255,.08)}}
</style>
</head>
<body><main class="wrap">
<section class="hero"><div class="eyebrow">AIBot Plugin Safety</div><h1>插件安全检测中心</h1><p>这里显示平台对插件版本的安全检查结果。插件若可能影响其他使用者、共享资源、平台凭证或系统安全，会直接停止执行并进入隔离，不允许强制绕过。</p>
<div class="summary"><div class="metric"><b>${counts.blocked}</b><span>已阻止</span></div><div class="metric"><b>${counts.review}</b><span>需要检查</span></div><div class="metric"><b>${counts.clear}</b><span>检查正常</span></div></div>
<div class="policy">平台不会在这个页面公开插件原始码、API Key、Secret、数据库凭证或可直接复现攻击的内容。这里提供的是足够让使用者判断风险的说明；系统仍保留机器可读的内部安全记录用于自动防护。</div></section>
${cards || '<section class="empty">目前没有需要显示的插件安全记录。</section>'}
</main></body></html>`;
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
  securityCenterForEnv,
  securityPage
};
