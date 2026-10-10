import {BRIDGE_ECHO_MARKER} from "./core.js";
const API="https://api.sgroup.qq.com";
const tokens=new Map();
function qqApiError(status,body){
 const err=new Error("QQ_API_"+status+":"+String(body?.code||"")+":"+String(body?.message||"").slice(0,140));
 err.status=status;err.code=Number(body?.code||0);
 return err;
}
export async function accessToken(env,fetchImpl=fetch) {
 const id=String(env.QQ_OPEN_APP_ID||""),secret=String(env.QQ_OPEN_CLIENT_SECRET||"");
 if(!id||!secret)throw new Error("QQ_OPEN_CREDENTIALS_REQUIRED");
 const cached=tokens.get(id),now=Date.now();
 if(cached&&now<cached.expires)return cached.token;
 const response=await fetchImpl("https://bots.qq.com/app/getAppAccessToken",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({appId:id,clientSecret:secret})});
 const data=await response.json();
 if(!response.ok||!data.access_token)throw new Error("QQ_TOKEN_FAILED:"+response.status);
 tokens.set(id,{token:data.access_token,expires:now+Number(data.expires_in||7200)*1000-300000});
 return data.access_token;
}
export async function qqRequest(env,path,options={},fetchImpl=fetch){
 const t=await accessToken(env,fetchImpl);
 const response=await fetchImpl(API+path,{method:options.method||"GET",
 headers:{Authorization:"QQBot "+t,...(options.body===undefined?{}:{"content-type":"application/json"})},
 body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data={message:raw};}
 if(!response.ok || (data?.code&&Number(data.code)!==0))throw qqApiError(response.status,data);
 return data;
}
export async function sendGroup(env,group,content,msgId,extra={}) {
 const text=String(content||"");
 if(text.length>1800)throw new Error("ABOT_REPLY_TOO_LONG_REWRITE_REQUIRED");
 const body={msg_type:0,content:text,...extra};
 if(msgId){body.msg_id=msgId;body.msg_seq=1;}
 return qqRequest(env,"/v2/groups/"+encodeURIComponent(group)+"/messages",{method:"POST",body});
}
export async function uploadGroupMedia(env,group,kind,url){
 const fileType={image:1,video:2,record:3,file:4}[kind];
 if(!fileType||!url)throw new Error("ABOT_MEDIA_UNAVAILABLE");
 const data=await qqRequest(env,"/v2/groups/"+encodeURIComponent(group)+"/files",{method:"POST",body:{file_type:fileType,url,srv_send_msg:false}});
 if(!data?.file_info)throw new Error("ABOT_MEDIA_NO_FILE_INFO");
 return data.file_info;
}
export async function sendMedia(env,group,operation){
 if(!operation.mediaUrl)throw Object.assign(new Error("ABOT_MEDIA_NO_PUBLIC_URL"),{status:415});
 const fileInfo=await uploadGroupMedia(env,group,operation.mediaKind,operation.mediaUrl);
 return sendGroup(env,group," "+BRIDGE_ECHO_MARKER,undefined,{msg_type:7,media:{file_info:fileInfo}});
}

export async function groupBotState(env,group){
 return qqRequest(env,"/v2/groups/"+encodeURIComponent(group)+"/bot_state");
}
