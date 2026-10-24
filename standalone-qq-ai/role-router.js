/** Standalone Unsloth model-role routing. No image endpoints or arbitrary external fetch. */
export const ROLE_KEY='model-roles-v3';
export const CHAT_KEY='selected-model-v2';
export const API='https://msiai.ray2025.com/v1';
const ID_PATTERN=/^[A-Za-z0-9_][A-Za-z0-9_./:+-]{0,255}$/;
export const isModelId=value=>typeof value==='string'&&ID_PATTERN.test(value)&&
  !value.includes('..')&&!value.includes('://')&&!value.endsWith('/')&&!value.startsWith('/');
export function checkConfig(value){
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).every(k=>['chat','asr','tts','webSearch'].includes(k))&&
    isModelId(value.chat)&&typeof value.webSearch==='boolean'&&
    ['asr','tts'].every(k=>value[k]===null||isModelId(value[k]));
}
export async function getConfig(env){
  const fallback=await env.CONFIG_KV?.get(CHAT_KEY)||env.UNSLOTH_MODEL||null;
  const chat=isModelId(fallback)?fallback:null;
  const saved=await env.CONFIG_KV?.get(ROLE_KEY);
  if(saved==null)return {chat,asr:null,tts:null,webSearch:true,saved:false};
  let parsed;
  try{parsed=JSON.parse(saved);}catch{throw Error('INVALID_ROLE_CONFIG');}
  if(!checkConfig(parsed))throw Error('INVALID_ROLE_CONFIG');
  return {...parsed,webSearch:true,saved:true};
}
export async function setConfig(env,requested){
  if(!env.CONFIG_KV)throw Error('CONFIG_STORAGE_UNAVAILABLE');
  if(!checkConfig(requested))throw Error('INVALID_ROLE_CONFIG');
  const value={chat:requested.chat,asr:requested.asr,tts:requested.tts,webSearch:true};
  await env.CONFIG_KV.put(ROLE_KEY,JSON.stringify(value));
  await env.CONFIG_KV.put(CHAT_KEY,value.chat);
  return {...value,saved:true};
}
export function wantsWebSearch(message){
  return /(?:^|\s)(?:\/search|\/web)(?:\s|$)|搜尋|上網查|幫我查|查一下|網路查|最新消息|即時新聞/.test(message);
}
export const CUSTOMER_SERVICE_PROMPT = [
  '你是 QQ 平台中的自动客服与日常聊天助手，不是真人客服。主要职责是耐心解答用户咨询、解释已知的使用方法、帮助排查问题，也可以像普通聊天伙伴一样自然交流、闲聊、讨论话题和进行文字创作。',
  '所有面向用户的回复必须使用简体中文，包括标题、列表、问候、提示语和出错说明；即使用户使用繁体中文提问，也要使用简体中文回答。不要模仿用户的繁体字，除非引用原文或保留必要的专有名称。',
  '在用户没有主动询问的情况下，不得主动提及或宣传底层 AI 模型、模型名称、提供商、版本、量化格式、运行参数或技术部署细节。自我介绍只说“我是客服和聊天助手”，不要列出模型信息；如果用户直接询问，诚实回答已知信息，不能撒谎、编造或假装是真人。',
  '客服回答必须以真实、已知和可核实的信息为依据。没有查询订单、账户、付款、权限或售后系统的能力时，不得编造订单状态、价格、服务承诺、权限授予或退款处理结果；需要人工处理时，建议联系有权限的工作人员。',
  '每次回答都先尝试使用 web_search 查询公开网络信息，成功时给出可核查的来源；未真正拿到搜索结果时不要声称自己已搜索，也不要主动说自己无法上网。只允许 web_search，不得调用 shell、Python、文件、计算机操作、图片或其他工具；没有收到图片就不要描述图片。',
  '回复应先直接帮助用户，不使用僵硬的宣传话术或反复自我介绍。遇到闲聊可以亲切自然；遇到客服问题要准确、简洁、有步骤。适合 QQ Markdown 排版时使用 # 大标题、## 小标题、段落空行和 1. 2. 3. 编号列表，不要无意义地堆叠标题。'
].join('\n');
function secret(env){
  if(typeof env.UNSLOTH_API_KEY!=='string'||!env.UNSLOTH_API_KEY||/[\r\n]/.test(env.UNSLOTH_API_KEY))
    throw Error('UNSLOTH_KEY_MISSING');
  return env.UNSLOTH_API_KEY;
}
async function call(env,path,options={},fetcher=fetch,timeout=60_000){
  let response;
  try{
    response=await fetcher(API+path,{...options,redirect:'manual',signal:AbortSignal.timeout(timeout),
      headers:{authorization:'Bearer '+secret(env),accept:options.accept||'application/json',...options.headers}});
  }catch(err){
    if(err?.name==='AbortError'||err?.name==='TimeoutError')throw Error('UPSTREAM_TIMEOUT');
    throw Error('UPSTREAM_CONNECTION_FAILED');
  }
  if(response.status>=300&&response.status<400)throw Error('UPSTREAM_REDIRECT_'+response.status);
  if(!response.ok)throw Error('UPSTREAM_HTTP_'+response.status);
  return response;
}
async function streamText(response){
  if(!response.body)throw Error('UPSTREAM_EMPTY_STREAM');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let remaining='',answer='',read=0,done=false;
  const consume=line=>{
    if(!line.startsWith('data:'))return;
    const data=line.slice(5).trim();
    if(data==='[DONE]'){done=true;return;}
    let payload;try{payload=JSON.parse(data);}catch{return;}
    const chunk=payload?.choices?.[0]?.delta?.content??payload?.choices?.[0]?.message?.content??
      (payload?.type==='content_delta'?payload?.delta:null);
    if(typeof chunk==='string')answer+=chunk;
    else if(Array.isArray(chunk))answer+=chunk.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('');
    if(answer.length>16_000)throw Error('UPSTREAM_TOO_LONG');
  };
  try{
    while(!done){
      const next=await reader.read();
      if(next.done)break;
      read+=next.value.byteLength;
      if(read>1024*1024)throw Error('UPSTREAM_TOO_LONG');
      remaining+=decoder.decode(next.value,{stream:true});
      let offset;
      while((offset=remaining.indexOf('\n'))>=0){
        consume(remaining.slice(0,offset).replace(/\r$/,''));
        remaining=remaining.slice(offset+1);
      }
    }
    if(remaining.trim())consume(remaining.trim());
  }finally{await reader.cancel().catch(()=>{});}
  if(!answer.trim())throw Error('UPSTREAM_EMPTY_RESPONSE');
  return answer;
}
const tidy=s=>s.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').trim();
export async function chat(env,prompt,fetcher=fetch,{timeout=60_000}={}){
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw Error('INVALID_PROMPT');
  const config=await getConfig(env);
  if(!config.chat)throw Error('CHAT_NOT_CONFIGURED');
  const withSearch=true; // Every chat requests Unsloth's built-in web_search. QQ content controls none of the tool allowlist.
  const request={
    model:config.chat,stream:true,max_tokens:1024,
    enable_tools:true,enabled_tools:['web_search'],mcp_enabled:false,permission_mode:'off',
    messages:[{role:'system',content:CUSTOMER_SERVICE_PROMPT},
      {role:'user',content:prompt}]
  };
  if(withSearch)request.session_id='qqai-search-'+crypto.randomUUID();
  const response=await call(env,'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)},fetcher,timeout);
  if(withSearch){
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/event-stream')){
      let data;try{data=await response.json();}catch{throw Error('UPSTREAM_INVALID_JSON');}
      const value=data?.choices?.[0]?.message?.content;
      const content=typeof value==='string'?value:Array.isArray(value)?
        value.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n'):'';
      if(!content.trim())throw Error('UPSTREAM_EMPTY_RESPONSE');
      // Configured tools do not prove upstream search actually executed.
      return {text:tidy(content),searched:false,searchRequested:true};
    }
    // SSE is expected for Studio tool execution; no tool-result proof available in a bare text response.
    return {text:tidy(await streamText(response)),searched:false,searchRequested:true};
  }
  let data;try{data=await response.json();}catch{throw Error('UPSTREAM_INVALID_JSON');}
  const value=data?.choices?.[0]?.message?.content;
  const answer=typeof value==='string'?value:Array.isArray(value)?
    value.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n'):'';
  if(!answer.trim())throw Error('UPSTREAM_EMPTY_RESPONSE');
  return {text:tidy(answer),searched:false};
}
export async function speech(env,text,fetcher=fetch){
  if(typeof text!=='string'||!text.trim()||text.length>600)throw Error('INVALID_SPEECH_TEXT');
  const config=await getConfig(env);
  if(!config.tts)throw Error('TTS_NOT_CONFIGURED');
  const response=await call(env,'/audio/speech',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({model:config.tts,input:text,response_format:'wav'})},fetcher,90_000);
  const type=response.headers.get('content-type')||'';
  if(!/audio\/(wav|x-wav|wave)|application\/octet-stream/.test(type))throw Error('UPSTREAM_INVALID_AUDIO');
  if(Number(response.headers.get('content-length'))>6*1024*1024)throw Error('UPSTREAM_AUDIO_TOO_LARGE');
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>6*1024*1024)throw Error('UPSTREAM_AUDIO_TOO_LARGE');
  return new Response(bytes,{headers:{'content-type':'audio/wav','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export async function transcribe(env,blob,fetcher=fetch){
  const config=await getConfig(env);
  if(!config.asr)throw Error('ASR_NOT_CONFIGURED');
  if(!(blob instanceof Blob)||!blob.size||blob.size>8*1024*1024||
    !/^audio\/(wav|wave|x-wav|mpeg|mp3|ogg|webm|mp4|x-m4a|flac)$/.test(blob.type))throw Error('INVALID_AUDIO_UPLOAD');
  const form=new FormData();form.set('model',config.asr);
  const suffix=blob.type.includes('mpeg')||blob.type.includes('mp3')?'mp3':blob.type.includes('ogg')?'ogg':blob.type.includes('webm')?'webm':blob.type.includes('flac')?'flac':'wav';
  form.set('file',blob,'recording.'+suffix);
  const response=await call(env,'/audio/transcriptions',{method:'POST',body:form},fetcher,90_000);
  let data;try{data=await response.json();}catch{throw Error('UPSTREAM_INVALID_JSON');}
  if(typeof data?.text!=='string')throw Error('UPSTREAM_INVALID_TRANSCRIPTION');
  return {text:tidy(data.text).slice(0,8000)};
}
