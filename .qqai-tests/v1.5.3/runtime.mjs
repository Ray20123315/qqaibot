import cryptoModule from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = cryptoModule.webcrypto;
const m = await import('file:///tmp/worker-v153-ci.mjs');
const ok=(v,n)=>{if(!v)throw Error(n)};
class S{constructor(d,q){this.d=d;this.q=q;this.a=[]}bind(...a){this.a=a;return this}async first(){const k=String(this.a[0]??'');return /SELECT\s+value/i.test(this.q)&&this.d.m.has(k)?{value:this.d.m.get(k)}:null}async run(){const k=String(this.a[0]??'');if(/INSERT/i.test(this.q))this.d.m.set(k,String(this.a[1]??''));if(/DELETE/i.test(this.q))this.d.m.delete(k);return{success:true}}async all(){return{results:[]}}}
class D{constructor(){this.m=new Map()}prepare(q){return new S(this,q)}}
const sent=[],calls=[];
const env={DB:new D(),DEVELOPER_QQ:'3569028262',ONEBOT_HUB:{idFromName:x=>x,get:()=>({fetch:async(_u,i)=>{const b=JSON.parse(i.body||'{}');calls.push(b);if(b.action==='get_group_member_list')return Response.json({ok:true,data:[{user_id:111,role:'owner',card:'群主'},{user_id:222,role:'admin',card:'管理'}]});if(b.action==='send_group_msg'){sent.push(b.params);return Response.json({ok:true,data:{message_id:9000+sent.length}})}return Response.json({ok:true,data:{}})}})}};
const gid='808882936',uid='3937277691';
env.DB.m.set(`onebot:self_group_role:${gid}`,JSON.stringify({exists:true,role:'admin',checkedAt:Date.now()}));
ok(m.normalizeRuleStrictness('智慧')==='smart','smart alias');
ok(m.ruleStrictnessConfig('smart').adaptive,'adaptive config');
let p=m.normalizeRuleCategoryPolicies([{name:'攻击',punishment:'recall',actions:[{action:'recall'},{action:'mute',muteSeconds:600}],note:'只处理真实攻击'}]);
ok(p[0].actions.length===2&&p[0].actions[1].muteSeconds===600,'multi actions');
ok(m.normalizeRuleCategoryPolicies([{name:'旧',punishment:'warn'}])[0].actions[0].action==='warn','legacy');
ok(m.ruleContentNeedsWebVerification('刚刚新闻说某地发生地震'),'news lookup');
let miss=false;try{await m.callGoogleDecision(env,{system:'x',prompt:'x',inputParts:[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]})}catch(e){miss=/VISION_DECISION_KEYS_MISSING/.test(String(e?.message||e))}ok(miss,'vision key isolation');
const oldFetch=globalThis.fetch;let url='';globalThis.fetch=async u=>{url=String(u);return Response.json({candidates:[{content:{parts:[{text:'{"violation":false}'}]}}],usageMetadata:{}})};
const vr=await m.callGoogleDecision({...env,GEMINI_VISION_API_KEY:'vision-key',GEMINI_VISION_MODELS:'gemini-vision-test'},{system:'x',prompt:'x',inputParts:[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]});globalThis.fetch=oldFetch;
ok(vr.decisionProvider==='gemini_vision'&&vr.imageEvidenceUsed&&/gemini-vision-test/.test(url),'vision route');
env.DB.m.set(`rule_strictness:${gid}`,'smart');const ad=await m.resolveAdaptiveRuleStrictness(env,gid,'聊天',Array.from({length:4},()=>({verdict:'not_violation'})));ok(ad.adaptive&&['loose','low'].includes(ad.level),'adaptive loosen');
const item={id:'rv1',groupId:gid,userId:uid,messageId:'1234',relatedMessageIds:['1235'],reason:'测试',violationType:'攻击',content:'违规'};
const ex=await m.performRuleAdditionalActions(env,item,[{action:'recall'},{action:'mute',muteSeconds:600}],{humanOverride:true,mode:'human',reasonText:'人工追加'});ok(ex.ok&&ex.taken.includes('recall')&&ex.taken.includes('mute'),'execute multiple');ok(calls.some(x=>x.action==='delete_msg')&&calls.some(x=>x.action==='set_group_ban'),'onebot actions');
env.DB.m.set(`rule_category_policies:${gid}`,JSON.stringify([{name:'攻击',punishment:'warn',actions:[{action:'warn'}],note:'仅真实攻击'}]));env.DB.m.set('ruleviolation:rv1',JSON.stringify({...item,actionTaken:'warn',actionsTaken:['warn'],warningMessageId:'7001',strikeCounted:false}));
const rev=await m.recordRuleViolationFeedback(env,{...item,actionTaken:'warn',actionsTaken:['warn'],warningMessageId:'7001',strikeCounted:false},'3569028262','not_violation','群友互相玩梗且双方接受，不算真实攻击');ok(rev.policyCorrectionApplied,'correction apply');ok(JSON.parse(env.DB.m.get(`rule_category_policies:${gid}`))[0].note.includes('群友互相玩梗'),'correction note');
const add={id:'rv2',groupId:gid,userId:uid,messageId:'888',violationType:'秩序',content:'刷屏',actionTaken:'recall',actionsTaken:['recall'],actionResults:['已撤回']};env.DB.m.set('ruleviolation:rv2',JSON.stringify(add));const ar=await m.recordRuleViolationFeedback(env,add,'3569028262','violation_additional','重复刷屏，追加禁言',{actions:[{action:'mute',muteSeconds:300}],allowKick:false});ok(ar.actionsTaken.includes('recall')&&ar.actionsTaken.includes('mute'),'additional punishment');
env.DB.m.set(`ruleviolation:index:${gid}`,JSON.stringify(['rv3']));env.DB.m.set('ruleviolation:rv3',JSON.stringify({id:'rv3',groupId:gid,userId:uid,actionTaken:'record_only',actionsTaken:['recall','mute']}));ok((await m.findLatestActiveRuleViolationForUser(env,gid,uid))?.id==='rv3','active lookup');
const q=await m.requestRuleManagerClarification(env,{groupId:gid,userId:uid,senderName:'群友',content:'边界内容',messageId:'999',reason:'证据不足'});ok(q.requested&&q.managerIds.length>=1&&sent.some(x=>x.message?.some?.(y=>y.type==='at')),'manager clarification');
console.log('worker v1.5.3 adaptive multi-action runtime PASS');
