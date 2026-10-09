import {clean,qq} from "./core.js";
export function mediaType(kind) {return ({image:1,video:2,record:3,file:4})[kind]||0;}
const textPart=(text)=>({type:"text",data:{text:String(text||"")}});
export function readableCard(type,raw){
 const text=String(raw||"").slice(0,16000);
 let label="[分享卡片]";
 let title="",link="";
 if(type==="json"){
  try{
   const obj=JSON.parse(text);
   const meta=obj.meta||{};
   const detail=meta.detail_1||meta.news||meta.video||meta.music||meta.detail||{};
   title=String(detail.title||obj.prompt||obj.desc||obj.title||"").slice(0,160);
   link=String(detail.qqdocurl||detail.url||detail.jumpUrl||obj.url||"").slice(0,500);
   if(/bilibili|b23\.tv|嗶哩嗶哩|哔哩哔哩/i.test(text))label="[B站分享]";
  }catch{}
 }else{
  title=(text.match(/title=["']([^"']{1,160})["']/i)||[])[1]||"";
  link=(text.match(/(?:url|jumpurl)=["']([^"']{1,500})["']/i)||[])[1]||"";
  if(/bilibili|b23\.tv/i.test(text))label="[B站分享]";
 }
 // Prevent QQ client from automatically unfurling a new card from our text.
 if(/^https?:\/\//i.test(link))link=link.replace(/^https?:\/\//i,m=>m.replace("://","[:]//"));
 else link="";
 return [label,title,link].filter(Boolean).join(" ").slice(0,650);
}

export function safeMediaUrl(value) {
  try {const u=new URL(String(value||""));return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.length>3&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)&&!u.hostname.endsWith(".local")?u.href.slice(0,2000):"";}catch{return "";}
}
export function relayOperations(groupName,sender,parts,mapping={},options={}) {
  const label="["+clean(groupName,36).replace(/[\[\]]/g,"")+"]"+clean(sender,40)+"：";
  const realMentions=options.realMentions===true;
  if(options.nativeBatch===true){
   const segments=[textPart(label)];
   let readable=label;
   for(const part of parts.slice(0,60)){
    if(part.type==="text"){
     const v=String(part.text||"").slice(0,2500);
     segments.push(textPart(v));readable+=v;
    }else if(part.type==="at"){
     const id=qq(part.qq);
     if(!id)continue;
     if(options.targetMembers?.has(id))segments.push({type:"at",data:{qq:id}});
     else segments.push(textPart("@"+String(options.sourceMembers?.get(id)||"群友").slice(0,40)));
     readable+="@"+String(options.sourceMembers?.get(id)||"群友").slice(0,40);
    }else if(mediaType(part.type)){
     const data=part.data||{};
     const file=clean(data.file||data.url||"",2048);
     const name=clean(data.name||"",100);
     if(file)segments.push({type:part.type,data:{file,...(name?{name}:{})}});
     else segments.push(textPart("[來源媒體不可取得]"));
     readable+="["+part.type+"]";
    }else if(part.type==="face"&&/^\d+$/.test(String(part.data?.id||""))){
     segments.push({type:"face",data:{id:String(part.data.id)}});readable+="[表情]";
    }else if(part.type==="mface"){
     const data=part.data||{};
     if(data.emoji_id&&data.emoji_package_id){
      segments.push({type:"mface",data:{emoji_id:data.emoji_id,emoji_package_id:data.emoji_package_id,
       ...(data.key?{key:data.key}:{}),...(data.summary?{summary:data.summary}:{})}});
     }else segments.push(textPart(data.summary||"[商城表情]"));
     readable+="[商城表情]";
    }else if(["reply","forward","json","xml","poke"].includes(part.type)){
     const hint=(part.type==="json"||part.type==="xml")?readableCard(part.type,part.data?.data):
      part.type==="reply"?"[回覆]":part.type==="forward"?"[合併轉發]":"[戳一戳]";
     segments.push(textPart(hint));readable+=hint;
    }
   }
   return [{index:0,kind:"native",content:readable.slice(0,1700),segments}];
  }
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
      else if(part.type==="mface" && data.emoji_id && data.emoji_package_id){
       segments.push({type:"mface",data:{emoji_id:data.emoji_id,emoji_package_id:data.emoji_package_id,
        ...(data.key?{key:data.key}:{}),...(data.summary?{summary:data.summary}:{})}});
      }else segments.push(textPart(data.summary||"[商城表情]"));
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
