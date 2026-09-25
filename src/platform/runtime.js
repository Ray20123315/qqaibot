// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { PLATFORM_FEATURES } from "../config/runtime.js";
import { appendIndex, callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbGet, dbGetStrict, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";




function platformRoleRank(role){return({member:0,admin:1,owner:2,developer:3})[String(role||'member')]??0}


function platformFeatureById(id){return PLATFORM_FEATURES.find(x=>x.id===String(id||'').toUpperCase())||null}


function platformFeatureKey(feature,groupId){return feature.scope==='global'?`platform:feature:${feature.id}:global`:`platform:feature:${feature.id}:group:${String(groupId||'')}`}


async function platformFeatureEnabled(env,feature,groupId){const v=await dbGet(env,platformFeatureKey(feature,groupId));return v==null?feature.defaultEnabled:v==='true'}


async function listPlatformFeatures(env, { groupId = '', role = 'member', query = '', includeHidden = false } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const rank = platformRoleRank(role);
  const rows = [];
  for (const feature of PLATFORM_FEATURES) {
    if (!includeHidden && platformRoleRank(feature.minRole) > rank) continue;
    const searchable = [feature.id, feature.name, feature.category, feature.mode].join(' ').toLowerCase();
    if (q && !searchable.includes(q)) continue;
    const configuredEnabled = await platformFeatureEnabled(env, feature, groupId);
    rows.push({ ...feature, enabled: configuredEnabled, configuredEnabled, enforced: false });
  }
  return rows;
}


async function setPlatformFeature(env, { feature }) {
  return { ok: false, code: "LEGACY_FEATURE_CATALOG_REMOVED", message: "舊功能目錄已移除；請改用 V3 插件管理。" };
}


async function appendPlatformTrace(env,data){const id=`tr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,item={id,at:Date.now(),...data};await dbPut(env,`platform:trace:${id}`,JSON.stringify(item));await appendIndex(env,'platform:trace:index',id,5000);if(item.groupId)await appendIndex(env,`platform:trace:index:${item.groupId}`,id,2000);return item}


async function listPlatformTraces(env,{groupId='',query='',limit=200}={}){const ids=await readJson(env,groupId?`platform:trace:index:${groupId}`:'platform:trace:index',[]),q=String(query||'').toLowerCase(),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:trace:${id}`,null);if(x&&(!q||JSON.stringify(x).toLowerCase().includes(q)))rows.push(x)}return rows}


async function enqueuePlatformJob(env,data){const id=`job_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,job={id,status:'queued',attempts:0,maxAttempts:Math.max(1,Math.min(10,Number(data.maxAttempts||3))),createdAt:Date.now(),nextRunAt:Number(data.nextRunAt||Date.now()),...data};await dbPut(env,`platform:job:${id}`,JSON.stringify(job));await appendIndex(env,'platform:job:index',id,5000);return job}


async function listPlatformJobs(env,{groupId='',status='',limit=200}={}){const ids=await readJson(env,'platform:job:index',[]),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:job:${id}`,null);if(!x)continue;if(groupId&&String(x.groupId||'')!==String(groupId))continue;if(status&&x.status!==status)continue;rows.push(x)}return rows}


async function processPlatformJobs(env, now = Date.now()) {
  if (!env?.DB) return;
  const candidates = (await listPlatformJobs(env, { limit: 100 })).reverse();
  for (const candidate of candidates) {
    if (!["queued", "running"].includes(String(candidate.status || ""))) continue;
    if (candidate.status === "queued" && Number(candidate.nextRunAt || 0) > now) continue;
    if (candidate.status === "running" && Number(candidate.leaseUntil || 0) > now) continue;
    const owner = `job:${crypto.randomUUID()}`;
    const key = `platform:job:${candidate.id}`;
    const claimResult = await env.DB.prepare(`UPDATE kv_store SET value = json_set(value,
        '$.status', 'running',
        '$.attempts', coalesce(CAST(json_extract(value, '$.attempts') AS INTEGER), 0) + 1,
        '$.leaseOwner', ?, '$.leaseUntil', ?)
      WHERE key = ? AND (
        (json_extract(value, '$.status') = 'queued' AND CAST(coalesce(json_extract(value, '$.nextRunAt'), 0) AS INTEGER) <= ?)
        OR (json_extract(value, '$.status') = 'running' AND CAST(coalesce(json_extract(value, '$.leaseUntil'), 0) AS INTEGER) <= ?)
      )`).bind(owner, now + 2 * 60 * 1000, key, now, now).run();
    if (claimResult?.success === false) throw Object.assign(new Error("D1 platform job claim failed"), { code: "D1_STORAGE_UNAVAILABLE" });
    if (Number(claimResult?.meta?.changes || 0) !== 1) continue;
    let job;
    try { job = JSON.parse(await dbGetStrict(env, key)); } catch { continue; }
    if (job?.leaseOwner !== owner) continue;
    try {
      if (job.type === "notification" && job.groupId && job.message) {
        await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(job.groupId), message: String(job.message), auto_escape: false } }, 15000);
      } else {
        await writeSystemAudit(env, { type: "platform_job", groupId: String(job.groupId || ""), actorId: String(job.actorId || "system"), action: String(job.action || job.id) });
      }
      job.status = "completed";
      job.completedAt = Date.now();
    } catch (error) {
      job.error = String(error?.message || error).slice(0, 500);
      if (Number(job.attempts || 0) < Number(job.maxAttempts || 3)) {
        job.status = "queued";
        job.nextRunAt = Date.now() + Math.min(3600000, 2 ** Number(job.attempts || 1) * 30000);
      } else {
        job.status = "dead_letter";
        await appendIndex(env, "platform:dead_letter:index", job.id, 2000);
      }
    }
    delete job.leaseOwner;
    delete job.leaseUntil;
    const saveResult = await env.DB.prepare("UPDATE kv_store SET value = ? WHERE key = ? AND json_extract(value, '$.leaseOwner') = ?")
      .bind(JSON.stringify(job), key, owner).run();
    if (saveResult?.success === false) throw Object.assign(new Error("D1 platform job save failed"), { code: "D1_STORAGE_UNAVAILABLE" });
  }
}

export { appendPlatformTrace, enqueuePlatformJob, listPlatformFeatures, listPlatformJobs, listPlatformTraces, platformFeatureById, platformFeatureEnabled, platformFeatureKey, platformRoleRank, processPlatformJobs, setPlatformFeature };
