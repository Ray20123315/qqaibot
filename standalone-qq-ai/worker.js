/** QQ official Webhook -> Unsloth text-only chat. No command/tool execution. */
const enc = new TextEncoder();
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const PKCS8_PREFIX = Uint8Array.from('302e020100300506032b657004220420'.match(/../g), x => parseInt(x, 16));
const text = value => typeof value === 'string' ? value.trim() : '';
const limited = value => text(value).slice(0, 1500);
const timeouts = (ms=18000) => AbortSignal.timeout(ms);
async function qqSigningKey(secret) {
  const original = enc.encode(secret);
  if (!original.length) throw Error('MISSING_BOT_SECRET');
  const seed = new Uint8Array(32);
  for (let i=0;i<32;i++) seed[i]=original[i%original.length];
  const der = new Uint8Array(PKCS8_PREFIX.length+seed.length);
  der.set(PKCS8_PREFIX);der.set(seed,PKCS8_PREFIX.length);
  return crypto.subtle.importKey('pkcs8',der,'Ed25519',false,['sign']);
}
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
async function qqSignature(secret,message) { return hex(await crypto.subtle.sign('Ed25519',await qqSigningKey(secret),enc.encode(message))); }
function timingEqual(a,b) {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function checkWebhookSignature(request,body,env) {
  const signature=request.headers.get('X-Signature-Ed25519')||'';
  const timestamp=request.headers.get('X-Signature-Timestamp')||'';
  if(!/^[a-fA-F0-9]{128}$/.test(signature)||!/^\d{10,13}$/.test(timestamp))return false;
  const seconds=Number(timestamp.length===13?Number(timestamp)/1000:timestamp);
  if(!Number.isFinite(seconds)||Math.abs(Date.now()/1000-seconds)>300)return false;
  return timingEqual(signature.toLowerCase(),await qqSignature(env.QQ_APP_SECRET,timestamp+body));
}
function eventToChat(payload) {
  if(payload?.op!==0||!['GROUP_AT_MESSAGE_CREATE','C2C_MESSAGE_CREATE'].includes(payload?.t))return null;
  const d=payload.d;
  if(!d||typeof d!=='object'||!text(d.id))return null;
  const isGroup=payload.t==='GROUP_AT_MESSAGE_CREATE';
  const target=isGroup?text(d.group_openid):text(d.author?.user_openid||d.author?.id||d.user_openid);
  if(!/^[a-zA-Z0-9_-]{8,160}$/.test(target))return null;
  const message=limited(d.content).replace(/<@!?[\w-]+>/g,'').trim();
  return {isGroup,target,id:text(d.id),message};
}
let tokenCache={value:'',expires:0};
async function qqToken(env) {
  if(tokenCache.value&&Date.now()<tokenCache.expires)return tokenCache.value;
  const response=await fetch('https://api.bot.qq.com/app/getAppAccessToken',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appId:env.QQ_APP_ID,clientSecret:env.QQ_APP_SECRET}),signal:timeouts(8000),redirect:'error'});
  if(!response.ok)throw Error('QQ_AUTH_HTTP_'+response.status);
  const data=await response.json();
  if(!data.access_token)throw Error('QQ_AUTH_INVALID_RESPONSE');
  tokenCache={value:data.access_token,expires:Date.now()+Math.max(60,Number(data.expires_in||7200)-300)*1000};
  return tokenCache.value;
}
async function sendQQ(env,event,answer) {
  const route=event.isGroup?'groups':'users';
  const token=await qqToken(env);
  const response=await fetch('https://api.bot.qq.com/v2/'+route+'/'+encodeURIComponent(event.target)+'/messages',{method:'POST',redirect:'error',signal:timeouts(8000),headers:{authorization:'QQBot '+token,'content-type':'application/json'},body:JSON.stringify({msg_type:0,content:answer,msg_id:event.id,msg_seq:1})});
  if(!response.ok)throw Error('QQ_SEND_HTTP_'+response.status);
  const result=await response.json();
  if(result.err_code||result.code)throw Error('QQ_SEND_API_REJECTED');
}
export async function queryModel(env,message) {
  if(!env.UNSLOTH_API_KEY||!env.UNSLOTH_MODEL)throw Error('MODEL_NOT_CONFIGURED');
  const res=await fetch('https://msiai.ray2025.com/v1/chat/completions',{method:'POST',redirect:'error',signal:timeouts(18000),headers:{'content-type':'application/json',authorization:'Bearer '+env.UNSLOTH_API_KEY},
    body:JSON.stringify({model:env.UNSLOTH_MODEL,stream:false,tools:[],tool_choice:'none',max_tokens:400,messages:[
      {role:'system',content:'你是 QQ 上的純文字聊天 AI。簡潔、友善並按使用者語言回答。你沒有工具或執行權限，不能執行指令、操作電腦、存取檔案或呼叫外部服務。不要聲稱已經執行任何操作。'},
      {role:'user',content:message}
    ]})
  });
  if(!res.ok)throw Error('MODEL_HTTP_'+res.status);
  const data=await res.json();
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())throw Error('MODEL_EMPTY_RESPONSE');
  return content.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,1500);
}
const recent=new Map();
function firstSeen(id) {
  const now=Date.now();
  if(recent.size>300)for(const [key,t] of recent)if(now-t>10*60_000)recent.delete(key);
  if(recent.has(id)&&now-recent.get(id)<10*60_000)return false;
  recent.set(id,now);return true;
}
export async function processEvent(env,event) {
  if(!event.message)return;
  const answer=/^[!/$>]/.test(event.message)?'這是純文字聊天機器人，無法執行指令。':await queryModel(env,event.message);
  await sendQQ(env,event,answer);
}
const PAGE = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>QQ AI · Unsloth</title><style>
:root{font-family:system-ui,-apple-system,sans-serif;color-scheme:light}body{background:#f4f6fa;color:#182338;margin:0}main{max-width:740px;margin:7vh auto;padding:24px}section{background:#fff;border:1px solid #dce2ec;border-radius:16px;padding:24px;margin:16px 0;box-shadow:0 4px 24px #192b4709}h1{font-size:26px}p{line-height:1.7;color:#536075}label{display:block;font-weight:600;margin:12px 0 6px}input,textarea{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #b5bfcd;border-radius:8px}button{background:#1f65dc;color:#fff;border:none;border-radius:8px;padding:11px 19px;font:inherit;cursor:pointer;margin-top:12px}button:disabled{opacity:.55}pre{white-space:pre-wrap;word-break:break-word;border-radius:8px;background:#f0f4f8;padding:16px;min-height:46px}small{color:#67758a}</style></head><body><main><h1>QQ AI · Unsloth</h1><p>獨立的 QQ 官方 Webhook 文字聊天服務。沒有系統指令、檔案操作或 AI 工具執行權限。</p><section><h2>服務狀態</h2><pre id="status">讀取中…</pre><small>狀態只顯示是否已設定金鑰，不會洩露金鑰內容。</small></section><section><h2>管理員聊天測試</h2><p>測試會直接呼叫 Unsloth；不會發送 QQ 訊息。管理金鑰不會被儲存在瀏覽器。</p><form id="chat"><label for="token">管理金鑰（ADMIN_TOKEN）</label><input type="password" id="token" autocomplete="off" required><label for="message">問題</label><textarea id="message" rows="4" maxlength="1500" required></textarea><button type="submit">測試 AI</button></form><pre id="reply" aria-live="polite">尚未發送。</pre></section></main><script>
(async()=>{try{const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();document.getElementById('status').textContent='Worker：正常\\nQQ 憑證：'+(d.qq_configured?'已設定':'尚未設定')+'\\nUnsloth：'+(d.model_configured?'已設定':'尚未設定')+'\\n管理介面：'+(d.admin_configured?'已啟用':'尚未設定');}catch{document.getElementById('status').textContent='狀態無法取得';}})();
document.getElementById('chat').addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button'),out=document.getElementById('reply');btn.disabled=true;out.textContent='處理中…';try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+document.getElementById('token').value},body:JSON.stringify({message:document.getElementById('message').value})});const d=await r.json();out.textContent=r.ok?d.reply:(d.error||'請求失敗');}catch{out.textContent='網路或模型服務無法使用';}finally{btn.disabled=false;}});
</script></body></html>`;
function page(){return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'",'x-frame-options':'DENY','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
async function adminAllowed(request,env) {
  if(!env.ADMIN_TOKEN)return false;
  const auth=request.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>1024)return false;
  const actual=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(auth.slice(7))));
  const expected=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(env.ADMIN_TOKEN)));
  let diff=0;for(let i=0;i<32;i++)diff|=actual[i]^expected[i];
  return diff===0;
}
export default {
  async fetch(request,env,ctx) {
    const pathname=new URL(request.url).pathname;
    if(request.method==='GET'&&pathname==='/')return page();
    if(request.method==='GET'&&pathname==='/api/status')return json({status:'ok',qq_configured:!!(env.QQ_APP_ID&&env.QQ_APP_SECRET),model_configured:!!(env.UNSLOTH_API_KEY&&env.UNSLOTH_MODEL),admin_configured:!!env.ADMIN_TOKEN,command_execution:false});
    if(pathname==='/api/chat') {
      if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      if(Number(request.headers.get('content-length'))>8192)return json({error:'TOO_LARGE'},413);
      const data=await request.json().catch(()=>null);
      const message=text(data?.message);
      if(!message||message.length>1500)return json({error:'INVALID_MESSAGE'},400);
      try{return json({reply:/^[!/$>]/.test(message)?'這是純文字聊天機器人，無法執行指令。':await queryModel(env,message)});}
      catch{return json({error:'MODEL_UNAVAILABLE'},502);}
    }
    if(pathname==='/webhook') {
      if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!env.QQ_APP_ID||!env.QQ_APP_SECRET)return json({error:'QQ_NOT_CONFIGURED'},503);
      if(request.headers.get('X-Bot-Appid')!==env.QQ_APP_ID)return json({error:'INVALID_APP'},403);
      if(Number(request.headers.get('content-length'))>64*1024)return json({error:'TOO_LARGE'},413);
      const raw=await request.text();
      if(raw.length>64*1024)return json({error:'TOO_LARGE'},413);
      const payload=(()=>{try{return JSON.parse(raw);}catch{return null;}})();
      if(!payload)return json({error:'BAD_JSON'},400);
      if(payload.op===13) {
        const token=payload.d?.plain_token,ts=payload.d?.event_ts;
        if(typeof token!=='string'||!token||token.length>256||!/^\d{10,13}$/.test(String(ts||'')))return json({error:'BAD_CHALLENGE'},400);
        return json({plain_token:token,signature:await qqSignature(env.QQ_APP_SECRET,String(ts)+token)});
      }
      if(!await checkWebhookSignature(request,raw,env))return json({error:'INVALID_SIGNATURE'},403);
      const event=eventToChat(payload);
      if(event&&firstSeen(payload.t+':'+event.id))ctx.waitUntil(processEvent(env,event).catch(err=>console.error('QQ_AI_DELIVERY_FAILED',String(err?.message||'UNKNOWN').slice(0,60))));
      return json({op:12});
    }
    return json({error:'NOT_FOUND'},404);
  }
};
