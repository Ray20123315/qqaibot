function resourceConnectPage() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>AIBot 安全連接</title>
<style>
:root{font-family:Inter,"Noto Sans TC",system-ui,sans-serif;color:#16181d;background:#f5f6f8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,rgba(115,125,255,.16),transparent 35%),radial-gradient(circle at 85% 75%,rgba(72,208,188,.12),transparent 30%),#f5f6f8}
.shell{width:min(720px,100%);background:rgba(255,255,255,.88);backdrop-filter:blur(22px);border:1px solid rgba(20,24,32,.08);border-radius:28px;box-shadow:0 24px 80px rgba(27,36,52,.12);overflow:hidden}
.head{padding:28px 30px 18px}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55}.head h1{margin:8px 0 8px;font-size:30px}.head p{margin:0;opacity:.68;line-height:1.65}
.content{padding:12px 30px 30px}.notice{padding:14px 16px;border-radius:16px;background:rgba(80,95,140,.08);line-height:1.6;margin-bottom:18px}
.field{margin:14px 0}.field label{display:block;font-size:13px;font-weight:700;margin-bottom:7px}.field input{width:100%;padding:13px 14px;border:1px solid rgba(30,40,55,.14);border-radius:14px;background:rgba(255,255,255,.74);font:inherit;outline:none}.field input:focus{border-color:#7079ff;box-shadow:0 0 0 4px rgba(112,121,255,.12)}
.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choice,.btn{appearance:none;border:0;border-radius:14px;padding:13px 16px;font:inherit;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.choice{background:rgba(30,40,55,.06);text-align:left}.choice.active{background:#242a3a;color:#fff;box-shadow:0 10px 24px rgba(36,42,58,.18)}.choice:hover,.btn:hover{transform:translateY(-1px)}.btn{width:100%;margin-top:18px;background:#242a3a;color:#fff;font-weight:700}.btn[disabled]{opacity:.45;cursor:not-allowed;transform:none}
.small{font-size:12px;opacity:.62;line-height:1.6;margin-top:12px}.hidden{display:none}.status{font-weight:650}.success{background:rgba(36,166,116,.11)}.error{background:rgba(210,70,70,.10)}
@media(max-width:560px){.choices{grid-template-columns:1fr}.head,.content{padding-left:20px;padding-right:20px}.head h1{font-size:25px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<main class="shell">
  <section class="head"><div class="eyebrow">AIBot Secure Connect</div><h1>安全連接資源</h1><p>完整金鑰只會在這次 HTTPS 提交中送到 AIBot，成功後不再顯示。</p></section>
  <section class="content">
    <div id="notice" class="notice">正在確認登入狀態與安全連結…</div>
    <form id="form" class="hidden" autocomplete="off">
      <div id="aiFields" class="hidden">
        <div class="field"><label>AI 服務</label><div class="choices" id="aiChoices">
          <button type="button" class="choice active" data-value="google_gemini">Gemini</button>
          <button type="button" class="choice" data-value="openai_api">OpenAI</button>
          <button type="button" class="choice" data-value="deepseek">DeepSeek</button>
          <button type="button" class="choice" data-value="openai_compatible">相容服務</button>
        </div></div>
        <div class="field"><label>顯示名稱</label><input id="aiLabel" value="我的 AI" maxlength="120"></div>
        <div class="field"><label>API Key</label><input id="aiSecret" type="password" maxlength="4096" autocomplete="new-password"></div>
      </div>
      <div id="storageFields" class="hidden">
        <div class="field"><label>資料儲存</label><div class="choices" id="storageChoices">
          <button type="button" class="choice active" data-value="cloudflare_d1">Cloudflare D1</button>
          <button type="button" class="choice" data-value="cloudflare_kv">Cloudflare KV</button>
        </div></div>
        <div class="field"><label>顯示名稱</label><input id="storageLabel" value="我的資料儲存" maxlength="120"></div>
        <div class="field"><label>Cloudflare Account ID</label><input id="accountId" maxlength="64"></div>
        <div class="field"><label id="resourceLabel">Database ID</label><input id="resourceId" maxlength="96"></div>
        <div class="field"><label>Cloudflare API Token</label><input id="storageSecret" type="password" maxlength="4096" autocomplete="new-password"></div>
      </div>
      <button id="submit" class="btn" type="submit">安全儲存</button>
      <p class="small">請只授予所需的最小權限。AIBot 不會在設定頁、私訊回覆或一般日誌重新顯示完整憑證。</p>
    </form>
  </section>
</main>
<script>
(function(){
  const ticket=new URLSearchParams(location.search).get('ticket')||'';
  const notice=document.getElementById('notice'),form=document.getElementById('form');
  const aiFields=document.getElementById('aiFields'),storageFields=document.getElementById('storageFields');
  let kind='',aiProvider='google_gemini',storageType='cloudflare_d1';
  function setChoice(root,value){root.querySelectorAll('.choice').forEach(b=>b.classList.toggle('active',b.dataset.value===value))}
  document.getElementById('aiChoices').onclick=e=>{const b=e.target.closest('.choice');if(!b)return;aiProvider=b.dataset.value;setChoice(e.currentTarget,aiProvider)};
  document.getElementById('storageChoices').onclick=e=>{const b=e.target.closest('.choice');if(!b)return;storageType=b.dataset.value;setChoice(e.currentTarget,storageType);document.getElementById('resourceLabel').textContent=storageType==='cloudflare_d1'?'Database ID':'Namespace ID'};
  async function api(path,method,body){const r=await fetch('/api/portal/v4/resources'+path,{method:method||'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});let data={};try{data=await r.json()}catch{}return{status:r.status,data}}
  async function init(){
    if(!ticket){notice.textContent='安全連結不完整。';notice.classList.add('error');return}
    const r=await api('/ticket?ticket='+encodeURIComponent(ticket));
    if(r.status===401){notice.innerHTML='請先登入 AIBot 後臺，再重新開啟這個安全連結。 <a href="/">前往登入</a>';return}
    if(!r.data.ok){notice.textContent=r.data.message||'安全連結不可用。';notice.classList.add('error');return}
    if(r.data.claimRequired){const c=await api('/ticket/claim','POST',{ticket});if(!c.data.ok){notice.textContent=c.data.message||'無法綁定目前登入帳號。';notice.classList.add('error');return}}
    kind=r.data.kind;notice.textContent=kind==='ai'?'新增你自己的 AI 服務。':'連接你自己的資料儲存。';form.classList.remove('hidden');(kind==='ai'?aiFields:storageFields).classList.remove('hidden')
  }
  form.onsubmit=async e=>{
    e.preventDefault();const btn=document.getElementById('submit');btn.disabled=true;notice.className='notice';notice.textContent='正在安全儲存…';
    let payload;
    if(kind==='ai'){payload={ticket,kind:'ai',secret:document.getElementById('aiSecret').value,config:{provider:aiProvider,label:document.getElementById('aiLabel').value,tasks:['chat']}}}
    else{payload={ticket,kind:'storage',secret:document.getElementById('storageSecret').value,config:{type:storageType,label:document.getElementById('storageLabel').value,accountId:document.getElementById('accountId').value,resourceId:document.getElementById('resourceId').value,purposes:['settings','memory','chat_history','plugin_data']}}}
    const r=await api('/consume','POST',payload);payload.secret='';if(r.data.ok){form.reset();form.classList.add('hidden');notice.textContent=r.data.message||'已完成。';notice.classList.add('success')}else{notice.textContent=r.data.message||'設定失敗。';notice.classList.add('error');btn.disabled=false}
  };
  init();
})();
</script>
</body>
</html>`;
}

export { resourceConnectPage };
