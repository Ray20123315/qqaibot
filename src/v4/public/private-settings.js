import { isDeveloperId, envList, publicBaseUrl } from "../../config/deployment.js";
import { listProviderAccountsForPrincipal, upsertProviderAccount } from "../../ai/provider-registry.js";
import { acceptLegalStatement, setDeveloperGroupWhitelist } from "./access.js";
import { createResourceInputTicket, qqOpenPrincipal, resolveCanonicalPrincipal } from "./resource-tickets.js";
import { listStorageConnectorsForPrincipal, testStorageConnector, upsertStorageConnector } from "./storage-registry.js";

const AI_PROVIDER_ALIASES = Object.freeze({
  gemini: "google_gemini",
  google_gemini: "google_gemini",
  gemma: "google_gemma",
  google_gemma: "google_gemma",
  deepseek: "deepseek",
  openai: "openai_api",
  openai_api: "openai_api",
  compatible: "openai_compatible",
  openai_compatible: "openai_compatible"
});

function clean(value, max = 4096) {
  return String(value ?? "").trim().slice(0, max);
}

function safeCountLabel(value) {
  return Number(value || 0) > 0 ? String(Number(value || 0)) : "0";
}

async function effectivePrivatePrincipal(env, openid) {
  return resolveCanonicalPrincipal(env, qqOpenPrincipal(openid));
}

function qqOpenDeveloper(env, openid, canonicalPrincipal = "") {
  const openids = envList(env.QQ_OPEN_DEVELOPER_OPENIDS);
  if (openids.includes(clean(openid, 180))) return true;
  const qq = String(canonicalPrincipal || "").startsWith("qq:") ? String(canonicalPrincipal).slice(3) : "";
  return Boolean(qq && isDeveloperId(env, qq));
}

function resourceLink(env, ticket) {
  const base = publicBaseUrl(env);
  return base ? `${base}/connect-resource?ticket=${encodeURIComponent(ticket)}` : "";
}

function privateSettingsMenu({ aiCount = 0, storageCount = 0, developer = false } = {}) {
  return [
    "AIBot 設定中心",
    `AI 服務：${safeCountLabel(aiCount)} 個`,
    `資料儲存：${safeCountLabel(storageCount)} 個`,
    "",
    "可用指令：",
    "新增AI　建立安全輸入頁",
    "新增資料庫　建立 D1 / KV 安全輸入頁",
    "!AI金鑰 <gemini|openai|deepseek|compatible> <金鑰>",
    "!資料庫 D1 <Account ID> <Database ID> <API Token>",
    "!資料庫 KV <Account ID> <Namespace ID> <API Token>",
    "同意法律聲明",
    developer ? "!白名單 <群組 OpenID> 開/關" : ""
  ].filter(Boolean).join("\n");
}

async function handleV4PrivateSettingsMessage(env, message = {}) {
  if (String(message?.scope || "") !== "private") return Object.freeze({ handled: false });
  const openid = clean(message?.userId, 180);
  const text = clean(message?.text, 16000);
  if (!openid || !text) return Object.freeze({ handled: false });

  const originalPrincipal = qqOpenPrincipal(openid);
  const principal = await resolveCanonicalPrincipal(env, originalPrincipal);
  const developer = qqOpenDeveloper(env, openid, principal);
  const normalized = text.normalize("NFKC").trim();

  if (/^(?:設定|设置|AI設定|AI设置|資料設定|资料设置|!設定|!设置)$/i.test(normalized)) {
    const [ai, storage] = await Promise.all([
      listProviderAccountsForPrincipal(env, principal),
      listStorageConnectorsForPrincipal(env, principal)
    ]);
    return Object.freeze({ handled: true, reply: privateSettingsMenu({ aiCount: ai.length, storageCount: storage.length, developer }) });
  }

  if (/^(?:新增AI|新增 AI|!新增AI)$/i.test(normalized)) {
    const ticket = await createResourceInputTicket(env, { principalId: originalPrincipal, kind: "ai", source: "qq-dm" });
    const link = resourceLink(env, ticket.token);
    return Object.freeze({
      handled: true,
      reply: link
        ? `安全輸入頁已建立，10 分鐘內有效。請先登入 AIBot 後臺，再開啟：\n${link}\n\n也可以直接私訊：!AI金鑰 <類型> <金鑰>`
        : "安全輸入頁需要先設定 PUBLIC_BASE_URL；目前仍可使用：!AI金鑰 <類型> <金鑰>"
    });
  }

  if (/^(?:新增資料庫|新增数据库|新增 儲存|新增 存储|!新增資料庫|!新增数据库)$/i.test(normalized)) {
    const ticket = await createResourceInputTicket(env, { principalId: originalPrincipal, kind: "storage", source: "qq-dm" });
    const link = resourceLink(env, ticket.token);
    return Object.freeze({
      handled: true,
      reply: link
        ? `資料儲存安全輸入頁已建立，10 分鐘內有效。請先登入 AIBot 後臺，再開啟：\n${link}\n\n也可以直接私訊 !資料庫 D1 ... 或 !資料庫 KV ...`
        : "安全輸入頁需要先設定 PUBLIC_BASE_URL；目前仍可使用 !資料庫 D1 ... 或 !資料庫 KV ..."
    });
  }

  const aiDirect = normalized.match(/^[!！](?:AI金鑰|AI密鑰|AI密钥)\s+(gemini|google_gemini|gemma|google_gemma|deepseek|openai|openai_api|compatible|openai_compatible)\s+([^\s]+)$/i);
  if (aiDirect) {
    const provider = AI_PROVIDER_ALIASES[String(aiDirect[1] || "").toLowerCase()];
    const secret = clean(aiDirect[2], 4096);
    if (!provider || secret.length < 8) return Object.freeze({ handled: true, reply: "AI 金鑰格式不完整，未儲存。" });
    const account = await upsertProviderAccount(env, {
      provider,
      ownerPrincipalId: principal,
      scope: "user",
      label: "我的 AI",
      tasks: ["chat"],
      secret
    });
    return Object.freeze({ handled: true, reply: `AI 服務已安全儲存：${account.label}（${account.provider}）。完整金鑰不會再次顯示。` });
  }

  const storageDirect = normalized.match(/^[!！](?:資料庫|数据库)\s+(D1|KV)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)$/i);
  if (storageDirect) {
    const kind = String(storageDirect[1] || "").toUpperCase();
    const connector = await upsertStorageConnector(env, {
      type: kind === "D1" ? "cloudflare_d1" : "cloudflare_kv",
      ownerPrincipalId: principal,
      label: kind === "D1" ? "我的 D1" : "我的 KV",
      accountId: clean(storageDirect[2], 64),
      resourceId: clean(storageDirect[3], 96),
      token: clean(storageDirect[4], 4096),
      purposes: ["settings", "memory", "chat_history", "plugin_data"]
    });
    let verified = false;
    try { verified = (await testStorageConnector(env, connector.id)).ok === true; } catch {}
    return Object.freeze({
      handled: true,
      reply: verified
        ? `${kind} 已安全連接並驗證成功。API Token 不會再次顯示。`
        : `${kind} 連線資料已加密儲存，但目前驗證未通過；請到後臺檢查權限或資源 ID。`
    });
  }

  if (/^(?:同意法律聲明|同意法律声明|!同意法律聲明|!同意法律声明)$/i.test(normalized)) {
    await acceptLegalStatement(env, { principalId: principal, source: "qq-dm" });
    return Object.freeze({ handled: true, reply: "已記錄你對目前版本法律聲明的同意。" });
  }

  const whitelist = normalized.match(/^[!！]白名單\s+([^\s]+)\s+(開|开|關|关)$/i);
  if (whitelist) {
    if (!developer) return Object.freeze({ handled: true, reply: "這項設定僅開發者帳號可使用。" });
    const enabled = /^(?:開|开)$/i.test(whitelist[2]);
    await setDeveloperGroupWhitelist(env, { groupId: clean(whitelist[1], 180), enabled, actorId: principal || originalPrincipal });
    return Object.freeze({ handled: true, reply: enabled ? "指定群組已加入靜默白名單。" : "指定群組已移除靜默白名單。" });
  }

  return Object.freeze({ handled: false });
}

export { AI_PROVIDER_ALIASES, effectivePrivatePrincipal, handleV4PrivateSettingsMessage, privateSettingsMenu };
