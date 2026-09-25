import { isDeveloperId } from "../../core/identity.js";
import { writeSystemAudit } from "../../core/permissions.js";
import { getPortalSession, jsonResponse, readCookie } from "../../portal/auth.js";
import { pluginPermissionDisclosures, pluginTrustLabelZh, releaseChannelLabelZh } from "../../plugins/governance.js";
import { getV3Runtime } from "../runtime/runtime.js";
import { v3BilibiliEnabled, v3RuntimeEnabled, v3RuntimeOptionsFromEnv } from "../runtime/bridge.js";

const V3_PLUGIN_MANAGER_BASE = "/api/portal/v3/plugins";
const V3_PLUGIN_MANAGER_MAX_PLUGIN_ID = 128;

function pluginManagerMethodAllowed(request, methods) {
  return methods.includes(String(request?.method || "GET").toUpperCase());
}

function decodePluginId(value) {
  let decoded = "";
  try { decoded = decodeURIComponent(String(value || "")); } catch { return ""; }
  decoded = decoded.trim();
  if (!decoded || decoded.length > V3_PLUGIN_MANAGER_MAX_PLUGIN_ID) return "";
  return /^[a-z0-9][a-z0-9._-]{1,127}$/i.test(decoded) ? decoded : "";
}

function pluginManagerRuntimeState(env = {}) {
  return Object.freeze({
    runtimeEnabled: v3RuntimeEnabled(env),
    bilibiliEnabled: v3BilibiliEnabled(env)
  });
}

async function authenticatePluginManager(request, env, url, body = {}, overrides = {}) {
  const loadSession = typeof overrides.getSession === "function" ? overrides.getSession : getPortalSession;
  const checkDeveloper = typeof overrides.isDeveloper === "function" ? overrides.isDeveloper : isDeveloperId;
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    || readCookie(request, "qqai_session")
    || String(body?.token || "")
    || url.searchParams.get("token")
    || "";
  let session = null;
  try {
    session = await loadSession(env, token);
  } catch {
    return Object.freeze({
      ok: false,
      response: jsonResponse({ ok: false, code: "SESSION_STORAGE_UNAVAILABLE", message: "Portal 会话资料库暂时不可用，请稍后重试。" }, 503)
    });
  }
  if (!session) {
    return Object.freeze({
      ok: false,
      response: jsonResponse({ ok: false, code: "SESSION_INVALID", message: "未登录或登录已过期。" }, 401)
    });
  }
  const privileged = session.systemAdmin === true || session?.permissions?.developer === true || checkDeveloper(env, session.qq);
  if (!privileged) {
    return Object.freeze({
      ok: false,
      response: jsonResponse({ ok: false, code: "PLUGIN_MANAGER_DEVELOPER_REQUIRED", message: "只有系统管理员或 Developer 可以管理 V3 插件。" }, 403)
    });
  }
  return Object.freeze({ ok: true, session });
}

function pluginSummary(plugin, surface = null) {
  const schema = plugin?.settings && typeof plugin.settings === "object" ? plugin.settings : {};
  const lifecycle = plugin?.lifecycle && typeof plugin.lifecycle === "object" ? plugin.lifecycle : null;
  const requestedPermissions = lifecycle?.requestedPermissions || plugin?.requestedCapabilities || plugin?.capabilities || [];
  const grantedPermissions = lifecycle?.grantedPermissions || plugin?.grantedCapabilities || [];
  const requiredPermissions = lifecycle?.requiredPermissions || plugin?.requiredCapabilities || [];
  const trustStatus = String(plugin?.trustStatus || lifecycle?.trustStatus || (plugin?.official === true ? "official" : "uncertified"));
  const releaseChannel = String(plugin?.releaseChannel || lifecycle?.releaseChannel || "stable");
  return Object.freeze({
    id: String(plugin?.id || ""),
    name: String(plugin?.name || ""),
    version: String(plugin?.version || ""),
    apiVersion: String(plugin?.apiVersion || ""),
    description: String(plugin?.description || ""),
    author: String(plugin?.author || ""),
    official: plugin?.official === true,
    trustStatus,
    trustLabelZh: pluginTrustLabelZh(trustStatus),
    releaseChannel,
    releaseChannelLabelZh: releaseChannelLabelZh(releaseChannel),
    channelPreference: String(lifecycle?.channelPreference || "stable"),
    publicStatus: plugin?.publicStatus === true,
    active: plugin?.active === true,
    lifecycle: lifecycle ? Object.freeze({ ...lifecycle }) : null,
    requestedPermissions: Object.freeze([...(Array.isArray(requestedPermissions) ? requestedPermissions : [])]),
    requiredPermissions: Object.freeze([...(Array.isArray(requiredPermissions) ? requiredPermissions : [])]),
    grantedPermissions: Object.freeze([...(Array.isArray(grantedPermissions) ? grantedPermissions : [])]),
    permissionDisclosures: pluginPermissionDisclosures(plugin),
    capabilities: Object.freeze([...(Array.isArray(plugin?.capabilities) ? plugin.capabilities : [])]),
    commands: Object.freeze([...(Array.isArray(plugin?.commands) ? plugin.commands : [])]),
    settingsSchema: schema,
    surface: plugin?.surface || null,
    settings: surface?.settings ?? null,
    status: surface?.status ?? null,
    surfaceAvailable: Boolean(surface)
  });
}

function pluginDescriptor(runtime, pluginId) {
  return runtime.listPlugins().find(plugin => String(plugin.id) === String(pluginId)) || null;
}

function normalizePortalPluginSettings(plugin, input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!source) throw Object.assign(new Error("PLUGIN_MANAGER_SETTINGS_OBJECT_REQUIRED"), { code: "PLUGIN_MANAGER_SETTINGS_OBJECT_REQUIRED" });
  const schema = plugin?.settingsSchema && typeof plugin.settingsSchema === "object" ? plugin.settingsSchema : (plugin?.settings && typeof plugin.settings === "object" ? plugin.settings : {});
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    const descriptor = schema[key];
    if (!descriptor) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_UNKNOWN:" + key), { code: "PLUGIN_MANAGER_SETTING_UNKNOWN", key });
    if (descriptor.readOnly === true) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_READ_ONLY:" + key), { code: "PLUGIN_MANAGER_SETTING_READ_ONLY", key });
    if (descriptor.secret === true && raw === "[redacted]") continue;
    if (descriptor.type === "boolean") {
      if (typeof raw !== "boolean") throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_TYPE:" + key), { code: "PLUGIN_MANAGER_SETTING_TYPE", key });
      result[key] = raw;
      continue;
    }
    if (descriptor.type === "number") {
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_TYPE:" + key), { code: "PLUGIN_MANAGER_SETTING_TYPE", key });
      if (descriptor.min !== undefined && value < Number(descriptor.min)) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_RANGE:" + key), { code: "PLUGIN_MANAGER_SETTING_RANGE", key });
      if (descriptor.max !== undefined && value > Number(descriptor.max)) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_RANGE:" + key), { code: "PLUGIN_MANAGER_SETTING_RANGE", key });
      result[key] = value;
      continue;
    }
    if (descriptor.type === "select") {
      const value = String(raw ?? "");
      const allowed = new Set((Array.isArray(descriptor.options) ? descriptor.options : []).map(option => String(option?.value ?? option ?? "")));
      if (!allowed.has(value)) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_OPTION:" + key), { code: "PLUGIN_MANAGER_SETTING_OPTION", key });
      result[key] = value;
      continue;
    }
    if (descriptor.type === "json") {
      if (raw === undefined) throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_TYPE:" + key), { code: "PLUGIN_MANAGER_SETTING_TYPE", key });
      result[key] = raw;
      continue;
    }
    if (descriptor.type === "string") {
      if (typeof raw !== "string") throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_TYPE:" + key), { code: "PLUGIN_MANAGER_SETTING_TYPE", key });
      result[key] = raw;
      continue;
    }
    throw Object.assign(new Error("PLUGIN_MANAGER_SETTING_TYPE:" + key), { code: "PLUGIN_MANAGER_SETTING_TYPE", key });
  }
  return Object.freeze(result);
}

function pluginManagerErrorResponse(error, fallbackStatus = 400) {
  const code = String(error?.code || error?.message || "PLUGIN_MANAGER_ERROR").split(":")[0].slice(0, 120);
  const key = String(error?.key || "").slice(0, 80);
  const messages = {
    PLUGIN_MANAGER_SETTINGS_OBJECT_REQUIRED: "插件设置必须是 JSON 对象。",
    PLUGIN_MANAGER_SETTING_UNKNOWN: key ? "未知插件设置：" + key : "包含未知插件设置。",
    PLUGIN_MANAGER_SETTING_READ_ONLY: key ? "此设置为只读：" + key : "包含只读插件设置。",
    PLUGIN_MANAGER_SETTING_TYPE: key ? "设置类型不正确：" + key : "插件设置类型不正确。",
    PLUGIN_MANAGER_SETTING_RANGE: key ? "设置数值超出允许范围：" + key : "插件设置数值超出允许范围。",
    PLUGIN_MANAGER_SETTING_OPTION: key ? "设置选项无效：" + key : "插件设置选项无效。",
    BILIBILI_LIVE_ADMIN_REQUIRED: "此插件还要求插件管理员权限。",
    PLUGIN_SETTINGS_READ_ONLY: "此插件不允许从 Portal 修改设置。",
    PLUGIN_LIFECYCLE_NOT_FOUND: "找不到插件生命周期记录。",
    PLUGIN_PERMISSION_NOT_REQUESTED: "不能授予插件未声明请求的权限。"
  };
  return jsonResponse({ ok: false, code, message: messages[code] || "插件设置无法更新，请检查输入内容。" }, fallbackStatus);
}

async function runtimeForPluginManager(env, overrides = {}) {
  const runtimeOverrides = overrides.runtimeOverrides && typeof overrides.runtimeOverrides === "object" ? overrides.runtimeOverrides : {};
  return getV3Runtime(env, v3RuntimeOptionsFromEnv(env, runtimeOverrides));
}

async function listPluginManagerState(env, session, overrides = {}) {
  const runtimeState = pluginManagerRuntimeState(env);
  if (!runtimeState.runtimeEnabled) {
    return Object.freeze({ ...runtimeState, pluginCount: 0, plugins: Object.freeze([]) });
  }
  const runtime = await runtimeForPluginManager(env, overrides);
  const plugins = [];
  for (const plugin of runtime.listPlugins()) {
    let surface = null;
    try { surface = await runtime.getPluginSurface(plugin.id, { userId: session.qq }); } catch {}
    plugins.push(pluginSummary(plugin, surface));
  }
  return Object.freeze({ ...runtimeState, pluginCount: plugins.length, plugins: Object.freeze(plugins) });
}

async function handleV3PluginManagerAuthed(request, env, url, body, session, overrides = {}) {
  const pathname = url.pathname;
  const runtimeState = pluginManagerRuntimeState(env);

  if (pathname === V3_PLUGIN_MANAGER_BASE) {
    if (!pluginManagerMethodAllowed(request, ["GET"])) {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 GET。" }, 405, { Allow: "GET" });
    }
    const state = await listPluginManagerState(env, session, overrides);
    return jsonResponse({ ok: true, ...state });
  }

  const stateMatch = pathname.match(/^\/api\/portal\/v3\/plugins\/([^/]+)\/state$/);
  if (stateMatch) {
    if (!pluginManagerMethodAllowed(request, ["POST", "PATCH", "PUT"])) {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 POST、PATCH 或 PUT。" }, 405, { Allow: "POST, PATCH, PUT" });
    }
    if (!runtimeState.runtimeEnabled) {
      return jsonResponse({ ok: false, code: "V3_RUNTIME_DISABLED", message: "V3 Runtime 目前关闭，不能修改插件生命周期。" }, 409);
    }
    if (typeof body?.enabled !== "boolean") return jsonResponse({ ok: false, code: "PLUGIN_STATE_INVALID", message: "enabled 必须是 boolean。" }, 400);
    const pluginId = decodePluginId(stateMatch[1]);
    if (!pluginId) return jsonResponse({ ok: false, code: "PLUGIN_ID_INVALID", message: "插件 ID 无效。" }, 400);
    const runtime = await runtimeForPluginManager(env, overrides);
    if (!pluginDescriptor(runtime, pluginId)) return jsonResponse({ ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到该插件。" }, 404);
    try {
      const lifecycle = await runtime.setPluginEnabled(pluginId, body.enabled, { userId: session.qq });
      const plugin = pluginDescriptor(runtime, pluginId);
      let surface = null;
      try { surface = await runtime.getPluginSurface(pluginId, { userId: session.qq }); } catch {}
      await writeSystemAudit(env, {
        type: "v3_plugin_lifecycle",
        actorId: session.qq,
        action: body.enabled ? "enable" : "disable",
        pluginId,
        lifecycleState: lifecycle?.state || ""
      }).catch(() => {});
      const blocked = lifecycle?.state === "blocked";
      return jsonResponse({
        ok: true,
        plugin: pluginSummary(plugin, surface),
        lifecycle,
        message: blocked ? "插件希望启用，但目前被兼容性或权限条件阻挡。" : (body.enabled ? "插件已启用。" : "插件已停用。")
      });
    } catch (error) {
      return pluginManagerErrorResponse(error);
    }
  }

  const permissionsMatch = pathname.match(/^\/api\/portal\/v3\/plugins\/([^/]+)\/permissions$/);
  if (permissionsMatch) {
    if (!pluginManagerMethodAllowed(request, ["POST", "PATCH", "PUT"])) {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 POST、PATCH 或 PUT。" }, 405, { Allow: "POST, PATCH, PUT" });
    }
    if (!runtimeState.runtimeEnabled) {
      return jsonResponse({ ok: false, code: "V3_RUNTIME_DISABLED", message: "V3 Runtime 目前关闭，不能修改插件权限。" }, 409);
    }
    if (!Array.isArray(body?.permissions) || body.permissions.some(value => typeof value !== "string")) {
      return jsonResponse({ ok: false, code: "PLUGIN_PERMISSIONS_INVALID", message: "permissions 必须是字符串数组。" }, 400);
    }
    const pluginId = decodePluginId(permissionsMatch[1]);
    if (!pluginId) return jsonResponse({ ok: false, code: "PLUGIN_ID_INVALID", message: "插件 ID 无效。" }, 400);
    const runtime = await runtimeForPluginManager(env, overrides);
    if (!pluginDescriptor(runtime, pluginId)) return jsonResponse({ ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到该插件。" }, 404);
    try {
      const permissions = [...new Set(body.permissions.map(value => String(value).trim()).filter(Boolean))];
      const lifecycle = await runtime.setPluginPermissions(pluginId, permissions, { userId: session.qq });
      const plugin = pluginDescriptor(runtime, pluginId);
      let surface = null;
      try { surface = await runtime.getPluginSurface(pluginId, { userId: session.qq }); } catch {}
      await writeSystemAudit(env, {
        type: "v3_plugin_permissions",
        actorId: session.qq,
        action: "update",
        pluginId,
        grantedPermissions: permissions
      }).catch(() => {});
      return jsonResponse({
        ok: true,
        plugin: pluginSummary(plugin, surface),
        lifecycle,
        message: lifecycle?.state === "blocked"
          ? "权限已更新；插件目前缺少必要權限，因此仍被阻擋。"
          : (lifecycle?.degraded ? "权限已更新；插件仍可啟用，但部分未授權功能會停用。" : "插件权限已更新。")
      });
    } catch (error) {
      return pluginManagerErrorResponse(error);
    }
  }

  const channelMatch = pathname.match(/^\/api\/portal\/v3\/plugins\/([^/]+)\/release-channel$/);
  if (channelMatch) {
    if (!pluginManagerMethodAllowed(request, ["POST", "PATCH", "PUT"])) return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 POST、PATCH 或 PUT。" }, 405, { Allow: "POST, PATCH, PUT" });
    if (!runtimeState.runtimeEnabled) return jsonResponse({ ok: false, code: "V3_RUNTIME_DISABLED", message: "V3 运行环境目前关闭，不能修改版本通道偏好。" }, 409);
    const channel = String(body?.channel || "").trim().toLowerCase();
    if (!["stable", "preview"].includes(channel)) return jsonResponse({ ok: false, code: "PLUGIN_RELEASE_CHANNEL_INVALID", message: "版本通道只能是 stable 或 preview。" }, 400);
    const pluginId = decodePluginId(channelMatch[1]);
    if (!pluginId) return jsonResponse({ ok: false, code: "PLUGIN_ID_INVALID", message: "插件 ID 无效。" }, 400);
    const runtime = await runtimeForPluginManager(env, overrides);
    if (!pluginDescriptor(runtime, pluginId)) return jsonResponse({ ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到该插件。" }, 404);
    try {
      const lifecycle = await runtime.setPluginChannelPreference(pluginId, channel, { userId: session.qq });
      await writeSystemAudit(env, { type: "v3_plugin_release_channel", actorId: session.qq, action: "update", pluginId, channel }).catch(() => {});
      const plugin = pluginDescriptor(runtime, pluginId);
      let surface = null;
      try { surface = await runtime.getPluginSurface(pluginId, { userId: session.qq }); } catch {}
      return jsonResponse({ ok: true, plugin: pluginSummary(plugin, surface), lifecycle, message: channel === "preview" ? "已切換為抢先体验版優先。" : "已切換為稳定版優先。" });
    } catch (error) { return pluginManagerErrorResponse(error); }
  }

  const settingsMatch = pathname.match(/^\/api\/portal\/v3\/plugins\/([^/]+)\/settings$/);
  if (settingsMatch) {
    if (!pluginManagerMethodAllowed(request, ["POST", "PATCH", "PUT"])) {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 POST、PATCH 或 PUT。" }, 405, { Allow: "POST, PATCH, PUT" });
    }
    if (!runtimeState.runtimeEnabled) {
      return jsonResponse({ ok: false, code: "V3_RUNTIME_DISABLED", message: "V3 Runtime 目前关闭，不能修改插件设置。" }, 409);
    }
    const pluginId = decodePluginId(settingsMatch[1]);
    if (!pluginId) return jsonResponse({ ok: false, code: "PLUGIN_ID_INVALID", message: "插件 ID 无效。" }, 400);
    const runtime = await runtimeForPluginManager(env, overrides);
    const plugin = pluginDescriptor(runtime, pluginId);
    if (!plugin) return jsonResponse({ ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到该插件。" }, 404);
    if (plugin?.surface?.writableSettings !== true) {
      return jsonResponse({ ok: false, code: "PLUGIN_SETTINGS_READ_ONLY", message: "此插件不允许从 Portal 修改设置。" }, 409);
    }
    let settings;
    try { settings = normalizePortalPluginSettings(plugin, body?.settings); }
    catch (error) { return pluginManagerErrorResponse(error); }
    try {
      const surface = await runtime.updatePluginSettings(pluginId, settings, { userId: session.qq });
      await writeSystemAudit(env, {
        type: "v3_plugin_settings",
        actorId: session.qq,
        action: "update",
        pluginId,
        settingKeys: Object.keys(settings)
      }).catch(() => {});
      return jsonResponse({ ok: true, plugin: pluginSummary(pluginDescriptor(runtime, pluginId), surface), message: "插件设置已更新。" });
    } catch (error) {
      return pluginManagerErrorResponse(error, /ADMIN_REQUIRED|CAPABILITY_DENIED/.test(String(error?.message || "")) ? 403 : 400);
    }
  }

  const detailMatch = pathname.match(/^\/api\/portal\/v3\/plugins\/([^/]+)$/);
  if (detailMatch) {
    if (!pluginManagerMethodAllowed(request, ["GET"])) {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", message: "此接口只允许 GET。" }, 405, { Allow: "GET" });
    }
    if (!runtimeState.runtimeEnabled) {
      return jsonResponse({ ok: false, code: "V3_RUNTIME_DISABLED", message: "V3 Runtime 目前关闭。" }, 409);
    }
    const pluginId = decodePluginId(detailMatch[1]);
    if (!pluginId) return jsonResponse({ ok: false, code: "PLUGIN_ID_INVALID", message: "插件 ID 无效。" }, 400);
    const runtime = await runtimeForPluginManager(env, overrides);
    const plugin = pluginDescriptor(runtime, pluginId);
    if (!plugin) return jsonResponse({ ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到该插件。" }, 404);
    let surface = null;
    try { surface = await runtime.getPluginSurface(pluginId, { userId: session.qq }); }
    catch { return jsonResponse({ ok: false, code: "PLUGIN_SURFACE_UNAVAILABLE", message: "插件管理状态暂时无法读取。" }, 503); }
    return jsonResponse({ ok: true, plugin: pluginSummary(plugin, surface), ...runtimeState });
  }

  return jsonResponse({ ok: false, code: "PLUGIN_MANAGER_ROUTE_NOT_FOUND", message: "未知插件管理接口。" }, 404);
}

async function handleV3PluginManagerApi(request, env, url = null, overrides = {}) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (!target.pathname.startsWith(V3_PLUGIN_MANAGER_BASE)) return null;
  let body = {};
  if (!["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase())) {
    try { body = await request.json(); } catch { body = {}; }
  }
  const auth = await authenticatePluginManager(request, env, target, body, overrides);
  if (!auth.ok) return auth.response;
  return handleV3PluginManagerAuthed(request, env, target, body, auth.session, overrides);
}

function injectV3PluginManagerClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-v3-plugin-manager-style")) return source;

  const nav = '<button id="v3PluginManagerNav" data-view="v3plugins" hidden>插件管理</button>';
  if (source.includes("</nav>")) source = source.replace("</nav>", nav + "</nav>");

  const section = [
    '<div id="qqaiV3PluginManagerContent" class="content">',
    '<section id="v-v3plugins" class="view">',
    '<div class="section-head"><div><h2>V3 插件管理</h2><p>官方与第三方插件共用同一套插件接口。这里不会直接读取插件 D1，也不会显示密钥原值。</p></div><button id="v3PluginRefresh" class="btn">重新加载</button></div>',
    '<div id="v3PluginRuntimeState" class="notice">正在读取 V3 运行状态。</div>',
    '<div id="v3PluginList" class="v3-plugin-grid"><div class="empty">尚未加载插件。</div></div>',
    '</section>',
    '</div>'
  ].join("");
  if (source.includes("</main>")) source = source.replace("</main>", section + "</main>");

  const style = '<style id="qqai-v3-plugin-manager-style">.v3-plugin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;margin-top:16px}.v3-plugin-card{background:var(--panel);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 8px 28px rgba(38,49,76,.045);min-width:0}.v3-plugin-title{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.v3-plugin-title h3{margin:0;font-size:17px}.v3-plugin-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v3-plugin-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--panel2);font-size:11px;font-weight:800}.v3-plugin-setting{margin-top:12px}.v3-plugin-setting textarea{min-height:130px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.v3-plugin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.v3-plugin-status{margin-top:12px}.v3-plugin-status pre{margin:8px 0 0;padding:10px;border-radius:10px;background:var(--panel2);max-height:260px;overflow:auto;font-size:11px}.v3-plugin-runtime-off{border-color:#d97706}.v3-plugin-runtime-on{border-color:#16a34a}@media(max-width:700px){.v3-plugin-grid{grid-template-columns:1fr}.v3-plugin-card{padding:15px}}</style>';
  source = source.includes("</head>") ? source.replace("</head>", style + "<style id=\"qqai-v3-plugin-lifecycle-style\">.v3-lifecycle-box{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--panel2)}.v3-lifecycle-head{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}.v3-lifecycle-perms{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px;margin-top:10px}.v3-lifecycle-perm{display:flex;gap:7px;align-items:center;font-size:12px}.v3-lifecycle-reason{margin-top:8px;font-size:12px;color:var(--warn)}.v3-lifecycle-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}</style>" + "</head>") : style + "<style id=\"qqai-v3-plugin-lifecycle-style\">.v3-lifecycle-box{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--panel2)}.v3-lifecycle-head{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}.v3-lifecycle-perms{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px;margin-top:10px}.v3-lifecycle-perm{display:flex;gap:7px;align-items:center;font-size:12px}.v3-lifecycle-reason{margin-top:8px;font-size:12px;color:var(--warn)}.v3-lifecycle-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}</style>" + source;

  const script = "<script id=\"qqai-v3-plugin-manager-client\">\n(function(){\n'use strict';\nvar nav=document.getElementById('v3PluginManagerNav');\nvar app=document.getElementById('app');\nvar list=document.getElementById('v3PluginList');\nvar state=document.getElementById('v3PluginRuntimeState');\nvar refresh=document.getElementById('v3PluginRefresh');\nif(!nav||!list||!state)return;\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]})}\nfunction statusClass(v){v=String(v||'').toUpperCase();return v==='OK'||v==='ENABLED'?'ok':v==='DEGRADED'||v==='DISABLED'||v==='BLOCKED'?'warning':'error'}\nasync function req(path,method,body){var init={method:method||'GET',headers:{Accept:'application/json'}};if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}var res=await fetch('/api/portal/v3/plugins'+(path||''),init),data={};try{data=await res.json()}catch(e){}return{status:res.status,data:data}}\nfunction settingControl(plugin,key,d,value){\n  var id='v3ps-'+plugin.id.replace(/[^a-z0-9_-]/gi,'-')+'-'+key,label=esc(d.label||key),desc=d.description?'<div class=\"item-meta\">'+esc(d.description)+'</div>':'',control='';\n  if(d.type==='boolean')control='<label class=\"switch\"><input id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"boolean\" type=\"checkbox\" '+(value===true?'checked':'')+'> '+label+'</label>'+desc;\n  else if(d.type==='select')control='<div class=\"field v3-plugin-setting\"><label>'+label+'</label><select id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"select\">'+(d.options||[]).map(function(o){return'<option value=\"'+esc(o.value)+'\" '+(String(value)==String(o.value)?'selected':'')+'>'+esc(o.label||o.value)+'</option>'}).join('')+'</select>'+desc+'</div>';\n  else if(d.type==='json')control='<div class=\"field v3-plugin-setting\"><label>'+label+'</label><textarea id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"json\" '+(d.readOnly?'disabled':'')+'>'+esc(JSON.stringify(value==null?null:value,null,2))+'</textarea>'+desc+'</div>';\n  else{var type=d.secret?'password':(d.type==='number'?'number':'text'),val=d.secret&&value==='[redacted]'?'':(value==null?'':String(value)),attrs=d.type==='number'?' min=\"'+esc(d.min==null?'':d.min)+'\" max=\"'+esc(d.max==null?'':d.max)+'\" step=\"'+esc(d.step==null?'any':d.step)+'\"':'';control='<div class=\"field v3-plugin-setting\"><label>'+label+(d.secret?'（密钥）':'')+'</label><input id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"'+esc(d.type)+'\" type=\"'+type+'\" value=\"'+esc(val)+'\" '+attrs+' '+(d.readOnly?'disabled':'')+' placeholder=\"'+(d.secret&&value==='[redacted]'?'已设置；留空代表不覆盖':'')+'\">'+desc+'</div>'}\n  return control;\n}\nfunction lifecycleControl(p){\n  var life=p.lifecycle||{},requested=p.requestedPermissions||[],required=new Set(p.requiredPermissions||[]),granted=new Set(p.grantedPermissions||[]),disclosures={};\n  (p.permissionDisclosures||[]).forEach(function(d){disclosures[d.capability]=d});\n  var stateName=String(life.state||'unknown').toUpperCase();\n  var accessLabel={read:'只读',write:'写入',action:'操作',external:'外部传输'};\n  var perms=requested.map(function(name){var d=disclosures[name]||{},types=(d.accessTypes||[]).map(function(t){return accessLabel[t]||t}).join('＋'),dest=(d.externalDestinations||[]).length?' → '+d.externalDestinations.join(', '):'';return'<label class=\"v3-lifecycle-perm\"><input type=\"checkbox\" data-v3-permission=\"'+esc(name)+'\" '+(granted.has(name)?'checked':'')+'> <span><b>'+esc(d.labelZh||name)+'</b> '+(required.has(name)?'（必要）':'（可选）')+'<br><small>'+esc(types||'操作')+esc(dest)+(d.descriptionZh?'｜'+esc(d.descriptionZh):'')+'</small></span></label>'}).join('');\n  var missingRequired=life.missingRequiredPermissions||[];\n  var reason=life.blockReason?'<div class=\"v3-lifecycle-reason\">阻挡原因：'+esc(life.blockReason)+(missingRequired.length?'｜缺少必要权限：'+esc(missingRequired.join(', ')):'')+'</div>':'';\n  var compat=life.compatibility||{};\n  var meta='已安装='+(life.installed!==false?'是':'否')+'｜可用='+(life.available!==false?'是':'否')+'｜已启用='+(p.active?'是':'否')+'｜QQAI '+esc(compat.qqaiVersion||'')+(life.degraded?'｜部分功能因未授权而停用':'');\n  var toggle=life.desiredState==='enabled'?'<button class=\"btn danger\" data-v3-toggle=\"'+esc(p.id)+'\" data-enabled=\"false\">停用插件</button>':'<button class=\"btn primary\" data-v3-toggle=\"'+esc(p.id)+'\" data-enabled=\"true\">启用插件</button>';\n  var channel='<label>版本偏好 <select data-v3-channel=\"'+esc(p.id)+'\"><option value=\"stable\" '+(p.channelPreference!=='preview'?'selected':'')+'>稳定版（优先）</option><option value=\"preview\" '+(p.channelPreference==='preview'?'selected':'')+'>抢先体验版</option></select></label><button class=\"btn\" data-v3-save-channel=\"'+esc(p.id)+'\">保存版本偏好</button>';\n  return '<div class=\"v3-lifecycle-box\"><div class=\"v3-lifecycle-head\"><b>生命周期与权限</b><span class=\"status '+statusClass(stateName)+'\">'+esc(stateName)+'</span></div><div class=\"item-meta\">'+meta+'</div>'+reason+(requested.length?'<div class=\"v3-lifecycle-perms\">'+perms+'</div><div class=\"v3-lifecycle-actions\">'+toggle+'<button class=\"btn\" data-v3-save-permissions=\"'+esc(p.id)+'\">保存权限</button>'+channel+'</div>':'<div class=\"v3-lifecycle-actions\">'+toggle+channel+'</div>')+'</div>';\n}\nfunction renderPlugin(p){\n  var schema=p.settingsSchema||{},settings=p.settings||{},status=p.status||{};\n  var badge='<span class=\"status '+statusClass(status.state)+'\">'+esc(status.state||'UNKNOWN')+'</span>';\n  var caps=(p.capabilities||[]).map(function(x){return'<span class=\"v3-plugin-badge\">'+esc(x)+'</span>'}).join('');\n  var fields=Object.keys(schema).map(function(k){return settingControl(p,k,schema[k],settings[k])}).join('');\n  var save=p.surface&&p.surface.writableSettings?'<button class=\"btn primary\" data-v3-save=\"'+esc(p.id)+'\">保存設定</button>':'<button class=\"btn\" disabled>设置只读</button>';\n  return '<article class=\"v3-plugin-card\" data-v3-plugin=\"'+esc(p.id)+'\"><div class=\"v3-plugin-title\"><div><h3>'+esc(p.name||p.id)+'</h3><div class=\"item-meta\">'+esc(p.id)+'｜v'+esc(p.version)+'｜Plugin API '+esc(p.apiVersion)+'</div></div>'+badge+'</div><div class=\"v3-plugin-badges\"><span class=\"v3-plugin-badge\">'+esc(p.trustLabelZh||'尚未取得认证')+'</span><span class=\"v3-plugin-badge\">'+esc(p.releaseChannelLabelZh||'稳定版')+'</span>'+(p.publicStatus?'<span class=\"v3-plugin-badge\">公开状态</span>':'')+caps+'</div>'+(p.description?'<div class=\"item-body\">'+esc(p.description)+'</div>':'')+lifecycleControl(p)+(fields||'<div class=\"notice\">此插件没有可配置设置。</div>')+'<div class=\"v3-plugin-actions\">'+save+'<button class=\"btn\" data-v3-detail=\"'+esc(p.id)+'\">重新读取状态</button></div><details class=\"v3-plugin-status\"><summary>查看运行状态</summary><pre>'+esc(JSON.stringify(status,null,2))+'</pre></details></article>';\n}\nfunction bindCards(){\n  list.querySelectorAll('[data-v3-save]').forEach(function(btn){btn.onclick=function(){savePlugin(this.dataset.v3Save)}});\n  list.querySelectorAll('[data-v3-detail]').forEach(function(btn){btn.onclick=function(){loadDetail(this.dataset.v3Detail)}});\n  list.querySelectorAll('[data-v3-toggle]').forEach(function(btn){btn.onclick=function(){togglePlugin(this.dataset.v3Toggle,this.dataset.enabled==='true')}});\n  list.querySelectorAll('[data-v3-save-permissions]').forEach(function(btn){btn.onclick=function(){savePermissions(this.dataset.v3SavePermissions)}});\n  list.querySelectorAll('[data-v3-save-channel]').forEach(function(btn){btn.onclick=function(){saveChannel(this.dataset.v3SaveChannel)}});\n}\nasync function loadPlugins(){\n  state.textContent='正在读取 V3 Runtime 与插件状态…';var r=await req('');\n  if(r.status===401||r.status===403){nav.hidden=true;return}nav.hidden=false;\n  if(!r.data.ok){state.textContent=r.data.message||'插件状态读取失败。';list.innerHTML='<div class=\"empty\">'+esc(r.data.message||'加载失败')+'</div>';return}\n  var enabled=!!r.data.runtimeEnabled;state.className='notice '+(enabled?'v3-plugin-runtime-on':'v3-plugin-runtime-off');\n  state.textContent=enabled?'V3 运行环境已启用｜候选插件 '+Number(r.data.pluginCount||0)+' 个'+(r.data.bilibiliEnabled?'｜Bilibili 内置候选插件已配置':''):'V3 运行环境目前关闭（V3_RUNTIME_ENABLED=false）。此页面只显示安全状态，不会因为打开控制台而启动 V3 或扫描 D1。';\n  list.innerHTML=(r.data.plugins||[]).map(renderPlugin).join('')||(enabled?'<div class=\"empty\">运行环境已启用，但目前没有插件候选。</div>':'<div class=\"empty\">V3 尚未启用，因此没有运行中的插件。</div>');bindCards();\n}\nasync function loadDetail(id){var r=await req('/'+encodeURIComponent(id));if(!r.data.ok){alert(r.data.message||'状态读取失败');return}var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');if(card){var fresh=document.createElement('div');fresh.innerHTML=renderPlugin(r.data.plugin);card.replaceWith(fresh.firstElementChild);bindCards()}}\nfunction collectSettings(card){var out={};card.querySelectorAll('[data-v3-setting]').forEach(function(el){var key=el.dataset.v3Setting,type=el.dataset.v3Type;if(el.disabled)return;if(type==='boolean')out[key]=!!el.checked;else if(type==='number'){if(el.value!=='')out[key]=Number(el.value)}else if(type==='json')out[key]=JSON.parse(el.value||'null');else if(type==='string'&&el.type==='password'&&!el.value){}else out[key]=el.value});return out}\nasync function savePlugin(id){var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');if(!card)return;var settings;try{settings=collectSettings(card)}catch(e){alert('JSON 设置格式错误：'+e.message);return}var r=await req('/'+encodeURIComponent(id)+'/settings','POST',{settings:settings});alert(r.data.message||'保存完成');if(r.data.ok)await loadDetail(id)}\nasync function togglePlugin(id,enabled){if(!confirm(enabled?'确定启用此插件？':'确定停用此插件？'))return;var r=await req('/'+encodeURIComponent(id)+'/state','POST',{enabled:enabled});alert(r.data.message||'操作完成');if(r.data.ok)await loadDetail(id)}\nasync function savePermissions(id){var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');if(!card)return;var permissions=Array.from(card.querySelectorAll('[data-v3-permission]:checked')).map(function(el){return el.dataset.v3Permission});var r=await req('/'+encodeURIComponent(id)+'/permissions','PUT',{permissions:permissions});alert(r.data.message||'权限已更新');if(r.data.ok)await loadDetail(id)}\nasync function saveChannel(id){var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');if(!card)return;var el=card.querySelector('[data-v3-channel]');if(!el)return;var r=await req('/'+encodeURIComponent(id)+'/release-channel','PUT',{channel:el.value});alert(r.data.message||'版本偏好已更新');if(r.data.ok)await loadDetail(id)}\nnav.addEventListener('click',function(){setTimeout(function(){var title=document.getElementById('pageTitle');if(title)title.textContent='插件管理';loadPlugins()},0)});\nif(refresh)refresh.onclick=loadPlugins;\nfunction probe(){if(!app||app.classList.contains('hidden'))return;loadPlugins()}\nif(app){new MutationObserver(function(){probe()}).observe(app,{attributes:true,attributeFilter:['class']});if(!app.classList.contains('hidden'))probe()}\n})();\n</script>";
  source = source.includes("</body>") ? source.replace("</body>", script + "</body>") : source + script;
  return source;
}

export {
  V3_PLUGIN_MANAGER_BASE,
  authenticatePluginManager,
  decodePluginId,
  handleV3PluginManagerApi,
  handleV3PluginManagerAuthed,
  injectV3PluginManagerClient,
  listPluginManagerState,
  normalizePortalPluginSettings,
  pluginManagerRuntimeState,
  pluginSummary
};
