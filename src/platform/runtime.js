// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { PLATFORM_FEATURES } from "../config/runtime.js";
import { appendIndex, callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbCompareAndSwap, dbGetStrict, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";




function platformRoleRank(role){return({member:0,admin:1,owner:2,developer:3})[String(role||'member')]??0}


async function listPlatformFeatures(env,{role='member',query='',includeHidden=false}={}){const q=String(query||'').trim().toLowerCase(),rank=platformRoleRank(role),rows=[];for(const f of PLATFORM_FEATURES){if(!includeHidden&&platformRoleRank(f.minRole)>rank)continue;if(q&&!`${f.id} ${f.name} ${f.category} ${f.mode}`.toLowerCase().includes(q))continue;rows.push({id:f.id,name:f.name,category:f.category,minRole:f.minRole,scope:f.scope,mode:f.mode})}return rows}


async function appendPlatformTrace(env,data){const id=`tr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,item={id,at:Date.now(),...data};await dbPut(env,`platform:trace:${id}`,JSON.stringify(item));await appendIndex(env,'platform:trace:index',id,5000);if(item.groupId)await appendIndex(env,`platform:trace:index:${item.groupId}`,id,2000);return item}


async function listPlatformTraces(env,{groupId='',query='',limit=200}={}){const ids=await readJson(env,groupId?`platform:trace:index:${groupId}`:'platform:trace:index',[]),q=String(query||'').toLowerCase(),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:trace:${id}`,null);if(x&&(!q||JSON.stringify(x).toLowerCase().includes(q)))rows.push(x)}return rows}


async function enqueuePlatformJob(env,data){const id=`job_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,job={id,status:'queued',attempts:0,maxAttempts:Math.max(1,Math.min(10,Number(data.maxAttempts||3))),createdAt:Date.now(),nextRunAt:Number(data.nextRunAt||Date.now()),...data};await dbPut(env,`platform:job:${id}`,JSON.stringify(job));await appendIndex(env,'platform:job:index',id,5000);return job}


async function listPlatformJobs(env,{groupId='',status='',limit=200}={}){const ids=await readJson(env,'platform:job:index',[]),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:job:${id}`,null);if(!x)continue;if(groupId&&String(x.groupId||'')!==String(groupId))continue;if(status&&x.status!==status)continue;rows.push(x)}return rows}


async function processPlatformJobs(env, now = Date.now()) {
  const jobs = await listPlatformJobs(env, { limit: 100 });
  for (const listed of jobs.reverse()) {
    const key = `platform:job:${listed.id}`;
    const raw = await dbGetStrict(env, key);
    if (!raw) continue;
    let job;
    try { job = JSON.parse(raw); } catch { continue; }
    if (job.status === "running") {
      if (Number(job.claim?.expiresAt || 0) > now) continue;
      // A stale/legacy running record has an ambiguous side-effect outcome. Stop
      // for manual review instead of automatically risking a duplicate send.
      const dead = { ...job, status: "dead_letter", error: "execution_claim_expired_manual_review", completedAt: Date.now() };
      delete dead.claim;
      if (await dbCompareAndSwap(env, key, raw, JSON.stringify(dead))) {
        await appendIndex(env, "platform:dead_letter:index", job.id, 2000);
      }
      continue;
    }
    if (job.status !== "queued" || Number(job.nextRunAt || 0) > now) continue;

    const claimed = {
      ...job,
      status: "running",
      attempts: Number(job.attempts || 0) + 1,
      claim: { owner: crypto.randomUUID(), claimedAt: now, expiresAt: now + 10 * 60 * 1000 }
    };
    const claimedRaw = JSON.stringify(claimed);
    if (!(await dbCompareAndSwap(env, key, raw, claimedRaw))) continue;

    let failure = null;
    try {
      if (job.type === "notification" && job.groupId && job.message) {
        await callOneBotAction(env, {
          action: "send_group_msg",
          params: { group_id: numericId(job.groupId), message: String(job.message), auto_escape: false }
        }, 15000);
      } else {
        await writeSystemAudit(env, { type: "platform_job", groupId: String(job.groupId || ""), actorId: String(job.actorId || "system"), action: String(job.action || job.id) });
      }
    } catch (error) {
      failure = error;
    }

    const result = { ...claimed };
    delete result.claim;
    if (!failure) {
      result.status = "completed";
      result.completedAt = Date.now();
    } else {
      result.error = String(failure?.message || failure);
      if (result.attempts < result.maxAttempts) {
        result.status = "queued";
        result.nextRunAt = Date.now() + Math.min(3600000, 2 ** result.attempts * 30000);
      } else {
        result.status = "dead_letter";
      }
    }
    if (!(await dbCompareAndSwap(env, key, claimedRaw, JSON.stringify(result)))) {
      const error = new Error("Job result could not be committed; manual review required");
      error.code = "D1_STORAGE_UNAVAILABLE";
      error.retryable = true;
      throw error;
    }
    if (result.status === "dead_letter") await appendIndex(env, "platform:dead_letter:index", job.id, 2000);
  }
}

export { appendPlatformTrace, enqueuePlatformJob, listPlatformFeatures, listPlatformJobs, listPlatformTraces, platformRoleRank, processPlatformJobs };
