
const API="https://api.sgroup.qq.com";
let token="",expires=0;
export async function accessToken(env,fetchImpl=fetch) {
  if (!env.QQ_OPEN_APP_ID || !env.QQ_OPEN_CLIENT_SECRET) throw new Error("QQ_OPEN_CREDENTIALS_REQUIRED");
  if(token && Date.now()<expires-300000)return token;
  const response=await fetchImpl("https://bots.qq.com/app/getAppAccessToken",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({appId:env.QQ_OPEN_APP_ID,clientSecret:env.QQ_OPEN_CLIENT_SECRET})
  });
  const data=await response.json();
  if(!response.ok||!data.access_token)throw new Error("QQ_TOKEN_FAILED:"+response.status);
  token=data.access_token;expires=Date.now()+Number(data.expires_in||7200)*1000;return token;
}
export async function qqRequest(env,path,options={},fetchImpl=fetch) {
  const t=await accessToken(env,fetchImpl);
  const r=await fetchImpl(API+path,{method:options.method||"GET",
    headers:{Authorization:"QQBot "+t,"content-type":"application/json"},
    body:options.body?JSON.stringify(options.body):undefined});
  const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={message:raw};}
  if(!r.ok || (data?.code && Number(data.code)!==0)) {
    const err=new Error("QQ_API_"+r.status+":"+(data?.code||"")+":"+String(data?.message||"").slice(0,140));
    err.status=r.status;err.code=data?.code;throw err;
  }
  return data;
}
export async function sendGroup(env,group,content,msgId) {
  const body={msg_type:0,content:String(content).slice(0,1800)};
  if(msgId){body.msg_id=msgId;body.msg_seq=1;}
  return qqRequest(env,"/v2/groups/"+encodeURIComponent(group)+"/messages",{method:"POST",body});
}
