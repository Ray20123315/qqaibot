/** Manage one encrypted Unsloth key and model for this standalone Worker. */
const enc = new TextEncoder();
const dec = new TextDecoder();
const STORAGE_KEY = "model-configuration-v1";
const MODELS_URL = "https://msiai.ray2025.com/v1/models";
const cipherKey = async env => {
  if (!env.ADMIN_TOKEN) throw Error("ADMIN_NOT_CONFIGURED");
  // Domain-separated key derived from high-entropy ADMIN_TOKEN (configured as a Worker Secret).
  const seed = await crypto.subtle.digest("SHA-256", enc.encode("qqaibot-unsloth/config/v1:" + env.ADMIN_TOKEN));
  return crypto.subtle.importKey("raw", seed, {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
};
function decode64(str) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length>4096) throw Error("INVALID_CONFIG");
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
const encode64 = arr => btoa(Array.from(arr, b=>String.fromCharCode(b)).join(""));
const usableKey = value => typeof value==="string" && value.trim().length>=8 && value.trim().length<=512 && !/[\r\n]/.test(value);
const usableModel = value => typeof value==="string" && value.length>0 && value.length<=256 && !/[\u0000-\u001f\u007f]/.test(value);

export async function readModelConfig(env) {
  const encrypted = await env.CONFIG_KV?.get(STORAGE_KEY);
  if (!encrypted) return {apiKey:env.UNSLOTH_API_KEY||"",model:env.UNSLOTH_MODEL||"",saved:false};
  try {
    const blob=JSON.parse(encrypted);
    if(blob.v!==1 || !blob.iv || !blob.data)throw Error("INVALID_CONFIG");
    const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode64(blob.iv)},await cipherKey(env),decode64(blob.data));
    const info=JSON.parse(dec.decode(clear));
    if(!usableKey(info.apiKey)||!usableModel(info.model))throw Error("INVALID_CONFIG");
    return {apiKey:info.apiKey,model:info.model,saved:true};
  } catch {throw Error("SAVED_CONFIG_UNAVAILABLE");}
}
export async function listUnslothModels(apiKey, fetcher=fetch) {
  if (!usableKey(apiKey)) throw Error("API_KEY_REQUIRED");
  let response;
  try {
    response=await fetcher(MODELS_URL, {
      method:"GET",headers:{authorization:"Bearer "+apiKey,"accept":"application/json"},
      signal:AbortSignal.timeout(12000),redirect:"manual"
    });
  } catch (err) {
    if(err?.name==="TimeoutError"||err?.name==="AbortError")throw Error("MODEL_LIST_TIMEOUT");
    // Do not expose fetch error.message or its cause: they can contain headers, URLs or local paths.
    throw Error("MODEL_LIST_CONNECTION_FAILED");
  }
  if(response.status>=300&&response.status<400)throw Error("MODEL_LIST_REDIRECT_"+response.status);
  if(!response.ok)throw Error("MODEL_LIST_HTTP_"+response.status);
  let payload;
  try { payload=await response.json(); } catch {throw Error("INVALID_MODEL_LIST");}
  if(!Array.isArray(payload?.data))throw Error("INVALID_MODEL_LIST");
  const ids=[...new Set(payload.data.map(item=>item?.id).filter(usableModel))];
  if(!ids.length)throw Error("NO_MODELS_AVAILABLE");
  return ids.slice(0,200);
}
export async function saveModelConfig(env,apiKey,model,fetcher=fetch) {
  if(!env.CONFIG_KV||!env.ADMIN_TOKEN)throw Error("MODEL_STORAGE_UNAVAILABLE");
  if(!usableModel(model))throw Error("INVALID_MODEL_SELECTION");
  const available=await listUnslothModels(apiKey,fetcher);
  if(!available.includes(model))throw Error("MODEL_NOT_IN_LIST");
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plaintext=enc.encode(JSON.stringify({apiKey,model}));
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},await cipherKey(env),plaintext);
  await env.CONFIG_KV.put(STORAGE_KEY,JSON.stringify({
    v:1,iv:encode64(iv),data:encode64(new Uint8Array(ciphertext))
  }));
  return {model,saved:true};
}
