import cryptoModule from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = cryptoModule.webcrypto;
const m = await import('file:///tmp/worker-v1.5.4-ci.mjs');
const ok=(v,n)=>{if(!v)throw new Error(n)};
class S{
  constructor(d,q){this.d=d;this.q=q;this.a=[]}
  bind(...a){this.a=a;return this}
  async first(){const k=String(this.a[0]??'');return /SELECT\s+value/i.test(this.q)&&this.d.m.has(k)?{value:this.d.m.get(k)}:null}
  async run(){const k=String(this.a[0]??'');if(/INSERT/i.test(this.q))this.d.m.set(k,String(this.a[1]??''));if(/DELETE/i.test(this.q))this.d.m.delete(k);return{success:true}}
  async all(){return{results:[]}}
}
class D{constructor(){this.m=new Map()}prepare(q){return new S(this,q)}}
const calls=[];
const env={DB:new D(),DEVELOPER_QQ:'3569028262',ONEBOT_HUB:{idFromName:x=>x,get:()=>({fetch:async(_u,i)=>{const b=JSON.parse(i.body||'{}');calls.push(b);if(b.action==='send_group_msg')return Response.json({ok:true,data:{message_id:7000+calls.length}});if(b.action==='get_group_member_list')return Response.json({ok:true,data:[{user_id:111,role:'owner'}]});return Response.json({ok:true,data:{}})}})}};
const gid='808882936',uid='3937277691';
env.DB.m.set(`onebot:self_group_role:${gid}`,JSON.stringify({exists:true,role:'admin',checkedAt:Date.now()}));
env.DB.m.set(`rule_proxy_mode:${gid}`,'auto');
env.DB.m.set(`rule_proxy_kick_authorized:${gid}`,'true');
env.DB.m.set(`rule_category_policies:${gid}`,JSON.stringify([{name:'公共秩序',punishment:'progressive',actions:[{action:'progressive'}],note:'测试'}]));
env.DB.m.set(`rule_progressive_policy:${gid}`,JSON.stringify({windowDays:7,minorAction:'remind',steps:[{actions:[{action:'recall'},{action:'mute',muteSeconds:120},{action:'warn'}]},{action:'kick'}]}));
let p=m.normalizeRuleProgressivePolicy({steps:[{actions:[{action:'recall'},{action:'mute',muteSeconds:120}]}]});
ok(p.steps[0].actions.length===2&&p.steps[0].actions[1].muteSeconds===120,'normalize multi');
let legacy=m.normalizeRuleProgressivePolicy({steps:[{action:'mute',muteSeconds:60}]});
ok(legacy.steps[0].actions.length===1&&legacy.steps[0].actions[0].action==='mute','legacy step');
let step=m.resolveRuleProgressiveStep(p,1);
ok(step.actions.length===2&&step.action==='recall','resolve multi');
ok(m.progressiveMuteFallback(p,1,600)===120,'mute fallback');
const item={id:'rv154',groupId:gid,userId:uid,messageId:'1234',relatedMessageIds:['1235'],reason:'连续刷屏',violationType:'公共秩序',content:'刷屏',severity:'moderate',intentional:true};
const out=await m.performRuleProxyAction(env,item,{severity:'moderate',intentional:true});
ok(out.actionOk,'action ok');
ok(out.actionsTaken.includes('recall')&&out.actionsTaken.includes('mute')&&out.actionsTaken.includes('warn'),'all actions taken');
ok(calls.some(x=>x.action==='delete_msg'),'recall call');
ok(calls.some(x=>x.action==='set_group_ban'&&Number(x.params.duration)===120),'mute call');
ok(calls.filter(x=>x.action==='send_group_msg').length>=2,'messages sent');

const failCalls=[];
const env2={DB:new D(),ONEBOT_HUB:{idFromName:x=>x,get:()=>({fetch:async(_u,i)=>{const b=JSON.parse(i.body||'{}');failCalls.push(b);if(b.action==='delete_msg')return Response.json({ok:false,message:'delete failed'});if(b.action==='send_group_msg')return Response.json({ok:true,data:{message_id:1}});return Response.json({ok:true,data:{}})}})}};
const gid2='1',uid2='2';
env2.DB.m.set(`onebot:self_group_role:${gid2}`,JSON.stringify({exists:true,role:'admin',checkedAt:Date.now()}));
env2.DB.m.set(`rule_proxy_mode:${gid2}`,'auto');
env2.DB.m.set(`rule_category_policies:${gid2}`,JSON.stringify([{name:'测试',actions:[{action:'progressive'}]}]));
env2.DB.m.set(`rule_progressive_policy:${gid2}`,JSON.stringify({steps:[{actions:[{action:'recall'},{action:'mute',muteSeconds:90}]}]}));
const out2=await m.performRuleProxyAction(env2,{id:'x',groupId:gid2,userId:uid2,messageId:'3',reason:'x',violationType:'测试',content:'x',severity:'moderate',intentional:true},{severity:'moderate',intentional:true});
ok(out2.actionsTaken.includes('mute')&&out2.actionOk,'later action survives primary failure');
console.log('worker v1.5.4 progressive multi-action runtime PASS');
