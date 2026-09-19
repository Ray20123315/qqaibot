import { VERSION } from "../../config/runtime.js";
import { writeSystemAudit } from "../../core/permissions.js";
import { jsonResponse } from "../../portal/auth.js";
import { trustedBundledPluginById, trustedBundledPluginCatalog, trustedBundledPluginIds } from "../../plugins/catalog.js";
import { createPluginPackageRegistry } from "../../plugins/package.js";
import { authenticatePluginManager, decodePluginId } from "./plugin-manager.js";
import { v3BilibiliEnabled } from "../runtime/bridge.js";

const V3_PACKAGE_MANAGER_BASE = "/api/portal/v3/packages";
const PACKAGE_TRANSACTION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function packageManagerMethodAllowed(request, methods) {
  return methods.includes(String(request?.method || "GET").toUpperCase());
}

function decodeTransactionId(value) {
  let decoded = "";
  try { decoded = decodeURIComponent(String(value || "")); } catch { return ""; }
  decoded = decoded.trim();
  return PACKAGE_TRANSACTION_ID_PATTERN.test(decoded) ? decoded : "";
}

function createPortalPackageStorageAdapter(env, overrides = {}) {
  if (overrides.storageAdapter) return overrides.storageAdapter;
  if (!env?.DB || typeof env.DB.prepare !== "function") throw new Error("PLUGIN_PACKAGE_STORAGE_UNAVAILABLE");
  return Object.freeze({
    async get(key) {
      const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(String(key)).first();
      return result ? result.value : null;
    },
    async put(key, value) {
      const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(key), String(value)).run();
      if (result?.success === false) throw new Error("PLUGIN_PACKAGE_STORAGE_WRITE_FAILED");
    },
    async del(key) {
      const result = await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(String(key)).run();
      if (result?.success === false) throw new Error("PLUGIN_PACKAGE_STORAGE_DELETE_FAILED");
    }
  });
}

function packageRegistryForPortal(env, overrides = {}) {
  if (overrides.registry) return overrides.registry;
  return createPluginPackageRegistry(createPortalPackageStorageAdapter(env, overrides), {
    qqaiVersion: String(overrides.qqaiVersion || VERSION),
    trustedCandidateIds: overrides.trustedCandidateIds || trustedBundledPluginIds(),
    nowProvider: overrides.nowProvider || Date.now,
    transactionIdProvider: overrides.transactionIdProvider
  });
}

function runtimeConfiguredForCatalogEntry(entry, env) {
  if (entry?.runtimeBinding === "bilibili") return v3BilibiliEnabled(env);
  return false;
}

function safePackageTransaction(transaction, now = Date.now()) {
  if (!transaction || typeof transaction !== "object") return null;
  return Object.freeze({
    id: String(transaction.id || ""),
    type: String(transaction.type || ""),
    pluginId: String(transaction.pluginId || ""),
    status: String(transaction.status || ""),
    actorId: String(transaction.actorId || ""),
    createdAt: Number(transaction.createdAt || 0) || null,
    expiresAt: Number(transaction.expiresAt || 0) || null,
    expired: Number(transaction.expiresAt || 0) > 0 && Number(transaction.expiresAt) < Number(now),
    committedAt: Number(transaction.committedAt || 0) || null,
    committedBy: String(transaction.committedBy || ""),
    rolledBackTransactionId: String(transaction.rolledBackTransactionId || ""),
    descriptor: transaction.descriptor ? Object.freeze({
      id: String(transaction.descriptor.id || ""),
      name: String(transaction.descriptor.name || ""),
      version: String(transaction.descriptor.version || ""),
      apiVersion: String(transaction.descriptor.apiVersion || ""),
      integrity: String(transaction.descriptor.integrity || "")
    }) : null,
    integrity: transaction.integrity ? Object.freeze({
      algorithm: String(transaction.integrity.algorithm || ""),
      hash: String(transaction.integrity.hash || ""),
      scope: String(transaction.integrity.scope || ""),
      preverified: transaction.integrity.preverified === true
    }) : null
  });
}

function packageCatalogSummary(entry, installed, env) {
  const installedVersion = String(installed?.descriptor?.version || "");
  const catalogVersion = String(entry?.descriptor?.version || "");
  return Object.freeze({
    id: String(entry?.id || ""),
    name: String(entry?.descriptor?.name || entry?.id || ""),
    official: entry?.descriptor?.official === true,
    catalogVersion,
    apiVersion: String(entry?.descriptor?.apiVersion || ""),
    sourcePath: String(entry?.sourcePath || ""),
    sourceSha256: String(entry?.sourceSha256 || ""),
    integrityScope: String(entry?.integrityScope || ""),
    requestedPermissions: Object.freeze([...(entry?.descriptor?.requestedPermissions || [])]),
    dependencies: entry?.descriptor?.dependencies || Object.freeze({}),
    metadataInstalled: Boolean(installed),
    installedVersion,
    verifiedHash: String(installed?.verifiedHash || ""),
    updateAvailable: Boolean(installed && installedVersion && catalogVersion && installedVersion !== catalogVersion),
    runtimeCodeBundled: entry?.trustedBundled === true,
    runtimeCandidateConfigured: runtimeConfiguredForCatalogEntry(entry, env),
    runtimeCodeLoaded: null
  });
}

async function listPortalPackageState(env, overrides = {}) {
  const registry = packageRegistryForPortal(env, overrides);
  const state = await registry.read();
  const catalog = typeof overrides.catalog === "function" ? overrides.catalog() : trustedBundledPluginCatalog();
  const now = Number((overrides.nowProvider || Date.now)());
  const packages = catalog.map(entry => packageCatalogSummary(entry, state.packages?.[entry.id]?.state === "installed" ? state.packages[entry.id] : null, env));
  const staged = Object.values(state.staged || {}).map(tx => safePackageTransaction(tx, now)).filter(Boolean).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const history = [...(state.history || [])].reverse().slice(0,20).map(tx => safePackageTransaction(tx, now)).filter(Boolean);
  return Object.freeze({
    schemaVersion: 1,
    qqaiVersion: String(overrides.qqaiVersion || VERSION),
    catalogCount: packages.length,
    packages: Object.freeze(packages),
    staged: Object.freeze(staged),
    history: Object.freeze(history),
    notice: "Package metadata registration does not load JavaScript. Runtime activation remains controlled by the V3 lifecycle manager."
  });
}

function packageManagerErrorResponse(error, fallbackStatus = 400) {
  const raw = String(error?.code || error?.message || "PLUGIN_PACKAGE_MANAGER_ERROR");
  const code = raw.split(":")[0].slice(0,120);
  const messages = {
    PLUGIN_PACKAGE_STORAGE_UNAVAILABLE: "套件资料库目前不可用。",
    PLUGIN_PACKAGE_STORAGE_WRITE_FAILED: "套件资料写入失败。",
    PLUGIN_PACKAGE_CANDIDATE_NOT_BUNDLED: "此套件不是当前 Worker 已审核并内建的候选。",
    PLUGIN_PACKAGE_ALREADY_CURRENT: "目前 metadata 已是 catalog 最新版本。",
    PLUGIN_PACKAGE_ACTION_MISMATCH: "此操作与目前 metadata 安装状态不一致。",
    PLUGIN_PACKAGE_NOT_INSTALLED: "此套件 metadata 尚未安装。",
    PLUGIN_PACKAGE_DEPENDENTS_EXIST: "仍有其他套件依赖此套件，不能移除。",
    PLUGIN_PACKAGE_DEPENDENCY_UNSATISFIED: "套件依赖条件尚未满足。",
    PLUGIN_PACKAGE_REVERSE_DEPENDENCY_UNSATISFIED: "更新会破坏其他已安装套件的依赖条件。",
    PLUGIN_PACKAGE_STAGE_NOT_FOUND: "找不到 staged transaction。",
    PLUGIN_PACKAGE_STAGE_EXPIRED: "staged transaction 已过期，请重新建立。",
    PLUGIN_PACKAGE_HISTORY_NOT_FOUND: "找不到可回滚的 transaction。",
    PLUGIN_PACKAGE_ROLLBACK_DEPENDENCY_UNSATISFIED: "回滚后的依赖条件无法满足。",
    PLUGIN_PACKAGE_ROLLBACK_REVERSE_DEPENDENCY_UNSATISFIED: "回滚会破坏其他套件依赖。",
    PLUGIN_PACKAGE_TRUSTED_HASH_INVALID: "内建套件的 build-verified SHA-256 无效。",
    PLUGIN_PACKAGE_TRUSTED_HASH_MISMATCH: "内建套件 SHA-256 与 catalog 不一致。"
  };
  return jsonResponse({ ok:false, code, message:messages[code] || "套件操作失败，请检查当前状态。" }, fallbackStatus);
}

async function handleV3PackageManagerAuthed(request, env, url, body, session, overrides = {}) {
  const pathname = url.pathname;
  const registry = packageRegistryForPortal(env, overrides);

  if (pathname === V3_PACKAGE_MANAGER_BASE) {
    if (!packageManagerMethodAllowed(request, ["GET"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 GET。"},405,{Allow:"GET"});
    try { return jsonResponse({ ok:true, ...(await listPortalPackageState(env, overrides)) }); }
    catch (error) { return packageManagerErrorResponse(error, 503); }
  }

  const stageMatch = pathname.match(/^\/api\/portal\/v3\/packages\/([^/]+)\/stage$/);
  if (stageMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const pluginId = decodePluginId(stageMatch[1]);
    if (!pluginId) return jsonResponse({ok:false,code:"PLUGIN_ID_INVALID",message:"插件 ID 无效。"},400);
    const action = String(body?.action || "").trim().toLowerCase();
    if (!["install","update","uninstall"].includes(action)) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_ACTION_INVALID",message:"action 必须是 install、update 或 uninstall。"},400);
    try {
      const installed = await registry.get(pluginId);
      let transaction;
      if (action === "uninstall") {
        transaction = await registry.stageUninstall(pluginId, { actorId: session.qq });
      } else {
        const entry = (typeof overrides.catalogById === "function" ? overrides.catalogById(pluginId) : trustedBundledPluginById(pluginId));
        if (!entry) throw new Error("PLUGIN_PACKAGE_CANDIDATE_NOT_BUNDLED:" + pluginId);
        if (action === "install" && installed) throw new Error("PLUGIN_PACKAGE_ACTION_MISMATCH");
        if (action === "update" && !installed) throw new Error("PLUGIN_PACKAGE_ACTION_MISMATCH");
        if (installed && String(installed.descriptor?.version || "") === String(entry.descriptor?.version || "") && String(installed.verifiedHash || "") === String(entry.sourceSha256 || "")) {
          throw new Error("PLUGIN_PACKAGE_ALREADY_CURRENT");
        }
        transaction = await registry.stageTrustedInstall(entry.descriptor, { verifiedHash: entry.sourceSha256, actorId: session.qq });
      }
      await writeSystemAudit(env, { type:"v3_plugin_package_stage", actorId:session.qq, action, pluginId, transactionId:transaction.id }).catch(()=>{});
      return jsonResponse({ ok:true, transaction:safePackageTransaction(transaction), state:await listPortalPackageState(env, overrides), message:"已建立 staged transaction；尚未 commit。" });
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const commitMatch = pathname.match(/^\/api\/portal\/v3\/packages\/transactions\/([^/]+)\/commit$/);
  if (commitMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const transactionId = decodeTransactionId(commitMatch[1]);
    if (!transactionId) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_TRANSACTION_ID_INVALID",message:"transaction ID 无效。"},400);
    try {
      const result = await registry.commit(transactionId, { actorId:session.qq });
      await writeSystemAudit(env, { type:"v3_plugin_package_commit", actorId:session.qq, action:result.transaction?.type || "commit", pluginId:result.transaction?.pluginId || "", transactionId }).catch(()=>{});
      return jsonResponse({ok:true,result:{transaction:safePackageTransaction(result.transaction),package:result.package},state:await listPortalPackageState(env,overrides),message:"metadata transaction 已 commit；这不代表 JavaScript runtime 已加载。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const cancelMatch = pathname.match(/^\/api\/portal\/v3\/packages\/transactions\/([^/]+)$/);
  if (cancelMatch) {
    if (!packageManagerMethodAllowed(request, ["DELETE"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 DELETE。"},405,{Allow:"DELETE"});
    const transactionId = decodeTransactionId(cancelMatch[1]);
    if (!transactionId) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_TRANSACTION_ID_INVALID",message:"transaction ID 无效。"},400);
    try {
      const cancelled = await registry.cancelStaged(transactionId);
      if (!cancelled) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_STAGE_NOT_FOUND",message:"找不到 staged transaction。"},404);
      await writeSystemAudit(env, { type:"v3_plugin_package_cancel", actorId:session.qq, action:"cancel", transactionId }).catch(()=>{});
      return jsonResponse({ok:true,state:await listPortalPackageState(env,overrides),message:"staged transaction 已取消。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const rollbackMatch = pathname.match(/^\/api\/portal\/v3\/packages\/history\/([^/]+)\/rollback$/);
  if (rollbackMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const transactionId = decodeTransactionId(rollbackMatch[1]);
    if (!transactionId) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_TRANSACTION_ID_INVALID",message:"transaction ID 无效。"},400);
    try {
      const result = await registry.rollback(transactionId, { actorId:session.qq });
      await writeSystemAudit(env, { type:"v3_plugin_package_rollback", actorId:session.qq, action:"rollback", pluginId:result.transaction?.pluginId || "", transactionId }).catch(()=>{});
      return jsonResponse({ok:true,result:{transaction:safePackageTransaction(result.transaction),package:result.package},state:await listPortalPackageState(env,overrides),message:"metadata rollback 已完成；runtime lifecycle 未自动改变。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_MANAGER_ROUTE_NOT_FOUND",message:"未知套件管理接口。"},404);
}

async function handleV3PackageManagerApi(request, env, url = null, overrides = {}) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (!target.pathname.startsWith(V3_PACKAGE_MANAGER_BASE)) return null;
  let body = {};
  if (!["GET","HEAD"].includes(String(request.method || "GET").toUpperCase())) {
    try { body = await request.json(); } catch { body = {}; }
  }
  const auth = await authenticatePluginManager(request, env, target, body, overrides);
  if (!auth.ok) return auth.response;
  return handleV3PackageManagerAuthed(request, env, target, body, auth.session, overrides);
}


function injectV3PackageManagerClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-v3-package-manager-style")) return source;
  const marker = '<div id="v3PluginList" class="v3-plugin-grid">';
  if (!source.includes(marker)) return source;

  const section = [
    '<div id="v3PackageManager" class="v3-package-manager">',
    '<div class="section-head"><div><h3>Trusted Package Metadata</h3><p>这里只管理当前 Worker 已内建/审核候选的 package metadata。Commit 不会动态加载 JavaScript，Plugin Lifecycle 仍独立控制启用状态。</p></div><button id="v3PackageRefresh" class="btn">刷新套件</button></div>',
    '<div id="v3PackageNotice" class="notice">尚未读取 package registry。</div>',
    '<h4 class="v3-package-subtitle">Bundled Catalog</h4><div id="v3PackageCatalog" class="v3-package-grid"></div>',
    '<h4 class="v3-package-subtitle">Staged Transactions</h4><div id="v3PackageStaged" class="v3-package-stack"></div>',
    '<h4 class="v3-package-subtitle">Recent History</h4><div id="v3PackageHistory" class="v3-package-stack"></div>',
    '</div>'
  ].join("");
  source = source.replace(marker, section + marker);

  const style = '<style id="qqai-v3-package-manager-style">.v3-package-manager{margin-top:16px;padding:16px;border:1px solid var(--line);border-radius:17px;background:var(--panel)}.v3-package-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:10px}.v3-package-card,.v3-package-tx{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel2)}.v3-package-title,.v3-package-tx{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v3-package-title h4{margin:0}.v3-package-badges,.v3-package-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.v3-package-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--panel);font-size:11px;font-weight:800}.v3-package-stack{display:grid;gap:8px}.v3-package-subtitle{margin:16px 0 6px}.v3-package-card code{font-size:11px}@media(max-width:700px){.v3-package-title,.v3-package-tx{display:block}.v3-package-actions{margin-top:10px}}</style>';
  source = source.includes("</head>") ? source.replace("</head>", style + "</head>") : style + source;
  const script = "<script id=\"qqai-v3-package-manager-client\">\n(function(){\n'use strict';\nvar nav=document.getElementById('v3PluginManagerNav');\nvar root=document.getElementById('v3PackageManager');\nvar catalog=document.getElementById('v3PackageCatalog');\nvar staged=document.getElementById('v3PackageStaged');\nvar history=document.getElementById('v3PackageHistory');\nvar notice=document.getElementById('v3PackageNotice');\nvar refresh=document.getElementById('v3PackageRefresh');\nif(!nav||!root||!catalog||!staged||!history||!notice)return;\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[x]})}\nfunction shortHash(v){v=String(v||'');return v.length>20?v.slice(0,12)+'…'+v.slice(-8):v}\nfunction when(v){if(!v)return'-';try{return new Date(Number(v)).toLocaleString()}catch(e){return String(v)}}\nasync function req(path,method,body){var init={method:method||'GET',headers:{Accept:'application/json'}};if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}var res=await fetch('/api/portal/v3/packages'+(path||''),init),data={};try{data=await res.json()}catch(e){}return{status:res.status,data:data}}\nfunction packageCard(p){\n  var badges='<span class=\"v3-package-badge\">'+(p.official?'官方':'第三方')+'</span>'\n    +'<span class=\"v3-package-badge\">'+(p.runtimeCodeBundled?'Runtime code 已随 Worker bundle':'Runtime code 未 bundle')+'</span>'\n    +'<span class=\"v3-package-badge\">'+(p.runtimeCandidateConfigured?'Runtime candidate 已配置':'Runtime candidate 未配置')+'</span>';\n  var meta=p.metadataInstalled?'<span class=\"status ok\">metadata installed</span>':'<span class=\"status warning\">metadata not installed</span>';\n  var action='';\n  if(!p.metadataInstalled)action='<button class=\"btn primary\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"install\">Stage metadata install</button>';\n  else{\n    if(p.updateAvailable)action+='<button class=\"btn primary\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"update\">Stage metadata update</button>';\n    action+='<button class=\"btn danger\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"uninstall\">Stage metadata uninstall</button>';\n  }\n  return '<article class=\"v3-package-card\"><div class=\"v3-package-title\"><div><h4>'+esc(p.name||p.id)+'</h4><div class=\"item-meta\">'+esc(p.id)+'｜catalog v'+esc(p.catalogVersion)+(p.installedVersion?'｜installed v'+esc(p.installedVersion):'')+'</div></div>'+meta+'</div><div class=\"v3-package-badges\">'+badges+'</div><div class=\"item-meta\">Build-verified source SHA-256：<code>'+esc(shortHash(p.sourceSha256))+'</code></div><div class=\"item-meta\">Integrity scope：'+esc(p.integrityScope||'-')+'</div><div class=\"item-meta\">runtimeCodeLoaded：'+esc(p.runtimeCodeLoaded===null?'unknown / not claimed':p.runtimeCodeLoaded)+'</div><div class=\"v3-package-actions\">'+action+'</div></article>';\n}\nfunction stagedCard(t){\n  var commit=t.expired?'<button class=\"btn\" disabled>已过期</button>':'<button class=\"btn primary\" data-v3-pkg-commit=\"'+esc(t.id)+'\">Commit metadata</button>';\n  return '<article class=\"v3-package-tx\"><div><b>'+esc(t.type)+' · '+esc(t.pluginId)+'</b><div class=\"item-meta\">'+esc(t.id)+'｜expires '+esc(when(t.expiresAt))+'</div></div><div class=\"v3-package-actions\">'+commit+'<button class=\"btn\" data-v3-pkg-cancel=\"'+esc(t.id)+'\">取消 staged transaction</button></div></article>';\n}\nfunction historyCard(t){\n  var rollback=['install','update','uninstall'].includes(String(t.type||''))?'<button class=\"btn\" data-v3-pkg-rollback=\"'+esc(t.id)+'\">Rollback metadata</button>':'';\n  return '<article class=\"v3-package-tx\"><div><b>'+esc(t.type)+' · '+esc(t.pluginId)+'</b><div class=\"item-meta\">'+esc(t.id)+'｜committed '+esc(when(t.committedAt))+'</div></div><div class=\"v3-package-actions\">'+rollback+'</div></article>';\n}\nfunction bind(){\n  root.querySelectorAll('[data-v3-pkg-stage]').forEach(function(b){b.onclick=function(){stagePackage(this.dataset.v3PkgStage,this.dataset.action)}});\n  root.querySelectorAll('[data-v3-pkg-commit]').forEach(function(b){b.onclick=function(){commitTx(this.dataset.v3PkgCommit)}});\n  root.querySelectorAll('[data-v3-pkg-cancel]').forEach(function(b){b.onclick=function(){cancelTx(this.dataset.v3PkgCancel)}});\n  root.querySelectorAll('[data-v3-pkg-rollback]').forEach(function(b){b.onclick=function(){rollbackTx(this.dataset.v3PkgRollback)}});\n}\nfunction render(data){\n  notice.textContent=(data.notice||'')+'｜Metadata 操作不会自动改变 Plugin Lifecycle。';\n  catalog.innerHTML=(data.packages||[]).map(packageCard).join('')||'<div class=\"empty\">目前没有 trusted bundled package。</div>';\n  staged.innerHTML=(data.staged||[]).map(stagedCard).join('')||'<div class=\"empty\">没有 staged transaction。</div>';\n  history.innerHTML=(data.history||[]).map(historyCard).join('')||'<div class=\"empty\">尚无 transaction history。</div>';\n  bind();\n}\nasync function load(){\n  notice.textContent='正在读取 trusted package catalog 与 metadata lock…';\n  var r=await req('');\n  if(r.status===401||r.status===403){root.hidden=true;return}\n  root.hidden=false;\n  if(!r.data.ok){notice.textContent=r.data.message||'套件资料读取失败。';return}\n  render(r.data);\n}\nasync function stagePackage(id,action){\n  if(!confirm('确定建立 '+action+' 的 metadata staged transaction？\\n这不会加载或卸载 JavaScript runtime code。'))return;\n  var r=await req('/'+encodeURIComponent(id)+'/stage','POST',{action:action});\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function commitTx(id){\n  if(!confirm('Commit 这笔 metadata transaction？\\nRuntime activation 仍由 Lifecycle Manager 独立控制。'))return;\n  var r=await req('/transactions/'+encodeURIComponent(id)+'/commit','POST');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function cancelTx(id){\n  var r=await req('/transactions/'+encodeURIComponent(id),'DELETE');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function rollbackTx(id){\n  if(!confirm('Rollback 这笔 metadata transaction？'))return;\n  var r=await req('/history/'+encodeURIComponent(id)+'/rollback','POST');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nnav.addEventListener('click',function(){setTimeout(load,0)});\nif(refresh)refresh.onclick=load;\n})();\n</script>";
  source = source.includes("</body>") ? source.replace("</body>", script + "</body>") : source + script;
  return source;
}

export {
  V3_PACKAGE_MANAGER_BASE,
  createPortalPackageStorageAdapter,
  decodeTransactionId,
  handleV3PackageManagerApi,
  handleV3PackageManagerAuthed,
  injectV3PackageManagerClient,
  listPortalPackageState,
  packageCatalogSummary,
  packageManagerErrorResponse,
  packageRegistryForPortal,
  safePackageTransaction
};
