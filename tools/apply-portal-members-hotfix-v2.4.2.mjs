import fs from 'node:fs';

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

const membersPath = 'src/portal/members.js';
let members = fs.readFileSync(membersPath, 'utf8');

// The injected browser script lives inside an outer template literal. A single \n here
// becomes a literal newline inside a browser-side single-quoted string and breaks parsing.
members = mustReplace(members, String.raw`确定直接建立主人关系？\n主人：`, String.raw`确定直接建立主人关系？\\n主人：`, 'direct-pair first newline');
members = mustReplace(members, String.raw`（'+masterId+'）\n所属成员：`, String.raw`（'+masterId+'）\\n所属成员：`, 'direct-pair second newline');
members = mustReplace(members, String.raw`（'+memberId+'）'+(replaceExisting?'\n双方既有关系会被强制替换。':'')`, String.raw`（'+memberId+'）'+(replaceExisting?'\\n双方既有关系会被强制替换。':'')`, 'direct-pair replacement newline');

members = mustReplace(
  members,
  String.raw`  async function call(path,method,body){
    if(typeof api==='function')return api(path,method||'GET',body);
    var response=await fetch('/api/portal'+path,{method:method||'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});
    return response.json().catch(function(){return{ok:false,message:'接口返回格式错误'}})
  }`,
  String.raw`  async function call(path,method,body){
    try{
      if(typeof api==='function')return await api(path,method||'GET',body);
      var controller=typeof AbortController!=='undefined'?new AbortController():null;
      var timer=controller?setTimeout(function(){controller.abort()},30000):null;
      var response=await fetch('/api/portal'+path,{method:method||'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined,signal:controller?controller.signal:undefined});
      if(timer)clearTimeout(timer);
      var text=await response.text(),data={};
      try{data=text?JSON.parse(text):{}}catch(parseError){data={ok:false,message:'接口返回格式错误（HTTP '+response.status+'）'}}
      if(!response.ok){data.ok=false;data.message=data.message||('请求失败：HTTP '+response.status)}
      return data
    }catch(error){return{ok:false,message:'请求失败：'+String(error&&error.message||error||'网络或脚本异常')}}
  }`,
  'diagnostic API client'
);

members = mustReplace(
  members,
  String.raw`  <div class="card member-console-toolbar">
    <div class="field"><label for="memberSearch">搜索昵称或 QQ</label><input id="memberSearch" placeholder="输入昵称、群名片或 QQ"></div>
    <div class="notice" id="memberConsoleStatus">请选择群组后读取群友列表。</div>
  </div>`,
  String.raw`  <div class="card member-console-toolbar">
    <div class="field"><label for="memberSearch">搜索昵称或 QQ</label><input id="memberSearch" placeholder="输入昵称、群名片或 QQ"></div>
    <div class="notice" id="memberConsoleStatus">请选择群组后读取群友列表。</div>
  </div>
  <div class="card member-console-filters">
    <div class="field"><label for="memberRoleFilter">身份</label><select id="memberRoleFilter"><option value="">全部身份</option><option value="owner">群主</option><option value="admin">管理员</option><option value="member">普通成员</option></select></div>
    <div class="field"><label for="memberMuteFilter">禁言状态</label><select id="memberMuteFilter"><option value="">全部状态</option><option value="muted">禁言中</option><option value="active">可发言</option></select></div>
    <div class="field"><label for="memberRelationshipFilter">关系</label><select id="memberRelationshipFilter"><option value="">全部关系</option><option value="related">已有关系</option><option value="none">无关系</option><option value="master">主人</option><option value="member">所属成员</option><option value="partner">对象</option></select></div>
    <div class="field"><label for="memberSort">排序</label><select id="memberSort"><option value="role">身份优先</option><option value="name">名称</option><option value="recent">最近发言</option><option value="mute">剩余禁言</option></select></div>
    <button id="memberResetFilters" class="btn ghost">重置筛选</button>
    <button id="memberExport" class="btn ghost">导出 CSV</button>
  </div>`,
  'member filters'
);

members = mustReplace(
  members,
  String.raw`.member-console-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr);gap:14px;align-items:end;margin-bottom:16px}`,
  String.raw`.member-console-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr);gap:14px;align-items:end;margin-bottom:12px}.member-console-filters{display:grid;grid-template-columns:repeat(4,minmax(135px,1fr)) auto auto;gap:10px;align-items:end;margin-bottom:16px}.member-console-filters .field{margin:0}`,
  'filter styles'
);
members = mustReplace(
  members,
  String.raw`@media(max-width:900px){.member-console-toolbar,.member-row{grid-template-columns:1fr}`,
  String.raw`@media(max-width:900px){.member-console-toolbar,.member-console-filters,.member-row{grid-template-columns:1fr}`,
  'responsive filters'
);

members = mustReplace(
  members,
  String.raw`  function secondsText(value){var seconds=Math.max(0,Number(value||0));if(seconds<60)return Math.ceil(seconds)+' 秒';if(seconds<3600)return Math.ceil(seconds/60)+' 分钟';if(seconds<86400)return Math.ceil(seconds/3600)+' 小时';return Math.ceil(seconds/86400)+' 天'}`,
  String.raw`  function secondsText(value){var seconds=Math.max(0,Number(value||0));if(seconds<60)return Math.ceil(seconds)+' 秒';if(seconds<3600)return Math.ceil(seconds/60)+' 分钟';if(seconds<86400)return Math.ceil(seconds/3600)+' 小时';return Math.ceil(seconds/86400)+' 天'}
  function dateText(value){var time=Number(value||0);return time?new Date(time).toLocaleString():'未知'}
  async function copyText(value){var text=String(value||'');try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);else{var input=document.createElement('textarea');input.value=text;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove()}notify('已复制 QQ：'+text)}catch(error){notify('复制失败：'+String(error&&error.message||error))}}
  function csvCell(value){var text=String(value==null?'':value);return '"'+text.replace(/"/g,'""')+'"'}
  function exportMembers(){var rows=[['QQ','名称','身份','禁言状态','剩余禁言秒数','关系身份','入群时间','最近发言时间']];cachedMembers.forEach(function(item){var relation=relationshipFor(item.qq),relationRole=relation?(relation.mode==='master'?(String(relation.masterId)===String(item.qq)?'主人':'所属成员'):'对象'):'';rows.push([item.qq,item.name||'',roleText(item.role),item.muted?'禁言中':'可发言',item.muteRemainingSeconds||0,relationRole,dateText(item.joinTime),dateText(item.lastSentTime)])});var csv='\ufeff'+rows.map(function(row){return row.map(csvCell).join(',')}).join('\\r\\n');var blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='群友列表-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}`,
  'member utility helpers'
);

members = mustReplace(
  members,
  String.raw`  function renderMembers(){
    var root=el('memberList');if(!root)return;
    var query=String(el('memberSearch')&&el('memberSearch').value||'').trim().toLowerCase();
    var rows=cachedMembers.filter(function(m){return !query||[m.qq,m.name,m.nickname,m.card,m.role].some(function(v){return String(v||'').toLowerCase().indexOf(query)>=0})});
    root.innerHTML='';`,
  String.raw`  function renderMembers(){
    var root=el('memberList');if(!root)return;
    var query=String(el('memberSearch')&&el('memberSearch').value||'').trim().toLowerCase();
    var role=String(el('memberRoleFilter')&&el('memberRoleFilter').value||''),mute=String(el('memberMuteFilter')&&el('memberMuteFilter').value||''),relationship=String(el('memberRelationshipFilter')&&el('memberRelationshipFilter').value||''),sort=String(el('memberSort')&&el('memberSort').value||'role');
    var rows=cachedMembers.filter(function(m){
      if(query&&![m.qq,m.name,m.nickname,m.card,m.role].some(function(v){return String(v||'').toLowerCase().indexOf(query)>=0}))return false;
      if(role&&String(m.role)!==role)return false;
      if(mute==='muted'&&!m.muted)return false;if(mute==='active'&&m.muted)return false;
      var rel=relationshipFor(m.qq),relRole=rel?(rel.mode==='master'?(String(rel.masterId)===String(m.qq)?'master':'member'):'partner'):'none';
      if(relationship==='related'&&!rel)return false;if(relationship&&relationship!=='related'&&relRole!==relationship)return false;
      return true
    }).slice();
    rows.sort(function(a,b){if(sort==='name')return String(a.name||a.qq).localeCompare(String(b.name||b.qq),'zh-CN');if(sort==='recent')return Number(b.lastSentTime||0)-Number(a.lastSentTime||0);if(sort==='mute')return Number(b.muteRemainingSeconds||0)-Number(a.muteRemainingSeconds||0);return ({owner:0,admin:1,member:2}[a.role]??3)-({owner:0,admin:1,member:2}[b.role]??3)||String(a.name||a.qq).localeCompare(String(b.name||b.qq),'zh-CN')});
    root.innerHTML='';`,
  'filtered member rendering'
);

members = mustReplace(
  members,
  String.raw`      var state=member.muted?'<span class="member-muted">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class="status ok">可发言</span>';if(lockText)state+=' <span class="member-lock">'+safe(lockText)+'</span>';var relation=relationshipFor(member.qq);if(relation)state+=' <span class="member-relationship">'+safe(relation.mode==='master'?(String(relation.masterId)===String(member.qq)?'主人':'所属成员'):'对象')+'</span>';
      row.innerHTML='<div class="member-main"><div class="member-name member-role-'+safe(member.role)+'">'+safe(member.name||member.qq)+'</div><div class="member-meta">QQ '+safe(member.qq)+'｜'+safe(roleText(member.role))+(member.title?'｜'+safe(member.title):'')+'</div></div><div>'+state+'</div><div class="member-actions"><button class="btn member-history" data-qq="'+safe(member.qq)+'">历史消息</button>`,
  String.raw`      var state=member.muted?'<span class="member-muted">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class="status ok">可发言</span>';if(lockText)state+=' <span class="member-lock">'+safe(lockText)+'</span>';var relation=relationshipFor(member.qq);if(relation)state+=' <span class="member-relationship">'+safe(relation.mode==='master'?(String(relation.masterId)===String(member.qq)?'主人':'所属成员'):'对象')+'</span>';
      var activity='入群 '+safe(dateText(member.joinTime))+'｜最近发言 '+safe(dateText(member.lastSentTime));
      row.innerHTML='<div class="member-main"><div class="member-name member-role-'+safe(member.role)+'">'+safe(member.name||member.qq)+'</div><div class="member-meta">QQ '+safe(member.qq)+'｜'+safe(roleText(member.role))+(member.title?'｜'+safe(member.title):'')+'</div><div class="member-meta">'+activity+'</div></div><div>'+state+'</div><div class="member-actions"><button class="btn ghost member-copy" data-qq="'+safe(member.qq)+'">复制 QQ</button><button class="btn member-history" data-qq="'+safe(member.qq)+'">历史消息</button>`,
  'member activity and copy button'
);

members = mustReplace(
  members,
  String.raw`    if(!result.ok){if(status)status.textContent=result.message||'读取失败';cachedMembers=[];renderMembers();return}
    cachedMembers=result.members||[];cachedRelationships=result.relationships||[];relationshipPermissions=result.permissions||{};renderMembers();renderRelationships();
    if(status)status.textContent='共 '+cachedMembers.length+' 位群友'+(result.stale?'｜当前显示缓存资料':'｜即时资料')+(result.warning?'｜'+result.warning:'')`,
  String.raw`    if(!result.ok){var message=result.message||'读取失败';if(status)status.textContent=message+'｜可点击「刷新群友」重试';var relationshipStatus=el('relationshipStatus');if(relationshipStatus)relationshipStatus.textContent='关系资料读取失败：'+message;cachedMembers=[];cachedRelationships=[];relationshipPermissions={};renderMembers();renderRelationships();return}
    cachedMembers=result.members||[];cachedRelationships=result.relationships||[];relationshipPermissions=result.permissions||{};renderMembers();renderRelationships();
    var mutedCount=cachedMembers.filter(function(item){return item.muted}).length,adminCount=cachedMembers.filter(function(item){return item.role==='owner'||item.role==='admin'}).length;
    if(status)status.textContent='共 '+cachedMembers.length+' 位群友｜管理层 '+adminCount+'｜禁言中 '+mutedCount+'｜关系 '+cachedRelationships.length+(result.stale?'｜当前显示缓存资料':'｜即时资料')+(result.warning?'｜'+result.warning:'')`,
  'load diagnostics and summary'
);

members = mustReplace(
  members,
  String.raw`    if(target.id==='memberConsoleNav'){setTimeout(function(){var title=el('pageTitle');if(title)title.textContent='群友列表';loadMembers()},0)}
    else if(target.id==='memberRefresh'||target.id==='relationshipRefresh')loadMembers();`,
  String.raw`    if(target.id==='memberConsoleNav'||target.dataset.view==='members'){setTimeout(function(){var title=el('pageTitle');if(title)title.textContent='群友列表';loadMembers()},0)}
    else if(target.id==='memberRefresh'||target.id==='relationshipRefresh')loadMembers();
    else if(target.id==='memberExport')exportMembers();
    else if(target.id==='memberResetFilters'){['memberSearch','memberRoleFilter','memberMuteFilter','memberRelationshipFilter','memberSort'].forEach(function(id){var node=el(id);if(node)node.value=id==='memberSort'?'role':''});renderMembers()}
    else if(target.classList.contains('member-copy'))copyText(target.dataset.qq);`,
  'navigation and quick tools'
);

members = mustReplace(
  members,
  String.raw`  document.addEventListener('input',function(event){if(event.target&&event.target.id==='memberSearch')renderMembers();if(event.target&&event.target.classList&&event.target.classList.contains('member-protect')){var row=event.target.closest('.member-row'),owner=row&&row.querySelector('.member-owner-unlock');if(owner){owner.disabled=!event.target.checked;if(!event.target.checked)owner.checked=false}}});`,
  String.raw`  document.addEventListener('input',function(event){if(event.target&&event.target.id==='memberSearch')renderMembers();if(event.target&&event.target.classList&&event.target.classList.contains('member-protect')){var row=event.target.closest('.member-row'),owner=row&&row.querySelector('.member-owner-unlock');if(owner){owner.disabled=!event.target.checked;if(!event.target.checked)owner.checked=false}}});
  document.addEventListener('change',function(event){if(event.target&&['memberRoleFilter','memberMuteFilter','memberRelationshipFilter','memberSort'].indexOf(event.target.id)>=0)renderMembers()});`,
  'filter change events'
);

members = mustReplace(
  members,
  String.raw`  var refresh=el('refresh');if(refresh)refresh.addEventListener('click',function(){if(isMembersView())setTimeout(loadMembers,100)});
})();`,
  String.raw`  var refresh=el('refresh');if(refresh)refresh.addEventListener('click',function(){if(isMembersView())setTimeout(loadMembers,100)});
  syncNav();if(isMembersView())setTimeout(loadMembers,0);
})();`,
  'client initialization'
);

fs.writeFileSync(membersPath, members);

const verifyPath = 'verify-portal-members-client.mjs';
fs.writeFileSync(verifyPath, `import { injectPortalMembersClient } from './src/portal/members.js';\n\nfunction assert(condition, message) { if (!condition) throw new Error(message); }\nconst html = injectPortalMembersClient('<!doctype html><html><head></head><body><nav><button data-view="logs">操作日志</button></nav><main><section id="v-logs"></section></main></body></html>');\nconst match = html.match(/<script id="qqai-member-console-client">([\\s\\S]*?)<\\/script>/);\nassert(match, 'Injected Portal member client script must exist');\nnew Function(match[1]);\nassert(html.includes('memberRoleFilter'), 'Role filter must be present');\nassert(html.includes('memberMuteFilter'), 'Mute filter must be present');\nassert(html.includes('memberRelationshipFilter'), 'Relationship filter must be present');\nassert(html.includes('memberExport'), 'CSV export must be present');\nassert(match[1].includes('syncNav();if(isMembersView())setTimeout(loadMembers,0);'), 'Member console must initialize when already active');\nassert(!match[1].includes("确定直接建立主人关系？\\n主人："), 'Generated script must not contain a literal newline in a single-quoted confirmation string');\nconsole.log('verify-portal-members-client: ok');\n`);

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '2.4.2';
if (!pkg.scripts.check.includes('verify-portal-members-client.mjs')) pkg.scripts.check += ' && node verify-portal-members-client.mjs';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const runtimePath = 'src/config/runtime.js';
let runtime = fs.readFileSync(runtimePath, 'utf8');
runtime = mustReplace(runtime, 'const VERSION = "2.4.1";', 'const VERSION = "2.4.2";', 'runtime version');
fs.writeFileSync(runtimePath, runtime);

const notes = {
  version: '2.4.2',
  notificationPolicy: 'portal-only-with-private-developer-failure-details',
  added: [
    '群友列表新增身份、禁言状态、关系筛选与多种排序',
    '群友列表新增复制 QQ、导出 CSV、入群时间与最近发言时间',
    '群友列表读取状态新增管理层、禁言与关系数量摘要'
  ],
  fixed: [
    '关系配对确认文字转义错误导致整个群友列表浏览器脚本无法解析',
    '从首页快捷入口或已打开的群友列表进入时不会自动读取资料',
    '群友列表接口异常时只停留在初始文字，未显示网络或 HTTP 错误'
  ]
};
fs.writeFileSync('release-notes.json', JSON.stringify(notes, null, 2) + '\n');

for (const file of fs.readdirSync('.').filter(name => /^verify-.*\\.mjs$/.test(name) && name !== verifyPath)) {
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes('2.4.1')) {
    source = source.replaceAll('2.4.1', '2.4.2');
    fs.writeFileSync(file, source);
  }
}

console.log('Portal member console v2.4.2 patch applied');
