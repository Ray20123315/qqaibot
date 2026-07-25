import { recentConversationMessagesForUser } from "../core/identity.js";
import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, listGroupMuteLocks, putMuteLock } from "../moderation/mute-locks.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbPut } from "../data/store.js";
import { jsonResponse, readJson } from "./auth.js";
import { numericId } from "../security/network.js";

const MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_MUTE_SECONDS = 30 * 24 * 60 * 60;

function memberConsoleAllowed(authed) {
  const permissions = authed?.permissions || {};
  return Boolean(
    permissions.developer
    || permissions.nativeAdmin
    || permissions.groupOps
    || ["owner", "admin", "developer"].includes(String(authed?.role || ""))
  );
}

function normalizeEpochMs(primarySeconds, fallbackValue = 0) {
  const primary = Number(primarySeconds || 0);
  if (primary > 0) return primary > 100000000000 ? primary : primary * 1000;
  const fallback = Number(fallbackValue || 0);
  if (fallback <= 0) return 0;
  return fallback > 100000000000 ? fallback : fallback * 1000;
}

function normalizeMember(raw) {
  const now = Date.now();
  const muteUntil = normalizeEpochMs(raw?.shut_up_timestamp ?? raw?.mute_until, raw?.muteUntil);
  const qq = String(raw?.user_id || raw?.qq || "").replace(/\D/g, "");
  const nickname = String(raw?.nickname || raw?.name || qq);
  const card = String(raw?.card || "");
  return {
    qq,
    name: card || nickname || qq,
    nickname,
    card,
    role: String(raw?.role || "member"),
    isRobot: Boolean(raw?.is_robot || raw?.isRobot),
    muted: muteUntil > now,
    muteUntil,
    muteRemainingSeconds: muteUntil > now ? Math.ceil((muteUntil - now) / 1000) : 0,
    joinTime: normalizeEpochMs(raw?.join_time, raw?.joinTime),
    lastSentTime: normalizeEpochMs(raw?.last_sent_time, raw?.lastSentTime),
    level: String(raw?.level || ""),
    title: String(raw?.title || raw?.special_title || raw?.specialTitle || "")
  };
}

function memberRoleRank(role) {
  return ({ owner: 0, admin: 1, member: 2 })[String(role || "member")] ?? 3;
}

async function listPortalMembers(env, groupId) {
  const cacheKey = `portal_member_cache:${groupId}`;
  try {
    const response = await callOneBotAction(env, {
      action: "get_group_member_list",
      params: { group_id: numericId(groupId), no_cache: false }
    }, 25000);
    const source = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
    const members = source.map(normalizeMember).filter(item => item.qq);
    members.sort((left, right) => memberRoleRank(left.role) - memberRoleRank(right.role) || left.name.localeCompare(right.name, "zh-CN"));
    await dbPut(env, cacheKey, JSON.stringify({ cachedAt: Date.now(), members }));
    return { members, source: "live", stale: false };
  } catch (error) {
    const cached = await readJson(env, cacheKey, null);
    if (cached?.members?.length && Date.now() - Number(cached.cachedAt || 0) <= MEMBER_CACHE_TTL_MS) {
      return { members: cached.members.map(normalizeMember), source: "cache", stale: true, warning: String(error?.message || error).slice(0, 300) };
    }
    const legacy = await readJson(env, `group_members:${groupId}`, []);
    if (Array.isArray(legacy) && legacy.length) {
      return { members: legacy.map(normalizeMember).filter(item => item.qq), source: "legacy_cache", stale: true, warning: String(error?.message || error).slice(0, 300) };
    }
    throw error;
  }
}

function sanitizeHistoryRecord(item) {
  return {
    id: String(item?.id || item?.messageId || ""),
    messageId: String(item?.messageId || item?.id || ""),
    userId: String(item?.userId || ""),
    senderName: String(item?.senderName || item?.name || item?.userId || ""),
    text: String(item?.text || "").slice(0, 4000),
    mentions: (Array.isArray(item?.mentions) ? item.mentions : []).map(String).slice(0, 50),
    createdAt: Number(item?.createdAt || item?.at || 0),
    direct: Boolean(item?.direct),
    hasImage: Boolean(item?.hasImage || item?.imageUrl || item?.imageFile)
  };
}

function parseMuteSeconds(value) {
  const seconds = Math.trunc(Number(value));
  if (!Number.isFinite(seconds) || seconds < 1) return 0;
  return Math.min(MAX_MUTE_SECONDS, seconds);
}

async function resolveTargetMember(env, groupId, qq) {
  const listing = await listPortalMembers(env, groupId);
  return listing.members.find(item => item.qq === qq) || null;
}

function protectedTargetReason(member, authed, action) {
  if (!member) return "找不到该群成员。";
  if (member.isRobot) return "不能从群友列表操作机器人账号。";
  if (action === "mute" && String(member.qq) === String(authed.qq)) return "不能从 Portal 禁言自己。";
  if (member.role === "owner") return "群主不能被禁言或解禁。";
  if (String(authed.role || "") === "admin" && member.role === "admin") return "QQ 管理员不能直接操作另一位 QQ 管理员。";
  return "";
}

async function handlePortalMemberApi(request, env, url, path, body, authed) {
  if (!path.startsWith("/members")) return null;
  const groupId = String(authed?.groupId || "").replace(/\D/g, "");
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (!memberConsoleAllowed(authed)) return jsonResponse({ ok: false, message: "群友列表、历史消息与禁言操作仅限本群 QQ 管理员、群主、获授群操作权限者或开发者。" }, 403);

  if (request.method === "GET" && path === "/members") {
    try {
      const listing = await listPortalMembers(env, groupId);
      const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const locks = await listGroupMuteLocks(env, groupId);
      const visibleMembers = listing.members.map(item => ({ ...item, muteLock: locks[item.qq] ? { source: locks[item.qq].source, allowOwnerUnmute: locks[item.qq].allowOwnerUnmute, expiresAt: locks[item.qq].expiresAt, blockedAttempts: locks[item.qq].blockedAttempts } : null }));
      const members = query
        ? visibleMembers.filter(item => [item.qq, item.name, item.nickname, item.card, item.role].some(value => String(value || "").toLowerCase().includes(query)))
        : visibleMembers;
      return jsonResponse({
        ok: true,
        members,
        total: members.length,
        source: listing.source,
        stale: listing.stale,
        warning: listing.warning || "",
        permissions: { viewHistory: true, mute: true, unmute: true },
        maxMuteSeconds: MAX_MUTE_SECONDS
      });
    } catch (error) {
      return jsonResponse({ ok: false, message: `无法读取群友列表：${String(error?.message || error).slice(0, 500)}` }, 502);
    }
  }

  if (request.method === "GET" && path === "/members/history") {
    const qq = String(url.searchParams.get("qq") || "").replace(/\D/g, "");
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(url.searchParams.get("limit") || 80))));
    if (!qq) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    const member = await resolveTargetMember(env, groupId, qq).catch(() => null);
    const records = (await recentConversationMessagesForUser(env, groupId, qq, limit)).map(sanitizeHistoryRecord).reverse();
    await writeSystemAudit(env, { type: "portal_member_history_view", groupId, actorId: authed.qq, targetId: qq, action: "view", count: records.length }).catch(() => {});
    return jsonResponse({ ok: true, member: member || { qq, name: qq, role: "unknown" }, records, limit });
  }

  if (request.method === "POST" && path === "/members/mute") {
    const qq = String(body?.qq || "").replace(/\D/g, "");
    const duration = parseMuteSeconds(body?.seconds);
    const protect = body?.protect === true;
    const allowOwnerUnmute = protect && body?.allowOwnerUnmute === true;
    if (!qq) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    if (!duration) return jsonResponse({ ok: false, message: `禁言秒数必须是 1 到 ${MAX_MUTE_SECONDS} 的整数。` }, 400);
    const member = await resolveTargetMember(env, groupId, qq).catch(() => null);
    const protectedReason = protectedTargetReason(member, authed, "mute");
    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);
    const previousLock = await getMuteLock(env, groupId, qq);
    if (previousLock?.source === "self") return jsonResponse({ ok: false, message: "该成员正在自我禁言，管理入口不能覆盖或解除。" }, 423);
    try {
      await callOneBotAction(env, {
        action: "set_group_ban",
        params: { group_id: numericId(groupId), user_id: numericId(qq), duration }
      }, 15000);
      if (protect) {
        await createManualMuteLock(env, { groupId, userId: qq, actorId: authed.qq, durationSeconds: duration, allowOwnerUnmute, reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500) });
      } else if (previousLock?.source === "manual") {
        await clearMuteLock(env, groupId, qq);
      }
      await writeSystemAudit(env, {
        type: "portal_member_mute",
        groupId,
        actorId: authed.qq,
        targetId: qq,
        targetName: member?.name || qq,
        action: "mute",
        durationSeconds: duration,
        preventUnmute: protect,
        allowOwnerUnmute,
        reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500)
      });
      return jsonResponse({ ok: true, message: `已禁言 ${member?.name || qq} ${duration} 秒${protect ? `，并启用防解除（${allowOwnerUnmute ? "开发者或群主可解除" : "仅开发者可解除"}）` : ""}。`, qq, durationSeconds: duration, preventUnmute: protect, allowOwnerUnmute });
    } catch (error) {
      return jsonResponse({ ok: false, message: `禁言失败：${String(error?.message || error).slice(0, 500)}` }, 502);
    }
  }

  if (request.method === "POST" && path === "/members/unmute") {
    const qq = String(body?.qq || "").replace(/\D/g, "");
    if (!qq) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    const member = await resolveTargetMember(env, groupId, qq).catch(() => null);
    const protectedReason = protectedTargetReason(member, authed, "unmute");
    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);
    const lock = await getMuteLock(env, groupId, qq);
    const permission = canUnlockMute(env, lock, { actorId: authed.qq, actorRole: authed.role, isDeveloper: Boolean(authed?.permissions?.developer) });
    if (!permission.allowed) {
      const message = lock?.source === "self" ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。" : lock?.allowOwnerUnmute ? "该禁言只能由开发者或群主解除。" : "该禁言只能由开发者解除。";
      return jsonResponse({ ok: false, message }, 423);
    }
    if (lock) await clearMuteLock(env, groupId, qq);
    try {
      await callOneBotAction(env, {
        action: "set_group_ban",
        params: { group_id: numericId(groupId), user_id: numericId(qq), duration: 0 }
      }, 15000);
      await writeSystemAudit(env, {
        type: "portal_member_unmute",
        groupId,
        actorId: authed.qq,
        targetId: qq,
        targetName: member?.name || qq,
        action: "unmute",
        durationSeconds: 0,
        reason: String(body?.reason || "Portal 群友列表手动解禁").slice(0, 500)
      });
      return jsonResponse({ ok: true, message: `已解除 ${member?.name || qq} 的禁言。`, qq });
    } catch (error) {
      if (lock) await putMuteLock(env, lock).catch(() => {});
      return jsonResponse({ ok: false, message: `解除禁言失败：${String(error?.message || error).slice(0, 500)}` }, 502);
    }
  }

  return jsonResponse({ ok: false, message: "未知群友管理接口。" }, 404);
}

function injectPortalMembersClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-member-console-client")) return source;

  const navAnchor = '<button data-view="logs">操作日志</button>';
  if (source.includes(navAnchor)) {
    source = source.replace(navAnchor, '<button data-view="members" id="memberConsoleNav" class="hidden">群友列表</button>' + navAnchor);
  }

  const section = `
<section id="v-members" class="view">
  <div class="section-head"><div><h2>群友列表</h2><p>仅管理层可查看。禁言可勾选防解除、群主可解除及跳过确认；自我禁言只能由本人私讯解除。所有操作都会写入审计日志。</p></div><button id="memberRefresh" class="btn">刷新群友</button></div>
  <div class="card member-console-toolbar">
    <div class="field"><label for="memberSearch">搜索昵称或 QQ</label><input id="memberSearch" placeholder="输入昵称、群名片或 QQ"></div>
    <div class="notice" id="memberConsoleStatus">请选择群组后读取群友列表。</div>
  </div>
  <div id="memberList" class="list"><div class="empty">尚未读取群友列表</div></div>
  <div id="memberHistoryPanel" class="card hidden">
    <div class="section-head compact"><div><h3 id="memberHistoryTitle">历史消息</h3><p>只显示本 Worker 已保存的该群聊天记录。</p></div><button id="memberHistoryClose" class="btn ghost">关闭</button></div>
    <div id="memberHistoryList" class="list"><div class="empty">请选择群友</div></div>
  </div>
</section>
`;
  const logsSectionIndex = source.indexOf('<section id="v-logs"');
  if (logsSectionIndex >= 0) source = source.slice(0, logsSectionIndex) + section + source.slice(logsSectionIndex);
  else source = source.replace("</main>", section + "</main>");

  const style = `
<style id="qqai-member-console-style">
.member-console-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr);gap:14px;align-items:end;margin-bottom:16px}.member-row{display:grid;grid-template-columns:minmax(180px,1.3fr) minmax(140px,.8fr) minmax(290px,1.5fr);gap:12px;align-items:center}.member-main{min-width:0}.member-name{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member-meta{font-size:12px;color:var(--muted);margin-top:4px}.member-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.member-actions input[type="number"]{width:112px;min-height:40px}.member-toggle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap}.member-toggle input{width:auto;min-height:auto}.member-lock{font-size:12px;font-weight:800;color:#b45309}.member-history-message{white-space:pre-wrap;word-break:break-word}.member-history-time{font-size:12px;color:var(--muted);margin-bottom:6px}.member-role-owner{font-weight:800}.member-role-admin{font-weight:700}.member-muted{color:#b45309;font-weight:800}@media(max-width:900px){.member-console-toolbar,.member-row{grid-template-columns:1fr}.member-actions input{width:100%}.member-actions .btn{flex:1 1 120px}}
</style>`;
  source = source.includes("</head>") ? source.replace("</head>", style + "\n</head>") : style + source;

  const script = `
<script id="qqai-member-console-client">
(function(){
  var cachedMembers=[];
  function el(id){return document.getElementById(id)}
  function safe(value){return typeof esc==='function'?esc(value):String(value==null?'':value).replace(/[&<>\"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c]})}
  function notify(message){if(typeof toast==='function')toast(message);else window.alert(message)}
  async function call(path,method,body){
    if(typeof api==='function')return api(path,method||'GET',body);
    var response=await fetch('/api/portal'+path,{method:method||'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});
    return response.json().catch(function(){return{ok:false,message:'接口返回格式错误'}})
  }
  function roleText(role){return({owner:'群主',admin:'管理员',member:'群成员'})[role]||role||'群成员'}
  function secondsText(value){var seconds=Math.max(0,Number(value||0));if(seconds<60)return Math.ceil(seconds)+' 秒';if(seconds<3600)return Math.ceil(seconds/60)+' 分钟';if(seconds<86400)return Math.ceil(seconds/3600)+' 小时';return Math.ceil(seconds/86400)+' 天'}
  function sessionAllows(){
    try{var s=typeof session!=='undefined'?session:null,p=s&&s.permissions||{};return !!(s&&(p.developer||p.nativeAdmin||p.groupOps||s.role==='owner'||s.role==='admin'||s.role==='developer'))}catch(e){return false}
  }
  function syncNav(){var nav=el('memberConsoleNav');if(nav)nav.classList.toggle('hidden',!sessionAllows())}
  function isMembersView(){var view=el('v-members');return !!(view&&view.classList.contains('active'))}
  function renderMembers(){
    var root=el('memberList');if(!root)return;
    var query=String(el('memberSearch')&&el('memberSearch').value||'').trim().toLowerCase();
    var rows=cachedMembers.filter(function(m){return !query||[m.qq,m.name,m.nickname,m.card,m.role].some(function(v){return String(v||'').toLowerCase().indexOf(query)>=0})});
    root.innerHTML='';
    rows.forEach(function(member){
      var row=document.createElement('div');row.className='item member-row';
      var lock=member.muteLock,lockText=lock?(lock.source==='self'?'自我禁言锁':(lock.allowOwnerUnmute?'防解除：开发者或群主':'防解除：仅开发者')):'';
      var state=member.muted?'<span class="member-muted">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class="status ok">可发言</span>';if(lockText)state+=' <span class="member-lock">'+safe(lockText)+'</span>';
      row.innerHTML='<div class="member-main"><div class="member-name member-role-'+safe(member.role)+'">'+safe(member.name||member.qq)+'</div><div class="member-meta">QQ '+safe(member.qq)+'｜'+safe(roleText(member.role))+(member.title?'｜'+safe(member.title):'')+'</div></div><div>'+state+'</div><div class="member-actions"><button class="btn member-history" data-qq="'+safe(member.qq)+'">历史消息</button><input class="member-seconds" type="number" min="1" max="2592000" value="60" aria-label="禁言秒数"><label class="member-toggle"><input class="member-protect" type="checkbox">防解除</label><label class="member-toggle"><input class="member-owner-unlock" type="checkbox" disabled>群主可解除</label><label class="member-toggle"><input class="member-skip-confirm" type="checkbox">跳过确认</label><button class="btn danger member-mute" data-qq="'+safe(member.qq)+'">禁言（秒）</button><button class="btn member-unmute" data-qq="'+safe(member.qq)+'">解禁</button></div>';
      root.appendChild(row)
    });
    if(!root.children.length)root.innerHTML='<div class="empty">没有符合条件的群友</div>'
  }
  async function loadMembers(){
    var status=el('memberConsoleStatus');if(status)status.textContent='正在读取群友列表…';
    var result=await call('/members');
    if(!result.ok){if(status)status.textContent=result.message||'读取失败';cachedMembers=[];renderMembers();return}
    cachedMembers=result.members||[];renderMembers();
    if(status)status.textContent='共 '+cachedMembers.length+' 位群友'+(result.stale?'｜当前显示缓存资料':'｜即时资料')+(result.warning?'｜'+result.warning:'')
  }
  async function showHistory(qq){
    var panel=el('memberHistoryPanel'),list=el('memberHistoryList'),title=el('memberHistoryTitle');if(!panel||!list)return;
    panel.classList.remove('hidden');list.innerHTML='<div class="empty">正在读取历史消息…</div>';
    var result=await call('/members/history?qq='+encodeURIComponent(qq)+'&limit=120');
    if(!result.ok){list.innerHTML='<div class="empty">'+safe(result.message||'读取失败')+'</div>';return}
    if(title)title.textContent=(result.member&&result.member.name||qq)+' 的历史消息';
    list.innerHTML=(result.records||[]).map(function(item){return '<div class="item"><div class="member-history-time">'+safe(item.createdAt?new Date(Number(item.createdAt)).toLocaleString():'时间未知')+'｜消息 '+safe(item.messageId||item.id||'')+'</div><div class="member-history-message">'+safe(item.text||'[无文字内容]')+'</div></div>'}).join('')||'<div class="empty">没有已保存的历史消息</div>'
  }
  async function muteMember(button){
    var row=button.closest('.member-row'),input=row&&row.querySelector('.member-seconds'),seconds=Math.trunc(Number(input&&input.value||0)),qq=button.dataset.qq;
    var protect=!!(row&&row.querySelector('.member-protect')&&row.querySelector('.member-protect').checked),ownerUnlock=!!(row&&row.querySelector('.member-owner-unlock')&&row.querySelector('.member-owner-unlock').checked),skip=!!(row&&row.querySelector('.member-skip-confirm')&&row.querySelector('.member-skip-confirm').checked);
    if(!seconds||seconds<1){notify('请输入大于 0 的禁言秒数');return}
    if(!skip){var ok=typeof confirmModal==='function'?await confirmModal('确定禁言 QQ '+qq+' '+seconds+' 秒'+(protect?'并启用防解除':'')+'？','确认禁言'):window.confirm('确定禁言 QQ '+qq+' '+seconds+' 秒？');if(!ok)return}
    var result=await call('/members/mute','POST',{qq:qq,seconds:seconds,protect:protect,allowOwnerUnmute:ownerUnlock});notify(result.message||'操作完成');if(result.ok)loadMembers()
  }
  async function unmuteMember(button){
    var row=button.closest('.member-row'),qq=button.dataset.qq,skip=!!(row&&row.querySelector('.member-skip-confirm')&&row.querySelector('.member-skip-confirm').checked);if(!skip){var ok=typeof confirmModal==='function'?await confirmModal('确定解除 QQ '+qq+' 的禁言？','确认解禁'):window.confirm('确定解除 QQ '+qq+' 的禁言？');if(!ok)return}
    var result=await call('/members/unmute','POST',{qq:qq});notify(result.message||'操作完成');if(result.ok)loadMembers()
  }
  document.addEventListener('click',function(event){
    var target=event.target.closest&&event.target.closest('button');if(!target)return;
    if(target.id==='memberConsoleNav'){setTimeout(function(){var title=el('pageTitle');if(title)title.textContent='群友列表';loadMembers()},0)}
    else if(target.id==='memberRefresh')loadMembers();
    else if(target.id==='memberHistoryClose')el('memberHistoryPanel')&&el('memberHistoryPanel').classList.add('hidden');
    else if(target.classList.contains('member-history'))showHistory(target.dataset.qq);
    else if(target.classList.contains('member-mute'))muteMember(target);
    else if(target.classList.contains('member-unmute'))unmuteMember(target)
  });
  document.addEventListener('input',function(event){if(event.target&&event.target.id==='memberSearch')renderMembers();if(event.target&&event.target.classList&&event.target.classList.contains('member-protect')){var row=event.target.closest('.member-row'),owner=row&&row.querySelector('.member-owner-unlock');if(owner){owner.disabled=!event.target.checked;if(!event.target.checked)owner.checked=false}}});
  var selector=el('groupSelect');if(selector)selector.addEventListener('change',function(){if(isMembersView())setTimeout(loadMembers,100)});
  var refresh=el('refresh');if(refresh)refresh.addEventListener('click',function(){if(isMembersView())setTimeout(loadMembers,100)});
  syncNav();setInterval(syncNav,3000)
})();
</script>`;
  return source.includes("</body>") ? source.replace("</body>", script + "\n</body>") : source + script;
}

export { handlePortalMemberApi, injectPortalMembersClient, listPortalMembers, memberConsoleAllowed, normalizeEpochMs, normalizeMember, parseMuteSeconds };
