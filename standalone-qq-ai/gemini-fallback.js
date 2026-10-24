/** Gemini text/image backup for the existing local Unsloth chat route. */
const HOST='https://generativelanguage.googleapis.com/v1beta/models/';
const MODEL=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/;
export function fallbackReady(env){
 return typeof env.GEMINI_API_KEY==='string'&&env.GEMINI_API_KEY.length>=8&&!/[\r\n]/.test(env.GEMINI_API_KEY)&&MODEL.test(String(env.GEMINI_FALLBACK_MODEL||''));
}
export function retryableLocalError(err){
 return /^(UPSTREAM_(TIMEOUT|CONNECTION_FAILED|INVALID_JSON|EMPTY_RESPONSE|EMPTY_STREAM|HTTP_(429|500|502|503|504)))$/.test(String(err?.message||''));
}
function toParts(content){
 if(typeof content==='string')return [{text:content}];
 if(!Array.isArray(content))throw Error('GEMINI_INVALID_MESSAGE');
 return content.map(part=>{
  if(part?.type==='text'&&typeof part.text==='string')return {text:part.text};
  if(part?.type==='image_url'){
   const value=String(part?.image_url?.url||'');
   const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
   if(!match||match[2].length>3000000)throw Error('GEMINI_INVALID_IMAGE');
   return {inline_data:{mime_type:match[1],data:match[2]}};
  }
  throw Error('GEMINI_INVALID_MESSAGE');
 });
}
export async function geminiChat(env,messages,fetcher=fetch,{timeout=10000,withSearch=false}={}){
 if(!fallbackReady(env))throw Error('GEMINI_FALLBACK_NOT_CONFIGURED');
 const rules=[],contents=[];
 for(const m of messages){
  if(m?.role==='system'&&typeof m.content==='string'){rules.push(m.content.slice(0,16000));continue;}
  if(m?.role==='user'||m?.role==='assistant')contents.push({role:m.role==='user'?'user':'model',parts:toParts(m.content)});
 }
 if(!contents.length)throw Error('GEMINI_EMPTY_REQUEST');
 const allowGrounding=withSearch&&env.GEMINI_SEARCH_GROUNDING==='true';
 const body={systemInstruction:{parts:[{text:rules.join('\n').slice(0,24000)||'你是 QQ 聊天助手。'}]},contents,
  generationConfig:{maxOutputTokens:1024},store:false,...(allowGrounding?{tools:[{googleSearch:{}}]}:{})};
 let response;
 try{response=await fetcher(HOST+encodeURIComponent(env.GEMINI_FALLBACK_MODEL)+':generateContent',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(timeout),
  headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify(body)});}
 catch(e){throw Error(e?.name==='AbortError'||e?.name==='TimeoutError'?'GEMINI_TIMEOUT':'GEMINI_CONNECTION_FAILED');}
 if(response.status>=300&&response.status<400)throw Error('GEMINI_REDIRECT');
 if(!response.ok)throw Error('GEMINI_HTTP_'+response.status);
 let data;try{data=await response.json();}catch{throw Error('GEMINI_INVALID_RESPONSE');}
 const text=(data?.candidates?.[0]?.content?.parts||[]).filter(x=>typeof x?.text==='string').map(x=>x.text).join('');
 if(!text.trim()||text.length>16000)throw Error('GEMINI_EMPTY_RESPONSE');
 const grounded=Array.isArray(data?.candidates?.[0]?.groundingMetadata?.groundingChunks)&&data.candidates[0].groundingMetadata.groundingChunks.length>0;
 return {text:text.trim(),usedFallback:true,searched:grounded,searchRequested:withSearch};
}
