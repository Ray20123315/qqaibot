import test from "node:test";
import assert from "node:assert/strict";
import {parseCommand} from "../src/core.js";
import {handleNapcatCommand} from "../src/napcat-control.js";
import {onOnebotEvent} from "../src/bridge.js";
import {deliver} from "../src/delivery.js";

class FakeD1 {
 constructor(){
  this.rooms=[];this.groups=[];this.members=[];this.acl=[];this.rosters=[];
 }
 seed(id,users){this.rosters.push({qq_group_id:id,fetched_at:Date.now()});this.members.push(...users.map(x=>({qq_group_id:id,qq_id:x.qq_id,role:x.role})))}
 prepare(sql){
  const db=this, q=sql.replace(/\s+/g," ").trim();
  return {bind(...args){return {first:async()=>db.first(q,args),all:async()=>({results:db.all(q,args)}),run:async()=>db.run(q,args)}},
    run:async()=>db.run(q,[])}
 }
 async batch(stmts){return Promise.all(stmts.map(s=>s.run()))}
 first(q,a){
  if(q.startsWith("SELECT * FROM bridge_groups WHERE qq_group_id"))return this.groups.find(x=>x.qq_group_id===a[0])||null;
  if(q.startsWith("SELECT fetched_at FROM bridge_rosters"))return this.rosters.find(x=>x.qq_group_id===a[0])||null;
  if(q.startsWith("SELECT COUNT(1) AS count FROM bridge_members"))return {count:this.members.filter(x=>x.qq_group_id===a[0]&&(x.qq_id===a[1]||x.qq_id===a[2])).length};
  if(q.startsWith("SELECT role FROM bridge_members"))return this.members.find(x=>x.qq_group_id===a[0]&&x.qq_id===a[1])||null;
  if(q.startsWith("SELECT qq_id FROM bridge_members"))return this.members.find(x=>x.qq_group_id===a[0]&&x.qq_id===a[1])||null;
  if(q.startsWith("SELECT id FROM bridge_rooms"))return this.rooms.find(x=>x.code_hash===a[0]&&x.active===1&&x.revoked===0)||null;
  if(q.startsWith("SELECT COUNT(*) AS total FROM bridge_groups"))return {total:this.groups.filter(x=>x.room_id===a[0]&&x.verified===1).length};
  throw Error("SQL_FIRST_UNHANDLED: "+q);
 }
 all(q,a){
  if(q.startsWith("SELECT scope FROM bridge_acl"))return this.acl.filter(x=>x.qq_group_id===a[0]&&x.qq_id===a[1]);
  throw Error("SQL_ALL_UNHANDLED "+q);
 }
 run(q,a){
  if(q.startsWith("CREATE "))return {meta:{changes:0}};
  if(q.startsWith("INSERT INTO bridge_rooms")){
   this.rooms.push({id:a[0],code_hash:a[1],creator_qq:a[2],active:1,revoked:0,created_at:a[3]});return {meta:{changes:1}};
  }
  if(q.startsWith("INSERT INTO bridge_groups")){
   if(this.groups.some(x=>x.group_openid===a[0]||x.qq_group_id===a[2]))throw Error("UNIQUE");
   this.groups.push({group_openid:a[0],room_id:a[1],qq_group_id:a[2],alias:a[3],display_name:a[4],verified:1,stopped:0,created_at:a[5]});
   return {meta:{changes:1}};
  }
  if(q.startsWith("UPDATE bridge_rooms SET revoked=1,active=0")){const r=this.rooms.find(x=>x.id===a[0]);r.revoked=1;r.active=0;return {meta:{changes:1}};}
  if(q.startsWith("UPDATE bridge_rooms SET code_hash=")){const r=this.rooms.find(x=>x.id===a[1]);r.code_hash=a[0];r.revoked=0;r.active=1;return {meta:{changes:1}};}
  if(q.startsWith("UPDATE bridge_rooms SET revoked=1")){const r=this.rooms.find(x=>x.id===a[0]);r.revoked=1;return {meta:{changes:1}};}
  if(q.startsWith("UPDATE bridge_groups SET alias=")){this.groups.find(x=>x.group_openid===a[1]).alias=a[0];return {meta:{changes:1}};}
  if(q.startsWith("UPDATE bridge_groups SET stopped=")){this.groups.find(x=>x.group_openid===a[1]).stopped=a[0];return {meta:{changes:1}};}
  if(q.startsWith("DELETE FROM bridge_groups")){this.groups=this.groups.filter(x=>x.group_openid!==a[0]);return {meta:{changes:1}};}
  if(q.startsWith("DELETE FROM bridge_acl")){this.acl=this.acl.filter(x=>x.qq_group_id!==a[0]||(a.length>1&&x.qq_id!==a[1]));return {meta:{changes:1}};}
  if(q.startsWith("INSERT INTO bridge_acl")){this.acl.push({qq_group_id:a[0],qq_id:a[1],scope:a[2]});return {meta:{changes:1}};}
  throw Error("SQL_RUN_UNHANDLED "+q);
 }
}

const mkMsg=(groupId,senderQq)=>({groupId,senderQq,groupName:"群"+groupId});
const origin="808882936",dest="810000111";
test("NapCat alone creates link and joins a second group with verified native QQ admin",async()=>{
 const db=new FakeD1();
 db.seed(origin,[{qq_id:"2681167798",role:"member"},{qq_id:"3569028262",role:"owner"},{qq_id:"111111111",role:"admin"}]);
 db.seed(dest,[{qq_id:"2681167798",role:"member"},{qq_id:"222222222",role:"owner"}]);
 let out=[];
 const send=async t=>out.push(t);
 const first=await handleNapcatCommand({DB:db},mkMsg(origin,"111111111"),parseCommand("!use"),send);
 assert.equal(first.handled,true);
 assert.equal(first.reply,true);
 const code=out[0].match(/連線代碼：([A-Z0-9]+)/)?.[1];
 assert.match(code,/^[A-Z0-9]{12}$/);
 assert.equal(db.groups[0].group_openid,"napcat:"+origin);
 assert.equal(db.rooms[0].active,1);
 out=[];
 const joined=await handleNapcatCommand({DB:db},mkMsg(dest,"222222222"),parseCommand("!"+code+" 測試群"),send);
 assert.equal(joined.reply,true);
 assert.match(out[0],/加入成功/);
 assert.equal(db.groups[1].room_id,db.groups[0].room_id);
 assert.equal(db.groups[1].group_openid,"napcat:"+dest);
 assert.equal(db.groups[1].alias,"測試群");
 out=[];
 await handleNapcatCommand({DB:db},mkMsg(dest,"222222222"),parseCommand("/!status"),send);
 assert.match(out[0],/連線群數：2/);
});
test("protected members block stop/leave/grant, but do not block admin's ability to join",async()=>{
 const db=new FakeD1();const a=mkMsg(origin,"111111111"),o=mkMsg(origin,"3569028262");
 db.seed(origin,[{qq_id:"2681167798",role:"member"},{qq_id:"3569028262",role:"owner"},{qq_id:"111111111",role:"admin"}]);
 let out=[];const reply=async t=>out.push(t);
 await handleNapcatCommand({DB:db},a,parseCommand("!use"),reply);
 for(const command of ["!stop","!leave","!grant 111111111 stop"]){
  out=[];const result=await handleNapcatCommand({DB:db},a,parseCommand(command),reply);
  assert.equal(result.handled,true);assert.match(out[0],/操作遭拒/);
 }
 out=[];
 await handleNapcatCommand({DB:db},o,parseCommand("!grant 111111111 stop"),reply);
 assert.match(out[0],/已更新授權/);
 out=[];
 await handleNapcatCommand({DB:db},a,parseCommand("!stop"),reply);
 assert.match(out[0],/已停止/);
});
test("NapCat synthetic group media uses Bbot directly and never calls Abot",async()=>{
 let b=0;
 const item={id:"k",target_group:"napcat:810000111",target_qq_group_id:"810000111",
  payload:JSON.stringify({kind:"media",mediaKind:"image",content:"[群]甲：",segments:[{type:"image",data:{file:"abc.jpg"}}]})};
 const result=await deliver({},item,{sendBbot:async(env,id,target,segments)=>{b++;assert.equal(target,dest);assert.equal(segments[0].type,"image");},
    sendText:async()=>{throw Error("ABOT_CALLED")},sendAttachment:async()=>{throw Error("ABOT_CALLED")}});
 assert.equal(result.status,"sent_bbot");assert.equal(b,1);
});
test("Bbot group event /!use routes to NapCat admin verifier with no OpenID",async()=>{
 const db=new FakeD1();db.seed(origin,[{qq_id:"2681167798",role:"member"},{qq_id:"111111111",role:"owner"}]);
 let sent="";
 const event={post_type:"message",message_type:"group",group_id:Number(origin),user_id:111111111,self_id:2681167798,message_id:10044,
   sender:{role:"owner",nickname:"測試群主"},message:[{type:"text",data:{text:"!use"}}]};
 const result=await onOnebotEvent({DB:db,BRIDGE_NAPCAT_COMMANDS:"true"},event,async text=>{sent=text});
 assert.equal(result.handled,true);assert.equal(db.groups[0].group_openid,"napcat:"+origin);
 assert.match(sent,/連線代碼/);
});
