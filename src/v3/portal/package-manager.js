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

export {
  V3_PACKAGE_MANAGER_BASE,
  createPortalPackageStorageAdapter,
  decodeTransactionId,
  handleV3PackageManagerApi,
  handleV3PackageManagerAuthed,
  listPortalPackageState,
  packageCatalogSummary,
  packageManagerErrorResponse,
  packageRegistryForPortal,
  safePackageTransaction
};
