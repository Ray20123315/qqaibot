import {accessToken} from "./qq-api.js";

const API="https://api.bot.qq.com";
const SCOPES=["group","c2c","channel","dm"];
const obsoleteName=value=>/^设置插话率$/.test(String(value||"").replace(/^[\/!！\s]+/g,"").trim());
export function isObsoleteQQCommand(item){
 return item?.type==="command"&&obsoleteName(item.name);
}
async function call(env,path,{method="GET",body,fetchImpl=fetch}={}){
 const token=await accessToken(env,fetchImpl);
 const response=await fetchImpl(API+path,{method,headers:{
  "Authorization":"QQBot "+token,"Content-Type":"application/json"
 },body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Object.assign(new Error("QQ_PANEL_HTTP_"+response.status),{status:response.status});
 if(response.status===204)return {};
 const data=await response.json();
 if(data?.code && Number(data.code)!==0)throw Object.assign(new Error("QQ_PANEL_API_ERROR"),{code:Number(data.code)});
 return data;
}
/**
 * Only strips exact retired commands. Preserves all other panel items,
 * target associations and remarks. Never creates or replaces a whole panel
 * from a hard-coded list.
 */
export async function cleanupRetiredQQCommands(env,{fetchImpl=fetch,scopes=SCOPES}={}){
 const report={scopes:[],removed:0,updated:0,deleted:0,examined:0};
 for(const scope of scopes){
  if(!SCOPES.includes(scope))throw new Error("QQ_PANEL_SCOPE_INVALID");
  let cursor="",pageCount=0;
  do{
   if(++pageCount>10)throw new Error("QQ_PANEL_PAGING_LIMIT");
   const q=new URLSearchParams({scope,limit:"50"});
   if(cursor)q.set("cursor",cursor);
   const data=await call(env,"/v2/panels?"+q,{fetchImpl});
   // Restrict modifications to confirmed panel record arrays. Never log payloads.
   const pages=[data,data?.data,data?.data?.data];
   const page=pages.find(value=>Array.isArray(value?.records));
   if(!page){
    const type=value=>Array.isArray(value)?"ARRAY":value===null?"NULL":value===undefined?"ABSENT":typeof value==="object"?"OBJECT":"SCALAR";
    throw new Error("QQ_PANEL_RECORDS_MISSING_"+pages.map(type).join("_"));
   }
   const records=page.records;
   for(const record of records){
    report.examined++;
    const items=record.panel?.items;
    if(!Array.isArray(items))continue;
    const clean=items.filter(x=>!isObsoleteQQCommand(x));
    const count=items.length-clean.length;
    if(!count)continue;
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(String(record.panel_id||"")))throw new Error("QQ_PANEL_ID_INVALID");
    const panelId=encodeURIComponent(record.panel_id);
    if(clean.length===0){
     await call(env,"/v2/panels/"+panelId,{method:"DELETE",fetchImpl});
     report.deleted++;
    }else{
     const panel={items:clean,remark:String(record.panel.remark||"")};
     if(Number.isInteger(record.panel.version))panel.version=record.panel.version;
     await call(env,"/v2/panels/"+panelId,{method:"PUT",body:{panel},fetchImpl});
     report.updated++;
    }
    report.removed+=count;
   }
   cursor=!page.is_end&&typeof page.next_cursor==="string"?page.next_cursor:"";
  }while(cursor);
  report.scopes.push(scope);
 }
 return report;
}
