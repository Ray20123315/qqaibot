import {readModelConfig,listUnslothModels,saveModelConfig} from "./model-config.js";
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
  const config=await readModelConfig(env);
  if(!config.apiKey||!config.model)throw Error('MODEL_NOT_CONFIGURED');
  const res=await fetch('https://msiai.ray2025.com/v1/chat/completions',{method:'POST',redirect:'error',signal:timeouts(18000),headers:{'content-type':'application/json',authorization:'Bearer '+config.apiKey},
    body:JSON.stringify({model:config.model,stream:false,tools:[],tool_choice:'none',max_tokens:400,messages:[
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
const PAGE = "<!doctype html><html lang=\"zh-Hant\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>QQ AI · 模型選擇</title>\n<style>:root{font-family:system-ui,-apple-system,sans-serif}body{background:#f4f6fa;color:#182338;margin:0}main{max-width:760px;margin:5vh auto;padding:24px}section{background:white;border:1px solid #dce2ec;border-radius:14px;padding:24px;margin:16px 0}h1{font-size:26px}p{line-height:1.7;color:#536075}label{display:block;font-weight:600;margin:12px 0 6px}input,textarea,select{box-sizing:border-box;width:100%;font:inherit;border:1px solid #b5bfcd;border-radius:8px;padding:12px}button{background:#1f65dc;color:#fff;border:0;border-radius:8px;padding:11px 18px;font:inherit;cursor:pointer;margin:12px 8px 0 0}button:disabled{opacity:.55}pre{white-space:pre-wrap;word-break:break-word;background:#f0f4f8;padding:14px;border-radius:8px;min-height:40px}small{color:#67758a}</style></head><body><main><h1>QQ AI · Unsloth 模型選擇</h1>\n<p>Unsloth API Key 請放在 Cloudflare Worker 的 <strong>UNSLOTH_API_KEY Secret</strong>。此網頁不接受或儲存 API Key；只保存你選定的模型。</p>\n<section><h2>1. 管理員驗證</h2><label for=\"token\">管理金鑰（ADMIN_TOKEN）</label><input id=\"token\" type=\"password\" autocomplete=\"off\" placeholder=\"輸入 Cloudflare 管理金鑰\"></section>\n<section><h2>2. 讀取並選擇模型</h2><button id=\"discover\" type=\"button\">取得模型清單</button><label for=\"model\">選擇 Unsloth 模型</label><select id=\"model\" disabled><option value=\"\">請先取得模型清單</option></select><button id=\"save\" type=\"button\" disabled>儲存並套用</button>\n<pre id=\"result\" aria-live=\"polite\">尚未讀取模型。</pre><small>模型 ID 儲存至獨立 Cloudflare KV；API Key 僅供 Worker 從 Secret 讀取，不會放入 KV 或網頁。</small></section>\n<section><h2>3. 管理員 AI 測試</h2><form id=\"chat\"><label for=\"message\">測試問題</label><textarea id=\"message\" rows=\"3\" maxlength=\"1500\" required></textarea><button type=\"submit\">測試 AI</button></form><pre id=\"reply\" aria-live=\"polite\">尚未測試。</pre></section>\n<section><h2>設定狀態</h2><pre id=\"status\">載入中…</pre></section>\n</main><script>\nconst $=id=>document.getElementById(id);\nconst auth=()=>({'authorization':'Bearer '+$('token').value});\nconst explain=code=>{if(code==='UNSLOTH_SECRET_NOT_CONFIGURED')return '請先在 qqaibot-unsloth 的 Cloudflare Secrets 加入 UNSLOTH_API_KEY。';if(code==='MODEL_LIST_TIMEOUT')return 'Unsloth 在 12 秒內未回應。';if(code==='MODEL_LIST_CONNECTION_FAILED')return 'Worker 無法建立到 Unsloth 的連線；請檢查 Tunnel 與 Worker 同 Zone 路由。';if(code.startsWith('MODEL_LIST_REDIRECT_'))return '模型 API 發生重新導向。';if(code.startsWith('MODEL_LIST_HTTP_'))return '上游 API 回覆了 HTTP 狀態碼；401 請檢查 API Key，5xx 請檢查本機服務。';return '';};\nasync function send(path,opts={}){const r=await fetch(path,{...opts,headers:{...auth(),...(opts.headers||{})},cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'REQUEST_FAILED');return j;}\nasync function status(){try{const r=await fetch('/api/status',{cache:'no-store'}),d=await r.json();$('status').textContent='Worker：正常\\nUnsloth API Key Secret：'+(d.unsloth_key_configured?'已設定':'未設定')+'\\n目前模型：'+(d.model_configured?'已選擇':'未選擇')+'\\nQQ 憑證：'+(d.qq_configured?'已設定':'未設定')+'\\n管理金鑰：'+(d.admin_configured?'已設定':'未設定');}catch{$('status').textContent='狀態無法讀取';}}\nstatus();\n$('discover').addEventListener('click',async()=>{const button=$('discover'),result=$('result');button.disabled=true;$('model').disabled=true;$('save').disabled=true;result.textContent='正在讀取模型清單…';try{const d=await send('/api/models');$('model').replaceChildren();for(const name of d.models){const o=document.createElement('option');o.value=name;o.textContent=name;$('model').append(o);}if(d.selected&&d.models.includes(d.selected))$('model').value=d.selected;$('model').disabled=false;$('save').disabled=false;result.textContent='取得 '+d.models.length+' 個模型，請選擇後按儲存。';}catch(e){result.textContent='取得失敗：'+e.message+'\\n'+explain(e.message);}finally{button.disabled=false;}});\n$('save').addEventListener('click',async()=>{const button=$('save'),result=$('result');button.disabled=true;result.textContent='正在套用…';try{const d=await send('/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:$('model').value})});result.textContent='已儲存模型：'+d.model+'。QQ 和管理員聊天將使用這個模型。';await status();}catch(e){result.textContent='儲存失敗：'+e.message+'\\n'+explain(e.message);}finally{button.disabled=false;}});\n$('chat').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button'),out=$('reply');button.disabled=true;out.textContent='處理中…';try{const d=await send('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:$('message').value})});out.textContent=d.reply;}catch(e){out.textContent='測試失敗：'+e.message;}finally{button.disabled=false;}});\n</script></body></html>";
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
    if(request.method==='GET'&&pathname==='/api/status')return json({status:'ok',qq_configured:!!(env.QQ_APP_ID&&env.QQ_APP_SECRET),unsloth_key_configured:!!env.UNSLOTH_API_KEY,model_configured:!!(await env.CONFIG_KV?.get("selected-model-v2")||env.UNSLOTH_MODEL),admin_configured:!!env.ADMIN_TOKEN,command_execution:false});

    if(pathname==='/api/models'||pathname==='/api/settings') {
      const listing=pathname==='/api/models';
      if((listing&&request.method!=='GET')||(!listing&&!['GET','POST'].includes(request.method)))return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      try {
        const current=await readModelConfig(env);
        if(listing)return json({models:await listUnslothModels(env),selected:current.model});
        if(request.method==='GET')return json({model:current.model,saved:current.saved,configured:!!(current.apiKey&&current.model)});
        if(Number(request.headers.get('content-length'))>8192)return json({error:'TOO_LARGE'},413);
        const data=await request.json().catch(()=>null);
        if(!data||typeof data!=='object'||'api_key' in data)return json({error:'INVALID_REQUEST'},400);
        return json(await saveModelConfig(env,text(data.model)));
      } catch(error) {
        const reason=String(error?.message||'').replace(/[^A-Z0-9_]/g,'').slice(0,55);
        const ok=/^(UNSLOTH_SECRET_NOT_CONFIGURED|INVALID_SAVED_MODEL|INVALID_MODEL_SELECTION|MODEL_STORAGE_UNAVAILABLE|MODEL_NOT_IN_LIST|NO_MODELS_AVAILABLE|INVALID_MODEL_LIST|MODEL_LIST_TIMEOUT|MODEL_LIST_CONNECTION_FAILED|MODEL_LIST_REDIRECT_[0-9]{3}|MODEL_LIST_HTTP_[0-9]{3})$/.test(reason);
        const code=ok?reason:'MODEL_CONFIGURATION_FAILED';
        return json({error:code},/^MODEL_LIST_/.test(code)?502:code==='UNSLOTH_SECRET_NOT_CONFIGURED'?503:400);
      }
    }
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
