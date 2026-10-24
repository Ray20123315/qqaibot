import {readModelConfig,listUnslothModels,saveModelConfig} from "./model-config.js";
import {DASHBOARD_HTML} from "./dashboard.js";
import {scopeKey,appendMessage,loadContext,getMemoryStats,contextBudget} from "./conversation-memory.js";
import {roomDatabase} from "./qq-memory-room.js";
export {QQMemoryRoom} from "./qq-memory-room.js";
import {lookupSupport,citationContext,uploadPublicDocument,listPublicDocuments} from "./support-knowledge.js";
import {commandResult,parseCommand} from "./qq-commands.js";
import {handleModeCommand,readModes} from "./qq-modes.js";
import {qqImageAttachments,imagePartFromQQ} from "./qq-image.js";
import {abusiveRepeatRequest,safeReplyText,isHtmlRequest,HTML_GROUP_NOT_SUPPORTED,userTopicBoundary,politicalScopeReply} from "./qq-output-policy.js";
import {markdownPayload,plainPayload,rejectedMarkdown} from "./qq-format.js";
import {getConfig as getRoles,setConfig as setRoles,chat as chatWithRoles,speech as ttsWithRoles,transcribe as asrWithRoles} from "./role-router.js";
import {adminAllowed,sessionRoute} from "./session-auth.js";
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
  // QQ OpenID is opaque: do not silently drop valid identifiers containing +, / or =.
  if(!target||target.length>256||/[\u0000-\u001f\u007f]/.test(target))return null;
  const message=limited(d.content).replace(/<@!?[\w-]+>/g,'').trim();
  const author=text(isGroup?(d.author?.member_openid||d.author?.user_openid||d.author?.id):target);
  const images=qqImageAttachments(d);
  const hadImage=!!(Array.isArray(d.attachments)&&d.attachments.some(x=>/^image\//.test(String(x?.content_type||x?.contentType||''))));
  return {isGroup,target,id:text(d.id),author,images,hadImage,message:message||(hadImage?'请描述这张图片':'')};
}
let tokenCache={value:'',expires:0};
const sanitizedProviderCode = value => {
  const code=String(value??'');
  return /^[0-9]{1,8}$/.test(code)&&code!=='0'?code:'';
};
async function qqToken(env) {
  if(tokenCache.value&&Date.now()<tokenCache.expires)return tokenCache.value;
  let response;
  try {
    response=await fetch('https://api.bot.qq.com/app/getAppAccessToken',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({appId:env.QQ_APP_ID,clientSecret:env.QQ_APP_SECRET}),
      signal:timeouts(8000),redirect:'manual'
    });
  } catch(err) {
    if(err?.name==='TimeoutError'||err?.name==='AbortError')throw Error('QQ_AUTH_TIMEOUT');
    throw Error('QQ_AUTH_FETCH_FAILED');
  }
  if(response.status>=300&&response.status<400)throw Error('QQ_AUTH_REDIRECT_'+response.status);
  if(!response.ok)throw Error('QQ_AUTH_HTTP_'+response.status);
  let data;
  try {data=await response.json();}catch{throw Error('QQ_AUTH_INVALID_RESPONSE');}
  if(!data?.access_token){
    const code=sanitizedProviderCode(data?.code);
    throw Error(code?'QQ_AUTH_CODE_'+code:'QQ_AUTH_INVALID_RESPONSE');
  }
  const ttl=Number(data.expires_in||7200);
  if(!Number.isFinite(ttl)||ttl<=0)throw Error('QQ_AUTH_INVALID_RESPONSE');
  tokenCache={value:data.access_token,expires:Date.now()+Math.max(60,ttl-300)*1000};
  return tokenCache.value;
}
async function sendQQ(env,event,answer) {
  const route=event.isGroup?'groups':'users';
  const token=await qqToken(env);
  const url='https://api.bot.qq.com/v2/'+route+'/'+encodeURIComponent(event.target)+'/messages';
  async function send(body){
    let response;
    try {
      response=await fetch(url,{
        method:'POST',redirect:'manual',signal:timeouts(8000),
        headers:{authorization:'QQBot '+token,'content-type':'application/json'},
        body:JSON.stringify(body)
      });
    }catch(err){
      // Unknown send outcome: never retry a failed network operation.
      if(err?.name==='TimeoutError'||err?.name==='AbortError')throw Error('QQ_SEND_TIMEOUT');
      throw Error('QQ_SEND_FETCH_FAILED');
    }
    if(response.status>=300&&response.status<400)throw Error('QQ_SEND_REDIRECT_'+response.status);
    if(!response.ok)return {accepted:false,response,code:''};
    let result;
    try{result=await response.json();}catch{throw Error('QQ_SEND_INVALID_RESPONSE');}
    const code=sanitizedProviderCode(result?.err_code??result?.code);
    return {accepted:!code,response,code};
  }
  const markdownDisabled=(await env.CONFIG_KV?.get('qq-markdown-denied-v1').catch(()=>null))==='1';
  if(!markdownDisabled){
    const rich=await send(markdownPayload(answer,event.id));
    if(rich.accepted)return;
    if(!rejectedMarkdown(rich.response,rich.code)){
      if(rich.code)throw Error('QQ_SEND_CODE_'+rich.code);
      throw Error('QQ_SEND_HTTP_'+rich.response.status);
    }
    // Cache explicit Markdown rejection; avoid repeated failed rich-text probes per message.
    try{await env.CONFIG_KV?.put('qq-markdown-denied-v1','1',{expirationTtl:86400});}catch{}
  }
  const plain=await send(plainPayload(answer,event.id,markdownDisabled?1:2));
  if(!plain.accepted){
    if(plain.code)throw Error('QQ_SEND_CODE_'+plain.code);
    throw Error('QQ_SEND_HTTP_'+plain.response.status);
  }
}
export async function queryModel(env,message,{timeoutMs=60_000,history=[],summary='',knowledge='',modes={},image=null}={}) {
  try {
    const result=await chatWithRoles(env,message,fetch,{timeout:timeoutMs,history,summary,knowledge,modes,image});
    return result.text.slice(0,1500);
  }catch(err){
    // Preserve the existing MODEL_* public diagnostic codes for QQ and old admin clients.
    const reason=String(err?.message||'');
    const mapped={
      UPSTREAM_TIMEOUT:'MODEL_TIMEOUT',
      UPSTREAM_CONNECTION_FAILED:'MODEL_CONNECTION_FAILED',
      UPSTREAM_INVALID_JSON:'MODEL_INVALID_RESPONSE',
      UPSTREAM_EMPTY_RESPONSE:'MODEL_EMPTY_RESPONSE',
      UPSTREAM_EMPTY_STREAM:'MODEL_EMPTY_RESPONSE',
      CHAT_NOT_CONFIGURED:'MODEL_NOT_CONFIGURED',
    }[reason] || (reason.match(/^UPSTREAM_(HTTP|REDIRECT)_([0-9]{3})$/)?.[0]||'').replace('UPSTREAM_','MODEL_');
    if(mapped)throw Error(mapped);
    throw err;
  }
}
// Keep only coarse delivery stages, UTC time and sanitized reason codes (no QQ IDs/messages/secrets).
const qqDiagnosticStages=['callback_verify','callback_rejected','event_received','event_ignored','model_failed','send_failed','reply_sent'];
const diagnosticCode=(err)=>{
  const value=String(err?.message||'').replace(/[^A-Z0-9_]/g,'').slice(0,48);
  return /^(MODEL_(NOT_CONFIGURED|TIMEOUT|CONNECTION_FAILED|EMPTY_RESPONSE|INVALID_RESPONSE|HTTP_[0-9]{3}|REDIRECT_[0-9]{3})|CHAT_NOT_CONFIGURED|UPSTREAM_(TIMEOUT|CONNECTION_FAILED|TOO_LONG|EMPTY_STREAM|EMPTY_RESPONSE|INVALID_JSON|HTTP_[0-9]{3}|REDIRECT_[0-9]{3})|QQ_(AUTH|SEND)_(HTTP_[0-9]{3}|REDIRECT_[0-9]{3}|TIMEOUT|FETCH_FAILED|INVALID_RESPONSE|CODE_[0-9]{1,8}|API_REJECTED))$/.test(value)?value:'UNKNOWN';
};
async function recordQQ(env,stage,code='OK') {
  if(!qqDiagnosticStages.includes(stage)||!env.CONFIG_KV)return;
  // Best effort: KV may throttle writes to the same stage at high request rates.
  try{await env.CONFIG_KV.put('qqdiag-v1:'+stage,JSON.stringify({at:new Date().toISOString(),code}),{expirationTtl:86400});}catch{}
}
async function readQQDiagnostics(env) {
  const stages=await Promise.all(qqDiagnosticStages.map(async(stage)=>{
    try {
      const raw=await env.CONFIG_KV?.get('qqdiag-v1:'+stage);
      if(!raw)return null;
      const info=JSON.parse(raw);
      if(typeof info.at!=='string'||typeof info.code!=='string')return null;
      return {stage,at:info.at.slice(0,30),code:info.code.slice(0,48)};
    }catch{return null;}
  }));
  return stages.filter(Boolean).sort((a,b)=>b.at.localeCompare(a.at));
}
const recent=new Map();
function firstSeen(id) {
  const now=Date.now();
  if(recent.size>300)for(const [key,t] of recent)if(now-t>10*60_000)recent.delete(key);
  if(recent.has(id)&&now-recent.get(id)<10*60_000)return false;
  recent.set(id,now);return true;
}
export async function processEvent(env,event) {
  if(!event.message) {
    await recordQQ(env,'event_ignored','EMPTY_MESSAGE');
    return;
  }
  let scope=null,state=null,db=null;
  if(env.CHAT_ROOMS){
    try{
      scope=await scopeKey(env,event);
      db=roomDatabase(env,scope);
      await appendMessage(db,scope,event.id,'user',event.message);
      const window=Number(await env.CONFIG_KV?.get('context-window-v1'))||16384;
      state=await loadContext(db,scope,{window});
    }catch(err){
      console.error('QQ_MEMORY_READ_FAILED',String(err?.message||'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,36));
      scope=null;state=null; // QQ text must still reply when memory database is unavailable.
    }
  }
  let answer;
  const mode=await handleModeCommand(env,event).catch(()=>({handled:true,text:'设置暂时无法保存，请稍后再试。'}));
  if(mode?.handled)answer=mode.text;
  if(!answer&&abusiveRepeatRequest(event.message))answer='为了避免刷屏，我不能一次发送大量重复字符。你可以要求简短示例，或用单行代码表示。';
  if(!answer&&userTopicBoundary(event.message))answer=politicalScopeReply;
  if(!answer&&isHtmlRequest(event.message)&&event.isGroup)answer=HTML_GROUP_NOT_SUPPORTED;
  const parsed=parseCommand(event.message);
  if(parsed&&!answer){
    let stats=null;
    if(scope&&(parsed.name==='上下文'||parsed.name==='总结')){
      try{stats=await getMemoryStats(db,scope);}catch{}
    }
    const cmd=commandResult(event.message,{stats,summary:state?.summary||''});
    if(cmd.handled)answer=cmd.text;
  }
  if(!answer){
    if(/^[!/$>]/.test(event.message)&&!/^\/(?:search|web)(?:\s|$)/.test(event.message)){
      answer='该指令目前不可用。输入 /帮助 查看已开放的功能。';
    }else {
      try {
        let knowledge='';
        if(env.SUPPORT_SEARCH&&/(HRS|MFL|客服|订单|权限|支付|付费|登录|购买|订阅|使用|报错|帮助)/i.test(event.message)){
          try{knowledge=citationContext(await lookupSupport(env,event.message));}
          catch{ /* Knowledge index failure must not break QQ text chat. */ }
        }
        const history=(state?.messages||[]).filter(row=>row.seq!==state?.lastSeq);
        const modes=await readModes(env,event);
        if(event.hadImage&&!event.images?.length)throw Error('QQ_IMAGE_UNAVAILABLE');
        const image=event.images?.length?await imagePartFromQQ(event.images[0]):null;
        answer=await queryModel(env,event.message,{timeoutMs:23_000,history,summary:state?.summary||'',knowledge,modes,image});
      }catch(err){
        const reason=diagnosticCode(err);
        await recordQQ(env,'model_failed',reason);
        answer=String(err?.message||'').startsWith('QQ_IMAGE_')?'暂时无法读取这张图片。请使用 QQ 正常发送 JPG、PNG 或 WebP 图片，再试一次。':'客服暂时无法完成回复（'+reason+'），请稍后再试。';
      }
    }
  }
  try {
    await sendQQ(env,event,safeReplyText(answer));
    await recordQQ(env,'reply_sent','OK');
    if(scope){
      try{
        await appendMessage(db,scope,event.id+':reply','assistant',answer);
        // Scoped Durable Object schedules non-destructive compaction after QQ reply.
      }catch(err){console.error('QQ_MEMORY_WRITE_FAILED',String(err?.message||'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,36));}
    }
  }catch(err) {
    await recordQQ(env,'send_failed',diagnosticCode(err));
    throw err;
  }
}
function page(){return new Response(DASHBOARD_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'",'x-frame-options':'DENY','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
export default {
  async fetch(request,env,ctx) {
    const pathname=new URL(request.url).pathname;
    if(request.method==='GET'&&pathname==='/')return page();
    if(pathname==='/api/session')return sessionRoute(request,env);
    if(request.method==='GET'&&pathname==='/api/status')return json({status:'ok',qq_configured:!!(env.QQ_APP_ID&&env.QQ_APP_SECRET),unsloth_key_configured:!!env.UNSLOTH_API_KEY,model_configured:!!(await env.CONFIG_KV?.get("selected-model-v2")||env.UNSLOTH_MODEL),admin_configured:!!env.ADMIN_TOKEN,command_execution:false});

    if(pathname==='/api/qq/diagnostics') {
      if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      return json({qq_configured:!!(env.QQ_APP_ID&&env.QQ_APP_SECRET),events:await readQQDiagnostics(env)});
    }

    if(pathname==='/api/knowledge'){
      if(!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      try{
        if(request.method==='GET')return json({documents:await listPublicDocuments(env),visibility:'PUBLIC_SUPPORT'});
        if(Number(request.headers.get('content-length'))>4*1024*1024+16000)return json({error:'TOO_LARGE'},413);
        if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))return json({error:'INVALID_KNOWLEDGE_FILE'},400);
        const form=await request.formData().catch(()=>null);
        return json(await uploadPublicDocument(env,form?.get('file')));
      }catch(err){
        const code=err?.message==='INVALID_KNOWLEDGE_FILE'?'INVALID_KNOWLEDGE_FILE':'KNOWLEDGE_UNAVAILABLE';
        return json({error:code},code==='INVALID_KNOWLEDGE_FILE'?400:503);
      }
    }
    if(pathname==='/api/context'){
      if(!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      if(request.method==='GET'){
        const configured=Number(await env.CONFIG_KV?.get('context-window-v1'))||16384;
        return json({...contextBudget(configured),modelCeiling:262144,actualStudioWindowVerified:false,
          memoryEnabled:!!env.CHAT_ROOMS,nonDestructiveCompaction:true});
      }
      const data=await request.json().catch(()=>null);
      const window=Number(data?.window);
      if(!Number.isInteger(window)||window<4096||window>262144)return json({error:'INVALID_WINDOW'},400);
      if(!env.CONFIG_KV)return json({error:'STORAGE_UNAVAILABLE'},503);
      await env.CONFIG_KV.put('context-window-v1',String(window));
      return json({...contextBudget(window),actualStudioWindowVerified:false});
    }

    if(pathname==='/api/model-roles'){
      if(!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      try{
        if(request.method==='GET')return json(await getRoles(env));
        if(Number(request.headers.get('content-length'))>4096)return json({error:'TOO_LARGE'},413);
        const data=await request.json().catch(()=>null);
        return json(await setRoles(env,data));
      }catch(e){
        const reason=e?.message;
        return json({error:reason==='INVALID_ROLE_CONFIG'?reason:'ROLE_SETTINGS_FAILED'},400);
      }
    }
    if(pathname==='/api/audio/speech'){
      if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      if(Number(request.headers.get('content-length'))>4096)return json({error:'TOO_LARGE'},413);
      const data=await request.json().catch(()=>null);
      try{return await ttsWithRoles(env,data?.text);}
      catch(e){
        const code=String(e?.message||'');
        const ok=/^(TTS_NOT_CONFIGURED|INVALID_SPEECH_TEXT|UPSTREAM_(TIMEOUT|CONNECTION_FAILED|INVALID_AUDIO|AUDIO_TOO_LARGE|HTTP_[0-9]{3}|REDIRECT_[0-9]{3}))$/.test(code);
        return json({error:ok?code:'AUDIO_UNAVAILABLE'},502);
      }
    }
    if(pathname==='/api/audio/transcriptions'){
      if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!await adminAllowed(request,env))return json({error:'UNAUTHORIZED'},401);
      const size=Number(request.headers.get('content-length'));
      if(size>8*1024*1024+20000)return json({error:'TOO_LARGE'},413);
      if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))return json({error:'INVALID_AUDIO_UPLOAD'},400);
      const form=await request.formData().catch(()=>null);
      const file=form?.get('file');
      try{return json(await asrWithRoles(env,file));}
      catch(e){
        const code=String(e?.message||'');
        const ok=/^(ASR_NOT_CONFIGURED|INVALID_AUDIO_UPLOAD|UPSTREAM_(TIMEOUT|CONNECTION_FAILED|INVALID_JSON|INVALID_TRANSCRIPTION|HTTP_[0-9]{3}|REDIRECT_[0-9]{3}))$/.test(code);
        return json({error:ok?code:'ASR_UNAVAILABLE'},502);
      }
    }

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
        const saved=await saveModelConfig(env,text(data.model));
        const roles=await getRoles(env);
        if(roles.saved)await setRoles(env,{chat:saved.model,asr:roles.asr,tts:roles.tts,webSearch:roles.webSearch});
        return json(saved);
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
      try{return json({reply:/^[!/$>]/.test(message)&&!/^\/(?:search|web)(?:\s|$)/.test(message)?'该指令目前不可用。输入 /帮助 查看已开放的功能。':await queryModel(env,message)});}
      catch(err){
        const reason=String(err?.message||'').replace(/[^A-Z0-9_]/g,'').slice(0,45);
        const approved=/^(MODEL_NOT_CONFIGURED|INVALID_SAVED_MODEL|MODEL_TIMEOUT|MODEL_CONNECTION_FAILED|MODEL_REDIRECT_[0-9]{3}|MODEL_HTTP_[0-9]{3}|MODEL_INVALID_RESPONSE|MODEL_EMPTY_RESPONSE|CHAT_NOT_CONFIGURED|UPSTREAM_(TIMEOUT|CONNECTION_FAILED|TOO_LONG|EMPTY_STREAM|EMPTY_RESPONSE|INVALID_JSON|HTTP_[0-9]{3}|REDIRECT_[0-9]{3}))$/.test(reason);
        const code=approved?reason:'MODEL_UNAVAILABLE';
        console.error('QQ_AI_CHAT_FAILED',code);
        return json({error:code},code==='MODEL_NOT_CONFIGURED'?503:502);
      }
    }
    if(pathname==='/webhook') {
      if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      const note=(stage,code)=>ctx.waitUntil(recordQQ(env,stage,code));
      if(!env.QQ_APP_ID||!env.QQ_APP_SECRET)return json({error:'QQ_NOT_CONFIGURED'},503);
      if(request.headers.get('X-Bot-Appid')!==env.QQ_APP_ID){note('callback_rejected','INVALID_APP');return json({error:'INVALID_APP'},403);}
      if(Number(request.headers.get('content-length'))>64*1024)return json({error:'TOO_LARGE'},413);
      const raw=await request.text();
      if(raw.length>64*1024)return json({error:'TOO_LARGE'},413);
      const payload=(()=>{try{return JSON.parse(raw);}catch{return null;}})();
      if(!payload)return json({error:'BAD_JSON'},400);
      if(payload.op===13) {
        const token=payload.d?.plain_token,ts=payload.d?.event_ts;
        if(typeof token!=='string'||!token||token.length>256||!/^\d{10,13}$/.test(String(ts||'')))return json({error:'BAD_CHALLENGE'},400);
        const signature=await qqSignature(env.QQ_APP_SECRET,String(ts)+token);
        note('callback_verify','OK');
        return json({plain_token:token,signature});
      }
      if(!await checkWebhookSignature(request,raw,env)){note('callback_rejected','INVALID_SIGNATURE');return json({error:'INVALID_SIGNATURE'},403);}
      const event=eventToChat(payload);
      if(event){
        note('event_received',event.isGroup?'GROUP_AT':'C2C');
        if(firstSeen(payload.t+':'+event.id))ctx.waitUntil(processEvent(env,event).catch(err=>console.error('QQ_AI_DELIVERY_FAILED',diagnosticCode(err))));
      }else note('event_ignored','UNSUPPORTED_OR_INVALID_EVENT');
      return json({op:12});
    }
    return json({error:'NOT_FOUND'},404);
  }
};
