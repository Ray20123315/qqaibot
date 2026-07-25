import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}
function insertBeforeOnce(source, marker, insertion, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing insertion anchor: ${label}`);
  if (source.indexOf(marker, index + marker.length) >= 0) throw new Error(`Ambiguous insertion anchor: ${label}`);
  return source.slice(0, index) + insertion + marker + source.slice(index);
}

{
  const path = "src/deployment/notifications.js";
  let source = read(path);
  source = replaceOnce(source, "const MAX_HISTORY = 60;\n", [
    "const MAX_HISTORY = 60;",
    "const SELF_FALLBACK_SEEN_PREFIX = \"deployment:self_fallback_seen:\";",
    "const SELF_FALLBACK_ANNOUNCED_PREFIX = \"deployment:self_fallback_announced:\";",
    ""
  ].join("\n"), "deployment fallback constants");

  const oldTerminal = [
    "  } else {",
    "    const terminalKey = `deployment:terminal_notified:${record.commitHash || record.buildUuid}:${record.kind}`;",
    "    if (!await kvGet(env, terminalKey)) {",
    "      const text = record.kind === \"succeeded\"",
    "        ? `${publicMessage(record)}${compactSummary(summary) ? `\\n${compactSummary(summary)}` : \"\"}`",
    "        : publicMessage(record);",
    "      groupNotification = await notifyGroups(env, text);",
    "      await kvPut(env, terminalKey, String(Date.now()));",
    "    }",
    "  }"
  ].join("\n");
  const newTerminal = [
    "  } else {",
    "    const terminalKey = `deployment:terminal_notified:${record.commitHash || record.buildUuid}:${record.kind}`;",
    "    const selfFallbackAlreadyAnnounced = record.kind === \"succeeded\"",
    "      && Boolean(await kvGet(env, `${SELF_FALLBACK_ANNOUNCED_PREFIX}${summary.version}`));",
    "    if (!selfFallbackAlreadyAnnounced && !await kvGet(env, terminalKey)) {",
    "      const text = record.kind === \"succeeded\"",
    "        ? `${publicMessage(record)}${compactSummary(summary) ? `\\n${compactSummary(summary)}` : \"\"}`",
    "        : publicMessage(record);",
    "      groupNotification = await notifyGroups(env, text);",
    "      await kvPut(env, terminalKey, String(Date.now()));",
    "    }",
    "  }"
  ].join("\n");
  source = replaceOnce(source, oldTerminal, newTerminal, "queue terminal dedupe against self fallback");

  source = replaceOnce(source,
    "  await kvPut(env, STATUS_KEY, JSON.stringify({ ...portalRecord, groupNotification, developerNotification }));\n  await kvPut(env, seenKey, String(Date.now()));",
    [
      "  await kvPut(env, STATUS_KEY, JSON.stringify({ ...portalRecord, groupNotification, developerNotification }));",
      "  if (record.kind === \"succeeded\") await kvPut(env, `${SELF_FALLBACK_ANNOUNCED_PREFIX}${summary.version}`, String(Date.now()));",
      "  await kvPut(env, seenKey, String(Date.now()));"
    ].join("\n"),
    "queue success marks fallback announced"
  );

  const fallbackFunction = [
    "async function announceDeployedVersionFallback(env, now = Date.now()) {",
    "  const announcedKey = `${SELF_FALLBACK_ANNOUNCED_PREFIX}${VERSION}`;",
    "  if (await kvGet(env, announcedKey)) return { ignored: true, reason: \"already_announced\" };",
    "  const seenKey = `${SELF_FALLBACK_SEEN_PREFIX}${VERSION}`;",
    "  const firstSeenAt = Number(await kvGet(env, seenKey) || 0);",
    "  if (!firstSeenAt) {",
    "    await kvPut(env, seenKey, String(now));",
    "    return { pending: true, reason: \"grace_started\" };",
    "  }",
    "  const graceMs = envNumber(env?.DEPLOY_NOTIFY_SELF_GRACE_SECONDS, 90, 30, 900) * 1000;",
    "  if (now - firstSeenAt < graceMs) return { pending: true, reason: \"grace_wait\", remainingMs: graceMs - (now - firstSeenAt) };",
    "  const current = parseJson(await kvGet(env, STATUS_KEY), null);",
    "  if (current?.kind === \"succeeded\" && String(current.releaseVersion || \"\") === VERSION) {",
    "    await kvPut(env, announcedKey, String(now));",
    "    return { ignored: true, reason: \"queue_event_already_announced\" };",
    "  }",
    "  const summary = releaseSummary();",
    "  const text = `${publicMessage({ kind: \"succeeded\" })}${compactSummary(summary) ? `\\n${compactSummary(summary)}` : \"\"}`;",
    "  const groupNotification = await notifyGroups(env, text);",
    "  if (groupNotification.length && groupNotification.every(item => !item.ok)) throw new Error(\"Deployment self-fallback could not notify any whitelisted group\");",
    "  const record = {",
    "    kind: \"succeeded\", buildUuid: `self:${VERSION}`, workerName: String(env?.DEPLOY_NOTIFY_WORKER_NAME || \"qqai\"),",
    "    branch: String(env?.DEPLOY_NOTIFY_BRANCH || \"main\"), commitHash: \"\", commitMessage: \"Worker runtime version self-check\",",
    "    author: \"system:self_fallback\", buildCommand: \"\", deployCommand: \"\", repoName: \"Ray20123315/qqaibot\",",
    "    createdAt: firstSeenAt, stoppedAt: now, outcome: \"success\", failureDetail: \"\", raw: \"\", stale: false,",
    "    noticeId: `self:${VERSION}:succeeded`, releaseVersion: summary.version, summary, publicMessage: publicMessage({ kind: \"succeeded\" }),",
    "    processedAt: now, source: \"runtime_self_fallback\", groupNotification, developerNotification: null",
    "  };",
    "  await appendHistory(env, record);",
    "  await kvPut(env, STATUS_KEY, JSON.stringify(record));",
    "  await kvPut(env, announcedKey, String(now));",
    "  return { ok: true, record, groupNotification, source: \"runtime_self_fallback\" };",
    "}",
    "",
    ""
  ].join("\n");
  source = insertBeforeOnce(source, "async function handleDeploymentBuildQueue(batch, env) {", fallbackFunction, "deployment fallback function");
  source = replaceOnce(source,
    "export { getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient, processBuildEvent };",
    "export { announceDeployedVersionFallback, getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient, processBuildEvent };",
    "deployment export"
  );
  write(path, source);
}

{
  const path = "worker.js";
  let source = read(path);
  source = replaceOnce(source,
    'import { getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient } from "./src/deployment/notifications.js";',
    'import { announceDeployedVersionFallback, getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient } from "./src/deployment/notifications.js";',
    "worker deployment import"
  );
  source = replaceOnce(source,
    '    ctx.waitUntil(dbPut(env, "system:last_cron", String(Number(controller?.scheduledTime || Date.now()))));',
    [
      '    ctx.waitUntil(dbPut(env, "system:last_cron", String(Number(controller?.scheduledTime || Date.now()))));',
      '    ctx.waitUntil(announceDeployedVersionFallback(env).catch(error => console.error("deployment self-fallback failed", error)));'
    ].join("\n"),
    "scheduled deployment fallback"
  );
  write(path, source);
}

{
  const path = "verify-deployment-notifications.mjs";
  let source = read(path);
  source = replaceOnce(source,
    'import { getDeploymentStatusForViewer, processBuildEvent } from "./src/deployment/notifications.js";',
    'import { announceDeployedVersionFallback, getDeploymentStatusForViewer, processBuildEvent } from "./src/deployment/notifications.js";',
    "deployment test import"
  );
  source = replaceOnce(source, '\nconsole.log("deployment notification checks passed");', [
    "",
    "const fallbackDb = new MockD1();",
    'const fallbackEnv = { DB: fallbackDb, DEPLOY_NOTIFY_DEVELOPER_ID: "", DEPLOY_NOTIFY_SELF_GRACE_SECONDS: "30" };',
    "const fallbackFirst = await announceDeployedVersionFallback(fallbackEnv, t0 + 20000);",
    'assert.equal(fallbackFirst.reason, "grace_started");',
    "const fallbackSuccess = await announceDeployedVersionFallback(fallbackEnv, t0 + 51000);",
    'assert.equal(fallbackSuccess.ok, true, "Runtime fallback must announce a live version when Queue events are absent");',
    "const fallbackStatus = await getDeploymentStatusForViewer(fallbackEnv, viewer);",
    'assert.equal(fallbackStatus.status.kind, "succeeded");',
    'assert.equal(fallbackStatus.status.releaseVersion, "2.0.3");',
    "const fallbackDuplicate = await announceDeployedVersionFallback(fallbackEnv, t0 + 90000);",
    'assert.equal(fallbackDuplicate.reason, "already_announced");',
    "",
    'console.log("deployment notification checks passed");'
  ].join("\n"), "deployment fallback tests");
  write(path, source);
}
