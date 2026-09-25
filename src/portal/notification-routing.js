import { isDeveloperId } from "../core/identity.js";
import {
  getNotificationRoutingPortalState,
  saveNotificationRoutingConfig
} from "../notifications/routing.js";
import { jsonResponse } from "./auth.js";

function notificationRoutingAllowed(env, authed) {
  const permissions = authed?.permissions || {};
  return Boolean(
    isDeveloperId(env, authed?.qq)
    || permissions.developer
    || permissions.nativeAdmin
    || permissions.groupOps
    || ["owner", "admin", "developer"].includes(String(authed?.role || ""))
  );
}

async function handleNotificationRoutingApi(request, env, path, body, authed) {
  if (!path.startsWith("/notification-routing")) return null;
  const groupId = String(authed?.groupId || "").replace(/\D/g, "");
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

function injectNotificationRoutingClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-notification-routing-client")) return source;
  const nav = '<button data-view="notification-routing" id="notificationRoutingNav" class="qqai-nav-entry"><span class="qqai-nav-glyph" aria-hidden="true">讯</span><span>通知路由</span></button>';
  const memberNav = '<button data-view="members" id="memberConsoleNav"';
  if (source.includes(memberNav)) source = source.replace(memberNav, nav + memberNav);
  else if (source.includes('</nav>')) source = source.replace('</nav>', nav + '</nav>');

  const page = `<section id="v-notification-routing" class="view">
  <div class="section-head"><div><h2>人工通知路由</h2><p>默认只通知开发者；只有手动改为指定管理员或群主时，才会通知其他人。群主通知总开关默认关闭。</p></div><button id="notificationRoutingReload" class="ghost">重新读取</button></div>
  <div class="card">
    <label class="switch-line"><input id="notificationOwnerEnabled" type="checkbox"><span><strong>允许通知群主</strong><small>关闭时，即使某项选择“群主”也不会发送。升级后默认关闭。</small></span></label>
    <div id="notificationRoutingWarning" class="muted"></div>
  </div>
  <div id="notificationRoutingRows" class="stack"><div class="empty">尚未读取通知设置</div></div>
  <div class="card"><button id="notificationRoutingSave" class="primary">保存通知路由</button><span id="notificationRoutingStatus" class="muted"></span></div>
</section>`;
  if (source.includes('</main>')) source = source.replace('</main>', page + '\n</main>');
  else if (source.includes('</body>')) source = source.replace('</body>', page + '\n</body>');

  const script = `<script id="qqai-notification-routing-client">
(function(){
  var state=null;
  function el(id){return document.getElementById(id)}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]})}
  async function call(method,body){var response;try{response=await fetch('/api/portal/notification-routing',{method:method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'})}catch(error){return{ok:false,code:'NETWORK_ERROR',message:'通知路由网络请求失败：'+String(error&&error.message||error)}}var text=await response.text(),data;try{data=text?JSON.parse(text):{}}catch(error){return{ok:false,code:'NON_JSON_RESPONSE',message:'通知路由服务器返回非 JSON（HTTP '+response.status+'，'+String(response.headers.get('Content-Type')||'未知类型')+'）。'+(text?'响应开头：'+text.slice(0,120):'响应为空')}}if(!data||typeof data!=='object')data={ok:false,message:'通知路由服务器响应格式无效'};if(!response.ok&&data.ok!==false)data.ok=false;if(!response.ok&&!data.message)data.message='通知路由请求失败：HTTP '+response.status;return data}
  function notify(text){if(typeof window.toast==='function')window.toast(text);var node=el('notificationRoutingStatus');if(node)node.textContent=text||''}
  function managerChecks(selected){var managers=(state&&state.managers)||[];if(!managers.length)return'<div class="empty">当前未取得可选择的 QQ 管理员；“指定管理员”将无法发送。</div>';return'<div class="notification-manager-grid">'+managers.map(function(item){var checked=(selected||[]).indexOf(String(item.qq))>=0?' checked':'';return'<label class="check"><input type="checkbox" class="notification-manager" value="'+esc(item.qq)+'"'+checked+'><span>'+esc(item.name||item.qq)+'（QQ:'+esc(item.qq)+'）</span></label>'}).join('')+'</div>'}
  function render(){var root=el('notificationRoutingRows');if(!root||!state)return;var config=state.config||{routes:{}};if(el('notificationOwnerEnabled'))el('notificationOwnerEnabled').checked=config.ownerEnabled===true;var warning=el('notificationRoutingWarning');if(warning)warning.textContent=(state.warning||'')+(state.owner?'｜当前群主：'+(state.owner.name||state.owner.qq)+'（QQ:'+state.owner.qq+'）':'｜当前未取得群主资料');root.innerHTML=(state.definitions||[]).map(function(def){var route=(config.routes||{})[def.id]||{enabled:def.defaultEnabled!==false,mode:def.defaultMode||'none',managerIds:[]};var options=(state.modes||[]).map(function(mode){return'<option value="'+esc(mode.id)+'"'+(route.mode===mode.id?' selected':'')+'>'+esc(mode.label)+'</option>'}).join('');return'<div class="card notification-route-row" data-event-id="'+esc(def.id)+'"><div class="section-head"><div><h3>'+esc(def.label)+'</h3><p>'+esc(def.description||'')+'</p></div><label class="check"><input type="checkbox" class="notification-enabled"'+(route.enabled!==false?' checked':'')+'>启用</label></div><label>通知目标<select class="notification-mode">'+options+'</select></label><div class="notification-manager-box">'+managerChecks(route.managerIds||[])+'</div><div class="muted notification-owner-note">选择群主时仍受页面顶部总开关控制。</div></div>'}).join('')||'<div class="empty">没有可设置的通知事件</div>';root.querySelectorAll('.notification-route-row').forEach(function(row){var mode=row.querySelector('.notification-mode');var sync=function(){var box=row.querySelector('.notification-manager-box');if(box)box.style.display=mode.value==='managers'?'':'none'};mode.addEventListener('change',sync);sync()})}
  async function load(){notify('正在读取通知路由…');var result=await call('GET');if(!result.ok){notify(result.message||'读取失败');return}state=result;render();notify('通知路由已读取')}
  function payload(){var routes={};document.querySelectorAll('.notification-route-row').forEach(function(row){routes[row.dataset.eventId]={enabled:!!row.querySelector('.notification-enabled').checked,mode:row.querySelector('.notification-mode').value,managerIds:Array.prototype.map.call(row.querySelectorAll('.notification-manager:checked'),function(node){return node.value})}});return{ownerEnabled:!!(el('notificationOwnerEnabled')&&el('notificationOwnerEnabled').checked),routes:routes}}
  async function save(){notify('正在保存…');var result=await call('POST',payload());notify(result.message||'保存完成');if(result.ok){state=result;render()}}
  document.addEventListener('click',function(event){var target=event.target.closest&&event.target.closest('button');if(!target)return;if(target.id==='notificationRoutingNav'){setTimeout(function(){var title=el('pageTitle');if(title)title.textContent='通知路由';load()},0)}else if(target.id==='notificationRoutingReload')load();else if(target.id==='notificationRoutingSave')save()});
  var selector=el('groupSelect');if(selector)selector.addEventListener('change',function(){var view=el('v-notification-routing');if(view&&view.classList.contains('active'))setTimeout(load,100)});
})();
</script>`;
  return source.includes('</body>') ? source.replace('</body>', script + '\n</body>') : source + script;
}

export {
  handleNotificationRoutingApi,
  injectNotificationRoutingClient,
  notificationRoutingAllowed
};
