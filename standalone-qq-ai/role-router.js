/** Standalone Unsloth role settings. Model IDs only; no image processing or credentials. */
export const ROLES_KEY="model-roles-v3";
export const LEGACY_CHAT_KEY="selected-model-v2";
const validId = x=>typeof x==="string"&&x.length>0&&x.length<=256&&/^[a-zA-Z0-9_./:+-]+$/.test(x)&&!x.includes("..")&&!x.includes("://");
export const validateRoles = x=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).every(k=>["chat","asr","tts","webSearch"].includes(k))&&validId(x.chat)&&(x.asr===null||validId(x.asr))&&(x.tts===null||validId(x.tts))&&typeof x.webSearch==="boolean";
export async function getRoles(env){
  const fallback=await env.CONFIG_KV?.get(LEGACY_CHAT_KEY)||env.UNSLOTH_MODEL||null;
  const raw=await env.CONFIG_KV?.get(ROLES_KEY);
  if(!raw)return {chat:validId(fallback)?fallback:null,asr:null,tts:null,webSearch:false,saved:false};
  let x;try{x=JSON.parse(raw);}catch{throw Error("INVALID_ROLE_CONFIG");}
  if(!validateRoles(x))throw Error("INVALID_ROLE_CONFIG");
  return {...x,saved:true};
}
export async function setRoles(env,x){
  if(!env.CONFIG_KV)throw Error("MODEL_STORAGE_UNAVAILABLE");
  if(!validateRoles(x))throw Error("INVALID_ROLE_CONFIG");
  const saved={chat:x.chat,asr:x.asr,tts:x.tts,webSearch:x.webSearch};
  await env.CONFIG_KV.put(ROLES_KEY,JSON.stringify(saved));
  await env.CONFIG_KV.put(LEGACY_CHAT_KEY,saved.chat);
  return {...saved,saved:true};
}
export const shouldSearch=message=>/(?:^|\s)\/(?:search|web)(?:\s|$)|搜尋|上網查|幫我查|查一下|網路查|最新消息|即時新聞/.test(message);
