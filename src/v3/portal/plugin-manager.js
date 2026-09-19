import { isDeveloperId } from "../../core/identity.js";
import { writeSystemAudit } from "../../core/permissions.js";
import { getPortalSession, jsonResponse, readCookie } from "../../portal/auth.js";
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
  if (!checkDeveloper(env, session.qq)) {
    return Object.freeze({
      ok: false,
      response: jsonResponse({ ok: false, code: "PLUGIN_MANAGER_DEVELOPER_REQUIRED", message: "只有核心开发者可以管理 V3 插件。" }, 403)
    });
  }
  return Object.freeze({ ok: true, session });
}

function pluginSummary(plugin, surface = null) {
  const schema = plugin?.settings && typeof plugin.settings === "object" ? plugin.settings : {};
  return Object.freeze({
    id: String(plugin?.id || ""),
    name: String(plugin?.name || ""),
    version: String(plugin?.version || ""),
    apiVersion: String(plugin?.apiVersion || ""),
    description: String(plugin?.description || ""),
    author: String(plugin?.author || ""),
    official: plugin?.official === true,
    publicStatus: plugin?.publicStatus === true,
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
  const schema = plugin?.settings && typeof plugin.settings === "object" ? plugin.settings : {};
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
    PLUGIN_SETTINGS_READ_ONLY: "此插件不允许从 Portal 修改设置。"
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
    '<div class="section-head"><div><h2>V3 插件管理</h2><p>官方与第三方插件共用同一 Plugin API。这里不会直接读取插件 D1，也不会显示 secret 原值。</p></div><button id="v3PluginRefresh" class="btn">重新加载</button></div>',
    '<div id="v3PluginRuntimeState" class="notice">正在读取 V3 Runtime 状态。</div>',
    '<div id="v3PluginList" class="v3-plugin-grid"><div class="empty">尚未加载插件。</div></div>',
    '</section>',
    '</div>'
  ].join("");
  if (source.includes("</main>")) source = source.replace("</main>", section + "</main>");

  const style = '<style id="qqai-v3-plugin-manager-style">.v3-plugin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;margin-top:16px}.v3-plugin-card{background:var(--panel);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 8px 28px rgba(38,49,76,.045);min-width:0}.v3-plugin-title{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.v3-plugin-title h3{margin:0;font-size:17px}.v3-plugin-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v3-plugin-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--panel2);font-size:11px;font-weight:800}.v3-plugin-setting{margin-top:12px}.v3-plugin-setting textarea{min-height:130px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.v3-plugin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.v3-plugin-status{margin-top:12px}.v3-plugin-status pre{margin:8px 0 0;padding:10px;border-radius:10px;background:var(--panel2);max-height:260px;overflow:auto;font-size:11px}.v3-plugin-runtime-off{border-color:#d97706}.v3-plugin-runtime-on{border-color:#16a34a}@media(max-width:700px){.v3-plugin-grid{grid-template-columns:1fr}.v3-plugin-card{padding:15px}}</style>';
  source = source.includes("</head>") ? source.replace("</head>", style + "</head>") : style + source;

  const script = "<script id=\"qqai-v3-plugin-manager-client\">\n(function(){\n'use strict';\nvar nav=document.getElementById('v3PluginManagerNav');\nvar app=document.getElementById('app');\nvar list=document.getElementById('v3PluginList');\nvar state=document.getElementById('v3PluginRuntimeState');\nvar refresh=document.getElementById('v3PluginRefresh');\nif(!nav||!list||!state)return;\nfunction esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]})}\nfunction statusClass(v){v=String(v||'').toUpperCase();return v==='OK'?'ok':v==='DEGRADED'?'warning':v==='DISABLED'?'warning':'error'}\nasync function req(path,method,body){\n  var init={method:method||'GET',headers:{Accept:'application/json'}};\n  if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}\n  var res=await fetch('/api/portal/v3/plugins'+(path||''),init),data={};\n  try{data=await res.json()}catch(e){}\n  return{status:res.status,data:data}\n}\nfunction settingControl(plugin,key,d,value){\n  var id='v3ps-'+plugin.id.replace(/[^a-z0-9_-]/gi,'-')+'-'+key;\n  var label=esc(d.label||key);\n  var desc=d.description?'<div class=\"item-meta\">'+esc(d.description)+'</div>':'';\n  var control='';\n  if(d.type==='boolean'){\n    control='<label class=\"switch\"><input id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"boolean\" type=\"checkbox\" '+(value===true?'checked':'')+'> '+label+'</label>'+desc;\n  }else if(d.type==='select'){\n    control='<div class=\"field v3-plugin-setting\"><label>'+label+'</label><select id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"select\">'+(d.options||[]).map(function(o){return'<option value=\"'+esc(o.value)+'\" '+(String(value)==String(o.value)?'selected':'')+'>'+esc(o.label||o.value)+'</option>'}).join('')+'</select>'+desc+'</div>';\n  }else if(d.type==='json'){\n    control='<div class=\"field v3-plugin-setting\"><label>'+label+'</label><textarea id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"json\" '+(d.readOnly?'disabled':'')+'>'+esc(JSON.stringify(value==null?null:value,null,2))+'</textarea>'+desc+'</div>';\n  }else{\n    var type=d.secret?'password':(d.type==='number'?'number':'text');\n    var val=d.secret&&value==='[redacted]'?'':(value==null?'':String(value));\n    var attrs=d.type==='number'?' min=\"'+esc(d.min==null?'':d.min)+'\" max=\"'+esc(d.max==null?'':d.max)+'\" step=\"'+esc(d.step==null?'any':d.step)+'\"':'';\n    control='<div class=\"field v3-plugin-setting\"><label>'+label+(d.secret?'（secret）':'')+'</label><input id=\"'+id+'\" data-v3-setting=\"'+esc(key)+'\" data-v3-type=\"'+esc(d.type)+'\" type=\"'+type+'\" value=\"'+esc(val)+'\" '+attrs+' '+(d.readOnly?'disabled':'')+' placeholder=\"'+(d.secret&&value==='[redacted]'?'已設定；留空代表不覆蓋':'')+'\">'+desc+'</div>';\n  }\n  return control;\n}\nfunction renderPlugin(p){\n  var schema=p.settingsSchema||{},settings=p.settings||{},status=p.status||{};\n  var badge='<span class=\"status '+statusClass(status.state)+'\">'+esc(status.state||'UNKNOWN')+'</span>';\n  var caps=(p.capabilities||[]).map(function(x){return'<span class=\"v3-plugin-badge\">'+esc(x)+'</span>'}).join('');\n  var fields=Object.keys(schema).map(function(k){return settingControl(p,k,schema[k],settings[k])}).join('');\n  var save=p.surface&&p.surface.writableSettings?'<button class=\"btn primary\" data-v3-save=\"'+esc(p.id)+'\">保存设置</button>':'<button class=\"btn\" disabled>设置只读</button>';\n  return '<article class=\"v3-plugin-card\" data-v3-plugin=\"'+esc(p.id)+'\"><div class=\"v3-plugin-title\"><div><h3>'+esc(p.name||p.id)+'</h3><div class=\"item-meta\">'+esc(p.id)+'｜v'+esc(p.version)+'｜Plugin API '+esc(p.apiVersion)+'</div></div>'+badge+'</div><div class=\"v3-plugin-badges\">'+(p.official?'<span class=\"v3-plugin-badge\">官方</span>':'<span class=\"v3-plugin-badge\">第三方</span>')+(p.publicStatus?'<span class=\"v3-plugin-badge\">Public Status</span>':'')+caps+'</div>'+(p.description?'<div class=\"item-body\">'+esc(p.description)+'</div>':'')+(fields||'<div class=\"notice\">此插件没有可配置设置。</div>')+'<div class=\"v3-plugin-actions\">'+save+'<button class=\"btn\" data-v3-detail=\"'+esc(p.id)+'\">重新读取状态</button></div><details class=\"v3-plugin-status\"><summary>查看运行状态</summary><pre>'+esc(JSON.stringify(status,null,2))+'</pre></details></article>';\n}\nfunction bindCards(){\n  list.querySelectorAll('[data-v3-save]').forEach(function(btn){btn.onclick=function(){savePlugin(this.dataset.v3Save)}});\n  list.querySelectorAll('[data-v3-detail]').forEach(function(btn){btn.onclick=function(){loadDetail(this.dataset.v3Detail)}});\n}\nasync function loadPlugins(){\n  state.textContent='正在读取 V3 Runtime 与插件状态…';\n  var r=await req('');\n  if(r.status===401||r.status===403){nav.hidden=true;return}\n  nav.hidden=false;\n  if(!r.data.ok){state.textContent=r.data.message||'插件状态读取失败。';list.innerHTML='<div class=\"empty\">'+esc(r.data.message||'加载失败')+'</div>';return}\n  var enabled=!!r.data.runtimeEnabled;\n  state.className='notice '+(enabled?'v3-plugin-runtime-on':'v3-plugin-runtime-off');\n  state.textContent=enabled?'V3 Runtime 已启用｜已载入 '+Number(r.data.pluginCount||0)+' 个插件'+(r.data.bilibiliEnabled?'｜Bilibili 官方插件已启用':''):'V3 Runtime 目前关闭（V3_RUNTIME_ENABLED=false）。此页面只显示安全状态，不会因为打开 Portal 而启动 V3 或扫描 D1。';\n  list.innerHTML=(r.data.plugins||[]).map(renderPlugin).join('')||(enabled?'<div class=\"empty\">Runtime 已启用，但目前没有载入插件。</div>':'<div class=\"empty\">V3 尚未启用，因此没有运行中的插件。</div>');\n  bindCards();\n}\nasync function loadDetail(id){\n  var r=await req('/'+encodeURIComponent(id));\n  if(!r.data.ok){alert(r.data.message||'状态读取失败');return}\n  var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');\n  if(card){var fresh=document.createElement('div');fresh.innerHTML=renderPlugin(r.data.plugin);card.replaceWith(fresh.firstElementChild);bindCards()}\n}\nfunction collectSettings(card){\n  var out={};\n  card.querySelectorAll('[data-v3-setting]').forEach(function(el){\n    var key=el.dataset.v3Setting,type=el.dataset.v3Type;\n    if(el.disabled)return;\n    if(type==='boolean')out[key]=!!el.checked;\n    else if(type==='number'){if(el.value!=='')out[key]=Number(el.value)}\n    else if(type==='json')out[key]=JSON.parse(el.value||'null');\n    else if(type==='string'&&el.type==='password'&&!el.value){}\n    else out[key]=el.value;\n  });\n  return out;\n}\nasync function savePlugin(id){\n  var card=list.querySelector('[data-v3-plugin=\"'+CSS.escape(id)+'\"]');\n  if(!card)return;\n  var settings;\n  try{settings=collectSettings(card)}catch(e){alert('JSON 设置格式错误：'+e.message);return}\n  var r=await req('/'+encodeURIComponent(id)+'/settings','POST',{settings:settings});\n  alert(r.data.message||'保存完成');\n  if(r.data.ok)await loadDetail(id);\n}\nnav.addEventListener('click',function(){setTimeout(function(){var title=document.getElementById('pageTitle');if(title)title.textContent='插件管理';loadPlugins()},0)});\nif(refresh)refresh.onclick=loadPlugins;\nfunction probe(){if(!app||app.classList.contains('hidden'))return;loadPlugins()}\nif(app){new MutationObserver(function(){probe()}).observe(app,{attributes:true,attributeFilter:['class']});if(!app.classList.contains('hidden'))probe()}\n})();\n</script>";
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
