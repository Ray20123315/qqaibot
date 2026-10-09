import {BRIDGE_ECHO_MARKER,authorize,clean,qq,isProtected} from "./core.js";
import {get,all,run,digest,makeCode,roster,groupByQq} from "./store.js";
import {sendUsingBbot} from "./delivery.js";

export const NAPCAT_GROUP_PREFIX="napcat:";
export function isNapcatGroup(openid){return String(openid||"").startsWith(NAPCAT_GROUP_PREFIX);}
export function napcatGroupKey(groupId){const id=qq(groupId);if(!id)throw new Error("INVALID_GROUP");return NAPCAT_GROUP_PREFIX+id;}
export const NAPCAT_HELP="跨群橋接（NapCat）\n!use 建立連線\n!連線碼 簡寫 加入連線\n!status 查看狀態\n!code 重設邀請碼\n!rename 名稱、!stop、!resume、!leave、!revoke\n!grant QQ號 manage|stop|both、!ungrant QQ號\n也支援 /! 前綴；不必使用 QQ 舊指令面板。";

async function respond(env,msg,text,reply) {
  const body=String(text).slice(0,1700);
  if(reply){try{await reply(body+BRIDGE_ECHO_MARKER);return true;}
    catch(e){console.error("BBOT_COMMAND_REPLY_FAILED",String(e).slice(0,180));return false;}}
  try{
    const id="cmd-"+crypto.randomUUID();
    await sendUsingBbot(env,id,msg.groupId,[{type:"text",data:{text:body+BRIDGE_ECHO_MARKER}}]);
    return true;
  }catch(e){console.error("BBOT_COMMAND_REPLY_FAILED",String(e).slice(0,180));return false;}
}
async function permission(env,msg,action) {
  const view=await roster(env.DB,msg.groupId);
  if(!view.fresh)return {ok:false,reason:"Bbot 尚未取得新鮮群員名單，請稍後重試"};
  const member=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
  if(!member)return {ok:false,reason:"無法在本群成員名單確認你的 QQ 號"};
  const scopes=await all(env.DB,"SELECT scope FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
  // Joining or creating a connection is NOT disabling the Bot. Group owners
  // and admins may do this even when a protected QQ account is present;
  // protected-account restrictions still apply to stop/leave/revoke and grants.
  if(action==="join"||action==="use"){
    const allowed=isProtected(msg.senderQq)||["owner","admin"].includes(member.role)||
      scopes.some(x=>x.scope==="manage");
    return allowed?{ok:true}:{ok:false,reason:"只有本群群主、管理員或獲授權成員可以建立／加入橋接"};
  }
  return authorize({actor:msg.senderQq,role:member.role,protectedPresent:view.protectedPresent,
    rosterFresh:view.fresh,scopes:scopes.map(x=>x.scope),action});
}
const cleanAlias=value=>clean(value||"",25).replace(/[<>[\]]/g,"");
const groupDisplay=msg=>cleanAlias(msg.groupName)||"QQ群 "+msg.groupId;

export async function handleNapcatCommand(env,msg,command,reply) {
  const respondText=text=>respond(env,msg,text,reply);
  const name=command.name;
  if(name==="help")return {handled:true,reply:await respondText(NAPCAT_HELP)};
  const group=await groupByQq(env.DB,msg.groupId);
  if(name==="status"){
    if(!group?.verified)return {handled:true,reply:await respondText("本群未連線。\n群主、管理員或獲授權成員請輸入 !use")};
    const count=await get(env.DB,"SELECT COUNT(*) AS total FROM bridge_groups WHERE room_id=? AND verified=1",group.room_id);
    const label=group.alias||group.display_name||groupDisplay(msg);
    return {handled:true,reply:await respondText("跨群連線："+(group.stopped?"已停止":"運作中")+
      "\n群組："+clean(label,50)+"\n連線群數："+Number(count?.total||0)+"\n管理指令：!help\nAI 聊天：已停用")};
  }
  if(name==="verify")return {handled:true,reply:await respondText("目前採 NapCat 群主／管理員直接驗證，不必輸入 !verify。\n第一群輸入 !use，其他群輸入 !連線碼 簡寫。")};
  if(name==="id"||name==="verifyid")return {handled:true,reply:await respondText("目前使用 NapCat QQ 號識別，無需另外配對 OpenID。")};
  const modifying=new Set(["use","join","rename","stop","resume","leave","revoke","code","grant","ungrant"]);
  if(!modifying.has(name))return {ignored:true};
  const allowed=await permission(env,msg,name);
  if(!allowed.ok)return {handled:true,reply:await respondText("操作遭拒："+allowed.reason)};
  if(name==="use") {
    if(group?.verified)return {handled:true,reply:await respondText("本群已連線，請使用 !status；如需重新產生邀請碼，使用 !code。")};
    // Prefix 'napcat:' is a reserved synthetic ID, not an actual QQ OpenID.
    const roomId=crypto.randomUUID(),code=makeCode(12), key=napcatGroupKey(msg.groupId);
    await run(env.DB,"INSERT INTO bridge_rooms(id,code_hash,creator_qq,active,revoked,created_at) VALUES(?,?,?,1,0,?)",
      roomId,await digest(code),msg.senderQq,Date.now());
    try {
      await run(env.DB,"INSERT INTO bridge_groups(group_openid,room_id,qq_group_id,alias,display_name,verified,stopped,created_at) VALUES(?,?,?,?,?,1,0,?)",
        key,roomId,msg.groupId,groupDisplay(msg),groupDisplay(msg),Date.now());
    }catch(e){
      // A concurrent initialisation / earlier official mapping may own the QQ group.
      await run(env.DB,"UPDATE bridge_rooms SET revoked=1,active=0 WHERE id=?",roomId);
      console.warn("BBOT_USE_GROUP_ALREADY_LINKED");
      return {handled:true,reply:await respondText("此群已有連線，請使用 !status。")};
    }
    const delivered=await respondText("連線已建立。\n連線代碼："+code+
      "\n其他群請由群主／管理員輸入：!"+code+" 群簡寫\nNapCat 直接完成群號與管理權限驗證，不需 OpenID。");
    return {handled:true,reply:delivered,created:true};
  }
  if(name==="join") {
    if(group?.verified)return {handled:true,reply:await respondText("本群已有連線，如需變更請先使用 !leave。")};
    if(!command.arg)return {handled:true,reply:await respondText("請輸入群簡寫，例如：!"+command.code+" 遊戲群")};
    const room=await get(env.DB,"SELECT id FROM bridge_rooms WHERE code_hash=? AND active=1 AND revoked=0",await digest(command.code));
    if(!room)return {handled:true,reply:await respondText("連線碼無效、已撤銷或尚未啟用。請在第一個群使用 !code 取得新代碼。")};
    const alias=cleanAlias(command.arg);
    try{
      await run(env.DB,"INSERT INTO bridge_groups(group_openid,room_id,qq_group_id,alias,display_name,verified,stopped,created_at) VALUES(?,?,?,?,?,1,0,?)",
        napcatGroupKey(msg.groupId),room.id,msg.groupId,alias,groupDisplay(msg),Date.now());
    }catch(e){
      console.warn("BBOT_JOIN_GROUP_ALREADY_LINKED");
      return {handled:true,reply:await respondText("此群可能已經連線；請使用 !status 確認。")};
    }
    return {handled:true,reply:await respondText("加入成功！本群簡寫："+alias+"\n現在同一連線碼的群組可以跨群轉發。")};
  }
  if(!group?.verified)return {handled:true,reply:await respondText("本群尚未連線，請先輸入 !use 或 !連線碼 簡寫。")};
  if(name==="code"){
    const code=makeCode(12);
    await run(env.DB,"UPDATE bridge_rooms SET code_hash=?,revoked=0,active=1 WHERE id=?",await digest(code),group.room_id);
    return {handled:true,reply:await respondText("新連線代碼："+code+"\n舊代碼已失效。")};
  }
  if(name==="rename"){
    const alias=cleanAlias(command.arg);
    if(!alias)return {handled:true,reply:await respondText("用法：!rename 新的群簡寫")};
    await run(env.DB,"UPDATE bridge_groups SET alias=? WHERE group_openid=?",alias,group.group_openid);
    return {handled:true,reply:await respondText("本群簡寫已改為："+alias)};
  }
  if(name==="stop"||name==="resume"){
    await run(env.DB,"UPDATE bridge_groups SET stopped=? WHERE group_openid=?",name==="stop"?1:0,group.group_openid);
    return {handled:true,reply:await respondText(name==="stop"?"本群橋接已停止。":"本群橋接已恢復。")};
  }
  if(name==="revoke"){
    await run(env.DB,"UPDATE bridge_rooms SET revoked=1 WHERE id=?",group.room_id);
    return {handled:true,reply:await respondText("邀請代碼已撤銷，已加入的群組仍保持連線。")};
  }
  if(name==="leave"){
    await run(env.DB,"DELETE FROM bridge_groups WHERE group_openid=?",group.group_openid);
    await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=?",msg.groupId);
    const remain=await get(env.DB,"SELECT COUNT(*) AS total FROM bridge_groups WHERE room_id=? AND verified=1",group.room_id);
    if(!Number(remain?.total||0))await run(env.DB,"UPDATE bridge_rooms SET active=0,revoked=1 WHERE id=?",group.room_id);
    return {handled:true,reply:await respondText("已退出本次跨群連線。")};
  }
  if(name==="grant"||name==="ungrant"){
    const [target,scope]=command.arg.split(/\s+/);
    if(!qq(target))return {handled:true,reply:await respondText("QQ 號無效。用法：!grant QQ號 manage|stop|both")};
    const member=await get(env.DB,"SELECT qq_id FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
    if(!member)return {handled:true,reply:await respondText("目標 QQ 號不在已驗證的群成員名單中。")};
    if(name==="grant"&&!["manage","stop","both"].includes(scope))return {handled:true,reply:await respondText("用法：!grant QQ號 manage|stop|both")};
    await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
    if(name==="grant")for(const entry of scope==="both"?["manage","stop"]:[scope])
      await run(env.DB,"INSERT INTO bridge_acl(qq_group_id,qq_id,scope) VALUES(?,?,?)",msg.groupId,target,entry);
    return {handled:true,reply:await respondText(name==="grant"?"已更新授權。":"已取消授權。")};
  }
  return {ignored:true};
}
