export const BRIDGE_ECHO_MARKER = "\u2063\u2063\u2063";

export const PROTECTED_QQ = Object.freeze(new Set(["3569028262", "2681167798"]));
export const MANAGE = new Set(["rename", "resume", "leave", "revoke", "stop", "code"]);
export function clean(value, max = 120) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function qq(value) {
  const s = String(value ?? "").trim();
  return /^\d{5,15}$/.test(s) ? s : "";
}
export function isProtected(value) { return PROTECTED_QQ.has(qq(value)); }
export function parseCommand(input) {
  // QQ's old slash menu is not used. OneBot and QQ Open Platform normalize
  // /!use, !use and legacy /use to the same command.
  const value = String(input ?? "").replace(/\[CQ:at,[^\]]+\]/g, " ").replace(/<@!?[^>]+>/g, " ").replace(/^@(?:Abot|AIBot|QQBot)\s*/i,"").trim();
  const match = value.match(/^(?:\/!?|!)(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const command = match[1].toLowerCase(), arg = clean(match[2] || "", 100);
  const known = new Set(["use","verify","status","leave","rename","revoke","stop","resume","grant","ungrant","id","verifyid","code","help","setting","settings"]);
  if (known.has(command)) return {name:command,arg};
  if (/^[a-z0-9]{10,16}$/i.test(command)) return {name:"join",code:command.toUpperCase(),arg};
  return null;
}
export function parseOnebot(event) {
  if (!event || event.post_type !== "message" || event.message_type !== "group") return null;
  const groupId = qq(event.group_id), senderQq = qq(event.user_id);
  if (!groupId || !senderQq) return null;
  const segments = Array.isArray(event.message) ? event.message : [{type:"text",data:{text:String(event.raw_message || "")}}];
  const parts = [], atIds = [];
  for (const seg of segments) {
    if (seg?.type === "text") parts.push({type:"text",text:String(seg.data?.text ?? "").slice(0,2500)});
    else if (seg?.type === "at") {
      const target = qq(seg.data?.qq);
      if (target) {parts.push({type:"at",qq:target}); atIds.push(target);}
      else if (seg.data?.qq === "all") parts.push({type:"text",text:"@全體成員"});
    } else if (["image","record","video","file"].includes(seg?.type)) {
      const data=seg.data||{};
      parts.push({type:seg.type,data:{
        file:String(data.file||"").slice(0,2048),
        url:String(data.url||"").slice(0,2048),
        name:clean(data.name||data.file_name||"",100),
        fileSize:Number(data.file_size||0)||0
      }});
    } else if(["face","mface","reply","forward","json","xml","poke"].includes(seg?.type)){
      const data=seg.data||{};
      if(seg.type==="mface")parts.push({type:"mface",data:{
       emoji_id:clean(data.emoji_id||"",120),emoji_package_id:clean(data.emoji_package_id||"",120),
       key:clean(data.key||"",500),summary:clean(data.summary||"",120)
      }});
      else if(seg.type==="json"||seg.type==="xml")parts.push({type:seg.type,data:{
       data:String(data.data||"").slice(0,16000)
      }});
      else parts.push({type:seg.type,data:{
       id:clean(data.id||"",100),file:clean(data.file||"",1024),data:clean(data.data||"",2000)
      }});
    }
  }
  const text = parts.map(p=>p.type==="text"?p.text:"").join("").trim();
  return {groupId,senderQq,role:String(event.sender?.role || "member").toLowerCase(),
    senderName:clean(event.sender?.card || event.sender?.nickname || senderQq,50),
    groupName:clean(event.__bridge_group_name || event.group_name || "",60),
    text,parts,atIds,messageId:clean(event.message_id,100),
    selfId:qq(event.self_id),time:Number(event.time||0)};
}
export function authorize({actor,role,protectedPresent,rosterFresh,scopes=[],action}) {
  if (!rosterFresh) return {ok:false,reason:"群成員名單未驗證或已過期，為避免繞過保護，暫停管理操作"};
  const privileged = isProtected(actor);
  const admin = role==="owner" || role==="admin";
  if (action==="grant" || action==="ungrant") {
    return privileged || (!protectedPresent && admin)
      ? {ok:true} : {ok:false,reason:"只有受保護帳號可在受保護群組授權其他人"};
  }
  if (privileged) return {ok:true};
  if (protectedPresent) {
    const scope = action==="stop" || action==="leave" || action==="revoke" ? "stop" : "manage";
    return scopes.includes(scope) ? {ok:true} : {ok:false,reason:"本群有受保護 QQ 帳號，須經其明確授權"};
  }
  return admin || scopes.includes("manage") || (action==="stop" && scopes.includes("stop"))
    ? {ok:true} : {ok:false,reason:"只有群主、管理員或已授權成員可以操作"};
}
export function formatForward(group, sender, parts, resolveMention = ()=>null) {
  const head = "[" + clean(group,36).replace(/[\[\]]/g,"") + "]" + clean(sender,40) + "：";
  let content = "";
  for (const p of parts) {
    if (p.type === "text") content += p.text;
    if (p.type === "at") {
      const mapped = resolveMention(p.qq);
      content += mapped && /^[a-z0-9_-]{8,128}$/i.test(mapped) ? "<@!" + mapped + ">" : "@" + p.qq;
    }
  }
  return (head + content).slice(0,1700);
}
export function isRelayable(msg) {
  if (!msg || !msg.parts.length) return false;
  if (msg.selfId && msg.senderQq===msg.selfId) return false;
  if (parseCommand(msg.text) || /^\s*[!\/]/.test(msg.text)) return false;
  return msg.parts.some(p=>p.type==="at" || ["image","record","video","file","face","mface","reply","forward","json","xml","poke"].includes(p.type) || (p.type==="text" && p.text.trim()));
}
