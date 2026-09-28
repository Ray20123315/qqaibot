import {
  deleteProviderAccount,
  getProviderAccount,
  listProviderAccountsForPrincipal,
  upsertProviderAccount
} from "../../ai/provider-registry.js";
import { getPortalSession, jsonResponse, readCookie } from "../../portal/auth.js";
import {
  claimResourceInputTicket,
  consumeResourceInputTicket,
  createResourceInputTicket,
  portalPrincipal,
  readResourceInputTicket,
  resolveCanonicalPrincipal
} from "../public/resource-tickets.js";
import {
  deleteStorageConnector,
  getStorageConnector,
  listStorageConnectorsForPrincipal,
  testStorageConnector,
  upsertStorageConnector
} from "../public/storage-registry.js";

const BASE = "/api/portal/v4/resources";

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function requirePortalPrincipal(request, env) {
  const token = readCookie(request, "qqai_session");
  const session = await getPortalSession(env, token, { touch: true }).catch(() => null);
  if (!session) return { error: jsonResponse({ ok: false, message: "請先登入 AIBot 後臺。" }, 401) };
  const principal = portalPrincipal(session);
  if (!principal) return { error: jsonResponse({ ok: false, message: "此登入身份不能建立個人資源。" }, 403) };
  return { session, principal, token };
}

function resourceError(error) {
  const code = String(error?.code || error?.message || "RESOURCE_REQUEST_FAILED").slice(0, 120);
  const status = /NOT_FOUND/.test(code) ? 404
    : /MISMATCH|OWNER|PRINCIPAL|IDENTITY|FORBIDDEN/.test(code) ? 403
      : /EXPIRED|CONFLICT/.test(code) ? 409
        : 400;
  const message = /ENCRYPTION_KEY_REQUIRED/.test(code)
    ? "伺服器尚未設定資源加密金鑰，暫時不能安全保存憑證。"
    : /EXPIRED/.test(code)
      ? "這個安全輸入連結已過期或已使用，請重新產生。"
      : /PRINCIPAL|MISMATCH|OWNER/.test(code)
        ? "目前登入帳號與這個資源不相符。"
        : "目前無法完成這項資源設定，請檢查資料後再試。";
  return jsonResponse({ ok: false, code, message }, status);
}

async function handleV4ResourcePortalApi(request, env, url = null) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (!target.pathname.startsWith(BASE)) return null;
  const auth = await requirePortalPrincipal(request, env);
  if (auth.error) return auth.error;
  const principal = await resolveCanonicalPrincipal(env, auth.principal);

  try {
    if (request.method === "GET" && target.pathname === BASE) {
      const [ai, storage] = await Promise.all([
        listProviderAccountsForPrincipal(env, principal),
        listStorageConnectorsForPrincipal(env, principal)
      ]);
      return jsonResponse({ ok: true, ai, storage });
    }

    if (request.method === "POST" && target.pathname === BASE + "/ticket") {
      const payload = await bodyJson(request);
      const kind = String(payload.kind || "").toLowerCase();
      const ticket = await createResourceInputTicket(env, { principalId: principal, kind, source: "portal" });
      return jsonResponse({ ok: true, ...ticket, path: `/connect-resource?ticket=${encodeURIComponent(ticket.token)}` });
    }

    if (request.method === "GET" && target.pathname === BASE + "/ticket") {
      const token = String(target.searchParams.get("ticket") || "");
      const record = await readResourceInputTicket(env, token);
      if (!record) return jsonResponse({ ok: false, message: "安全輸入連結不存在、已過期或已使用。" }, 404);
      const canonicalSource = await resolveCanonicalPrincipal(env, record.principalId);
      const claimRequired = canonicalSource !== principal && !record.claimedPrincipalId;
      if (!claimRequired && (record.claimedPrincipalId || canonicalSource) !== principal) {
        return jsonResponse({ ok: false, message: "這個安全輸入連結不屬於目前登入帳號。" }, 403);
      }
      return jsonResponse({
        ok: true,
        kind: record.kind,
        source: record.source,
        claimRequired,
        expiresAt: record.expiresAt
      });
    }

    if (request.method === "POST" && target.pathname === BASE + "/ticket/claim") {
      const payload = await bodyJson(request);
      const record = await claimResourceInputTicket(env, payload.ticket, principal);
      return jsonResponse({ ok: true, kind: record.kind, expiresAt: record.expiresAt });
    }

    if (request.method === "POST" && target.pathname === BASE + "/consume") {
      const payload = await bodyJson(request);
      const kind = String(payload.kind || "").toLowerCase();
      await claimResourceInputTicket(env, payload.ticket, principal);
      await consumeResourceInputTicket(env, payload.ticket, principal, kind);
      const config = payload.config && typeof payload.config === "object" ? payload.config : {};
      const secret = String(payload.secret || "").trim();
      if (secret.length < 8) throw new Error("RESOURCE_SECRET_REQUIRED");

      if (kind === "ai") {
        const account = await upsertProviderAccount(env, {
          provider: config.provider,
          label: config.label || "我的 AI",
          endpoint: config.endpoint || "",
          model: config.model || "",
          tasks: Array.isArray(config.tasks) && config.tasks.length ? config.tasks : ["chat"],
          ownerPrincipalId: principal,
          scope: "user",
          secret
        });
        return jsonResponse({ ok: true, kind, resource: account, message: "AI 服務已安全儲存。" });
      }

      if (kind === "storage") {
        const connector = await upsertStorageConnector(env, {
          type: config.type,
          label: config.label || "我的資料儲存",
          ownerPrincipalId: principal,
          accountId: config.accountId,
          resourceId: config.resourceId,
          purposes: config.purposes || ["settings", "memory"],
          token: secret
        });
        let verification = { ok: false };
        try { verification = await testStorageConnector(env, connector.id); } catch {}
        return jsonResponse({
          ok: true,
          kind,
          resource: connector,
          verified: verification.ok === true,
          message: verification.ok === true ? "資料儲存已連接並驗證成功。" : "資料儲存已加密保存，但連線驗證尚未通過。"
        });
      }
      throw new Error("RESOURCE_KIND_INVALID");
    }

    const aiDelete = target.pathname.match(new RegExp("^" + BASE + "/ai/([^/]+)$"));
    if (request.method === "DELETE" && aiDelete) {
      const account = await getProviderAccount(env, decodeURIComponent(aiDelete[1]));
      if (!account) return jsonResponse({ ok: false, message: "找不到這個 AI 服務。" }, 404);
      if (account.ownerPrincipalId !== principal) throw new Error("AI_PROVIDER_OWNER_MISMATCH");
      await deleteProviderAccount(env, account.id);
      return jsonResponse({ ok: true, message: "AI 服務已移除。" });
    }

    const storagePath = target.pathname.match(new RegExp("^" + BASE + "/storage/([^/]+)(?:/(test))?$"));
    if (storagePath) {
      const id = decodeURIComponent(storagePath[1]);
      const connector = await getStorageConnector(env, id);
      if (!connector) return jsonResponse({ ok: false, message: "找不到這個資料儲存。" }, 404);
      if (connector.ownerPrincipalId !== principal) throw new Error("STORAGE_CONNECTOR_OWNER_MISMATCH");
      if (request.method === "DELETE" && !storagePath[2]) {
        await deleteStorageConnector(env, id, principal);
        return jsonResponse({ ok: true, message: "資料儲存已移除。" });
      }
      if (request.method === "POST" && storagePath[2] === "test") {
        const verification = await testStorageConnector(env, id);
        return jsonResponse({ ok: true, verification });
      }
    }

    return jsonResponse({ ok: false, message: "找不到這項資源操作。" }, 404);
  } catch (error) {
    return resourceError(error);
  }
}

export { BASE as V4_RESOURCE_PORTAL_BASE, handleV4ResourcePortalApi };
