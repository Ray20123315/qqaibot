// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { PLATFORM_FEATURES } from "../config/runtime.js";
import { appendIndex, callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbGet, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";




function platformRoleRank(role){return({member:0,admin:1,owner:2,developer:3})[String(role||'member')]??0}


function platformFeatureById(id){return PLATFORM_FEATURES.find(x=>x.id===String(id||'').toUpperCase())||null}


function platformFeatureKey(feature,groupId){return feature.scope==='global'?`platform:feature:${feature.id}:global`:`platform:feature:${feature.id}:group:${String(groupId||'')}`}


async function platformFeatureEnabled(env,feature,groupId){const v=await dbGet(env,platformFeatureKey(feature,groupId));return v==null?feature.defaultEnabled:v==='true'}


async function listPlatformFeatures(env,{groupId='',role='member',query='',includeHidden=false}={}){const q=String(query||'').trim().toLowerCase(),rank=platformRoleRank(role),rows=[];for(const f of PLATFORM_FEATURES){if(!includeHidden&&platformRoleRank(f.minRole)>rank)continue;if(q&&!`${f.id} ${f.name} ${f.category} ${f.mode}`.toLowerCase().includes(q))continue;rows.push({...f,enabled:await platformFeatureEnabled(env,f,groupId)})}return rows}


async function setPlatformFeature(env,{feature,groupId,enabled,actorId,actorRole,auditMode='log'}){if(!feature)return{ok:false,message:'找不到功能。'};if(platformRoleRank(actorRole)<platformRoleRank(feature.minRole))return{ok:false,message:'你的权限等级无法修改此功能。'};if(feature.scope==='group'&&!groupId)return{ok:false,message:'请先选择群组。'};await dbPut(env,platformFeatureKey(feature,groupId),enabled?'true':'false');if(auditMode!=='silent')await writeSystemAudit(env,{type:'platform_feature',groupId,actorId,action:feature.id,featureName:feature.name,enabled:Boolean(enabled)});return{ok:true,message:`${feature.id} ${feature.name} 已${enabled?'開啟':'關閉'}。`}}


async function appendPlatformTrace(env,data){const id=`tr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,item={id,at:Date.now(),...data};await dbPut(env,`platform:trace:${id}`,JSON.stringify(item));await appendIndex(env,'platform:trace:index',id,5000);if(item.groupId)await appendIndex(env,`platform:trace:index:${item.groupId}`,id,2000);return item}


async function listPlatformTraces(env,{groupId='',query='',limit=200}={}){const ids=await readJson(env,groupId?`platform:trace:index:${groupId}`:'platform:trace:index',[]),q=String(query||'').toLowerCase(),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:trace:${id}`,null);if(x&&(!q||JSON.stringify(x).toLowerCase().includes(q)))rows.push(x)}return rows}


async function enqueuePlatformJob(env,data){const id=`job_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,job={id,status:'queued',attempts:0,maxAttempts:Math.max(1,Math.min(10,Number(data.maxAttempts||3))),createdAt:Date.now(),nextRunAt:Number(data.nextRunAt||Date.now()),...data};await dbPut(env,`platform:job:${id}`,JSON.stringify(job));await appendIndex(env,'platform:job:index',id,5000);return job}


async function listPlatformJobs(env,{groupId='',status='',limit=200}={}){const ids=await readJson(env,'platform:job:index',[]),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:job:${id}`,null);if(!x)continue;if(groupId&&String(x.groupId||'')!==String(groupId))continue;if(status&&x.status!==status)continue;rows.push(x)}return rows}


async function processPlatformJobs(env,now=Date.now()){const jobs=await listPlatformJobs(env,{status:'queued',limit:100});for(const job of jobs.reverse()){if(Number(job.nextRunAt||0)>now)continue;job.status='running';job.attempts=Number(job.attempts||0)+1;try{if(job.type==='notification'&&job.groupId&&job.message)await callOneBotAction(env,{action:'send_group_msg',params:{group_id:numericId(job.groupId),message:String(job.message),auto_escape:false}},15000);else await writeSystemAudit(env,{type:'platform_job',groupId:String(job.groupId||''),actorId:String(job.actorId||'system'),action:String(job.action||job.id)});job.status='completed';job.completedAt=Date.now()}catch(e){job.error=String(e?.message||e);if(job.attempts<job.maxAttempts){job.status='queued';job.nextRunAt=Date.now()+Math.min(3600000,2**job.attempts*30000)}else{job.status='dead_letter';await appendIndex(env,'platform:dead_letter:index',job.id,2000)}}await dbPut(env,`platform:job:${job.id}`,JSON.stringify(job))}}

export { appendPlatformTrace, enqueuePlatformJob, listPlatformFeatures, listPlatformJobs, listPlatformTraces, platformFeatureById, platformFeatureEnabled, platformFeatureKey, platformRoleRank, processPlatformJobs, setPlatformFeature };
