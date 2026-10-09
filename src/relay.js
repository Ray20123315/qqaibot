import {clean,qq} from "./core.js";
export function mediaType(kind) {return ({image:1,video:2,record:3,file:4})[kind]||0;}
const textPart=(text)=>({type:"text",data:{text:String(text||"")}});
export function safeMediaUrl(value) {
  try {const u=new URL(String(value||""));return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.length>3&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)&&!u.hostname.endsWith(".local")?u.href.slice(0,2000):"";}catch{return "";}
}
export function relayOperations(groupName,sender,parts,mapping={},options={}) {
  const label="["+clean(groupName,36).replace(/[\[\]]/g,"")+"]"+clean(sender,40)+"：";
  const realMentions=options.realMentions===true;
  const operations=[];
  let text="",segments=[],started=false;
  function open() {if(!started){text=label;segments=[textPart(label)];started=true;}}
  function flush(){
    if(!started)return;
    if(text.trim() && (text!==label || !operations.length)){
      operations.push({kind:"text",content:text.slice(0,1700),segments});
    }
    text="";segments=[];started=false;
  }
  for (const part of parts.slice(0,60)){
    if(part.type==="text"){open();text+=String(part.text||"").slice(0,2500);segments.push(textPart(part.text));}
    else if(part.type==="at"){
      open();const id=qq(part.qq);
      if(!id)continue;
      const mapped=realMentions?String(mapping[id]||""):"";
      text+=mapped&&/^[a-zA-Z0-9_-]{8,128}$/.test(mapped)?'<qqbot-at-user id="'+mapped+'" />':"@"+id;
      // Target QQ ID is only mentioned natively when Bbot is a member of that target group.
      const targetMembers=options.targetMembers;
      if(targetMembers && targetMembers.has(id))segments.push({type:"at",data:{qq:id}});
      else segments.push(textPart("@"+id));
    }else if(mediaType(part.type)){
      flush();
      const prefix=label;
      const kind=part.type, data=part.data||{};
      const url=safeMediaUrl(data.url||data.file);
      const fallbackFile=clean(data.file||data.url,2048);
      const name=clean(data.name||"",100);
      const fallback= fallbackFile
        ? [textPart(prefix),{type:kind,data:{file:fallbackFile,...(name?{name}:{})}}]
        : [textPart(prefix+"["+({image:"圖片",video:"影片",record:"語音",file:"檔案"}[kind])+":來源不可取得]")];
      operations.push({kind:"media",mediaKind:kind,content:prefix,mediaUrl:url,mediaName:name,segments:fallback});
    }else if(part.type==="face"||part.type==="mface"){
      flush();
      const data=part.data||{};const file=clean(data.file||"",1024);
      const segments=[textPart(label)];
      if(part.type==="face" && /^\d+$/.test(String(data.id||"")))segments.push({type:"face",data:{id:String(data.id)}});
      else if(file)segments.push({type:"image",data:{file}});
      else segments.push(textPart("[表情]"));
      operations.push({kind:"native",content:label+"[表情]",segments});
    }else if(part.type==="reply"){open();text+="[回覆]";segments.push(textPart("[回覆]"));}
    else if(part.type==="forward"){open();text+="[合併轉發]";segments.push(textPart("[合併轉發]"));}
    else if(part.type==="json"||part.type==="xml"){open();text+="[卡片訊息]";segments.push(textPart("[卡片訊息]"));}
    else if(part.type==="poke"){open();text+="[戳一戳]";segments.push(textPart("[戳一戳]"));}
  }
  flush();
  return operations.map((x,index)=>({...x,index}));
}
export function classifyAbotFailure(error){
  const status=Number(error?.status||0),code=Number(error?.code||0);
  // Network exceptions, 5xx, 408, 409 and retryable throttling are ambiguous.
  // Fallback is safe only on an explicit rejection, including a documented quota code.
  if([22009,304082,304083].includes(code)||[400,401,403,404,405,415,422].includes(status))return "definitive";
  return "ambiguous";
}
export function decideFallback({mode="on-rejection",failure,bbotAvailable}={}){
  return mode==="on-rejection"&&failure==="definitive"&&!!bbotAvailable;
}
export function outboundAction(messageId,targetGroupId,segments){
  const id=qq(targetGroupId);
  if(!id||!Array.isArray(segments)||!segments.length)throw new Error("BBOT_SEND_INVALID");
  return {action:"send_group_msg",params:{group_id:Number(id),message:segments},echo:"bridge-send:"+messageId};
}
