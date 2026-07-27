from pathlib import Path
import json


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


# Version metadata.
replace_once("src/config/runtime.js", 'const VERSION = "2.7.8";', 'const VERSION = "2.7.9";')
replace_once("package.json", '"version": "2.7.8"', '"version": "2.7.9"')
replace_once(
    "package.json",
    'verify-self-outbound-loop.mjs"',
    'verify-self-outbound-loop.mjs && node verify-portal-auth-password.mjs"'
)

# Fresh notification defaults are developer-only. Legacy v1 empty-manager defaults migrate,
# while explicit manager IDs and all v2 choices remain intact.
routing_path = Path("src/notifications/routing.js")
routing = routing_path.read_text(encoding="utf-8")
old_default_count = routing.count('defaultMode: "managers"')
if old_default_count != 7:
    raise RuntimeError(f"notification manager default count={old_default_count}, expected 7")
routing = routing.replace('defaultMode: "managers"', 'defaultMode: "developer"')
old_normalizers = '''function normalizeRoute(value, definition) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaultRouteFor(definition);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    mode: NOTIFICATION_ROUTE_MODES.includes(String(source.mode || "")) ? String(source.mode) : fallback.mode,
    managerIds: cleanManagerIds(source.managerIds)
  };
}

function normalizeNotificationRoutingConfig(value, groupId = "") {
  const source = value && typeof value === "object" ? value : {};
  const routes = {};
  for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
    routes[definition.id] = normalizeRoute(source?.routes?.[definition.id], definition);
  }
  return {
    version: 1,
    groupId: cleanId(source.groupId || groupId),
    ownerEnabled: source.ownerEnabled === true,
    routes,
    updatedAt: Number(source.updatedAt || 0),
    updatedBy: cleanId(source.updatedBy)
  };
}
'''
new_normalizers = '''function normalizeRoute(value, definition, { migrateLegacyImplicitManagers = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaultRouteFor(definition);
  const managerIds = cleanManagerIds(source.managerIds);
  let mode = NOTIFICATION_ROUTE_MODES.includes(String(source.mode || "")) ? String(source.mode) : fallback.mode;
  if (migrateLegacyImplicitManagers && mode === "managers" && managerIds.length === 0) mode = "developer";
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    mode,
    managerIds
  };
}

function normalizeNotificationRoutingConfig(value, groupId = "") {
  const source = value && typeof value === "object" ? value : {};
  const sourceVersion = Number(source.version || 0);
  const hasStoredRoutes = Boolean(source.routes && typeof source.routes === "object");
  const migrateLegacyImplicitManagers = hasStoredRoutes && sourceVersion < 2;
  const routes = {};
  for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
    routes[definition.id] = normalizeRoute(source?.routes?.[definition.id], definition, { migrateLegacyImplicitManagers });
  }
  return {
    version: 2,
    groupId: cleanId(source.groupId || groupId),
    ownerEnabled: source.ownerEnabled === true,
    routes,
    updatedAt: Number(source.updatedAt || 0),
    updatedBy: cleanId(source.updatedBy)
  };
}
'''
if routing.count(old_normalizers) != 1:
    raise RuntimeError("notification normalizer anchor mismatch")
routing = routing.replace(old_normalizers, new_normalizers, 1)
routing_path.write_text(routing, encoding="utf-8")

# Notification Portal endpoint and JSON-safe error handling.
portal_notification_path = Path("src/portal/notification-routing.js")
portal_notification = portal_notification_path.read_text(encoding="utf-8")
old_handler = '''async function handleNotificationRoutingApi(request, env, path, body, authed) {
  if (!path.startsWith("/notification-routing")) return null;
  const groupId = String(authed?.groupId || "").replace(/\\D/g, "");
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (!notificationRoutingAllowed(env, authed)) {
    return jsonResponse({ ok: false, message: "通知路由仅限本群 QQ 管理员、群主、获授群操作权限者或开发者设置。" }, 403);
  }
  if (request.method === "GET" && path === "/notification-routing") {
    const state = await getNotificationRoutingPortalState(env, groupId);
    return jsonResponse({ ok: true, ...state });
  }
  if (request.method === "POST" && path === "/notification-routing") {
    const config = await saveNotificationRoutingConfig(env, groupId, body || {}, authed.qq);
    const state = await getNotificationRoutingPortalState(env, groupId);
    return jsonResponse({ ok: true, message: "人工通知路由已保存。", config, ...state });
  }
  return jsonResponse({ ok: false, message: "未知通知路由接口。" }, 404);
}
'''
new_handler = '''async function handleNotificationRoutingApi(request, env, path, body, authed) {
  if (!path.startsWith("/notification-routing")) return null;
  const groupId = String(authed?.groupId || "").replace(/\\D/g, "");
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (!notificationRoutingAllowed(env, authed)) {
    return jsonResponse({ ok: false, message: "通知路由仅限本群 QQ 管理员、群主、获授群操作权限者或开发者设置。" }, 403);
  }
  try {
    if (request.method === "GET" && path === "/notification-routing") {
      const state = await getNotificationRoutingPortalState(env, groupId);
      return jsonResponse({ ok: true, ...state });
    }
    if (request.method === "POST" && path === "/notification-routing") {
      const config = await saveNotificationRoutingConfig(env, groupId, body || {}, authed.qq);
      const state = await getNotificationRoutingPortalState(env, groupId);
      return jsonResponse({ ok: true, message: "人工通知路由已保存。", config, ...state });
    }
    return jsonResponse({ ok: false, message: "未知通知路由接口。" }, 404);
  } catch (error) {
    return jsonResponse({
      ok: false,
      code: "NOTIFICATION_ROUTING_UNAVAILABLE",
      message: `通知路由暂时无法读取或保存：${String(error?.message || error).slice(0, 300)}`
    }, 503);
  }
}
'''
if portal_notification.count(old_handler) != 1:
    raise RuntimeError("notification API handler anchor mismatch")
portal_notification = portal_notification.replace(old_handler, new_handler, 1)
portal_notification = portal_notification.replace(
    '统一设置需要人工处理的事件应通知谁。群主通知总开关默认关闭。',
    '默认只通知开发者；只有手动改为指定管理员或群主时，才会通知其他人。群主通知总开关默认关闭。',
    1
)
old_client_call = "  async function call(method,body){var response=await fetch('/api/notification-routing',{method:method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});var data=await response.json().catch(function(){return{ok:false,message:'服务器未返回 JSON'}});if(!response.ok&&data.ok!==false)data.ok=false;return data}"
new_client_call = "  async function call(method,body){var response;try{response=await fetch('/api/portal/notification-routing',{method:method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'})}catch(error){return{ok:false,code:'NETWORK_ERROR',message:'通知路由网络请求失败：'+String(error&&error.message||error)}}var text=await response.text(),data;try{data=text?JSON.parse(text):{}}catch(error){return{ok:false,code:'NON_JSON_RESPONSE',message:'通知路由服务器返回非 JSON（HTTP '+response.status+'，'+String(response.headers.get('Content-Type')||'未知类型')+'）。'+(text?'响应开头：'+text.slice(0,120):'响应为空')}}if(!data||typeof data!=='object')data={ok:false,message:'通知路由服务器响应格式无效'};if(!response.ok&&data.ok!==false)data.ok=false;if(!response.ok&&!data.message)data.message='通知路由请求失败：HTTP '+response.status;return data}"
if portal_notification.count(old_client_call) != 1:
    raise RuntimeError("notification client call anchor mismatch")
portal_notification = portal_notification.replace(old_client_call, new_client_call, 1)
portal_notification_path.write_text(portal_notification, encoding="utf-8")

# Password record validation must never turn a malformed record into a storage outage.
auth_path = Path("src/portal/auth.js")
auth = auth_path.read_text(encoding="utf-8")
old_verify = '''async function verifyPortalPassword(password, record) {
  if (!record || record.algorithm !== "PBKDF2-SHA-256") return false;
  const actual = await derivePortalPassword(String(password || ""), base64UrlToBytes(record.salt), Number(record.iterations || 120000));
  return constantTimeEqual(actual, base64UrlToBytes(record.hash));
}
'''
new_verify = '''function isValidPortalPasswordRecord(record) {
  if (!record || typeof record !== "object" || record.algorithm !== "PBKDF2-SHA-256") return false;
  const iterations = Number(record.iterations || 0);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 2000000) return false;
  if (typeof record.salt !== "string" || typeof record.hash !== "string") return false;
  try {
    const salt = base64UrlToBytes(record.salt);
    const hash = base64UrlToBytes(record.hash);
    return salt.length >= 16 && salt.length <= 64 && hash.length === 32;
  } catch {
    return false;
  }
}

async function verifyPortalPassword(password, record) {
  if (!isValidPortalPasswordRecord(record)) return false;
  try {
    const actual = await derivePortalPassword(String(password || ""), base64UrlToBytes(record.salt), Number(record.iterations));
    return constantTimeEqual(actual, base64UrlToBytes(record.hash));
  } catch {
    return false;
  }
}
'''
if auth.count(old_verify) != 1:
    raise RuntimeError("password verify anchor mismatch")
auth = auth.replace(old_verify, new_verify, 1)
export_anchor = 'isMemoryBanned, jsonResponse'
if auth.count(export_anchor) != 1:
    raise RuntimeError("auth export anchor mismatch")
auth = auth.replace(export_anchor, 'isMemoryBanned, isValidPortalPasswordRecord, jsonResponse', 1)
auth_path.write_text(auth, encoding="utf-8")

# Worker password login diagnostics plus QQ-code password reset.
worker_path = Path("worker.js")
worker = worker_path.read_text(encoding="utf-8")
import_anchor = 'constantTimeEqual, createPortalSession'
if worker.count(import_anchor) != 1:
    raise RuntimeError("worker auth import create anchor mismatch")
worker = worker.replace(import_anchor, 'constantTimeEqual, createPortalPasswordRecord, createPortalSession', 1)
import_anchor2 = 'isMemoryBanned, jsonResponse'
if worker.count(import_anchor2) != 1:
    raise RuntimeError("worker auth import validation anchor mismatch")
worker = worker.replace(import_anchor2, 'isMemoryBanned, isValidPortalPasswordRecord, jsonResponse', 1)
import_anchor3 = 'upsertMemoryVector, verifyPortalPassword'
if worker.count(import_anchor3) != 1:
    raise RuntimeError("worker auth import policy anchor mismatch")
worker = worker.replace(import_anchor3, 'upsertMemoryVector, validatePortalPassword, verifyPortalPassword', 1)

login_anchor = '''    if (request.method === 'POST' && url.pathname === '/api/auth/login-password') {
'''
reset_block = '''    if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\\D/g, "");
      const code = String(payload.code || "").replace(/\\D/g, "");
      const newPassword = String(payload.newPassword || "");
      if (!/^\\d{5,12}$/.test(qq) || !/^\\d{6}$/.test(code)) return jsonResponse({ ok: false, message: "请输入正确的 QQ 号和六位验证码。" }, 400);
      const validation = validatePortalPassword(newPassword);
      if (!validation.ok) return jsonResponse({ ok: false, code: "PASSWORD_POLICY", message: validation.message }, 400);
      try {
        const verified = await verifyPortalVerificationCode(env, qq, code, { consume: false });
        if (!verified.ok) return jsonResponse(verified, 400);
        const record = await createPortalPasswordRecord(validation.value);
        await authDbPutStrict(env, `portal_auth_password:${qq}`, JSON.stringify(record));
        await authDbDelStrict(env, `portal_auth_code:${qq}`);
        await clearPasswordLoginGuard(env, qq);
        await writeSystemAudit(env, { type: "portal_auth_security", actorId: qq, action: "password_reset_by_qq_code" }).catch(() => {});
        return jsonResponse({ ok: true, message: "密码已通过 QQ 验证码重设。现在可以使用新密码登录。" });
      } catch (error) {
        return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: "密码重设失败，验证码尚未消耗，请稍后重试。" }, 503);
      }
    }

'''
if worker.count(login_anchor) != 1:
    raise RuntimeError("password login endpoint anchor mismatch")
worker = worker.replace(login_anchor, reset_block + login_anchor, 1)
record_anchor = '        if (!passwordRecord) return jsonResponse({ ok: false, code: "PASSWORD_NOT_SET", message: "此 QQ 尚未设置密码，请先使用 QQ 验证码登录。" }, 404);\n        if (!(await verifyPortalPassword(password, passwordRecord))) {'
record_replacement = '        if (!passwordRecord) return jsonResponse({ ok: false, code: "PASSWORD_NOT_SET", message: "此 QQ 尚未设置密码，请先使用 QQ 验证码登录。" }, 404);\n        if (!isValidPortalPasswordRecord(passwordRecord)) return jsonResponse({ ok: false, code: "PASSWORD_RECORD_INVALID", message: "密码记录已损坏或格式过旧，请使用 QQ 验证码重设密码。" }, 409);\n        if (!(await verifyPortalPassword(password, passwordRecord))) {'
if worker.count(record_anchor) != 1:
    raise RuntimeError("password record validation anchor mismatch")
worker = worker.replace(record_anchor, record_replacement, 1)
worker_path.write_text(worker, encoding="utf-8")

# Login-page password recovery UI and behavior.
runtime_path = Path("src/portal/runtime.js")
runtime = runtime_path.read_text(encoding="utf-8")
ui_anchor = '''      <button id="verifyPassword" type="button" class="btn primary" style="width:100%;margin-top:12px">使用密码登录</button>
    </div>
    <label class="switch"><input id="rememberLogin" type="checkbox" checked>在这台设备保持登录（最长 180 天）</label>'''
ui_replacement = '''      <button id="verifyPassword" type="button" class="btn primary" style="width:100%;margin-top:12px">使用密码登录</button>
      <details id="loginPasswordReset" class="settings-fold" style="margin-top:14px"><summary>密码无法使用或忘记密码</summary><div class="settings-fold-body"><p class="muted">发送 QQ 验证码后，可直接建立新的登录密码；不需要旧密码。</p><div class="field"><label for="loginResetPassword">新密码（至少 10 个字符）</label><input id="loginResetPassword" type="password" maxlength="128" autocomplete="new-password"></div><div class="field"><label for="loginResetConfirm">确认新密码</label><input id="loginResetConfirm" type="password" maxlength="128" autocomplete="new-password"></div><div class="field"><label for="loginResetCode">QQ 六位验证码</label><input id="loginResetCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><div class="row"><button id="passwordResetSendCode" type="button" class="btn ghost grow">发送重设验证码</button><button id="passwordResetSubmit" type="button" class="btn primary grow">重设密码</button></div></div></details>
    </div>
    <label class="switch"><input id="rememberLogin" type="checkbox" checked>在这台设备保持登录（最长 180 天）</label>'''
if runtime.count(ui_anchor) != 1:
    raise RuntimeError("password reset UI anchor mismatch")
runtime = runtime.replace(ui_anchor, ui_replacement, 1)
old_verify_login = "async function verifyPasswordLogin(){var qq=String($('loginQq').value||'').replace(/\\D/g,''),password=$('loginPassword').value;if(!/^\\d{5,12}$/.test(qq)||!password){$('loginNotice').textContent='请输入正确的 QQ 号和密码。';return}var b=$('verifyPassword');b.disabled=true;b.textContent='验证中…';var factorVisible=!$('loginFactorWrap').classList.contains('hidden');var r=await raw('/api/auth/login-password','POST',{qq:qq,password:password,remember:!$('rememberLogin')||$('rememberLogin').checked,factorType:factorVisible?$('loginFactorType').value:'',factorCode:factorVisible?$('loginFactorCode').value:''});b.disabled=false;b.textContent='使用密码登录';$('loginNotice').textContent=r.message||'登录失败。';if(r.requiresTwoFactor||r.code==='TWO_FACTOR_REQUIRED'){$('loginFactorWrap').classList.remove('hidden');$('loginFactorCode').focus();return}if(r.ok){await boot()}}"
new_verify_login = "async function verifyPasswordLogin(){var qq=String($('loginQq').value||'').replace(/\\D/g,''),password=$('loginPassword').value;if(!/^\\d{5,12}$/.test(qq)||!password){$('loginNotice').textContent='请输入正确的 QQ 号和密码。';return}var b=$('verifyPassword');b.disabled=true;b.textContent='验证中…';var factorVisible=!$('loginFactorWrap').classList.contains('hidden');var r=await raw('/api/auth/login-password','POST',{qq:qq,password:password,remember:!$('rememberLogin')||$('rememberLogin').checked,factorType:factorVisible?$('loginFactorType').value:'',factorCode:factorVisible?$('loginFactorCode').value:''});b.disabled=false;b.textContent='使用密码登录';$('loginNotice').textContent=r.message||'登录失败。';if(r.code==='PASSWORD_RECORD_INVALID'&&$('loginPasswordReset'))$('loginPasswordReset').open=true;if(r.requiresTwoFactor||r.code==='TWO_FACTOR_REQUIRED'){$('loginFactorWrap').classList.remove('hidden');$('loginFactorCode').focus();return}if(r.ok){await boot()}}"
if runtime.count(old_verify_login) != 1:
    raise RuntimeError("password login client anchor mismatch")
runtime = runtime.replace(old_verify_login, new_verify_login, 1)
reset_function_anchor = "async function requestPasswordFactorCode(){var qq=String($('loginQq').value||'').replace(/\\D/g,'');if(!/^\\d{5,12}$/.test(qq)){toast('请先输入正确的 QQ 号');return}var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'验证码发送失败。';if(r.ok){$('loginFactorType').value='qq_code';$('loginFactorWrap').classList.remove('hidden')}}"
reset_functions = reset_function_anchor + "\nasync function requestPasswordResetCode(){var qq=String($('loginQq').value||'').replace(/\\D/g,'');if(!/^\\d{5,12}$/.test(qq)){$('loginNotice').textContent='请先输入正确的 QQ 号。';return}var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'重设验证码发送失败。';if(r.ok&&$('loginPasswordReset'))$('loginPasswordReset').open=true}\nasync function resetPasswordLogin(){var qq=String($('loginQq').value||'').replace(/\\D/g,''),next=$('loginResetPassword').value,confirm=$('loginResetConfirm').value,code=String($('loginResetCode').value||'').replace(/\\D/g,'');if(!/^\\d{5,12}$/.test(qq)){$('loginNotice').textContent='请输入正确的 QQ 号。';return}if(next!==confirm){$('loginNotice').textContent='两次输入的新密码不一致。';return}if(next.length<10||!/^\\d{6}$/.test(code)){$('loginNotice').textContent='请输入至少 10 个字符的新密码和六位 QQ 验证码。';return}var b=$('passwordResetSubmit');b.disabled=true;b.textContent='重设中…';var r=await raw('/api/auth/reset-password','POST',{qq:qq,code:code,newPassword:next});b.disabled=false;b.textContent='重设密码';$('loginNotice').textContent=r.message||'密码重设失败。';if(r.ok){$('loginPassword').value=next;$('loginResetPassword').value='';$('loginResetConfirm').value='';$('loginResetCode').value='';if($('loginPasswordReset'))$('loginPasswordReset').open=false}}"
if runtime.count(reset_function_anchor) != 1:
    raise RuntimeError("password reset function anchor mismatch")
runtime = runtime.replace(reset_function_anchor, reset_functions, 1)
bind_anchor = "$('passwordSendFactorCode').addEventListener('click',requestPasswordFactorCode);"
if runtime.count(bind_anchor) != 1:
    raise RuntimeError("password reset binding anchor mismatch")
runtime = runtime.replace(bind_anchor, bind_anchor + "$('passwordResetSendCode').addEventListener('click',requestPasswordResetCode);$('passwordResetSubmit').addEventListener('click',resetPasswordLogin);", 1)
runtime_path.write_text(runtime, encoding="utf-8")

# Rewrite notification regression with migration and corrected endpoint checks.
notification_test = r'''import assert from "node:assert/strict";
import fs from "node:fs";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  normalizeNotificationRoutingConfig,
  resolveNotificationRecipientIds,
  selectNotificationRecipientIds
} from "./src/notifications/routing.js";

const defaults = normalizeNotificationRoutingConfig(null, "808882936");
assert.equal(defaults.version, 2);
assert.equal(defaults.groupId, "808882936");
assert.equal(defaults.ownerEnabled, false, "owner notification must remain globally disabled by default");
for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
  assert.equal(definition.defaultMode, "developer", `${definition.id} must default to developer-only routing`);
  assert.equal(defaults.routes[definition.id].mode, "developer");
}
assert.equal(defaults.routes.suggestion_created.enabled, false);

const migrated = normalizeNotificationRoutingConfig({
  version: 1,
  routes: {
    join_request_pending: { enabled: true, mode: "managers", managerIds: [] },
    moderation_proposal: { enabled: true, mode: "managers", managerIds: ["10002"] },
    appeal_created: { enabled: true, mode: "owner", managerIds: [] },
    suggestion_created: { enabled: false, mode: "none", managerIds: [] }
  }
}, "808882936");
assert.equal(migrated.version, 2);
assert.equal(migrated.routes.join_request_pending.mode, "developer", "legacy implicit all-manager default must migrate to developer");
assert.deepEqual(migrated.routes.moderation_proposal, { enabled: true, mode: "managers", managerIds: ["10002"] }, "explicit manager choice must survive migration");
assert.equal(migrated.routes.appeal_created.mode, "owner", "explicit owner choice must survive migration");
assert.deepEqual(migrated.routes.suggestion_created, { enabled: false, mode: "none", managerIds: [] });

const v2AllManagers = normalizeNotificationRoutingConfig({
  version: 2,
  routes: { join_request_pending: { enabled: true, mode: "managers", managerIds: [] } }
}, "808882936");
assert.equal(v2AllManagers.routes.join_request_pending.mode, "managers", "an explicit v2 all-manager choice must be preserved");

const managers = [{ qq: "10001", role: "admin" }, { qq: "10002", role: "admin" }];
const owner = { qq: "10000", role: "owner" };
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: ["10002", "99999"] }, managers, owner, developer: "90001" }), ["10002"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: [] }, managers, owner, developer: "90001" }), ["10001", "10002"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "developer", managerIds: [] }, managers, owner, developer: "90001" }), ["90001"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "owner", managerIds: [] }, ownerEnabled: false, managers, owner, developer: "90001" }), []);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "owner", managerIds: [] }, ownerEnabled: true, managers, owner, developer: "90001" }), ["10000"]);
assert.deepEqual(resolveNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: ["10002"] }, candidates: { managers: [], owner: null, source: "none" }, developer: "90001" }), ["10002"]);

const routingSource = fs.readFileSync("src/notifications/routing.js", "utf8");
const portalSource = fs.readFileSync("src/portal/notification-routing.js", "utf8");
const moderationSource = fs.readFileSync("src/moderation/runtime.js", "utf8");
const operationsSource = fs.readFileSync("src/operations/runtime.js", "utf8");
assert.match(routingSource, /group_members:/);
assert.match(routingSource, /candidates\.source !== "none"/);
assert.match(portalSource, /fetch\('\/api\/portal\/notification-routing'/, "client must call the authenticated Portal API path");
assert.doesNotMatch(portalSource, /fetch\('\/api\/notification-routing'/, "obsolete non-Portal path must be absent");
assert.match(portalSource, /NOTIFICATION_ROUTING_UNAVAILABLE/, "server errors must remain JSON");
assert.match(portalSource, /NON_JSON_RESPONSE/, "client must report non-JSON diagnostics");
assert.match(portalSource, /默认只通知开发者/);
for (const eventId of ["join_request_pending", "join_request_failed", "group_work_request"]) assert.match(moderationSource, new RegExp(eventId));
for (const eventId of ["appeal_created", "suggestion_created", "bug_created", "quality_feedback_created"]) assert.match(operationsSource, new RegExp(eventId));
console.log("verify-notification-routing: ok");
'''
write("verify-notification-routing.mjs", notification_test)

password_test = r'''import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createPortalPasswordRecord,
  isValidPortalPasswordRecord,
  verifyPortalPassword
} from "./src/portal/auth.js";

const password = "correct horse battery staple 279";
const record = await createPortalPasswordRecord(password);
assert.equal(record.algorithm, "PBKDF2-SHA-256");
assert.equal(isValidPortalPasswordRecord(record), true);
assert.equal(await verifyPortalPassword(password, record), true, "correct password must verify");
assert.equal(await verifyPortalPassword("wrong password value", record), false, "wrong password must fail");
assert.equal(isValidPortalPasswordRecord({ ...record, salt: "%%%" }), false, "malformed salt must be rejected");
assert.equal(await verifyPortalPassword(password, { ...record, hash: "%%%" }), false, "malformed record must fail safely");

const worker = fs.readFileSync("worker.js", "utf8");
const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const auth = fs.readFileSync("src/portal/auth.js", "utf8");
assert.match(worker, /url\.pathname === '\/api\/auth\/reset-password'/);
const resetStart = worker.indexOf("url.pathname === '/api/auth/reset-password'");
const resetEnd = worker.indexOf("url.pathname === '/api/auth/login-password'", resetStart);
const resetBlock = worker.slice(resetStart, resetEnd);
assert.ok(resetStart >= 0 && resetEnd > resetStart);
assert.match(resetBlock, /verifyPortalVerificationCode\(env, qq, code, \{ consume: false \}\)/);
assert.match(resetBlock, /createPortalPasswordRecord\(validation\.value\)/);
assert.match(resetBlock, /authDbPutStrict\(env, `portal_auth_password:\$\{qq\}`/);
assert.match(resetBlock, /authDbDelStrict\(env, `portal_auth_code:\$\{qq\}`\)/);
assert.match(worker, /PASSWORD_RECORD_INVALID/);
assert.match(runtime, /id="loginPasswordReset"/);
assert.match(runtime, /raw\('\/api\/auth\/reset-password'/);
assert.match(runtime, /passwordResetSendCode/);
assert.match(auth, /function isValidPortalPasswordRecord/);
console.log("verify-portal-auth-password: ok");
'''
write("verify-portal-auth-password.mjs", password_test)

# Keep all version fixtures aligned after the permanent tests are written.
fixture_updates = 0
for verify_path in Path(".").glob("verify-*.mjs"):
    source = verify_path.read_text(encoding="utf-8")
    count = source.count("2.7.8")
    if count:
        verify_path.write_text(source.replace("2.7.8", "2.7.9"), encoding="utf-8")
        fixture_updates += count

release = {
    "version": "2.7.9",
    "notificationPolicy": "developer-only-by-default-with-explicit-opt-in",
    "added": [
        "新增 QQ 验证码重设 Portal 密码流程，不需要旧密码即可建立新的安全密码记录",
        "新增真实 PBKDF2 密码建立、正确验证、错误密码与损坏记录回归测试",
        "新增通知路由旧版隐式全管理员配置迁移，只保留明确指定的管理员选择"
    ],
    "fixed": [
        "修复通知路由网页调用错误 API 路径，导致读取与保存收到非 JSON 响应",
        "修复通知路由存储或成员资料读取异常时没有稳定 JSON 错误响应",
        "修复默认通知多个管理员造成干扰，所有事件现在默认只通知开发者",
        "修复损坏密码记录被误报为资料库故障且无法自行恢复的问题"
    ]
}
write("release-notes.json", json.dumps(release, ensure_ascii=False, indent=2) + "\n")
print(f"Applied v2.7.9 notification/password repair; fixture updates={fixture_updates}")
