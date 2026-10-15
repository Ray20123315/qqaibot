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
// Kept as a compatibility entry point for Abot and legacy Bbot callers.
// Online status of the local Codex Bridge NEVER changes the default chat model.
// Deliberately do not attempt a Luna fallback until a globally enforced
// concurrency gate, circuit breaker, and authorization checks are installed.
export async function generateWithCodexPreference(env,input){
 return generateWithExistingSecrets(env,input);
}
