// All bridge transmissions must use the authenticated NapCat/Bbot OneBot connection.
// QQ Open Platform/Abot is deliberately disabled until the user opts back in.
export async function sendUsingBbot(env,id,groupId,segments) {
 if(!groupId||!env.ONEBOT_HUB)throw new Error("BBOT_TARGET_UNAVAILABLE");
 const stub=env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("bridge-bbot-napcat-v2"));
 const response=await stub.fetch("https://internal/send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,groupId,segments})});
 const info=await response.json();
 if(!response.ok||!info?.ok)throw new Error("BBOT_"+(info?.reason||"SEND_FAILED"));
 return info;
}
export async function deliver(env,item,{sendBbot=sendUsingBbot}={}) {
 // Do not attempt QQ official API for any destination, even a historical real OpenID.
 if(!item?.target_qq_group_id)return {status:"failed",path:"bbot",error:"TARGET_QQ_GROUP_UNKNOWN"};
 let operation;
 try{operation=JSON.parse(item.payload||"{}");}catch{return {status:"failed",path:"bbot",error:"INVALID_PAYLOAD"};}
 if(!Array.isArray(operation?.segments)||!operation.segments.length)return {status:"failed",path:"bbot",error:"NO_ONEBOT_SEGMENTS"};
 try{
  await sendBbot(env,item.id,item.target_qq_group_id,operation.segments);
  return {status:"sent_bbot",path:"bbot"};
 }catch(e){
  // OneBot ACK timeout is ambiguous. Do not replay automatically.
  return {status:"failed_ambiguous",path:"bbot",error:String(e).slice(0,180)};
 }
}
