import {BRIDGE_ECHO_MARKER} from "./core.js";
import {sendGroup,sendMedia} from "./qq-api.js";
import {classifyAbotFailure,decideFallback} from "./relay.js";
export async function sendUsingBbot(env,id,groupId,segments){
  if(!groupId||!env.ONEBOT_HUB)throw new Error("BBOT_TARGET_UNAVAILABLE");
  const stub=env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("bridge-bbot"));
  const response=await stub.fetch("https://internal/send",{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({id,groupId,segments})});
  const info=await response.json();
  if(!response.ok||!info?.ok)throw new Error("BBOT_"+(info?.reason||"SEND_FAILED"));
  return info;
}
export async function deliver(env,item,{sendBbot=sendUsingBbot,sendText=sendGroup,sendAttachment=sendMedia}={}){
 const operation=JSON.parse(item.payload||"{}");
 let abotError=null;
 try{
  if(operation.kind==="text"){
   await sendText(env,item.target_group,operation.content+BRIDGE_ECHO_MARKER);
  } else if(operation.kind==="media"){
   await sendAttachment(env,item.target_group,operation);
  } else {
   // Native-only QQ proprietary emoji / replies cannot be encoded faithfully by the public API.
   throw Object.assign(new Error("ABOT_NATIVE_FORMAT_UNAVAILABLE"),{status:415});
  }
  return {status:"sent_abot",path:"abot"};
 }catch(e){
  abotError=e;
 }
 const failure=classifyAbotFailure(abotError);
 const mode=String(env.BRIDGE_BBOT_FALLBACK||"on-rejection");
 const canFallback=!!item.target_qq_group_id;
 if(!decideFallback({mode,failure,bbotAvailable:canFallback})){
  return {status:failure==="ambiguous"?"failed_ambiguous":"failed",
   path:"abot",error:String(abotError).slice(0,180)};
 }
 try{
  await sendBbot(env,item.id,item.target_qq_group_id,operation.segments);
  return {status:"sent_bbot",path:"bbot",error:String(abotError).slice(0,180)};
 }catch(e){
  return {status:"failed_ambiguous",path:"bbot",error:("Abot: "+String(abotError)+"; Bbot: "+String(e)).slice(0,180)};
 }
}
