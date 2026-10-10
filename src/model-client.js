// Secret names and request formats intentionally match the pre-refactor QQAIBOT.
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const unique=v=>[...new Set(String(v||"").split(",").map(x=>x.trim()).filter(Boolean))];
const allowModel=v=>/^[A-Za-z0-9_.-]{3,100}$/.test(v);
const endpoint="https://generativelanguage.googleapis.com/v1beta/models/";
function configuredModels(env,provider){
 const configured=provider==="deepseek" ? unique(env.DEEPSEEK_FLASH_MODEL) : unique(env.GEMINI_CHAT_MODELS);
 const candidates=configured.filter(allowModel);
 if(provider==="deepseek")return [...new Set([...(candidates.length?candidates.slice(0,1):[]),DEFAULT_DEEPSEEK_MODEL])];
 // Known compatible fallback, in case model list refers to preview/retired models.
 return [...new Set([...candidates.slice(0,1),DEFAULT_GEMINI_MODEL])].slice(0,2);
}
export function modelAvailability(env){
 return {gemini:unique(env.GEMINI_API_KEYS).length>0,deepseek:unique(env.DEEPSEEK_API_KEY).length>0,
  availableModels:{gemini:configuredModels(env,"gemini"),deepseek:configuredModels(env,"deepseek")}};
}
function sanitizeError(response){return new Error("MODEL_HTTP_"+String(response.status));}
function normalizeMessages(messages){
 return (Array.isArray(messages)?messages:[]).filter(m=>["system","user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.trim()).slice(-12);
}
export async function generateWithExistingSecrets(env,{provider="gemini",model="",messages,maxTokens=480}={},fetchImpl=fetch) {
 const input=normalizeMessages(messages);
 if(!input.some(m=>m.role==="user"))throw new Error("MODEL_INPUT_MISSING");
 const maxOutputTokens=Math.min(Math.max(128,Number(maxTokens)||650),1500);
 const selected=String(provider||"gemini").toLowerCase();
 if(!["gemini","deepseek"].includes(selected))throw new Error("MODEL_PROVIDER_INVALID");
 const list=unique(selected==="gemini"?env.GEMINI_API_KEYS:env.DEEPSEEK_API_KEY);
 if(!list.length)throw new Error("MODEL_SECRET_MISSING_"+selected.toUpperCase());
 const chosen=String(model||"").trim(),configured=configuredModels(env,selected);
 if(chosen&&!allowModel(chosen))throw new Error("MODEL_NAME_INVALID");
 // Explicit model is pinned: never silently bill another provider, only try different keys.
 const models=chosen?[chosen]:configured;
 let lastError=new Error("MODEL_UNAVAILABLE");
 for(const currentModel of models){
  for(const secret of list.slice(0,2)){
   try{
    if(selected==="gemini"){
     const system=input.filter(x=>x.role==="system").map(x=>x.content).join("\n");
     const contents=input.filter(x=>x.role!=="system").map(x=>({
      role:x.role==="assistant"?"model":"user",parts:[{text:x.content.slice(0,4000)}]
     }));
     const res=await fetchImpl(endpoint+encodeURIComponent(currentModel)+":generateContent",{
      method:"POST",headers:{"content-type":"application/json","x-goog-api-key":secret},
      body:JSON.stringify({contents,...(system?{systemInstruction:{parts:[{text:system.slice(0,1600)}]}}:{}),
       generationConfig:{maxOutputTokens,temperature:0.55}}),
      signal:AbortSignal.timeout(18000)
     });
     if(!res.ok){
      lastError=sanitizeError(res);
      if(res.status===429||res.status>=500)continue;
      if(res.status===400||res.status===404)break;
      continue;
     }
     const data=await res.json();
     if(data?.candidates?.[0]?.finishReason==="MAX_TOKENS")throw new Error("MODEL_INCOMPLETE_RESPONSE");
     const answer=(data?.candidates?.[0]?.content?.parts||[]).filter(x=>!x?.thought).map(x=>x.text||"").join("").trim();
     if(!answer)throw new Error("MODEL_EMPTY_RESPONSE");
     return {text:answer,provider:selected,model:currentModel};
    }
    const res=await fetchImpl("https://api.deepseek.com/chat/completions",{
     method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+secret},
     body:JSON.stringify({model:currentModel,messages:input.map(x=>({role:x.role,content:x.content.slice(0,4000)})),
      max_tokens:maxOutputTokens,temperature:0.55}),signal:AbortSignal.timeout(18000)
    });
    if(!res.ok){lastError=sanitizeError(res);if(res.status===400||res.status===404)break;continue;}
    const data=await res.json(),answer=String(data?.choices?.[0]?.message?.content||"").trim();
    if(data?.choices?.[0]?.finish_reason==="length")throw new Error("MODEL_INCOMPLETE_RESPONSE");
    if(!answer)throw new Error("MODEL_EMPTY_RESPONSE");
    return {text:answer.slice(0,1800),provider:selected,model:currentModel};
   }catch(e){
    lastError=/MODEL_SECRET|MODEL_INPUT/.test(String(e?.message))?e:new Error("MODEL_REQUEST_FAILED");
   }
  }
 }
 throw lastError;
}
