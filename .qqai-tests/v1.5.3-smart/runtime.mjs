import cryptoModule from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = cryptoModule.webcrypto;
const m = await import('file:///tmp/worker-v1.5.3-ci.mjs');
const assert = (v, msg) => { if (!v) throw new Error(msg); };

class Statement {
  constructor(db, sql) { this.db=db; this.sql=sql; this.args=[]; }
  bind(...args){ this.args=args; return this; }
  async first(){ const key=String(this.args[0]??''); if(/SELECT\s+value/i.test(this.sql)) return this.db.map.has(key)?{value:this.db.map.get(key)}:null; return null; }
  async run(){ const key=String(this.args[0]??''); if(/INSERT/i.test(this.sql)) this.db.map.set(key,String(this.args[1]??'')); if(/DELETE/i.test(this.sql)) this.db.map.delete(key); return {success:true}; }
  async all(){ return {results:[]}; }
}
class D1 { constructor(){this.map=new Map();} prepare(sql){return new Statement(this,sql);} }
const makeHub=(actions, managers=[{user_id:111111,card:'管理员甲',role:'admin'},{user_id:222222,card:'群主乙',role:'owner'}])=>({
  idFromName:v=>v,
  get:()=>({fetch:async(_url,init)=>{
    const b=JSON.parse(init.body||'{}'); actions.push({action:b.action,params:b.params});
    if(b.action==='get_group_member_list') return new Response(JSON.stringify({ok:true,data:managers}),{headers:{'content-type':'application/json'}});
    if(b.action==='get_group_member_info') return new Response(JSON.stringify({ok:true,data:{role:'owner'}}),{headers:{'content-type':'application/json'}});
    if(b.action==='send_private_msg'||b.action==='send_group_msg') return new Response(JSON.stringify({ok:true,data:{message_id:789}}),{headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({ok:true,data:{}}),{headers:{'content-type':'application/json'}});
  }})
});

assert(m.normalizeRuleStrictness('智慧')==='smart','smart alias');
assert(m.ruleStrictnessLabel('smart')==='智慧','smart label');
assert(JSON.stringify(m.normalizeRulePolicyActions(['recall','mute']))==='["recall","mute"]','multi action normalization');
const migrated=m.normalizeRuleCategoryPolicies([{name:'测试',punishment:'mute',note:'x'}]);
assert(JSON.stringify(migrated[0].actions)==='["mute"]','legacy punishment migration');

{
  const db=new D1();
  const ids=[];
  for(let i=0;i<5;i++){ const id='f'+i; ids.push(id); db.map.set('rulefeedback:'+id,JSON.stringify({id,groupId:'1',verdict:i<4?'not_violation':'violation',at:Date.now(),content:'x'})); }
  db.map.set('rulefeedback:index:1',JSON.stringify(ids));
  const smart=await m.deriveSmartRuleStrictness({DB:db},'1');
  assert(smart.level==='smart'&&smart.minConfidence>0.82,'smart adapts looser after misjudgments');
}

{
  const db=new D1(), actions=[]; const env={DB:db,ONEBOT_HUB:makeHub(actions)};
  const social=await m.collectRuleSocialSignals(env,'1',['QQ:111111：先别处罚，像是玩笑','QQ:333333：我没介意']);
  assert(social.managers.length===2&&social.managerMessages.length===1&&social.peerMessages.length===1,'social signals');
  const r=await m.requestRuleClarificationFromRandomManagers(env,{groupId:'1',userId:'333333',senderName:'群友',content:'边界内容',messageId:'55',review:{violation:false,confidence:.66,reason:'需要管理确认'},imageEvidence:{present:false},socialSignals:social});
  assert(r.requested===true&&r.managerIds.length>=1,'manager clarification requested');
  assert(actions.some(x=>x.action==='send_private_msg'),'manager private message');
  assert(db.map.has('rule_clarification_rate:1'),'clarification rate recorded');
}

{
  const db=new D1(), actions=[]; const group='808882936', user='333333';
  db.map.set(`rule_proxy_mode:${group}`,'auto');
  db.map.set(`rule_category_policies:${group}`,JSON.stringify([{name:'人身攻击',actions:['recall','mute'],punishment:'recall',note:'测试多动作',muteSeconds:600}]));
  db.map.set('onebot:self_identity',JSON.stringify({userId:'999999',nickname:'bot',at:Date.now()}));
  db.map.set(`onebot:self_group_role:${group}`,JSON.stringify({exists:true,role:'owner',verifiedBy:'test',checkedAt:Date.now()}));
  const env={DB:db,ONEBOT_HUB:makeHub(actions)};
  const item={id:'rv1',groupId:group,userId:user,senderName:'u',content:'x',violationType:'人身攻击',messageId:'99',relatedMessageIds:[],severity:'moderate',intentional:true};
  db.map.set('ruleviolation:rv1',JSON.stringify(item));
  const out=await m.performRuleProxyAction(env,item,{severity:'moderate',intentional:true,muteSeconds:600});
  assert((out.actionsTaken||[]).includes('recall')&&(out.actionsTaken||[]).includes('mute'),'recall + mute both executed');
  assert(actions.some(x=>x.action==='delete_msg')&&actions.some(x=>x.action==='set_group_ban'),'onebot multi actions');
}

// Maintenance and missing model keys must not stop classification; it should defer and ask management.
{
  const db=new D1(), actions=[]; const group='9', user='333333';
  db.map.set(`group_rules:${group}`,'禁止真实骚扰；边界情况交管理复核');
  db.map.set(`rule_monitor_enabled:${group}`,'true');
  db.map.set(`rule_strictness:${group}`,'smart');
  db.map.set(`ops:settings:${group}`,JSON.stringify({maintenanceMode:true,emergencyLock:false,ruleSampleReviewPercent:0}));
  db.map.set('onebot:self_identity',JSON.stringify({userId:'999999',nickname:'bot',at:Date.now()}));
  db.map.set(`onebot:self_group_role:${group}`,JSON.stringify({exists:true,role:'member',verifiedBy:'test',checkedAt:Date.now()}));
  const env={DB:db,ONEBOT_HUB:makeHub(actions)};
  const out=await m.inspectMessageAgainstGroupRules(env,{groupId:group,userId:user,senderName:'群友',text:'这句话需要结合语境判断',messageId:'123'});
  assert(out.status==='pending_review','maintenance/model failure defers instead of stopping');
  assert(actions.some(x=>x.action==='send_private_msg'),'degraded path asks manager');
}
console.log('worker v1.5.3 smart multi-rule runtime PASS');
