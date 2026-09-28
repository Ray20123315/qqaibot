function injectV4LeanPortalClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-v4-lean-portal-style")) return source;

  const style = `<style id="qqai-v4-lean-portal-style">
:root{
  --v4-bg:#05070d;--v4-panel:rgba(12,16,28,.74);--v4-panel2:rgba(18,24,40,.74);
  --v4-line:rgba(155,168,255,.16);--v4-glow:rgba(113,93,255,.28);--v4-cyan:rgba(76,221,255,.24);
}
body.v4-lean-enabled{
  --bg:#05070d;--panel:#0d1220;--panel2:#131a2a;--text:#f2f5ff;--muted:#98a5bb;
  --line:#283149;--primary:#7b6cff;--primary2:#55cfff;--ok:#45e3aa;--warn:#ffc566;--bad:#ff657d;
  --topbar-bg:rgba(5,8,15,.62);--shadow:0 20px 70px rgba(0,0,0,.3);
  background:
  radial-gradient(circle at 18% 14%,rgba(108,82,255,.19),transparent 32%),
  radial-gradient(circle at 84% 18%,rgba(52,211,255,.13),transparent 28%),
  radial-gradient(circle at 72% 82%,rgba(180,68,255,.13),transparent 30%),
  #05070d!important;
  background-attachment:fixed;overflow-x:hidden}
body.v4-lean-enabled:before,body.v4-lean-enabled:after{
  content:"";position:fixed;inset:-20%;pointer-events:none;z-index:-1;opacity:.55;
  background-image:radial-gradient(circle,rgba(255,255,255,.18) 0 1px,transparent 1.5px);
  background-size:38px 38px;animation:v4stars 28s linear infinite}
body.v4-lean-enabled:after{background-size:71px 71px;opacity:.22;animation-duration:45s;animation-direction:reverse}
@keyframes v4stars{to{transform:translate3d(80px,58px,0) rotate(.01deg)}}
body.v4-lean-enabled .sidebar{background:rgba(6,9,17,.82)!important;border-right:1px solid var(--v4-line)!important;backdrop-filter:blur(24px) saturate(150%)}
body.v4-lean-enabled .side-brand{padding:12px 10px 22px}
body.v4-lean-enabled .side-brand .logo{box-shadow:0 0 32px rgba(111,93,255,.38);animation:v4logo 4.6s ease-in-out infinite}
@keyframes v4logo{50%{transform:translateY(-3px) rotate(2deg);box-shadow:0 0 48px rgba(82,222,255,.34)}}
#v4LeanNav{display:grid;gap:7px;padding:3px 0}
#v4LeanNav button{position:relative;overflow:hidden;border:1px solid transparent;background:transparent;color:#9aa5bc;padding:11px 12px;border-radius:13px;text-align:left;font-weight:760;cursor:pointer;transition:.22s ease}
#v4LeanNav button:before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 25%,rgba(255,255,255,.08),transparent 70%);transform:translateX(-130%);transition:transform .5s ease}
#v4LeanNav button:hover:before{transform:translateX(130%)}
#v4LeanNav button:hover,#v4LeanNav button.active{color:#fff;border-color:rgba(129,119,255,.28);background:linear-gradient(120deg,rgba(109,91,255,.18),rgba(50,201,255,.08));transform:translateX(3px)}
#v4LeanNav button.active{box-shadow:0 0 26px rgba(94,79,255,.16)}
body.v4-lean-enabled #v4LeanNav{display:grid!important}
body.v4-lean-enabled .main{background:transparent!important}
body.v4-lean-enabled .topbar{background:rgba(5,8,15,.62)!important;border-color:rgba(140,153,220,.14)!important;backdrop-filter:blur(24px) saturate(160%)}
body.v4-lean-enabled .content{max-width:1540px!important}
body.v4-lean-enabled .card,body.v4-lean-enabled .v4-card{
  background:linear-gradient(145deg,rgba(16,21,36,.82),rgba(8,12,22,.76))!important;
  border:1px solid rgba(145,156,225,.16)!important;
  box-shadow:0 20px 70px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.03)!important;
  backdrop-filter:blur(18px) saturate(130%);
}
body.v4-lean-enabled .view.active{animation:v4enter .48s cubic-bezier(.2,.8,.2,1)}
@keyframes v4enter{from{opacity:0;transform:translateY(12px) scale(.992);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}
.v4-shell{display:grid;gap:18px}.v4-hero{position:relative;overflow:hidden;border-radius:28px;padding:28px;min-height:250px;border:1px solid rgba(152,142,255,.22);background:linear-gradient(130deg,rgba(17,21,40,.9),rgba(7,10,19,.84));box-shadow:0 30px 100px rgba(0,0,0,.28)}
.v4-hero:before{content:"";position:absolute;width:340px;height:340px;right:-80px;top:-110px;border-radius:50%;background:conic-gradient(from 40deg,rgba(115,91,255,.58),rgba(67,211,255,.18),rgba(225,80,255,.4),rgba(115,91,255,.58));filter:blur(2px);animation:v4orbspin 12s linear infinite}
.v4-hero:after{content:"";position:absolute;width:270px;height:270px;right:-46px;top:-74px;border-radius:50%;background:#080b14;box-shadow:inset 0 0 80px rgba(86,69,255,.24)}
@keyframes v4orbspin{to{transform:rotate(360deg)}}
.v4-hero>*{position:relative;z-index:2}.v4-eyebrow{font-size:12px;font-weight:850;letter-spacing:.18em;text-transform:uppercase;color:#9ea7ff}.v4-hero h1{font-size:clamp(30px,5vw,62px);line-height:.98;margin:12px 0 16px;letter-spacing:-.055em;max-width:850px}.v4-hero p{max-width:760px;color:var(--muted);font-size:15px;line-height:1.8}
.v4-statusline{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.v4-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(150,163,235,.17);background:rgba(255,255,255,.045);border-radius:999px;padding:8px 11px;font-size:12px;font-weight:780}.v4-dot{width:9px;height:9px;border-radius:50%;background:#697386;box-shadow:0 0 0 0 rgba(105,115,134,.3)}.v4-dot.ok{background:#45e3aa;box-shadow:0 0 18px rgba(69,227,170,.7);animation:v4pulse 1.8s infinite}.v4-dot.warn{background:#ffc566;box-shadow:0 0 18px rgba(255,197,102,.55)}.v4-dot.bad{background:#ff657d;box-shadow:0 0 18px rgba(255,101,125,.5)}
@keyframes v4pulse{50%{box-shadow:0 0 0 9px rgba(69,227,170,0)}}
.v4-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}.v4-card{grid-column:span 4;border-radius:20px;padding:18px;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;transform-style:preserve-3d}.v4-card:hover{border-color:rgba(140,129,255,.34)!important;box-shadow:0 24px 80px rgba(0,0,0,.3),0 0 42px rgba(93,75,255,.1)!important}.v4-card.wide{grid-column:span 8}.v4-card.full{grid-column:1/-1}.v4-card h3{margin:0 0 8px}.v4-big{font-size:30px;font-weight:900;letter-spacing:-.04em}.v4-sub{font-size:12px;color:var(--muted);line-height:1.6}.v4-cap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(150,160,220,.1)}.v4-cap:last-child{border-bottom:0}.v4-tag{border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800;background:rgba(81,216,174,.1);color:#67e0b3}.v4-tag.pending{background:rgba(255,194,88,.1);color:#ffc66e}
.v4-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.v4-actions .btn{transition:transform .18s ease,box-shadow .18s ease}.v4-actions .btn:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.22)}
.v4-input{width:100%;border:1px solid rgba(150,160,220,.16);background:rgba(7,10,18,.72);color:var(--text);border-radius:13px;padding:11px 12px;outline:none}.v4-input:focus{border-color:rgba(115,101,255,.7);box-shadow:0 0 0 4px rgba(108,92,255,.12)}
.v4-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:end}.v4-list{display:grid;gap:10px;margin-top:12px}.v4-row{border:1px solid rgba(150,160,220,.12);border-radius:14px;padding:13px;background:rgba(255,255,255,.025)}.v4-row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.v4-row-title{font-weight:850;overflow-wrap:anywhere}.v4-row-meta{font-size:12px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}.v4-row-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v4-inline{display:grid;grid-template-columns:minmax(190px,1fr) auto auto;gap:8px;align-items:center;margin-top:10px}
.v4-tabs{display:flex;gap:8px;flex-wrap:wrap}.v4-tabs button.active{background:var(--primary);color:#fff}.v4-empty{padding:30px;border:1px dashed rgba(150,160,220,.18);border-radius:15px;color:var(--muted);text-align:center}.v4-error{color:#ff8292}.v4-ok{color:#5ce0b1}
.v4-restored{display:flex;gap:7px;flex-wrap:wrap}.v4-restored span{font-size:11px;color:#aeb9d2;border:1px solid rgba(150,160,220,.16);padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.03)}
.v4-console{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;background:rgba(1,3,8,.65);border:1px solid rgba(150,160,220,.12);border-radius:14px;padding:13px;max-height:300px;overflow:auto}

.v4-resource-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.v4-resource-card{border:1px solid rgba(150,160,220,.13);border-radius:17px;padding:15px;background:rgba(255,255,255,.025)}
.v4-resource-card .v4-resource-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(123,108,255,.22),rgba(85,207,255,.10));font-weight:900;margin-bottom:12px}
.v4-dev-only{display:none!important}body.v4-developer-mode .v4-dev-only{display:block!important}
#v4DeveloperGate{position:relative;margin-top:14px;min-height:28px;border-radius:12px;opacity:.5;transition:opacity .2s ease}
#v4DeveloperGate:hover,#v4DeveloperGate:focus-within{opacity:1}
#v4DeveloperGate input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:text}
#v4DeveloperMask{display:block;min-height:28px;padding:5px 9px;color:#8e99ad;font-size:11px;letter-spacing:.08em}
body.v4-developer-mode #v4DeveloperMask{color:#78e4c1}
.v4-modal-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(2,4,10,.66);backdrop-filter:blur(18px)}
.v4-modal-backdrop.hidden{display:none}.v4-modal-card{width:min(560px,100%);border:1px solid rgba(150,160,220,.18);border-radius:22px;background:linear-gradient(145deg,rgba(18,23,38,.97),rgba(8,12,22,.97));box-shadow:0 30px 100px rgba(0,0,0,.45);padding:22px}
.v4-modal-card h3{margin:0 0 8px}.v4-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
@media(max-width:720px){.v4-resource-summary{grid-template-columns:1fr}}
@media(max-width:1100px){.v4-card,.v4-card.wide{grid-column:span 6}.v4-hero:before,.v4-hero:after{opacity:.55}}
@media(max-width:720px){.v4-card,.v4-card.wide{grid-column:1/-1}.v4-hero{padding:22px;min-height:230px}.v4-toolbar,.v4-inline{grid-template-columns:1fr}.v4-hero:before,.v4-hero:after{opacity:.25}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.v4-card{transform:none!important}}
</style>`;

  const script = `<script id="qqai-v4-lean-portal-client">
(function(){
'use strict';
var RESTORED=['活动/投票','排程提醒','匿名申诉','历史违规','B站监控','成员与关系','平台功能目录','插件管理','系统工具'];
var ACTIVE='v4overview';
var VIEWER={developer:false};var DEV_UNLOCKED=false;
function q(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function jsonReq(path,method,body){
  var init={method:method||'GET',headers:{Accept:'application/json'}};
  if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}
  return fetch(path,init).then(async function(res){var data={};try{data=await res.json()}catch(e){}if(!res.ok)throw new Error(data.message||data.detail||('HTTP '+res.status));return data})
}
function ensureView(id,title,html){
  if(q('v-'+id))return q('v-'+id);
  var v=document.createElement('section');v.id='v-'+id;v.className='view';v.dataset.v4Custom='1';v.innerHTML=html;
  var content=document.querySelector('.content');if(content)content.appendChild(v);return v
}
function hideViews(){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')})}
function setActive(id,label){
  ACTIVE=id;document.querySelectorAll('#v4LeanNav button').forEach(function(b){b.classList.toggle('active',b.dataset.v4Target===id)});
  var h=document.querySelector('.topbar h2');if(h&&label)h.textContent=label
}
function showCustom(id,label){hideViews();var v=q('v-'+id);if(v)v.classList.add('active');setActive(id,label);if(id==='v4qqopen')refreshStatus();if(id==='v4groups')loadGroupAll();if(id==='v4resources')loadResources()}
function openLegacy(view,label){
  var btn=document.querySelector('#nav button[data-view="'+view+'"]');
  if(btn){btn.click();setTimeout(function(){setActive(view,label)},0)}
}
function renderOverview(){
  ensureView('v4overview','总览','<div class="v4-shell">'+
    '<div class="v4-hero v4-tilt"><div class="v4-eyebrow">QQAIBOT / FULL CONTROL</div><h1>完整功能回来了，<br>QQ Open 负责主路径。</h1><p>原有 Portal 导航与 QQAI 2.7.12 功能完整保留；V4 区块只增加 QQ Open、分类指令面板与 Hybrid 状态，不再隐藏旧功能。</p><div class="v4-statusline"><span class="v4-pill"><i id="v4HeroDot" class="v4-dot"></i><b id="v4HeroState">读取 QQ Open...</b></span><span class="v4-pill">WebSocket Native</span><span class="v4-pill">OpenID Identity</span></div></div>'+
    '<div class="v4-grid">'+
      '<div class="v4-card"><div class="v4-sub">Gateway</div><div id="v4MetricGateway" class="v4-big">—</div><div id="v4MetricEvent" class="v4-sub">等待状态</div></div>'+
      '<div class="v4-card"><div class="v4-sub">消息 / 媒体</div><div class="v4-big">6 类</div><div class="v4-sub">文字、图片、影片、语音、文件、Markdown</div></div>'+
      '<div class="v4-card"><div class="v4-sub">V4 快捷区</div><div class="v4-big">6</div><div class="v4-sub">原 Portal 完整导航保留，另加总览 / QQ Open / 群管理 / AI-Codex / 插件 / 系统</div></div>'+
      '<div class="v4-card wide"><h3>完整能力</h3><div class="v4-cap"><span>QQ Open WebSocket + OpenAPI</span><b class="v4-tag">主路径</b></div><div class="v4-cap"><span>完整 QQAI 2.7.12 指令与群管理</span><b class="v4-tag">恢复</b></div><div class="v4-cap"><span>AI / Codex / CodexChat / CodexWork / Plugin Runtime</span><b class="v4-tag">完整</b></div><div class="v4-cap"><span>分类自定义菜单 / 指令面板</span><b class="v4-tag">同步</b></div></div>'+
      '<div class="v4-card"><h3>已恢复入口</h3><div class="v4-restored">'+RESTORED.map(function(x){return'<span>'+esc(x)+'</span>'}).join('')+'</div><div class="v4-sub" style="margin-top:12px">这些功能继续使用原本的权限、确认、插件与资料层；V4 不再覆盖或隐藏它们。</div></div>'+
    '</div></div>');
}
function renderQqOpen(){
  ensureView('v4qqopen','QQ Open','<div class="v4-shell"><div class="section-head"><div><h2>QQ Open</h2><p>实时 Gateway 与官方能力状态。</p></div><div class="v4-actions"><button id="v4Connect" class="btn primary">连接</button><button id="v4Disconnect" class="btn">断开</button><button id="v4StatusRefresh" class="btn">刷新</button></div></div>'+
    '<div class="v4-grid"><div class="v4-card"><div class="v4-sub">Gateway</div><div id="v4QqState" class="v4-big">—</div><div id="v4QqConfigured" class="v4-sub">—</div></div>'+
    '<div class="v4-card"><div class="v4-sub">最后事件</div><div id="v4QqEvent" class="v4-big" style="font-size:19px">—</div><div id="v4QqSeq" class="v4-sub">seq —</div></div>'+
    '<div class="v4-card"><div class="v4-sub">重连</div><div id="v4QqReconnect" class="v4-big">0</div><div id="v4QqError" class="v4-sub">没有错误</div></div>'+
    '<div class="v4-card"><div class="v4-sub">Interaction</div><div id="v4QqInteractions" class="v4-big">0</div><div id="v4QqInteractionLast" class="v4-sub">尚无互动</div></div>'+
    '<div class="v4-card"><div class="v4-sub">主动推送授权</div><div id="v4QqPush" class="v4-big">0</div><div id="v4QqHybrid" class="v4-sub">Hybrid —</div></div>'+
    '<div class="v4-card"><div class="v4-sub">生命周期事件</div><div id="v4QqLifecycle" class="v4-big">0</div><div id="v4QqLifecycleLast" class="v4-sub">尚无事件</div></div>'+
    '<div class="v4-card"><div class="v4-sub">群映射</div><div id="v4QqMappings" class="v4-big">0</div><div id="v4QqMappingsDetail" class="v4-sub">静态 0 · 自动 0</div></div>'+
    '<div class="v4-card wide"><h3>消息 / 富媒体</h3><div class="v4-cap"><span>接收：文字、图片、影片、语音、文件、表情</span><b class="v4-tag">官方支持</b></div><div class="v4-cap"><span>发送：文字、Markdown、图片、影片、语音、文件</span><b class="v4-tag">官方支持</b></div><div class="v4-cap"><span>富媒体发送流程</span><b class="v4-tag pending">上传 → file_info → msg_type=7</b></div></div>'+
    '<div class="v4-card"><h3>群管理</h3><div class="v4-cap"><span>成员列表 / 资料</span><b class="v4-tag">支持</b></div><div class="v4-cap"><span>禁言 / 移出 / 黑名单</span><b class="v4-tag">支持</b></div><div class="v4-cap"><span>入群申请同意 / 拒绝 / 拉黑</span><b class="v4-tag">支持</b></div><div class="v4-sub" style="margin-top:10px">实际开放程度取决于当前 App 权限。</div></div>'+
    '<div class="v4-card full v4-dev-only"><h3>开发者诊断</h3><div id="v4QqRaw" class="v4-console">读取中...</div></div></div></div>');
}
function renderGroups(){
  ensureView('v4groups','群管理','<div class="v4-shell"><div class="section-head"><div><h2>QQ Open 群管理</h2><p>直接使用 group_openid / member_openid，不再假装成数字 QQ。</p></div></div>'+
    '<div class="v4-card"><div class="v4-toolbar"><div><label class="v4-sub">Group OpenID</label><input id="v4GroupId" class="v4-input" placeholder="输入 group_openid"></div><button id="v4GroupLoad" class="btn primary">读取群状态</button></div><div id="v4GroupNotice" class="v4-sub" style="margin-top:10px">尚未读取。</div></div>'+
    '<div class="v4-tabs"><button class="btn active" data-v4-tab="members">成员</button><button class="btn" data-v4-tab="joins">入群申请</button><button class="btn" data-v4-tab="blacklist">黑名单</button><button class="btn" data-v4-tab="mutes">禁言状态</button></div>'+
    '<div id="v4GroupInfo" class="v4-card full"><div class="v4-empty">输入 Group OpenID 后读取。</div></div>'+
    '<div id="v4GroupMembers" class="v4-list"></div><div id="v4GroupJoins" class="v4-list hidden"></div><div id="v4GroupBlacklist" class="v4-list hidden"></div><div id="v4GroupMutes" class="v4-list hidden"></div></div>');
}
function renderResources(){
  ensureView('v4resources','AI 与资料','<div class="v4-shell">'+
    '<div class="section-head"><div><h2>AI 与资料</h2><p>连接你自己的 AI 与资料储存。完整金钥只用于建立连接，保存后不会再显示。</p></div><div class="v4-actions"><button id="v4AddAi" class="btn primary">新增 AI</button><button id="v4AddStorage" class="btn">连接资料储存</button></div></div>'+
    '<div class="v4-resource-summary"><div class="v4-resource-card"><div class="v4-resource-icon">AI</div><div id="v4AiCount" class="v4-big">—</div><div class="v4-sub">自己的 AI 服务</div></div><div class="v4-resource-card"><div class="v4-resource-icon">DB</div><div id="v4StorageCount" class="v4-big">—</div><div class="v4-sub">已连接资料储存</div></div><div class="v4-resource-card"><div class="v4-resource-icon">✓</div><div id="v4PersistenceState" class="v4-big">—</div><div class="v4-sub">长期保存状态</div></div></div>'+
    '<div class="v4-grid"><div class="v4-card wide"><h3>我的 AI</h3><p class="v4-sub">你可以自己使用，也可以只分享给你仍在的群组。离群后分享自动失效。</p><div id="v4AiList" class="v4-list"><div class="v4-empty">读取中…</div></div></div>'+
    '<div class="v4-card"><h3>资料储存</h3><p class="v4-sub">要保存长期记忆、聊天记录、设置或插件资料，请连接自己的 D1 或 KV。</p><div id="v4StorageList" class="v4-list"><div class="v4-empty">读取中…</div></div></div></div>'+
    '<div id="v4ResourceNotice" class="v4-sub"></div></div>');
}
function renderResourceRows(data){
  var ai=Array.isArray(data&&data.ai)?data.ai:[],st=Array.isArray(data&&data.storage)?data.storage:[],p=(data&&data.persistence)||{};
  if(q('v4AiCount'))q('v4AiCount').textContent=String(ai.length);
  if(q('v4StorageCount'))q('v4StorageCount').textContent=String(st.length);
  if(q('v4PersistenceState')){q('v4PersistenceState').textContent=p.connected?'已启用':'未启用';q('v4PersistenceState').className='v4-big '+(p.connected?'v4-ok':'v4-error')}
  if(q('v4AiList'))q('v4AiList').innerHTML=ai.length?ai.map(function(x){return '<div class="v4-row"><div class="v4-row-head"><div><div class="v4-row-title">'+esc(x.label||'AI 服务')+'</div><div class="v4-row-meta">'+esc(x.provider||'服务')+(x.model?' · '+esc(x.model):'')+'</div></div><span class="v4-tag">'+(x.enabled===false?'停用':'可用')+'</span></div><div class="v4-row-meta">已分享群组 '+String(Array.isArray(x.sharedGroupIds)?x.sharedGroupIds.length:0)+' · 群友私聊 '+(x.allowGroupMemberPrivateChat?'允许':'关闭')+'</div><div class="v4-row-actions"><button class="btn" data-v4-ai-share="'+esc(x.id)+'">分享设置</button><button class="btn danger" data-v4-ai-delete="'+esc(x.id)+'">移除</button></div></div>'}).join(''):'<div class="v4-empty">尚未连接自己的 AI。</div>';
  if(q('v4StorageList'))q('v4StorageList').innerHTML=st.length?st.map(function(x){var type=x.type==='cloudflare_d1'?'D1':'KV';return '<div class="v4-row"><div class="v4-row-head"><div><div class="v4-row-title">'+esc(x.label||type)+'</div><div class="v4-row-meta">Cloudflare '+type+' · '+(x.enabled===false?'已停用':'已连接')+'</div></div></div><div class="v4-row-actions"><button class="btn" data-v4-storage-test="'+esc(x.id)+'">测试连接</button><button class="btn danger" data-v4-storage-delete="'+esc(x.id)+'">移除</button></div></div>'}).join(''):'<div class="v4-empty">尚未连接资料储存；长期内容不会保存。</div>';
  bindResourceActions(ai);
}
async function loadResources(){
  try{var data=await jsonReq('/api/portal/v4/resources');VIEWER=data.viewer||VIEWER;renderResourceRows(data)}catch(e){if(q('v4ResourceNotice'))q('v4ResourceNotice').textContent=String(e.message||e)}
}
async function createResourceTicket(kind){
  try{var r=await jsonReq('/api/portal/v4/resources/ticket','POST',{kind:kind});if(r.path)location.href=r.path}catch(e){if(q('v4ResourceNotice'))q('v4ResourceNotice').textContent=String(e.message||e)}
}
function closeV4Modal(){var el=q('v4Modal');if(el)el.classList.add('hidden')}
function openV4Modal(title,body,onSave){
  var el=q('v4Modal');if(!el){el=document.createElement('div');el.id='v4Modal';el.className='v4-modal-backdrop hidden';el.innerHTML='<div class="v4-modal-card"><h3 id="v4ModalTitle"></h3><div id="v4ModalBody"></div><div class="v4-modal-actions"><button id="v4ModalCancel" class="btn">取消</button><button id="v4ModalSave" class="btn primary">储存</button></div></div>';document.body.appendChild(el);q('v4ModalCancel').onclick=closeV4Modal}
  q('v4ModalTitle').textContent=title;q('v4ModalBody').innerHTML=body;el.classList.remove('hidden');q('v4ModalSave').onclick=async function(){await onSave();closeV4Modal()}
}
function bindResourceActions(ai){
  if(q('v4AddAi'))q('v4AddAi').onclick=function(){createResourceTicket('ai')};
  if(q('v4AddStorage'))q('v4AddStorage').onclick=function(){createResourceTicket('storage')};
  document.querySelectorAll('[data-v4-storage-test]').forEach(function(b){b.onclick=async function(){try{await jsonReq('/api/portal/v4/resources/storage/'+encodeURIComponent(b.dataset.v4StorageTest)+'/test','POST',{});q('v4ResourceNotice').textContent='资料储存连接正常。'}catch(e){q('v4ResourceNotice').textContent=String(e.message||e)}}});
  document.querySelectorAll('[data-v4-storage-delete]').forEach(function(b){b.onclick=function(){openV4Modal('移除资料储存','<p class="v4-sub">移除连接不会自动删除你 Cloudflare 帐号里的资料，但 AIBot 将无法继续读取。</p>',async function(){await jsonReq('/api/portal/v4/resources/storage/'+encodeURIComponent(b.dataset.v4StorageDelete),'DELETE');await loadResources()})}});
  document.querySelectorAll('[data-v4-ai-delete]').forEach(function(b){b.onclick=function(){openV4Modal('移除 AI 服务','<p class="v4-sub">移除后，这个 API 金钥将不再由 AIBot 使用。</p>',async function(){await jsonReq('/api/portal/v4/resources/ai/'+encodeURIComponent(b.dataset.v4AiDelete),'DELETE');await loadResources()})}});
  document.querySelectorAll('[data-v4-ai-share]').forEach(function(b){b.onclick=function(){var account=ai.find(function(x){return x.id===b.dataset.v4AiShare})||{},groups=(account.sharedGroupIds||[]).join('\n');openV4Modal('AI 分享设置','<label class="v4-sub">允许使用的群组 ID，每行一个</label><textarea id="v4ShareGroups" class="v4-input" rows="6">'+esc(groups)+'</textarea><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="v4SharePrivate" type="checkbox" '+(account.allowGroupMemberPrivateChat?'checked':'')+'>允许这些群的成员在私讯使用</label><p class="v4-sub">实际使用前仍会确认 AI 提供者和使用者都还在对应群组。</p>',async function(){var groupIds=String(q('v4ShareGroups').value||'').split(/\n|,/).map(function(x){return x.trim()}).filter(Boolean);await jsonReq('/api/portal/v4/resources/ai/'+encodeURIComponent(account.id)+'/sharing','POST',{groupIds:groupIds,allowGroupMemberPrivateChat:q('v4SharePrivate').checked});await loadResources()})}}
  );
}
function bindResources(){if(q('v4AddAi'))q('v4AddAi').onclick=function(){createResourceTicket('ai')};if(q('v4AddStorage'))q('v4AddStorage').onclick=function(){createResourceTicket('storage')}}
function renderCodex(){
  ensureView('v4codex','AI / Codex','<div class="v4-shell"><div class="v4-hero"><div class="v4-eyebrow">AI / CODEX</div><h1>一个人，默认一个 Codex 对话。</h1><p>!codex、!codexchat、!codexwork 不再按群聊/私聊拆成一堆聊天室。只有插件内部分析、明确要求隔离的工作才保持独立会话。</p></div><div class="v4-grid">'+
    '<div class="v4-card"><div class="v4-sub">直接指令会话</div><div class="v4-big">统一</div><div class="v4-sub">优先使用 principalId；没有映射时退回当前平台 userId。</div></div>'+
    '<div class="v4-card"><div class="v4-sub">特殊隔离</div><div class="v4-big">插件</div><div class="v4-sub">后台插件分析不污染用户主要 Codex 对话。</div></div>'+
    '<div class="v4-card"><div class="v4-sub">Codex Work</div><div class="v4-big">同会话</div><div class="v4-sub">权限边界仍由本机 Bridge 的 read/edit roots 与 no-delete 控制。</div></div>'+
    '<div class="v4-card full"><h3>保留原则</h3><div class="v4-cap"><span>!codex / !codexchat / !codexwork</span><b class="v4-tag">同主会话</b></div><div class="v4-cap"><span>Plugin Codex override</span><b class="v4-tag pending">特殊隔离</b></div><div class="v4-cap"><span>跨 QQ OpenID 自动认同一人</span><b class="v4-tag pending">需 identity mapping 后启用</b></div></div></div></div>');
}
function renderSystem(){
  ensureView('v4system','系统','<div class="v4-shell"><div class="section-head"><div><h2>系统</h2><p>集中展示 V4 系统快捷入口；原 Portal 的完整系统与功能导航仍全部保留。</p></div></div><div class="v4-grid">'+
    '<div class="v4-card"><h3>系统管理</h3><p class="v4-sub">开发者、变量与高权限管理。</p><div class="v4-actions"><button class="btn primary" data-open-legacy="systemadmin">打开</button></div></div>'+
    '<div class="v4-card"><h3>健康检查</h3><p class="v4-sub">Provider、D1、Worker 与运行状态。</p><div class="v4-actions"><button class="btn primary" data-open-legacy="health">打开</button></div></div>'+
    '<div class="v4-card"><h3>日志</h3><p class="v4-sub">终端样式日志与排错。</p><div class="v4-actions"><button class="btn primary" data-open-legacy="logs">打开</button></div></div>'+
    '<div class="v4-card"><h3>维护模式</h3><p class="v4-sub">维护页、开发者绕过与状态切换。</p><div class="v4-actions"><button class="btn primary" data-open-legacy="maintenance">打开</button></div></div></div></div>');
}
function ensureLeanNav(){
  var nav=q('nav');if(!nav)return;
  if(!q('v4LeanNav')){var box=document.createElement('div');box.id='v4LeanNav';[
    ['v4overview','总览'],['v4resources','AI 与资料'],['v4codex','AI / Codex'],['v3plugins','插件'],['v4qqopen','QQ Open','dev'],['v4groups','群管理','dev'],['v4system','系统','dev']
  ].forEach(function(x){var b=document.createElement('button');b.type='button';b.dataset.v4Target=x[0];b.textContent=x[1];if(x[2]==='dev'){b.classList.add('v4-dev-only');b.dataset.v4DevOnly='1'}b.onclick=function(){if(x[0]==='v3plugins')openLegacy('v3plugins','插件');else showCustom(x[0],x[1])};box.appendChild(b)});nav.appendChild(box);ensureDeveloperGate()}
}
async function loadViewer(){
  try{var r=await jsonReq('/api/portal/v4/resources/viewer');VIEWER=r.viewer||VIEWER;ensureDeveloperGate()}catch(e){VIEWER={developer:false}}
}
function ensureDeveloperGate(){
  var nav=q('nav');if(!nav||!VIEWER.developer)return;
  var gate=q('v4DeveloperGate');
  if(!gate){gate=document.createElement('div');gate.id='v4DeveloperGate';gate.innerHTML='<span id="v4DeveloperMask"> </span><input id="v4DeveloperInput" inputmode="numeric" autocomplete="off" aria-label="开发者模式">';nav.appendChild(gate)}
  var input=q('v4DeveloperInput'),mask=q('v4DeveloperMask');if(!input||input.dataset.bound)return;input.dataset.bound='1';
  var proxy='开发者模式';
  input.addEventListener('input',function(){var raw=String(input.value||'').replace(/[^0]/g,'').slice(0,5);input.value=raw;mask.textContent=proxy.slice(0,raw.length);if(raw==='00000'){DEV_UNLOCKED=true;document.body.classList.add('v4-developer-mode');mask.textContent='开发者模式';input.blur()}});
  input.addEventListener('blur',function(){if(!DEV_UNLOCKED){input.value='';mask.textContent=' '}})
}
function applyLean(){
  document.body.classList.add('v4-lean-enabled');renderOverview();renderResources();renderQqOpen();renderGroups();renderCodex();renderSystem();ensureLeanNav();
  showCustom('v4overview','总览');
  document.querySelectorAll('[data-open-legacy]').forEach(function(b){if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=function(){openLegacy(b.dataset.openLegacy,b.textContent||'系统')}})
  bindGroup();bindStatusButtons();bindResources();bindTilt()
}
function stateLabel(g){if(g&&g.ready)return['READY','ok'];if(g&&g.connected)return['CONNECTED','warn'];return['OFFLINE','bad']}
async function refreshStatus(){
  try{var r=await jsonReq('/api/portal/v4/qqopen/status');var g=r.gateway||{},s=stateLabel(g);
    var dot=q('v4HeroDot');if(dot){dot.className='v4-dot '+s[1];q('v4HeroState').textContent='QQ Open '+s[0]}
    if(q('v4MetricGateway'))q('v4MetricGateway').textContent=s[0];if(q('v4MetricEvent'))q('v4MetricEvent').textContent=g.lastEventType?('最近 '+g.lastEventType):'尚无事件';
    if(q('v4QqState'))q('v4QqState').textContent=s[0];if(q('v4QqConfigured'))q('v4QqConfigured').textContent=(r.enabled?'已启用':'未启用')+' / '+(r.configured?'凭证已配置':'凭证未配置');
    if(q('v4QqEvent'))q('v4QqEvent').textContent=g.lastEventType||'—';if(q('v4QqSeq'))q('v4QqSeq').textContent='seq '+(g.seq==null?'—':g.seq);
    if(q('v4QqReconnect'))q('v4QqReconnect').textContent=String(g.reconnectCount||0);if(q('v4QqError')){q('v4QqError').textContent=g.lastError||'没有错误';q('v4QqError').className='v4-sub '+(g.lastError?'v4-error':'v4-ok')}
    if(q('v4QqInteractions'))q('v4QqInteractions').textContent=String((g.interaction&&g.interaction.count)||0);if(q('v4QqInteractionLast')){var li=g.interaction&&g.interaction.last;q('v4QqInteractionLast').textContent=li?('type '+li.type+' · '+li.scene):'尚无互动'}
    if(q('v4QqPush'))q('v4QqPush').textContent=String(Array.isArray(g.pushPermissions)?g.pushPermissions.length:0);if(q('v4QqHybrid'))q('v4QqHybrid').textContent='Hybrid '+String((r.hybrid&&r.hybrid.primary)||'—')+' · 映射 '+String((r.hybrid&&r.hybrid.totalMappedGroups)||0)
    if(q('v4QqLifecycle'))q('v4QqLifecycle').textContent=String((g.lifecycle&&g.lifecycle.count)||0);if(q('v4QqLifecycleLast')){var ll=g.lifecycle&&g.lifecycle.last;q('v4QqLifecycleLast').textContent=ll?(String(ll.eventType||'事件')+' · '+(ll.active?'active':'inactive')):'尚无事件'}
    if(q('v4QqMappings'))q('v4QqMappings').textContent=String((r.hybrid&&r.hybrid.totalMappedGroups)||0);if(q('v4QqMappingsDetail')){var hc=r.hybrid||{},pc=Array.isArray(hc.pendingMappingCandidates)?hc.pendingMappingCandidates:[],top=pc[0]||null,detail='静态 '+String(hc.mappedGroups||0)+' · 自动 '+String(hc.dynamicMappedGroups||0)+' · 候选 '+String(pc.length);if(top)detail+=' · 学习 '+String(top.count||0)+'/'+String(hc.mappingEvidenceRequired||3);q('v4QqMappingsDetail').textContent=detail}
    if(q('v4QqRaw'))q('v4QqRaw').textContent=JSON.stringify({enabled:r.enabled,configured:r.configured,hybrid:r.hybrid,gateway:g,media:r.media,groupManagement:r.groupManagement},null,2)
  }catch(e){if(q('v4HeroState'))q('v4HeroState').textContent='QQ Open 状态读取失败';if(q('v4QqRaw'))q('v4QqRaw').textContent=String(e.message||e)}
}
function bindStatusButtons(){
  if(q('v4StatusRefresh')&&!q('v4StatusRefresh').dataset.bound){q('v4StatusRefresh').dataset.bound='1';q('v4StatusRefresh').onclick=refreshStatus}
  if(q('v4Connect')&&!q('v4Connect').dataset.bound){q('v4Connect').dataset.bound='1';q('v4Connect').onclick=async function(){try{await jsonReq('/api/portal/v4/qqopen/gateway/connect','POST',{});await refreshStatus()}catch(e){q('v4QqRaw').textContent=String(e.message||e)}}}
  if(q('v4Disconnect')&&!q('v4Disconnect').dataset.bound){q('v4Disconnect').dataset.bound='1';q('v4Disconnect').onclick=async function(){try{await jsonReq('/api/portal/v4/qqopen/gateway/disconnect','POST',{});await refreshStatus()}catch(e){q('v4QqRaw').textContent=String(e.message||e)}}}
}
function arr(v){if(Array.isArray(v))return v;if(Array.isArray(v&&v.list))return v.list;if(Array.isArray(v&&v.members))return v.members;if(Array.isArray(v&&v.data))return v.data;return[]}
function groupId(){return String((q('v4GroupId')||{}).value||'').trim()}
async function loadGroupAll(){
  var gid=groupId();if(!gid)return;
  var notice=q('v4GroupNotice');if(notice)notice.textContent='读取中...';
  var urls=['/group/info','/group/members','/group/join-requests','/group/blacklist','/group/mutes'];
  var results=await Promise.all(urls.map(function(p){return jsonReq('/api/portal/v4/qqopen'+p+'?group='+encodeURIComponent(gid)).then(function(x){return{ok:true,data:x}}).catch(function(e){return{ok:false,error:String(e.message||e)}})}));
  renderGroupInfo(results[0]);renderMembers(results[1]);renderJoins(results[2]);renderBlacklist(results[3]);renderMutes(results[4]);
  if(notice)notice.textContent='已完成；若某区块显示权限不足，代表 QQ 尚未为当前机器人开放该接口。'
}
function renderGroupInfo(r){var el=q('v4GroupInfo');if(!el)return;if(!r.ok){el.innerHTML='<div class="v4-error">'+esc(r.error)+'</div>';return}var d=r.data||{},info=d.info||{},bot=d.botState||{};el.innerHTML='<div class="v4-row-head"><div><div class="v4-row-title">'+esc(info.group_name||info.name||'群资料')+'</div><div class="v4-row-meta">'+esc(groupId())+'</div></div><span class="v4-tag">'+esc(bot.member_role||bot.role||'role ?')+'</span></div><div class="v4-sub" style="margin-top:8px">成员 '+esc(info.group_member_num||info.member_count||'—')+' · recv '+esc(bot.recv_msg_setting||'—')+'</div>'}
function renderMembers(r){var el=q('v4GroupMembers');if(!el)return;if(!r.ok){el.innerHTML='<div class="v4-empty v4-error">'+esc(r.error)+'</div>';return}var rows=arr(r.data&&r.data.result);el.innerHTML=rows.length?rows.map(function(m){var id=m.member_openid||m.openid||m.id||'';return'<div class="v4-row"><div class="v4-row-head"><div><div class="v4-row-title">'+esc(m.username||m.member_name||id)+'</div><div class="v4-row-meta">'+esc(id)+' · '+esc(m.member_role||m.role||'member')+'</div></div></div><div class="v4-inline"><input class="v4-input" data-mute-time="'+esc(id)+'" type="datetime-local"><button class="btn" data-mute="'+esc(id)+'">禁言</button><button class="btn" data-unmute="'+esc(id)+'">解禁</button></div><div class="v4-row-actions"><button class="btn" data-remove="'+esc(id)+'">移出</button><button class="btn danger" data-remove-black="'+esc(id)+'">移出并拉黑</button></div></div>'}).join(''):'<div class="v4-empty">没有成员资料，或接口尚未开放。</div>';bindMemberActions()}
function renderJoins(r){var el=q('v4GroupJoins');if(!el)return;if(!r.ok){el.innerHTML='<div class="v4-empty v4-error">'+esc(r.error)+'</div>';return}var rows=arr(r.data&&r.data.result);el.innerHTML=rows.length?rows.map(function(x){var id=x.member_openid||x.user_openid||'';var rid=x.join_request_id||x.request_id||'';return'<div class="v4-row"><div class="v4-row-title">'+esc(x.username||id)+'</div><div class="v4-row-meta">'+esc(id)+' · '+esc(rid)+'</div><div class="v4-row-meta">'+esc(x.verify_info||x.reason||'')+'</div><div class="v4-row-actions"><button class="btn primary" data-join-op="approve" data-member="'+esc(id)+'" data-request="'+esc(rid)+'">同意</button><button class="btn" data-join-op="decline" data-member="'+esc(id)+'" data-request="'+esc(rid)+'">拒绝</button><button class="btn danger" data-join-op="decline-black" data-member="'+esc(id)+'" data-request="'+esc(rid)+'">拒绝并拉黑</button></div></div>'}).join(''):'<div class="v4-empty">目前没有待处理申请。</div>';bindJoinActions()}
function renderBlacklist(r){var el=q('v4GroupBlacklist');if(!el)return;if(!r.ok){el.innerHTML='<div class="v4-empty v4-error">'+esc(r.error)+'</div>';return}var rows=arr(r.data&&r.data.result);el.innerHTML=rows.length?rows.map(function(x){var id=x.member_openid||x.openid||x.id||x;return'<div class="v4-row"><div class="v4-row-head"><div><div class="v4-row-title">'+esc(x.username||id)+'</div><div class="v4-row-meta">'+esc(id)+'</div></div><button class="btn" data-unblack="'+esc(id)+'">解除拉黑</button></div></div>'}).join(''):'<div class="v4-empty">黑名单为空或不可读取。</div>';bindBlacklistActions()}
function renderMutes(r){var el=q('v4GroupMutes');if(!el)return;if(!r.ok){el.innerHTML='<div class="v4-empty v4-error">'+esc(r.error)+'</div>';return}el.innerHTML='<div class="v4-console">'+esc(JSON.stringify(r.data&&r.data.result||{},null,2))+'</div>'}
async function post(path,body){return jsonReq('/api/portal/v4/qqopen'+path,'POST',body)}
function bindMemberActions(){
  document.querySelectorAll('[data-remove],[data-remove-black]').forEach(function(b){b.onclick=async function(){var id=b.dataset.remove||b.dataset.removeBlack;try{await post('/group/remove-members',{groupOpenid:groupId(),memberOpenids:[id],addToMemberBlacklist:!!b.dataset.removeBlack});await loadGroupAll()}catch(e){q('v4GroupNotice').textContent=String(e.message||e)}}});
  document.querySelectorAll('[data-mute]').forEach(function(b){b.onclick=async function(){var id=b.dataset.mute,t=document.querySelector('[data-mute-time="'+CSS.escape(id)+'"]');if(!t||!t.value){q('v4GroupNotice').textContent='请先选择禁言结束时间。';return}try{await post('/group/mute',{groupOpenid:groupId(),memberOpenid:id,op:'add',muteExpireAt:new Date(t.value).toISOString()});await loadGroupAll()}catch(e){q('v4GroupNotice').textContent=String(e.message||e)}}});
  document.querySelectorAll('[data-unmute]').forEach(function(b){b.onclick=async function(){try{await post('/group/mute',{groupOpenid:groupId(),memberOpenid:b.dataset.unmute,op:'del'});await loadGroupAll()}catch(e){q('v4GroupNotice').textContent=String(e.message||e)}}})
}
function bindJoinActions(){document.querySelectorAll('[data-join-op]').forEach(function(b){b.onclick=async function(){var op=b.dataset.joinOp;try{await post('/group/join-request',{groupOpenid:groupId(),memberOpenid:b.dataset.member,joinRequestId:b.dataset.request,op:op==='approve'?'approve':'decline',rejectReason:'未通过入群验证',addToMemberBlacklist:op==='decline-black'});await loadGroupAll()}catch(e){q('v4GroupNotice').textContent=String(e.message||e)}}})}
function bindBlacklistActions(){document.querySelectorAll('[data-unblack]').forEach(function(b){b.onclick=async function(){try{await post('/group/blacklist',{groupOpenid:groupId(),memberOpenids:[b.dataset.unblack],op:'del'});await loadGroupAll()}catch(e){q('v4GroupNotice').textContent=String(e.message||e)}}})}
function bindGroup(){
  if(q('v4GroupLoad')&&!q('v4GroupLoad').dataset.bound){q('v4GroupLoad').dataset.bound='1';q('v4GroupLoad').onclick=loadGroupAll}
  document.querySelectorAll('[data-v4-tab]').forEach(function(b){if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=function(){document.querySelectorAll('[data-v4-tab]').forEach(function(x){x.classList.toggle('active',x===b)});['members','joins','blacklist','mutes'].forEach(function(x){var el=q('v4Group'+x.charAt(0).toUpperCase()+x.slice(1));if(el)el.classList.toggle('hidden',x!==b.dataset.v4Tab)})}})
}
function bindTilt(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.querySelectorAll('.v4-tilt,.v4-card').forEach(function(el){if(el.dataset.tiltBound)return;el.dataset.tiltBound='1';el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform='perspective(900px) rotateX('+(-y*3)+'deg) rotateY('+(x*4)+'deg) translateY(-2px)'});el.addEventListener('pointerleave',function(){el.style.transform=''})})
}
async function init(){await loadViewer();applyLean();if(VIEWER.developer)refreshStatus();setInterval(function(){if(VIEWER.developer&&DEV_UNLOCKED)refreshStatus()},5000);new MutationObserver(function(){ensureLeanNav();ensureDeveloperGate()}).observe(q('nav')||document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;

  source = source.includes("</head>") ? source.replace("</head>", style + "\n</head>") : style + source;
  source = source.includes("</body>") ? source.replace("</body>", script + "\n</body>") : source + script;
  return source;
}

export { injectV4LeanPortalClient };
