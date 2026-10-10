import {BBOT_HUB_ID} from "./bbot-hub.js";
import {generateWithExistingSecrets} from "./model-client.js";
export const CODEX_BRIDGE_PROTOCOL="qqai-codex-bridge-v1";
export const CODEX_LUNA_MODEL="gpt-6-luna";
export function codexWsRequest({messages,sessionKey,timeoutMs=35000}={}){
 const safe=String(sessionKey||"").slice(0,200);
 const content=(Array.isArray(messages)?messages:[]).filter(x=>["system","user","assistant"].includes(x.role)).slice(-10)
  .map(x=>({role:x.role,content:String(x.content||"").slice(0,4000)}));
 if(!safe||!content.some(x=>x.role==="user"))throw Error("CODEX_REQUEST_INVALID");
 return {protocol:CODEX_BRIDGE_PROTOCOL,type:"request",task:"chat",model:CODEX_LUNA_MODEL,
  reasoningEffort:"none",sessionKey:safe,messages:content,maxOutputTokens:900,
  timeoutMs:Math.max(1000,Math.min(60000,timeoutMs)),originalPromptOnly:false};
}
export async function generateWithCodexPreference(env,input){
 // Abot and Bbot do not directly expose private local bridge credentials.
 if(env.ONEBOT_HUB?.get && env.ONEBOT_HUB?.idFromName){
  try{
   const stub=env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName(BBOT_HUB_ID));
   const state=await stub.fetch("https://internal/codex/status");
   const online=state.ok && (await state.json())?.connected===true;
   if(online){
    const sessionRaw=[input.groupOpenid||input.groupId||"",input.userOpenid||input.userId||""].join(":");
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(sessionRaw));
    const sessionKey="qqaibot:ai:"+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,40);
    const request=codexWsRequest({messages:input.messages,sessionKey});
    const response=await stub.fetch("https://internal/codex/chat",{method:"POST",
     headers:{"content-type":"application/json"},body:JSON.stringify(request)});
    if(response.ok){
     const body=await response.json();
     if(body.ok===true && typeof body.text==="string" && body.text.trim())return {text:body.text,provider:"codex",model:CODEX_LUNA_MODEL};
    }
    console.warn("CODEX_LUNA_FALLBACK",response.status);
   }
  }catch(e){console.warn("CODEX_LUNA_FALLBACK","unavailable");}
 }
 return generateWithExistingSecrets(env,input);
}
