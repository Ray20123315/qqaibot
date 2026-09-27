import { isDeveloperId } from "../core/identity.js";
import { getOneBotHub, getPortalSession, jsonResponse, readCookie, readJson } from "./auth.js";

const PORTAL_DIAGNOSTICS_BASE = "/api/portal/diagnostics";

const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|secret|token|password|credential|api[_-]?key|private[_-]?key|session)/i;
const SENSITIVE_TEXT_PATTERNS = Object.freeze([
  /Bearer\s+[A-Za-z0-9._~+\/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi
]);

function redactText(value) {
  let text = String(value ?? "");
  for (const pattern of SENSITIVE_TEXT_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  return text;
}

function sanitizeDiagnosticValue(value, depth = 0) {
  if (depth > 6) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value).slice(0, 12000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(-1000).map(item => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 200)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeDiagnosticValue(item, depth + 1);
    }
    return output;
  }
  return redactText(value);
}

async function authenticateDiagnostics(request, env) {
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  const token = bearer || readCookie(request, "qqai_session");
  let session;
  try { session = await getPortalSession(env, token, { touch: false }); }
  catch {
    return { ok: false, response: jsonResponse({ ok: false, code: "SESSION_STORAGE_UNAVAILABLE", message: "会话资料库暂时不可用。" }, 503) };
  }
  if (!session) return { ok: false, response: jsonResponse({ ok: false, message: "请先登录 Portal。" }, 401) };
  if (!(session.systemAdmin || isDeveloperId(env, session.qq))) {
    return { ok: false, response: jsonResponse({ ok: false, message: "只有开发者或系统管理员可以查看系统诊断。" }, 403) };
  }
  return { ok: true, session };
}

async function safeOneBotStatus(env) {
  try {
    const response = await getOneBotHub(env).fetch("https://onebot-hub/status");
    const value = await response.json().catch(() => ({}));
    return sanitizeDiagnosticValue(value);
  } catch (error) {
    return { connected: false, error: redactText(error?.message || error) };
  }
}

async function runDeterministicSelfCheck(env) {
  const checks = [];

  const push = async (name, fn) => {
    const started = Date.now();
    try {
      const detail = await fn();
      checks.push({ name, status: "ok", latencyMs: Date.now() - started, detail: sanitizeDiagnosticValue(detail) });
    } catch (error) {
      checks.push({ name, status: "error", latencyMs: Date.now() - started, error: redactText(error?.message || error).slice(0, 500) });
    }
  };

  await push("D1", async () => {
    if (!env.DB) throw new Error("DB_NOT_BOUND");
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    if (!row?.ok) throw new Error("D1_QUERY_FAILED");
    return { query: true };
  });

  await push("OneBot", async () => {
    if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    const state = await safeOneBotStatus(env);
    if (!state?.connected) throw new Error(state?.error || "NAPCAT_NOT_CONNECTED");
    return {
      connected: true,
      sockets: state.sockets,
      pendingRpc: state.pendingRpc,
      lastHeartbeatAt: state.lastHeartbeatAt
    };
  });

  await push("Codex Bridge", async () => {
    if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    const state = await safeOneBotStatus(env);
    if (!state?.codexBridge?.connected) throw new Error("CODEX_BRIDGE_NOT_CONNECTED");
    return {
      connected: true,
      protocol: state.codexBridge.protocol,
      pending: state.codexBridge.pending,
      lastEventAt: state.codexBridge.lastEventAt
    };
  });

  checks.push({
    name: "Bindings",
    status: env.DB && env.ONEBOT_HUB ? "ok" : "error",
    latencyMs: 0,
    detail: {
      db: Boolean(env.DB),
      onebotHub: Boolean(env.ONEBOT_HUB),
      vectorize: Boolean(env.VECTORIZE),
      workersAi: Boolean(env.AI)
    }
  });

  return {
    ok: !checks.some(check => check.status === "error"),
    aiUsed: false,
    checkedAt: new Date().toISOString(),
    checks
  };
}

function terminalLine(kind, item) {
  const at = redactText(item?.at || item?.createdAt || item?.updatedAt || "");
  const type = redactText(item?.type || kind);
  const message = redactText(item?.message || item?.action || item?.error || "");
  const context = item?.context ? ` ${JSON.stringify(sanitizeDiagnosticValue(item.context))}` : "";
  return `[${at || "-"}] ${type}${message ? ` :: ${message}` : ""}${context}`;
}

async function collectDiagnosticLogs(env, limit = 500) {
  const max = Math.max(20, Math.min(2000, Number(limit) || 500));
  const [errors, audit, onebot] = await Promise.all([
    readJson(env, "system_error_logs", []).catch(() => []),
    readJson(env, "audit:system:global", []).catch(() => []),
    safeOneBotStatus(env)
  ]);
  const rows = [
    ...(Array.isArray(errors) ? errors.map(item => ({ kind: "error", ...sanitizeDiagnosticValue(item) })) : []),
    ...(Array.isArray(audit) ? audit.map(item => ({ kind: "audit", ...sanitizeDiagnosticValue(item) })) : [])
  ];
  rows.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  const selected = rows.slice(-max).reverse();
  const terminal = [
    `# QQAIBOT diagnostics ${new Date().toISOString()}`,
    `# OneBot connected=${Boolean(onebot?.connected)} Codex connected=${Boolean(onebot?.codexBridge?.connected)}`,
    ...selected.map(item => terminalLine(item.kind, item))
  ].join("\n");
  return { records: selected, terminal, onebot };
}

async function safeRepair(env) {
  if (!env.ONEBOT_HUB) return { ok: false, code: "ONEBOT_HUB_NOT_BOUND" };
  try {
    const response = await getOneBotHub(env).fetch("https://onebot-hub/v3/repair-safe", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    return sanitizeDiagnosticValue({ status: response.status, ...payload });
  } catch (error) {
    return { ok: false, code: "REPAIR_REQUEST_FAILED", error: redactText(error?.message || error) };
  }
}

async function handlePortalDiagnosticsApi(request, env, url = null) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (!target.pathname.startsWith(PORTAL_DIAGNOSTICS_BASE)) return null;
  const auth = await authenticateDiagnostics(request, env);
  if (!auth.ok) return auth.response;

  const subpath = target.pathname.slice(PORTAL_DIAGNOSTICS_BASE.length) || "/";
  if (request.method === "GET" && subpath === "/logs") {
    const logs = await collectDiagnosticLogs(env, target.searchParams.get("limit"));
    if (target.searchParams.get("download") === "1") {
      return new Response(logs.terminal + "\n", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="qqaibot-logs-${new Date().toISOString().slice(0, 10)}.log"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    return jsonResponse({ ok: true, ...logs });
  }

  if (request.method === "GET" && subpath === "/self-check") {
    return jsonResponse(await runDeterministicSelfCheck(env));
  }

  if (request.method === "POST" && subpath === "/repair") {
    const repaired = await safeRepair(env);
    const check = await runDeterministicSelfCheck(env);
    return jsonResponse({ ok: Boolean(repaired?.ok) && check.ok, repaired, check, aiUsed: false }, repaired?.ok ? 200 : 503);
  }

  return jsonResponse({ ok: false, message: "未知诊断接口。" }, 404);
}

function injectPortalDiagnosticsClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-diagnostics-client")) return source;

  const nav = '<button id="qqaiDiagnosticsNav" data-view="diagnostics" hidden>系统日志</button>';
  if (source.includes("</nav>")) source = source.replace("</nav>", nav + "</nav>");

  const section = [
    '<div id="qqaiDiagnosticsContent" class="content">',
    '<section id="v-diagnostics" class="view">',
    '<div class="section-head"><div><h2>系统日志与自我检测</h2><p>终端样式查看已脱敏日志；自我检测与安全修复不调用 AI。</p></div>',
    '<div class="row"><button id="diagRefresh" class="btn">刷新日志</button><button id="diagDownload" class="btn">下载日志</button><button id="diagCheck" class="btn">自我检测</button><button id="diagRepair" class="btn">安全修复</button></div></div>',
    '<div id="diagStatus" class="notice">尚未执行检测。</div>',
    '<pre id="diagTerminal" class="qqai-terminal">$ waiting for diagnostics...</pre>',
    '</section>',
    '</div>'
  ].join("");
  if (source.includes("</main>")) source = source.replace("</main>", section + "</main>");

  const style = '<style id="qqai-diagnostics-style">'
    + '.qqai-terminal{margin-top:14px;min-height:360px;max-height:65vh;overflow:auto;padding:16px;border-radius:14px;background:#0b0f14;color:#d6e2ee;border:1px solid #263241;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}'
    + '</style>';
  if (source.includes("</head>")) source = source.replace("</head>", style + "</head>");

  const script = `<script id="qqai-diagnostics-client">
(function(){
'use strict';
var nav=document.getElementById('qqaiDiagnosticsNav'),term=document.getElementById('diagTerminal'),status=document.getElementById('diagStatus');
if(!nav||!term||!status)return;
async function api(path,method){var r=await fetch('/api/portal/diagnostics'+path,{method:method||'GET',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?'{}':undefined}),d={};try{d=await r.json()}catch(e){}return{status:r.status,data:d}}
async function logs(){term.textContent='$ loading logs...';var r=await api('/logs?limit=800');if(!r.data.ok){term.textContent='$ '+(r.data.message||'日志读取失败');return}term.textContent=r.data.terminal||'$ no logs'}
async function check(){status.textContent='正在执行非 AI 自我检测...';var r=await api('/self-check');var rows=(r.data.checks||[]).map(function(x){return (x.status==='ok'?'[OK] ':'[ERROR] ')+x.name+(x.error?' :: '+x.error:'')});status.textContent=(r.data.ok?'检测通过':'检测发现问题')+'｜AI：未使用';term.textContent=rows.join('\\n')+'\\n\\n'+term.textContent}
async function repair(){status.textContent='正在执行安全修复...';var r=await api('/repair','POST');status.textContent=(r.data.ok?'安全修复完成并复检通过':'安全修复后仍有异常')+'｜AI：未使用';var rows=((r.data.check||{}).checks||[]).map(function(x){return (x.status==='ok'?'[OK] ':'[ERROR] ')+x.name+(x.error?' :: '+x.error:'')});term.textContent=rows.join('\\n')+'\\n\\n'+term.textContent}
document.getElementById('diagRefresh')?.addEventListener('click',logs);
document.getElementById('diagDownload')?.addEventListener('click',function(){window.location.href='/api/portal/diagnostics/logs?download=1&limit=2000'});
document.getElementById('diagCheck')?.addEventListener('click',check);
document.getElementById('diagRepair')?.addEventListener('click',repair);
var observer=new MutationObserver(function(){if(document.getElementById('app')&&!document.getElementById('app').classList.contains('hidden')){nav.hidden=false}});
observer.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['class']});
setTimeout(function(){if(document.getElementById('app')&&!document.getElementById('app').classList.contains('hidden'))nav.hidden=false},500);
})();
</script>`;
  return source.includes("</body>") ? source.replace("</body>", script + "</body>") : source + script;
}

export {
  PORTAL_DIAGNOSTICS_BASE,
  collectDiagnosticLogs,
  handlePortalDiagnosticsApi,
  injectPortalDiagnosticsClient,
  redactText,
  runDeterministicSelfCheck,
  sanitizeDiagnosticValue
};