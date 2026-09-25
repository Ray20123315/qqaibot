import { VERSION } from "../../config/runtime.js";
import { writeSystemAudit } from "../../core/permissions.js";
import { jsonResponse } from "../../portal/auth.js";
import { trustedBundledPluginById, trustedBundledPluginCatalog, trustedBundledPluginIds } from "../../plugins/catalog.js";
import { createPluginPackageRegistry } from "../../plugins/package.js";
import { PLUGIN_ALLOWED_ARTIFACT_TYPES, PLUGIN_AUTHOR_KEY_ID_PATTERN } from "../../plugins/distribution.js";
import { createPluginAuthorTrustStore } from "../../plugins/trust.js";
import { createPluginQuarantine } from "../../plugins/quarantine.js";
import { createPluginSecurityCenter } from "../../plugins/security-center.js";
import { fetchPublicUrl } from "../../security/network.js";
import { authenticatePluginManager, decodePluginId } from "./plugin-manager.js";
import { v3BilibiliEnabled } from "../runtime/bridge.js";

const V3_PACKAGE_MANAGER_BASE = "/api/portal/v3/packages";
const PACKAGE_TRANSACTION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;


function decodeAuthorKeyId(value) {
  let decoded = "";
  try { decoded = decodeURIComponent(String(value || "")); } catch { return ""; }
  decoded = decoded.trim().toLowerCase();
  return PLUGIN_AUTHOR_KEY_ID_PATTERN.test(decoded) ? decoded : "";
}

async function fetchExternalPluginArtifact(url, { maxBytes, mediaType } = {}) {
  const limit = Number(maxBytes || 0);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("PLUGIN_EXTERNAL_FETCH_LIMIT_INVALID");
  let response;
  try {
    response = await fetchPublicUrl(url, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Accept": PLUGIN_ALLOWED_ARTIFACT_TYPES.join(", "),
        "User-Agent": "QQAIbot-V3-PluginVerifier/1.0"
      }
    }, 2);
  } catch (error) {
    throw new Error("PLUGIN_EXTERNAL_FETCH_FAILED:" + String(error?.message || error).slice(0, 160));
  }
  if (!response.ok) throw new Error("PLUGIN_EXTERNAL_FETCH_HTTP:" + response.status);
  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (contentLength && contentLength > limit) throw new Error("PLUGIN_ARTIFACT_TOO_LARGE");
  const actualType = String(response.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!PLUGIN_ALLOWED_ARTIFACT_TYPES.includes(actualType)) throw new Error("PLUGIN_DISTRIBUTION_MEDIA_TYPE_UNSUPPORTED");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > limit) throw new Error("PLUGIN_ARTIFACT_TOO_LARGE");
  return Object.freeze({
    bytes: new Uint8Array(buffer),
    mediaType: actualType === "application/octet-stream" ? String(mediaType || actualType) : actualType
  });
}

function externalStoresForPortal(env, overrides = {}) {
  const storageAdapter = overrides.storageAdapter || createPortalPackageStorageAdapter(env, overrides);
  const trustStore = overrides.authorTrustStore || createPluginAuthorTrustStore(storageAdapter, {
    nowProvider: overrides.nowProvider || Date.now
  });
  const securityCenter = overrides.securityCenter || createPluginSecurityCenter(storageAdapter, {
    nowProvider: overrides.nowProvider || Date.now
  });
  const quarantine = overrides.quarantine || createPluginQuarantine(storageAdapter, {
    trustStore,
    fetchArtifact: overrides.fetchExternalArtifact || fetchExternalPluginArtifact,
    securityCenter,
    scanArtifact: overrides.scanExternalArtifact,
    nowProvider: overrides.nowProvider || Date.now,
    idProvider: overrides.quarantineIdProvider
  });
  return Object.freeze({ storageAdapter, trustStore, securityCenter, quarantine });
}

function safeAuthorRecord(record) {
  if (!record) return null;
  return Object.freeze({
    keyId: String(record.keyId || ""),
    label: String(record.label || ""),
    status: String(record.status || ""),
    pluginIds: Object.freeze([...(record.pluginIds || [])]),
    publicKeyJwk: record.publicKeyJwk ? Object.freeze({
      kty: String(record.publicKeyJwk.kty || ""),
      crv: String(record.publicKeyJwk.crv || ""),
      x: String(record.publicKeyJwk.x || "")
    }) : null,
    createdAt: Number(record.createdAt || 0) || null,
    updatedAt: Number(record.updatedAt || 0) || null,
    updatedBy: String(record.updatedBy || "")
  });
}

function safeQuarantineRecord(record) {
  if (!record) return null;
  return Object.freeze({
    id: String(record.id || ""),
    pluginId: String(record.pluginId || ""),
    version: String(record.version || ""),
    state: String(record.state || ""),
    author: record.author ? Object.freeze({ keyId: String(record.author.keyId || ""), label: String(record.author.label || "") }) : null,
    artifact: record.distribution?.artifact ? Object.freeze({
      url: String(record.distribution.artifact.url || ""),
      immutableRef: String(record.distribution.artifact.immutableRef || ""),
      mediaType: String(record.distribution.artifact.mediaType || ""),
      sizeBytes: Number(record.distribution.artifact.sizeBytes || 0),
      sha256: String(record.distribution.artifact.sha256 || "")
    }) : null,
    repositoryUrl: String(record.distribution?.repositoryUrl || ""),
    verification: record.verification ? Object.freeze({
      signatureVerified: record.verification.signatureVerified === true,
      artifactVerified: record.verification.artifactVerified === true,
      hash: String(record.verification.hash || ""),
      sizeBytes: Number(record.verification.sizeBytes || 0),
      verifiedAt: Number(record.verification.verifiedAt || 0) || null
    }) : null,
    security: record.security ? Object.freeze({
      recordId: String(record.security.recordId || ""),
      scanner: String(record.security.scanner || ""),
      findingCount: Number(record.security.findingCount || 0),
      riskLevel: String(record.security.riskLevel || "none"),
      overrideAllowed: record.security.overrideAllowed === true,
      blocked: record.security.blocked === true,
      findings: Object.freeze((record.security.findings || []).map(finding => Object.freeze({
        code: String(finding.code || ""),
        severity: String(finding.severity || ""),
        summaryZh: String(finding.summaryZh || ""),
        impacts: Object.freeze([...(finding.impacts || [])]),
        overrideAllowed: finding.overrideAllowed === true
      })))
    }) : null,
    acceptedRiskAt: Number(record.acceptedRiskAt || 0) || null,
    acceptedRiskBy: String(record.acceptedRiskBy || ""),
    rejectionReason: String(record.rejectionReason || ""),
    approvedAt: Number(record.approvedAt || 0) || null,
    rejectedAt: Number(record.rejectedAt || 0) || null,
    createdAt: Number(record.createdAt || 0) || null,
    updatedAt: Number(record.updatedAt || 0) || null,
    updatedBy: String(record.updatedBy || "")
  });
}

async function listExternalPluginState(env, overrides = {}) {
  const { trustStore, quarantine } = externalStoresForPortal(env, overrides);
  const [authors, entries] = await Promise.all([trustStore.list(), quarantine.list()]);
  return Object.freeze({
    authors: Object.freeze(authors.map(safeAuthorRecord).filter(Boolean)),
    quarantine: Object.freeze(entries.map(safeQuarantineRecord).filter(Boolean)),
    notice: "外部／自制插件的批准只验证作者签名与插件文件完整性；批准不会执行 JavaScript，也不会自动授予运行权限。"
  });
}

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
    notice: "登记插件安装信息不会加载 JavaScript；插件启用状态仍由 V3 生命周期管理单独控制。"
  });
}

function packageManagerErrorResponse(error, fallbackStatus = 400) {
  const raw = String(error?.code || error?.message || "PLUGIN_PACKAGE_MANAGER_ERROR");
  const code = raw.split(":")[0].slice(0,120);
  const messages = {
    PLUGIN_PACKAGE_STORAGE_UNAVAILABLE: "插件包资料库目前不可用。",
    PLUGIN_PACKAGE_STORAGE_WRITE_FAILED: "插件包资料写入失败。",
    PLUGIN_PACKAGE_CANDIDATE_NOT_BUNDLED: "此插件包不是当前 Worker 已审核并内置的候选。",
    PLUGIN_PACKAGE_ALREADY_CURRENT: "当前安装信息已经是内置目录中的最新版本。",
    PLUGIN_PACKAGE_ACTION_MISMATCH: "此操作与当前插件安装信息状态不一致。",
    PLUGIN_PACKAGE_NOT_INSTALLED: "此插件包尚未登记安装信息。",
    PLUGIN_PACKAGE_DEPENDENTS_EXIST: "仍有其他插件包依赖此插件包，不能移除。",
    PLUGIN_PACKAGE_DEPENDENCY_UNSATISFIED: "插件包依赖条件尚未满足。",
    PLUGIN_PACKAGE_REVERSE_DEPENDENCY_UNSATISFIED: "更新会破坏其他已安装套件的依赖条件。",
    PLUGIN_PACKAGE_STAGE_NOT_FOUND: "找不到待提交操作。",
    PLUGIN_PACKAGE_STAGE_EXPIRED: "待提交操作已过期，请重新建立。",
    PLUGIN_PACKAGE_HISTORY_NOT_FOUND: "找不到可回滚的操作记录。",
    PLUGIN_PACKAGE_ROLLBACK_DEPENDENCY_UNSATISFIED: "回滚后的依赖条件无法满足。",
    PLUGIN_PACKAGE_ROLLBACK_REVERSE_DEPENDENCY_UNSATISFIED: "回滚会破坏其他插件包依赖。",
    PLUGIN_PACKAGE_TRUSTED_HASH_INVALID: "内置插件包的 build-verified SHA-256 无效。",
    PLUGIN_PACKAGE_TRUSTED_HASH_MISMATCH: "内置插件包 SHA-256 与 catalog 不一致。",
    PLUGIN_AUTHOR_KEY_ID_INVALID: "作者密钥 ID 无效。",
    PLUGIN_AUTHOR_PUBLIC_KEY_INVALID: "作者公钥 不是有效的 Ed25519 JWK。",
    PLUGIN_AUTHOR_PRIVATE_KEY_FORBIDDEN: "禁止上传或保存作者 private key；这里只能使用 public JWK。",
    PLUGIN_AUTHOR_STATUS_INVALID: "作者密钥 状态无效。",
    PLUGIN_AUTHOR_KEY_NOT_FOUND: "找不到作者公钥。",
    PLUGIN_AUTHOR_KEY_UNTRUSTED: "此作者公钥 尚未被信任。",
    PLUGIN_AUTHOR_KEY_REVOKED: "此作者公钥 已撤销。",
    PLUGIN_AUTHOR_KEY_SCOPE_DENIED: "此作者密钥 未获授权签署该 插件 ID。",
    PLUGIN_SIGNATURE_INVALID: "Ed25519 签名验证失败。",
    PLUGIN_SECURITY_OVERRIDE_FORBIDDEN: "此风险可能影响拥有者、其他用户、共享资源、Core Secret 或平台完整性，禁止自行承担并强制加载。",
    PLUGIN_SECURITY_OVERRIDE_NOT_REQUIRED: "此项目目前不需要风险 override。",
    PLUGIN_SECURITY_NOT_FOUND: "找不到对应的插件安全中心记录。",
    PLUGIN_QUARANTINE_STATE_INVALID: "目前隔离区状态不允许这个操作。",
    PLUGIN_SIGNATURE_ALGORITHM_UNSUPPORTED: "只支持 Ed25519 签名。",
    PLUGIN_DISTRIBUTION_SCHEMA_UNSUPPORTED: "不支持的 distribution schemaVersion。",
    PLUGIN_DISTRIBUTION_HTTPS_REQUIRED: "外部插件 artifact/repository URL 必须使用 HTTPS。",
    PLUGIN_DISTRIBUTION_URL_UNSAFE: "外部插件 URL 指向不允许的私有或本机目标。",
    PLUGIN_DISTRIBUTION_IMMUTABLE_REF_INVALID: "immutableRef 无效。",
    PLUGIN_DISTRIBUTION_SIZE_INVALID: "artifact sizeBytes 无效或超过上限。",
    PLUGIN_DISTRIBUTION_MEDIA_TYPE_UNSUPPORTED: "artifact media type 不受支持。",
    PLUGIN_ARTIFACT_SIZE_MISMATCH: "下载的 artifact 大小与签署资料不一致。",
    PLUGIN_ARTIFACT_HASH_MISMATCH: "下载的 artifact SHA-256 与签署资料不一致。",
    PLUGIN_ARTIFACT_TOO_LARGE: "artifact 超过允许大小。",
    PLUGIN_EXTERNAL_FETCH_FAILED: "无法安全下载外部 plugin artifact。",
    PLUGIN_EXTERNAL_FETCH_HTTP: "外部 plugin artifact 下载失败。",
    PLUGIN_QUARANTINE_NOT_FOUND: "找不到 quarantine 记录。",
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


  if (pathname === V3_PACKAGE_MANAGER_BASE + "/external") {
    if (!packageManagerMethodAllowed(request, ["GET"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 GET。"},405,{Allow:"GET"});
    try { return jsonResponse({ ok:true, ...(await listExternalPluginState(env, overrides)) }); }
    catch (error) { return packageManagerErrorResponse(error, 503); }
  }

  if (pathname === V3_PACKAGE_MANAGER_BASE + "/authors") {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    try {
      const { trustStore } = externalStoresForPortal(env, overrides);
      const record = await trustStore.trust({
        keyId: body?.keyId,
        label: body?.label,
        publicKeyJwk: body?.publicKeyJwk,
        pluginIds: body?.pluginIds
      }, session.qq);
      await writeSystemAudit(env, {
        type:"v3_plugin_author_trust",
        actorId:session.qq,
        action:"trust",
        keyId:record.keyId,
        pluginIds:record.pluginIds
      }).catch(()=>{});
      return jsonResponse({ok:true,author:safeAuthorRecord(record),state:await listExternalPluginState(env,overrides),message:"作者公钥已加入信任库。私钥不会也不应上传。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const authorRevokeMatch = pathname.match(/^\/api\/portal\/v3\/packages\/authors\/([^/]+)\/revoke$/);
  if (authorRevokeMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const keyId = decodeAuthorKeyId(authorRevokeMatch[1]);
    if (!keyId) return jsonResponse({ok:false,code:"PLUGIN_AUTHOR_KEY_ID_INVALID",message:"作者密钥 ID 无效。"},400);
    try {
      const { trustStore } = externalStoresForPortal(env, overrides);
      const record = await trustStore.revoke(keyId, session.qq);
      await writeSystemAudit(env, {type:"v3_plugin_author_trust",actorId:session.qq,action:"revoke",keyId}).catch(()=>{});
      return jsonResponse({ok:true,author:safeAuthorRecord(record),state:await listExternalPluginState(env,overrides),message:"作者公钥已撤销；之后由该密钥签名的新分发包不会再通过验证。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const authorDeleteMatch = pathname.match(/^\/api\/portal\/v3\/packages\/authors\/([^/]+)$/);
  if (authorDeleteMatch) {
    if (!packageManagerMethodAllowed(request, ["DELETE"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 DELETE。"},405,{Allow:"DELETE"});
    const keyId = decodeAuthorKeyId(authorDeleteMatch[1]);
    if (!keyId) return jsonResponse({ok:false,code:"PLUGIN_AUTHOR_KEY_ID_INVALID",message:"作者密钥 ID 无效。"},400);
    try {
      const { trustStore } = externalStoresForPortal(env, overrides);
      const removed = await trustStore.remove(keyId);
      if (!removed) return jsonResponse({ok:false,code:"PLUGIN_AUTHOR_KEY_NOT_FOUND",message:"找不到作者公钥。"},404);
      await writeSystemAudit(env, {type:"v3_plugin_author_trust",actorId:session.qq,action:"remove",keyId}).catch(()=>{});
      return jsonResponse({ok:true,state:await listExternalPluginState(env,overrides),message:"作者公钥已从信任库移除。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  if (pathname === V3_PACKAGE_MANAGER_BASE + "/external/verify") {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    if (!body?.distribution || typeof body.distribution !== "object") return jsonResponse({ok:false,code:"PLUGIN_DISTRIBUTION_REQUIRED",message:"distribution 必须是 JSON 对象。"},400);
    try {
      const { quarantine } = externalStoresForPortal(env, overrides);
      const record = await quarantine.verifyAndQuarantine(body.distribution, session.qq);
      await writeSystemAudit(env, {
        type:"v3_plugin_external_quarantine",
        actorId:session.qq,
        action:"verify",
        pluginId:record.pluginId,
        version:record.version,
        keyId:record.author?.keyId || "",
        quarantineId:record.id
      }).catch(()=>{});
      const message = record.state === "blocked"
        ? "签名与完整性已验证，但安全扫描判定为不可由单一用户承担的系统性风险，因此已阻止。"
        : record.state === "risky"
          ? "签名与完整性已验证；检测到可由安装者自行承担的风险，请阅读问题详情后再决定是否仍要加载。"
          : "签名、artifact 大小与 SHA-256 已验证；安全扫描未发现当前规则可识别的风险。尚未执行任何第三方 JavaScript。";
      return jsonResponse({ok:true,entry:safeQuarantineRecord(record),state:await listExternalPluginState(env,overrides),message});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const quarantineApproveMatch = pathname.match(/^\/api\/portal\/v3\/packages\/external\/([^/]+)\/approve$/);
  if (quarantineApproveMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const id = decodeTransactionId(quarantineApproveMatch[1]);
    if (!id) return jsonResponse({ok:false,code:"PLUGIN_QUARANTINE_ID_INVALID",message:"quarantine ID 无效。"},400);
    try {
      const { quarantine } = externalStoresForPortal(env, overrides);
      const record = await quarantine.approve(id, session.qq);
      await writeSystemAudit(env, {type:"v3_plugin_external_quarantine",actorId:session.qq,action:"approve",pluginId:record.pluginId,quarantineId:id}).catch(()=>{});
      return jsonResponse({ok:true,entry:safeQuarantineRecord(record),state:await listExternalPluginState(env,overrides),message:"外部插件安装信息已批准供未来隔离加载器使用；目前仍未执行 JavaScript。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const quarantineAcceptRiskMatch = pathname.match(/^\/api\/portal\/v3\/packages\/external\/([^/]+)\/accept-risk$/);
  if (quarantineAcceptRiskMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允許 POST。"},405,{Allow:"POST"});
    const id = decodeTransactionId(quarantineAcceptRiskMatch[1]);
    if (!id) return jsonResponse({ok:false,code:"PLUGIN_QUARANTINE_ID_INVALID",message:"隔离区 ID 无效。"},400);
    try {
      const { quarantine } = externalStoresForPortal(env, overrides);
      const record = await quarantine.acceptRisk(id, session.qq);
      await writeSystemAudit(env, {type:"v3_plugin_external_quarantine",actorId:session.qq,action:"accept_risk",pluginId:record.pluginId,quarantineId:id}).catch(()=>{});
      return jsonResponse({
        ok:true,
        entry:safeQuarantineRecord(record),
        state:await listExternalPluginState(env,overrides),
        message:"你已明确承担此未认证插件在自己范围内的已披露风险；系统性／跨用户风险仍不能通过此操作解除。外部 JavaScript 仍须由隔离运行环境加载。"
      });
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const quarantineRejectMatch = pathname.match(/^\/api\/portal\/v3\/packages\/external\/([^/]+)\/reject$/);
  if (quarantineRejectMatch) {
    if (!packageManagerMethodAllowed(request, ["POST"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 POST。"},405,{Allow:"POST"});
    const id = decodeTransactionId(quarantineRejectMatch[1]);
    if (!id) return jsonResponse({ok:false,code:"PLUGIN_QUARANTINE_ID_INVALID",message:"quarantine ID 无效。"},400);
    try {
      const { quarantine } = externalStoresForPortal(env, overrides);
      const record = await quarantine.reject(id, session.qq, body?.reason || "");
      await writeSystemAudit(env, {type:"v3_plugin_external_quarantine",actorId:session.qq,action:"reject",pluginId:record.pluginId,quarantineId:id}).catch(()=>{});
      return jsonResponse({ok:true,entry:safeQuarantineRecord(record),state:await listExternalPluginState(env,overrides),message:"外部插件已标记 rejected。"});
    } catch (error) { return packageManagerErrorResponse(error); }
  }

  const quarantineDeleteMatch = pathname.match(/^\/api\/portal\/v3\/packages\/external\/([^/]+)$/);
  if (quarantineDeleteMatch) {
    if (!packageManagerMethodAllowed(request, ["DELETE"])) return jsonResponse({ok:false,code:"METHOD_NOT_ALLOWED",message:"此接口只允许 DELETE。"},405,{Allow:"DELETE"});
    const id = decodeTransactionId(quarantineDeleteMatch[1]);
    if (!id) return jsonResponse({ok:false,code:"PLUGIN_QUARANTINE_ID_INVALID",message:"quarantine ID 无效。"},400);
    try {
      const { quarantine } = externalStoresForPortal(env, overrides);
      const removed = await quarantine.remove(id);
      if (!removed) return jsonResponse({ok:false,code:"PLUGIN_QUARANTINE_NOT_FOUND",message:"找不到 quarantine 记录。"},404);
      await writeSystemAudit(env, {type:"v3_plugin_external_quarantine",actorId:session.qq,action:"remove",quarantineId:id}).catch(()=>{});
      return jsonResponse({ok:true,state:await listExternalPluginState(env,overrides),message:"隔离区记录已移除。"});
    } catch (error) { return packageManagerErrorResponse(error); }
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
      if (!cancelled) return jsonResponse({ok:false,code:"PLUGIN_PACKAGE_STAGE_NOT_FOUND",message:"找不到待提交操作。"},404);
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
    '<div class="section-head"><div><h3>受信任插件包</h3><p>这里只管理当前 Worker 已内置并审核的插件包信息。提交安装信息不会动态加载 JavaScript；插件启用状态仍由生命周期管理单独控制。</p></div><button id="v3PackageRefresh" class="btn">刷新插件包</button></div>',
    '<div id="v3PackageNotice" class="notice">尚未读取插件包注册信息。</div>',
    '<h4 class="v3-package-subtitle">内置插件目录</h4><div id="v3PackageCatalog" class="v3-package-grid"></div>',
    '<h4 class="v3-package-subtitle">待提交操作</h4><div id="v3PackageStaged" class="v3-package-stack"></div>',
    '<h4 class="v3-package-subtitle">最近操作记录</h4><div id="v3PackageHistory" class="v3-package-stack"></div>',
    '<div id="v3ExternalPluginManager" class="v3-external-manager">',
    '<div class="section-head"><div><h3>自制／外部插件</h3><p>信任作者公钥，验证签名分发包并放入隔离区。私钥不会上传；批准也不会执行 JavaScript。</p></div><button id="v3ExternalRefresh" class="btn">刷新外部插件</button></div>',
    '<div id="v3ExternalNotice" class="notice">尚未读取外部插件信任与隔离区状态。</div>',
    '<div class="v3-external-forms">',
    '<div class="v3-external-form"><h4>信任作者公钥</h4><div class="field"><label>密钥 ID</label><input id="v3AuthorKeyId" placeholder="yourname:key1"></div><div class="field"><label>作者名称</label><input id="v3AuthorLabel" placeholder="Your Name"></div><div class="field"><label>允许签署的插件 ID（逗号分隔；留空=不限）</label><input id="v3AuthorPluginIds" placeholder="my.plugin.one,my.plugin.two"></div><div class="field"><label>Ed25519 公钥 JWK</label><textarea id="v3AuthorPublicJwk" placeholder="{&quot;kty&quot;:&quot;OKP&quot;,&quot;crv&quot;:&quot;Ed25519&quot;,&quot;x&quot;:&quot;...&quot;}"></textarea></div><button id="v3AuthorTrustBtn" class="btn primary">加入信任库</button></div>',
    '<div class="v3-external-form"><h4>验证自己的签名分发包</h4><div class="field"><label>qqai-distribution.json</label><textarea id="v3ExternalDistribution" placeholder="{...}"></textarea></div><button id="v3ExternalVerifyBtn" class="btn primary">下载、验证并放入隔离区</button><div class="item-meta">只会下载到单次请求内存做签名、大小与 SHA-256 验证；插件文件内容不会写入 D1。</div></div>',
    '</div>',
    '<h4 class="v3-package-subtitle">受信任作者密钥</h4><div id="v3AuthorTrustList" class="v3-package-stack"></div>',
    '<h4 class="v3-package-subtitle">外部插件隔离区</h4><div id="v3ExternalQuarantine" class="v3-package-stack"></div>',
    '</div>',
    '</div>'
  ].join("");
  source = source.replace(marker, section + marker);

  const style = '<style id="qqai-v3-package-manager-style">.v3-package-manager{margin-top:16px;padding:16px;border:1px solid var(--line);border-radius:17px;background:var(--panel)}.v3-package-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:10px}.v3-package-card,.v3-package-tx{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel2)}.v3-package-title,.v3-package-tx{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v3-package-title h4{margin:0}.v3-package-badges,.v3-package-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.v3-package-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--panel);font-size:11px;font-weight:800}.v3-package-stack{display:grid;gap:8px}.v3-package-subtitle{margin:16px 0 6px}.v3-package-card code{font-size:11px}.v3-external-manager{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}.v3-external-forms{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px}.v3-external-form{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel2)}.v3-external-form textarea{min-height:150px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.v3-external-record{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel2)}@media(max-width:700px){.v3-package-title,.v3-package-tx{display:block}.v3-package-actions{margin-top:10px}.v3-external-forms{grid-template-columns:1fr}}</style>';
  source = source.includes("</head>") ? source.replace("</head>", style + "</head>") : style + source;
  const script = "<script id=\"qqai-v3-package-manager-client\">\n(function(){\n'use strict';\nvar nav=document.getElementById('v3PluginManagerNav');\nvar root=document.getElementById('v3PackageManager');\nvar catalog=document.getElementById('v3PackageCatalog');\nvar staged=document.getElementById('v3PackageStaged');\nvar history=document.getElementById('v3PackageHistory');\nvar notice=document.getElementById('v3PackageNotice');\nvar refresh=document.getElementById('v3PackageRefresh');\nif(!nav||!root||!catalog||!staged||!history||!notice)return;\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[x]})}\nfunction shortHash(v){v=String(v||'');return v.length>20?v.slice(0,12)+'…'+v.slice(-8):v}\nfunction when(v){if(!v)return'-';try{return new Date(Number(v)).toLocaleString()}catch(e){return String(v)}}\nasync function req(path,method,body){var init={method:method||'GET',headers:{Accept:'application/json'}};if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}var res=await fetch('/api/portal/v3/packages'+(path||''),init),data={};try{data=await res.json()}catch(e){}return{status:res.status,data:data}}\nfunction packageCard(p){\n  var badges='<span class=\"v3-package-badge\">'+(p.official?'官方':'第三方')+'</span>'\n    +'<span class=\"v3-package-badge\">'+(p.runtimeCodeBundled?'运行代码已随 Worker 打包':'运行代码未打包')+'</span>'\n    +'<span class=\"v3-package-badge\">'+(p.runtimeCandidateConfigured?'运行候选插件已配置':'运行候选插件未配置')+'</span>';\n  var meta=p.metadataInstalled?'<span class=\"status ok\">安装信息已登记</span>':'<span class=\"status warning\">安装信息未登记</span>';\n  var action='';\n  if(!p.metadataInstalled)action='<button class=\"btn primary\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"install\">暂存安装信息</button>';\n  else{\n    if(p.updateAvailable)action+='<button class=\"btn primary\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"update\">暂存更新信息</button>';\n    action+='<button class=\"btn danger\" data-v3-pkg-stage=\"'+esc(p.id)+'\" data-action=\"uninstall\">暂存卸载信息</button>';\n  }\n  return '<article class=\"v3-package-card\"><div class=\"v3-package-title\"><div><h4>'+esc(p.name||p.id)+'</h4><div class=\"item-meta\">'+esc(p.id)+'｜catalog v'+esc(p.catalogVersion)+(p.installedVersion?'｜installed v'+esc(p.installedVersion):'')+'</div></div>'+meta+'</div><div class=\"v3-package-badges\">'+badges+'</div><div class=\"item-meta\">构建验证源码 SHA-256：<code>'+esc(shortHash(p.sourceSha256))+'</code></div><div class=\"item-meta\">完整性范围：'+esc(p.integrityScope||'-')+'</div><div class=\"item-meta\">运行代码加载状态：'+esc(p.runtimeCodeLoaded===null?'未知／未声明':p.runtimeCodeLoaded)+'</div><div class=\"v3-package-actions\">'+action+'</div></article>';\n}\nfunction stagedCard(t){\n  var commit=t.expired?'<button class=\"btn\" disabled>已过期</button>':'<button class=\"btn primary\" data-v3-pkg-commit=\"'+esc(t.id)+'\">提交安装信息</button>';\n  return '<article class=\"v3-package-tx\"><div><b>'+esc(t.type)+' · '+esc(t.pluginId)+'</b><div class=\"item-meta\">'+esc(t.id)+'｜到期 '+esc(when(t.expiresAt))+'</div></div><div class=\"v3-package-actions\">'+commit+'<button class=\"btn\" data-v3-pkg-cancel=\"'+esc(t.id)+'\">取消暂存操作</button></div></article>';\n}\nfunction historyCard(t){\n  var rollback=['install','update','uninstall'].includes(String(t.type||''))?'<button class=\"btn\" data-v3-pkg-rollback=\"'+esc(t.id)+'\">回滚安装信息</button>':'';\n  return '<article class=\"v3-package-tx\"><div><b>'+esc(t.type)+' · '+esc(t.pluginId)+'</b><div class=\"item-meta\">'+esc(t.id)+'｜已提交 '+esc(when(t.committedAt))+'</div></div><div class=\"v3-package-actions\">'+rollback+'</div></article>';\n}\nfunction bind(){\n  root.querySelectorAll('[data-v3-pkg-stage]').forEach(function(b){b.onclick=function(){stagePackage(this.dataset.v3PkgStage,this.dataset.action)}});\n  root.querySelectorAll('[data-v3-pkg-commit]').forEach(function(b){b.onclick=function(){commitTx(this.dataset.v3PkgCommit)}});\n  root.querySelectorAll('[data-v3-pkg-cancel]').forEach(function(b){b.onclick=function(){cancelTx(this.dataset.v3PkgCancel)}});\n  root.querySelectorAll('[data-v3-pkg-rollback]').forEach(function(b){b.onclick=function(){rollbackTx(this.dataset.v3PkgRollback)}});\n}\nfunction render(data){\n  notice.textContent=(data.notice||'')+'｜安装信息操作不会自动改变插件生命周期。';\n  catalog.innerHTML=(data.packages||[]).map(packageCard).join('')||'<div class=\"empty\">目前没有受信任的内置插件包。</div>';\n  staged.innerHTML=(data.staged||[]).map(stagedCard).join('')||'<div class=\"empty\">没有暂存操作。</div>';\n  history.innerHTML=(data.history||[]).map(historyCard).join('')||'<div class=\"empty\">尚无操作记录。</div>';\n  bind();\n}\nasync function load(){\n  notice.textContent='正在读取受信任插件目录与安装信息…';\n  var r=await req('');\n  if(r.status===401||r.status===403){root.hidden=true;return}\n  root.hidden=false;\n  if(!r.data.ok){notice.textContent=r.data.message||'插件包资料读取失败。';return}\n  render(r.data);\n}\nasync function stagePackage(id,action){\n  if(!confirm('确定建立 '+action+' 的暂存操作？\\n这不会加载或卸载 JavaScript 运行代码。'))return;\n  var r=await req('/'+encodeURIComponent(id)+'/stage','POST',{action:action});\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function commitTx(id){\n  if(!confirm('提交这笔安装信息操作？\\n插件启用状态仍由生命周期管理独立控制。'))return;\n  var r=await req('/transactions/'+encodeURIComponent(id)+'/commit','POST');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function cancelTx(id){\n  var r=await req('/transactions/'+encodeURIComponent(id),'DELETE');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nasync function rollbackTx(id){\n  if(!confirm('回滚这笔安装信息操作？'))return;\n  var r=await req('/history/'+encodeURIComponent(id)+'/rollback','POST');\n  alert(r.data.message||'操作完成');\n  if(r.data.ok)render(r.data.state);else await load();\n}\nnav.addEventListener('click',function(){setTimeout(load,0)});\nif(refresh)refresh.onclick=load;\n})();\n</script>";
  source = source.includes("</body>") ? source.replace("</body>", script + "</body>") : source + script;
  const externalScript = "<script id=\"qqai-v3-external-plugin-client\">\n(function(){\n'use strict';\nvar nav=document.getElementById('v3PluginManagerNav');\nvar root=document.getElementById('v3ExternalPluginManager');\nvar notice=document.getElementById('v3ExternalNotice');\nvar authors=document.getElementById('v3AuthorTrustList');\nvar quarantine=document.getElementById('v3ExternalQuarantine');\nvar refresh=document.getElementById('v3ExternalRefresh');\nvar trustBtn=document.getElementById('v3AuthorTrustBtn');\nvar verifyBtn=document.getElementById('v3ExternalVerifyBtn');\nif(!nav||!root||!notice||!authors||!quarantine)return;\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[x]})}\nfunction short(v){v=String(v||'');return v.length>26?v.slice(0,14)+'…'+v.slice(-8):v}\nfunction when(v){if(!v)return'-';try{return new Date(Number(v)).toLocaleString()}catch(e){return String(v)}}\nasync function req(path,method,body){var init={method:method||'GET',headers:{Accept:'application/json'}};if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}var res=await fetch('/api/portal/v3/packages'+path,init),data={};try{data=await res.json()}catch(e){}return{status:res.status,data:data}}\nfunction authorCard(a){\n  var scope=(a.pluginIds||[]).length?(a.pluginIds||[]).join(', '):'所有插件 ID';\n  var actions=a.status==='trusted'?'<button class=\"btn danger\" data-author-revoke=\"'+esc(a.keyId)+'\">撤销密钥</button>':'<span class=\"status warning\">已撤销</span>';\n  actions+='<button class=\"btn\" data-author-delete=\"'+esc(a.keyId)+'\">删除记录</button>';\n  return '<article class=\"v3-external-record\"><b>'+esc(a.label||a.keyId)+'</b><div class=\"item-meta\">'+esc(a.keyId)+'｜'+esc(a.status)+'｜范围：'+esc(scope)+'</div><div class=\"item-meta\">Ed25519 x: <code>'+esc(short(a.publicKeyJwk&&a.publicKeyJwk.x))+'</code></div><div class=\"v3-package-actions\">'+actions+'</div></article>';\n}\nfunction quarantineCard(q){\n  var state=String(q.state||'unknown').toUpperCase();\n  var status='<span class=\"status '+(state==='APPROVED'?'ok':state==='APPROVED_WITH_RISK'||state==='RISKY'?'warning':state==='BLOCKED'||state==='REJECTED'?'error':'warning')+'\">'+esc(state)+'</span>';\n  var sec=q.security||{},findings=(sec.findings||[]).map(function(f){return'<div class=\"v3-lifecycle-reason\"><b>'+esc(f.severity||'')+' · '+esc(f.code||'')+'</b> '+esc(f.summaryZh||'')+'<br><small>影响：'+esc((f.impacts||[]).join(', '))+'｜'+(f.overrideAllowed?'可由安装者承担':'不可覆盖')+'</small></div>'}).join('');\n  var actions='';\n  if(q.state==='verified')actions='<button class=\"btn primary\" data-q-approve=\"'+esc(q.id)+'\">批准加载安装信息</button><button class=\"btn danger\" data-q-reject=\"'+esc(q.id)+'\">拒绝</button>';\n  if(q.state==='risky'&&sec.overrideAllowed&&!sec.blocked)actions='<button class=\"btn danger\" data-q-accept-risk=\"'+esc(q.id)+'\">了解风险后仍要加载</button><button class=\"btn\" data-q-reject=\"'+esc(q.id)+'\">拒绝</button>';\n  if(q.state==='blocked')actions='<span class=\"status error\">系统性风险：禁止强制加载</span><button class=\"btn\" data-q-reject=\"'+esc(q.id)+'\">拒绝</button>';\n  actions+='<button class=\"btn\" data-q-delete=\"'+esc(q.id)+'\">删除隔离记录</button>';\n  return '<article class=\"v3-external-record\"><div class=\"v3-package-title\"><div><b>'+esc(q.pluginId)+' v'+esc(q.version)+'</b><div class=\"item-meta\">'+esc(q.id)+'｜作者 '+esc(q.author&&q.author.keyId)+'</div></div>'+status+'</div><div class=\"item-meta\">引用：'+esc(q.artifact&&q.artifact.immutableRef)+'｜大小 '+esc(q.artifact&&q.artifact.sizeBytes)+'｜SHA-256 <code>'+esc(short(q.artifact&&q.artifact.sha256))+'</code></div><div class=\"item-meta\">安全扫描：'+esc(sec.riskLevel||'none')+'｜问题数 '+Number(sec.findingCount||0)+'｜'+(sec.overrideAllowed?'可自行承担':'不可自行承担')+'</div>'+findings+(q.rejectionReason?'<div class=\"v3-lifecycle-reason\">原因：'+esc(q.rejectionReason)+'</div>':'')+'<div class=\"v3-package-actions\">'+actions+'</div></article>';\n}\nfunction bind(){\n  root.querySelectorAll('[data-author-revoke]').forEach(function(b){b.onclick=function(){revokeAuthor(this.dataset.authorRevoke)}});\n  root.querySelectorAll('[data-author-delete]').forEach(function(b){b.onclick=function(){deleteAuthor(this.dataset.authorDelete)}});\n  root.querySelectorAll('[data-q-approve]').forEach(function(b){b.onclick=function(){approveQ(this.dataset.qApprove)}});\n  root.querySelectorAll('[data-q-accept-risk]').forEach(function(b){b.onclick=function(){acceptRiskQ(this.dataset.qAcceptRisk)}});\n  root.querySelectorAll('[data-q-reject]').forEach(function(b){b.onclick=function(){rejectQ(this.dataset.qReject)}});\n  root.querySelectorAll('[data-q-delete]').forEach(function(b){b.onclick=function(){deleteQ(this.dataset.qDelete)}});\n}\nfunction render(data){\n  notice.textContent=data.notice||'外部插件验证不会执行 JavaScript。';\n  authors.innerHTML=(data.authors||[]).map(authorCard).join('')||'<div class=\"empty\">尚未信任任何外部作者公钥。</div>';\n  quarantine.innerHTML=(data.quarantine||[]).map(quarantineCard).join('')||'<div class=\"empty\">隔离区目前为空。</div>';\n  bind();\n}\nasync function load(){\n  notice.textContent='正在读取作者信任与隔离区…';\n  var r=await req('/external');\n  if(r.status===401||r.status===403){root.hidden=true;return}\n  root.hidden=false;\n  if(!r.data.ok){notice.textContent=r.data.message||'读取失败';return}\n  render(r.data);\n}\nasync function trustAuthor(){\n  var keyId=document.getElementById('v3AuthorKeyId').value.trim();\n  var label=document.getElementById('v3AuthorLabel').value.trim();\n  var ids=document.getElementById('v3AuthorPluginIds').value.split(',').map(function(x){return x.trim()}).filter(Boolean);\n  var jwk;try{jwk=JSON.parse(document.getElementById('v3AuthorPublicJwk').value)}catch(e){alert('公钥 JWK JSON 格式错误：'+e.message);return}\n  var r=await req('/authors','POST',{keyId:keyId,label:label,pluginIds:ids,publicKeyJwk:jwk});\n  alert(r.data.message||'操作完成');if(r.data.ok)render(r.data.state);else await load();\n}\nasync function verifyExternal(){\n  var distribution;try{distribution=JSON.parse(document.getElementById('v3ExternalDistribution').value)}catch(e){alert('Distribution JSON 格式错误：'+e.message);return}\n  if(!confirm('QQAI 将从签名 HTTPS 地址下载插件文件到本次请求内存，验证 Ed25519、大小与 SHA-256。不会执行 JavaScript。继续？'))return;\n  var r=await req('/external/verify','POST',{distribution:distribution});\n  alert(r.data.message||'验证完成');if(r.data.ok)render(r.data.state);else await load();\n}\nasync function revokeAuthor(id){if(!confirm('撤销 '+id+'？之后该密钥签署的新分发包都会被拒绝。'))return;var r=await req('/authors/'+encodeURIComponent(id)+'/revoke','POST');alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nasync function deleteAuthor(id){if(!confirm('删除信任记录 '+id+'？'))return;var r=await req('/authors/'+encodeURIComponent(id),'DELETE');alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nasync function approveQ(id){if(!confirm('批准只表示安装信息／完整性／安全扫描流程可继续，不会让插件取得未授权权限。继续？'))return;var r=await req('/external/'+encodeURIComponent(id)+'/approve','POST');alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nasync function acceptRiskQ(id){if(!confirm('此插件尚未取得认证且存在安全问题。你只能承担影响自己范围内的风险；若风险会影响拥有者、其他用户、共享资源或平台，系统会拒绝。仍要载入？'))return;var r=await req('/external/'+encodeURIComponent(id)+'/accept-risk','POST');alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nasync function rejectQ(id){var reason=prompt('拒绝原因（可留空）','')||'';var r=await req('/external/'+encodeURIComponent(id)+'/reject','POST',{reason:reason});alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nasync function deleteQ(id){if(!confirm('删除隔离记录？'))return;var r=await req('/external/'+encodeURIComponent(id),'DELETE');alert(r.data.message||'完成');if(r.data.ok)render(r.data.state);else await load()}\nif(trustBtn)trustBtn.onclick=trustAuthor;\nif(verifyBtn)verifyBtn.onclick=verifyExternal;\nif(refresh)refresh.onclick=load;\nnav.addEventListener('click',function(){setTimeout(load,0)});\n})();\n</script>";
  source = source.includes("</body>") ? source.replace("</body>", externalScript + "</body>") : source + externalScript;
  return source;
}

export {
  V3_PACKAGE_MANAGER_BASE,
  createPortalPackageStorageAdapter,
  decodeAuthorKeyId,
  externalStoresForPortal,
  fetchExternalPluginArtifact,
  decodeTransactionId,
  handleV3PackageManagerApi,
  handleV3PackageManagerAuthed,
  injectV3PackageManagerClient,
  listExternalPluginState,
  listPortalPackageState,
  packageCatalogSummary,
  packageManagerErrorResponse,
  packageRegistryForPortal,
  safeAuthorRecord,
  safePackageTransaction,
  safeQuarantineRecord
};
