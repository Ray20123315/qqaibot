import releaseNotes from "../../release-notes.json" with { type: "json" };
import { DEFAULT_DEVELOPER_ID, VERSION } from "../config/runtime.js";
import { callOneBotAction } from "../core/permissions.js";
import { sendOneBotHttpAction } from "../portal/auth.js";
import { numericId } from "../security/network.js";

const STATUS_KEY = "deployment:latest_status";
const HISTORY_KEY = "deployment:history";
const LATEST_STARTED_KEY = "deployment:latest_started";
const LAST_GROUP_STARTED_AT_KEY = "deployment:last_group_started_at";
const MAX_HISTORY = 60;
const SELF_FALLBACK_SEEN_PREFIX = "deployment:self_fallback_seen:";
const SELF_FALLBACK_ANNOUNCED_PREFIX = "deployment:self_fallback_announced:";

function parseJson(raw, fallback = null) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function kvGet(env, key) {
  if (!env?.DB) throw new Error("Missing D1 binding: DB");
  const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

async function kvPut(env, key, value) {
  if (!env?.DB) throw new Error("Missing D1 binding: DB");
  const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
  if (result && result.success === false) throw new Error(`D1 write failed: ${key}`);
}

function envNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function buildKind(type) {
  const suffix = String(type || "").split(".").pop();
  return ["started", "succeeded", "failed", "canceled"].includes(suffix) ? suffix : "unknown";
}

function eventTime(event) {
  const raw = event?.payload?.createdAt || event?.payload?.created_on || event?.metadata?.eventTimestamp || Date.now();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function terminalTime(event) {
  const raw = event?.payload?.stoppedAt || event?.payload?.stopped_on || event?.metadata?.eventTimestamp || Date.now();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function metadataFor(event) {
  return event?.payload?.buildTriggerMetadata || event?.payload?.build_trigger_metadata || {};
}

function releaseSummary() {
  const added = Array.isArray(releaseNotes?.added) ? releaseNotes.added.map(String).filter(Boolean).slice(0, 4) : [];
  const fixed = Array.isArray(releaseNotes?.fixed) ? releaseNotes.fixed.map(String).filter(Boolean).slice(0, 4) : [];
  return { version: String(releaseNotes?.version || VERSION), added, fixed };
}

function compactSummary(summary = releaseSummary()) {
  const lines = [];
  if (summary.added?.length) lines.push(`新增：${summary.added.join("、")}`);
  if (summary.fixed?.length) lines.push(`修复：${summary.fixed.join("、")}`);
  return lines.slice(0, 2).join("\n");
}

function safeString(value, max = 1200) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").slice(0, max);
}

function failureDetail(event) {
  const payload = event?.payload || {};
  const candidates = [
    payload.error,
    payload.errors,
    payload.message,
    payload.failureReason,
    payload.failure_reason,
    event?.error,
    event?.message
  ].map(value => safeString(value, 2500)).filter(Boolean);
  return candidates.join("\n").slice(0, 4500);
}

function normalizeBuildEvent(event) {
  const kind = buildKind(event?.type);
  const payload = event?.payload || {};
  const trigger = metadataFor(event);
  const buildUuid = String(payload.buildUuid || payload.build_uuid || "").trim();
  return {
    kind,
    buildUuid,
    workerName: String(event?.source?.workerName || event?.source?.worker_name || "").trim(),
    branch: String(trigger.branch || "").trim(),
    commitHash: String(trigger.commitHash || trigger.commit_hash || "").trim(),
    commitMessage: String(trigger.commitMessage || trigger.commit_message || "").trim(),
    author: String(trigger.author || "").trim(),
    buildCommand: String(trigger.buildCommand || trigger.build_command || "").trim(),
    deployCommand: String(trigger.deployCommand || trigger.deploy_command || "").trim(),
    repoName: String(trigger.repoName || trigger.repo_name || "").trim(),
    createdAt: eventTime(event),
    stoppedAt: terminalTime(event),
    outcome: String(payload.buildOutcome || payload.build_outcome || payload.status || kind).trim(),
    failureDetail: failureDetail(event),
    raw: safeString(event, 12000)
  };
}

async function listWhitelistedGroups(env) {
  if (!env?.DB) return [];
  const rows = await env.DB.prepare("SELECT key FROM kv_store WHERE key LIKE 'group_whitelist:%' AND value = 'true' ORDER BY key LIMIT 1000").all();
  return (rows.results || [])
    .map(row => String(row.key || "").slice("group_whitelist:".length))
    .filter(id => /^\d{5,}$/.test(id));
}

async function sendOneBotWithFallback(env, action, params) {
  const errors = [];
  try {
    const result = await callOneBotAction(env, { action, params }, 12000);
    return { ok: true, transport: "websocket", result };
  } catch (error) {
    errors.push(`websocket:${safeString(error?.message || error, 500)}`);
  }
  try {
    const result = await sendOneBotHttpAction(env, action, params, 12000);
    return { ok: true, transport: "http", result };
  } catch (error) {
    errors.push(`http:${safeString(error?.message || error, 500)}`);
  }
  return { ok: false, transport: "none", errors };
}

async function notifyGroups(env, text) {
  const groups = await listWhitelistedGroups(env);
  const results = [];
  for (let index = 0; index < groups.length; index += 4) {
    const chunk = groups.slice(index, index + 4);
    const settled = await Promise.all(chunk.map(async groupId => ({
      groupId,
      ...(await sendOneBotWithFallback(env, "send_group_msg", { group_id: numericId(groupId), message: text, auto_escape: false }))
    })));
    results.push(...settled);
  }
  return results;
}

function developerId(env) {
  return String(env?.DEPLOY_NOTIFY_DEVELOPER_ID || env?.DEVELOPER_ID || DEFAULT_DEVELOPER_ID || "").replace(/\D/g, "");
}

async function fetchBuildLogs(env, accountId, buildUuid) {
  const token = String(env?.CLOUDFLARE_BUILDS_API_TOKEN || "").trim();
  if (!token || !accountId || !buildUuid) return "";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/builds/builds/${encodeURIComponent(buildUuid)}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return `Build logs API: HTTP ${response.status}`;
    const body = await response.json().catch(() => null);
    const lines = Array.isArray(body?.result?.lines) ? body.result.lines : [];
    return lines.map(line => Array.isArray(line) ? line.slice(1).join(" ") : String(line)).join("\n").slice(-5000);
  } catch (error) {
    return `Build logs API: ${safeString(error?.message || error, 500)}`;
  }
}

async function notifyDeveloperFailure(env, record, accountId) {
  const qq = developerId(env);
  if (!/^\d{5,}$/.test(qq)) return { ok: false, skipped: true, reason: "developer_id_missing" };
  const logs = await fetchBuildLogs(env, accountId, record.buildUuid);
  const detail = logs || record.failureDetail || "事件没有附带错误日志。请在 Cloudflare Workers Builds 中按 Build UUID 查看。";
  const text = [
    "【QQAI 部署失败详情】",
    `Worker：${record.workerName || "qqai"}`,
    `Build UUID：${record.buildUuid || "未知"}`,
    `分支：${record.branch || "未知"}`,
    `Commit：${record.commitHash ? record.commitHash.slice(0, 12) : "未知"}`,
    record.commitMessage ? `提交说明：${record.commitMessage.slice(0, 300)}` : "",
    `结果：${record.outcome || record.kind}`,
    "",
    `错误详情：\n${detail.slice(0, 5000)}`
  ].filter(Boolean).join("\n");
  return sendOneBotWithFallback(env, "send_private_msg", { user_id: numericId(qq), message: text, auto_escape: false });
}

async function appendHistory(env, record) {
  const history = parseJson(await kvGet(env, HISTORY_KEY), []);
  const next = Array.isArray(history) ? history : [];
  next.push(record);
  await kvPut(env, HISTORY_KEY, JSON.stringify(next.slice(-MAX_HISTORY)));
}

function publicMessage(record) {
  if (record.kind === "started") return "系统正在部署更新，期间可能会短暂不稳定。";
  if (record.kind === "succeeded") return "系统更新已完成。";
  if (record.kind === "failed") return "系统更新失败，当前继续使用上一个可用版本。";
  if (record.kind === "canceled") return "系统更新已取消，当前继续使用上一个可用版本。";
  return "系统部署状态已更新。";
}

async function processBuildEvent(env, event) {
  const record = normalizeBuildEvent(event);
  const expectedWorker = String(env?.DEPLOY_NOTIFY_WORKER_NAME || "qqai").trim();
  const expectedBranch = String(env?.DEPLOY_NOTIFY_BRANCH || "main").trim();
  if (!record.buildUuid || record.kind === "unknown") return { ignored: true, reason: "unsupported_event" };
  if (record.workerName !== expectedWorker || record.branch !== expectedBranch) return { ignored: true, reason: "scope_mismatch" };

  const seenKey = `deployment:seen:${record.buildUuid}:${record.kind}`;
  if (await kvGet(env, seenKey)) return { ignored: true, reason: "duplicate" };

  const latestStarted = parseJson(await kvGet(env, LATEST_STARTED_KEY), null);
  let stale = false;
  if (record.kind === "started") {
    if (!latestStarted || record.createdAt >= Number(latestStarted.createdAt || 0)) {
      await kvPut(env, LATEST_STARTED_KEY, JSON.stringify({ buildUuid: record.buildUuid, createdAt: record.createdAt, commitHash: record.commitHash }));
    }
  } else if (latestStarted && latestStarted.buildUuid !== record.buildUuid && Number(latestStarted.createdAt || 0) > record.createdAt) {
    stale = true;
  }

  const summary = releaseSummary();
  const portalRecord = {
    ...record,
    stale,
    noticeId: `${record.buildUuid}:${record.kind}`,
    releaseVersion: summary.version,
    summary,
    publicMessage: publicMessage(record),
    processedAt: Date.now()
  };
  await appendHistory(env, portalRecord);

  if (stale) {
    await kvPut(env, seenKey, String(Date.now()));
    return { ignored: true, reason: "stale_terminal", record: portalRecord };
  }
  await kvPut(env, STATUS_KEY, JSON.stringify(portalRecord));

  let groupNotification = null;
  if (record.kind === "started") {
    const cooldownMs = envNumber(env?.DEPLOY_NOTIFY_START_COOLDOWN_SECONDS, 600, 30, 86400) * 1000;
    const lastStartedAt = Number(await kvGet(env, LAST_GROUP_STARTED_AT_KEY) || 0);
    if (Date.now() - lastStartedAt >= cooldownMs) {
      groupNotification = await notifyGroups(env, publicMessage(record));
      await kvPut(env, LAST_GROUP_STARTED_AT_KEY, String(Date.now()));
    }
  } else {
    const terminalKey = `deployment:terminal_notified:${record.commitHash || record.buildUuid}:${record.kind}`;
    const selfFallbackAlreadyAnnounced = record.kind === "succeeded"
      && Boolean(await kvGet(env, `${SELF_FALLBACK_ANNOUNCED_PREFIX}${summary.version}`));
    if (!selfFallbackAlreadyAnnounced && !await kvGet(env, terminalKey)) {
      const text = record.kind === "succeeded"
        ? `${publicMessage(record)}${compactSummary(summary) ? `\n${compactSummary(summary)}` : ""}`
        : publicMessage(record);
      groupNotification = await notifyGroups(env, text);
      await kvPut(env, terminalKey, String(Date.now()));
    }
  }

  let developerNotification = null;
  if (record.kind === "failed") developerNotification = await notifyDeveloperFailure(env, portalRecord, String(event?.metadata?.accountId || ""));

  await kvPut(env, STATUS_KEY, JSON.stringify({ ...portalRecord, groupNotification, developerNotification }));
  if (record.kind === "succeeded") await kvPut(env, `${SELF_FALLBACK_ANNOUNCED_PREFIX}${summary.version}`, String(Date.now()));
  await kvPut(env, seenKey, String(Date.now()));
  return { ok: true, record: portalRecord, groupNotification, developerNotification };
}

async function announceDeployedVersionFallback(env, now = Date.now()) {
  const announcedKey = `${SELF_FALLBACK_ANNOUNCED_PREFIX}${VERSION}`;
  if (await kvGet(env, announcedKey)) return { ignored: true, reason: "already_announced" };
  const seenKey = `${SELF_FALLBACK_SEEN_PREFIX}${VERSION}`;
  const firstSeenAt = Number(await kvGet(env, seenKey) || 0);
  if (!firstSeenAt) {
    await kvPut(env, seenKey, String(now));
    return { pending: true, reason: "grace_started" };
  }
  const graceMs = envNumber(env?.DEPLOY_NOTIFY_SELF_GRACE_SECONDS, 90, 30, 900) * 1000;
  if (now - firstSeenAt < graceMs) return { pending: true, reason: "grace_wait", remainingMs: graceMs - (now - firstSeenAt) };
  const current = parseJson(await kvGet(env, STATUS_KEY), null);
  if (current?.kind === "succeeded" && String(current.releaseVersion || "") === VERSION) {
    await kvPut(env, announcedKey, String(now));
    return { ignored: true, reason: "queue_event_already_announced" };
  }
  const summary = releaseSummary();
  const text = `${publicMessage({ kind: "succeeded" })}${compactSummary(summary) ? `\n${compactSummary(summary)}` : ""}`;
  const groupNotification = await notifyGroups(env, text);
  if (groupNotification.length && groupNotification.every(item => !item.ok)) throw new Error("Deployment self-fallback could not notify any whitelisted group");
  const record = {
    kind: "succeeded", buildUuid: `self:${VERSION}`, workerName: String(env?.DEPLOY_NOTIFY_WORKER_NAME || "qqai"),
    branch: String(env?.DEPLOY_NOTIFY_BRANCH || "main"), commitHash: "", commitMessage: "Worker runtime version self-check",
    author: "system:self_fallback", buildCommand: "", deployCommand: "", repoName: "Ray20123315/qqaibot",
    createdAt: firstSeenAt, stoppedAt: now, outcome: "success", failureDetail: "", raw: "", stale: false,
    noticeId: `self:${VERSION}:succeeded`, releaseVersion: summary.version, summary, publicMessage: publicMessage({ kind: "succeeded" }),
    processedAt: now, source: "runtime_self_fallback", groupNotification, developerNotification: null
  };
  await appendHistory(env, record);
  await kvPut(env, STATUS_KEY, JSON.stringify(record));
  await kvPut(env, announcedKey, String(now));
  return { ok: true, record, groupNotification, source: "runtime_self_fallback" };
}

async function handleDeploymentBuildQueue(batch, env) {
  for (const message of batch?.messages || []) {
    try {
      await processBuildEvent(env, message.body);
      message.ack();
    } catch (error) {
      console.error("deployment build event failed", error);
      message.retry({ delaySeconds: 60 });
    }
  }
}

async function getDeploymentStatusForViewer(env, session) {
  const current = parseJson(await kvGet(env, STATUS_KEY), null);
  if (!current) return { ok: true, configured: false, status: null };
  const isDeveloper = Boolean(session?.permissions?.developer || session?.role === "developer" || String(session?.qq || "") === developerId(env));
  const base = {
    ok: true,
    configured: true,
    status: {
      noticeId: current.noticeId,
      kind: current.kind,
      message: current.publicMessage,
      releaseVersion: current.releaseVersion || VERSION,
      summary: current.summary || releaseSummary(),
      createdAt: current.createdAt,
      stoppedAt: current.stoppedAt,
      processedAt: current.processedAt,
      stale: Boolean(current.stale)
    },
    viewer: { developer: isDeveloper }
  };
  if (isDeveloper) {
    const history = parseJson(await kvGet(env, HISTORY_KEY), []);
    base.details = {
      buildUuid: current.buildUuid,
      workerName: current.workerName,
      branch: current.branch,
      commitHash: current.commitHash,
      commitMessage: current.commitMessage,
      author: current.author,
      outcome: current.outcome,
      failureDetail: current.failureDetail,
      raw: current.raw,
      history: Array.isArray(history) ? history.slice(-20).reverse() : []
    };
  }
  return base;
}

function injectDeploymentPortalClient(html) {
  const source = String(html || "");
  if (source.includes("qqai-deployment-toast")) return source;
  const addition = `
<style>
#qqai-deployment-toast{position:fixed;right:18px;bottom:18px;z-index:2147483000;max-width:min(430px,calc(100vw - 32px));padding:14px 16px;border-radius:14px;background:#172033;color:#fff;box-shadow:0 16px 48px rgba(0,0,0,.35);font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:none}
#qqai-deployment-toast[data-kind="succeeded"]{background:#14532d}#qqai-deployment-toast[data-kind="failed"],#qqai-deployment-toast[data-kind="canceled"]{background:#7f1d1d}#qqai-deployment-toast[data-kind="started"]{background:#78350f}
#qqai-deployment-toast strong{display:block;font-size:15px;margin-bottom:4px}#qqai-deployment-toast pre{white-space:pre-wrap;max-height:220px;overflow:auto;font-size:12px;background:rgba(0,0,0,.2);padding:8px;border-radius:8px}#qqai-deployment-toast button{float:right;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer}
</style>
<div id="qqai-deployment-toast" role="status" aria-live="polite"><button type="button" aria-label="关闭">×</button><strong></strong><div class="qqai-deployment-message"></div><pre hidden></pre></div>
<script>
(()=>{const box=document.getElementById('qqai-deployment-toast');if(!box)return;box.querySelector('button').onclick=()=>box.style.display='none';let running=false;async function poll(){if(running)return;running=true;try{const r=await fetch('/api/deployment/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const data=await r.json();const s=data&&data.status;if(!s||!s.noticeId||s.stale)return;const key='qqai_deploy_notice_seen';if(localStorage.getItem(key)===s.noticeId)return;localStorage.setItem(key,s.noticeId);box.dataset.kind=s.kind||'';box.querySelector('strong').textContent=s.releaseVersion?('QQAI '+s.releaseVersion+' 部署通知'):'QQAI 部署通知';let text=s.message||'';if(s.kind==='succeeded'&&s.summary){const lines=[];if(s.summary.added&&s.summary.added.length)lines.push('新增：'+s.summary.added.join('、'));if(s.summary.fixed&&s.summary.fixed.length)lines.push('修复：'+s.summary.fixed.join('、'));if(lines.length)text+='\n'+lines.join('\n')}box.querySelector('.qqai-deployment-message').textContent=text;const pre=box.querySelector('pre');if(data.viewer&&data.viewer.developer&&data.details&&(s.kind==='failed'||s.kind==='canceled')){pre.hidden=false;pre.textContent=['Build UUID：'+(data.details.buildUuid||'未知'),'Commit：'+(data.details.commitHash||'未知'),'提交说明：'+(data.details.commitMessage||'无'),'结果：'+(data.details.outcome||s.kind),'错误：'+(data.details.failureDetail||'事件未附带错误日志')].join('\n')}else{pre.hidden=true;pre.textContent=''}box.style.display='block'}catch{}finally{running=false}}poll();setInterval(poll,15000)})();
</script>`;
  return source.includes("</body>") ? source.replace("</body>", `${addition}\n</body>`) : `${source}${addition}`;
}

export { announceDeployedVersionFallback, getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient, processBuildEvent };
