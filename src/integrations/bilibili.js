// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { VERSION } from "../config/runtime.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbClaimLeaseStrict, dbDel, dbDeleteKeyIfJsonFieldEquals, dbGet, dbPut, dbPutStrict } from "../data/store.js";
import { getBotGroupRole } from "../group/runtime.js";
import { jsonResponse, readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";



function normalizeBilibiliEvent(payload) {
  const data = payload?.data || payload?.event_data || payload?.body || payload || {};
  const rawType = String(payload?.event_type || payload?.event || payload?.cmd || payload?.type || data?.event_type || data?.type || "").toLowerCase();
  let type = "unknown";
  if (/live.*start|start.*live|live_open_platform_live_start|开播|開播/.test(rawType)) type = "live_start";
  else if (/video.*publish|archive.*publish|稿件.*发布|投稿|new_video/.test(rawType)) type = "video_publish";
  const creatorId = String(data?.open_id || data?.uid || data?.mid || data?.creator_id || payload?.open_id || payload?.uid || "");
  const creatorName = String(data?.uname || data?.name || data?.creator_name || payload?.creator_name || "");
  const title = String(data?.title || data?.room_title || data?.archive_title || payload?.title || "");
  const roomId = String(data?.room_id || data?.roomid || payload?.room_id || "");
  const bvid = String(data?.bvid || data?.bv_id || payload?.bvid || "");
  const url = String(data?.url || data?.link || payload?.url || (type === "live_start" && roomId ? `https://live.bilibili.com/${roomId}` : type === "video_publish" && bvid ? `https://www.bilibili.com/video/${bvid}` : ""));
  const eventId = String(payload?.event_id || payload?.id || data?.event_id || `${type}:${creatorId}:${roomId || bvid}:${title}`).slice(0, 256);
  return { type, creatorId, creatorName, title, roomId, bvid, url, eventId, rawType };
}



async function sendBilibiliConnectorNotification(env, connector, event) {
  const notify = event.type === "live_start" ? connector.liveNotify : event.type === "video_publish" ? connector.videoNotify : false;
  const atAllRequested = event.type === "live_start" ? connector.liveAtAll : event.type === "video_publish" ? connector.videoAtAll : false;
  const log = { at: Date.now(), connectorId: connector.id, groupId: connector.groupId, event };
  if (!notify) {
    log.status = "record_only";
    await dbPutStrict(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log));
    return { ok: true, sent: false };
  }
  const botRole = (await getBotGroupRole(env, connector.groupId)).role;
  const canAtAll = botRole === "owner" || botRole === "admin";
  const prefix = atAllRequested && canAtAll ? "[CQ:at,qq=all] " : "";
  const label = event.type === "live_start" ? "开播通知" : "新视频通知";
  const creator = event.creatorName || connector.creatorName || event.creatorId || connector.creatorId || "B站创作者";
  const message = `${prefix}【${label}】${creator}\n${event.title || (event.type === "live_start" ? "直播已开始" : "已上传新视频")}${event.url ? "\n" + event.url : ""}`;
  try {
    await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(connector.groupId), message, auto_escape: false } }, 15000);
    log.status = "sent";
    log.atAllRequested = atAllRequested;
    log.atAllSent = atAllRequested && canAtAll;
    await dbPutStrict(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log)).catch(error => console.warn("Bilibili delivery log save failed", String(error?.code || error?.message || error)));
    return { ok: true, sent: true };
  } catch (error) {
    log.status = "failed"; log.error = String(error?.message || error);
    await dbPut(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log)).catch(() => {});
    return { ok: false, error: log.error };
  }
}



async function listBilibiliConnectors(env, groupId) {
  const ids = await readJson(env, `bili:connector:index:${groupId}`, []);
  const result = [];
  for (const id of ids) { const item = await readJson(env, `bili:connector:${id}`, null); if (item) result.push(item); }
  return result;
}



const BILIBILI_POLL_MIN_SECONDS = 1800;


const BILIBILI_POLL_DEFAULT_SECONDS = 1800;


const BILIBILI_POLL_MAX_SECONDS = 21600;


const BILIBILI_BLOCK_BACKOFF_MAX_SECONDS = 72 * 60 * 60;



function normalizeBilibiliUid(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 24);
}



function bilibiliPollIntervalSeconds(value) {
  const n = Number(value || BILIBILI_POLL_DEFAULT_SECONDS);
  return Math.max(BILIBILI_POLL_MIN_SECONDS, Math.min(BILIBILI_POLL_MAX_SECONDS, Number.isFinite(n) ? Math.floor(n) : BILIBILI_POLL_DEFAULT_SECONDS));
}



function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0))); }


function isBilibiliBlockedError(error) { return /HTTP\s*(?:412|429)|错误\s*-412|request was banned|请求被拦截|風控|风控|rate.?limit/i.test(String(error?.message || error || "")); }



async function fetchBilibiliJson(url, timeoutMs = 12000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "Referer": "https://www.bilibili.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    };
    const cookie = String(options?.cookie || "").trim();
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(url, { headers, signal: controller.signal });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0, 180)}`);
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error(`B站返回的不是 JSON：${raw.slice(0, 180)}`); }
    if (payload && Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) {
      throw new Error(`B站接口错误 ${payload.code}：${payload.message || payload.msg || "未知错误"}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}



async function fetchBilibiliLiveSnapshot(uid, env = {}) {
  const payload = await fetchBilibiliJson(`https://api.live.bilibili.com/room/v1/Room/getRoomInfoOld?mid=${encodeURIComponent(uid)}`, 12000, { cookie: env.BILIBILI_COOKIE });
  const data = payload?.data || {};
  const roomId = String(data.roomid || data.room_id || "");
  return {
    available: Boolean(roomId || data.title || data.uname),
    live: Number(data.liveStatus ?? data.live_status ?? 0) === 1,
    liveStatus: Number(data.liveStatus ?? data.live_status ?? 0),
    roomId,
    title: String(data.title || data.room_title || ""),
    creatorName: String(data.uname || data.name || ""),
    url: roomId ? `https://live.bilibili.com/${roomId}` : `https://space.bilibili.com/${uid}`
  };
}



function extractBilibiliVideoFromDynamic(payload, uid) {
  const items = payload?.data?.items || payload?.data?.list || [];
  for (const item of items) {
    const major = item?.modules?.module_dynamic?.major || item?.module_dynamic?.major || {};
    const archive = major?.archive || major?.ugc_season || item?.archive || {};
    const bvid = String(archive.bvid || archive.bv_id || item?.bvid || "");
    if (!bvid) continue;
    const author = item?.modules?.module_author || item?.module_author || {};
    return {
      bvid,
      title: String(archive.title || item?.title || ""),
      creatorName: String(author.name || author.uname || ""),
      publishedAt: Number(author.pub_ts || item?.pub_ts || archive.pub_ts || 0),
      url: `https://www.bilibili.com/video/${bvid}`
    };
  }
  return null;
}



function extractBilibiliVideoFromArchiveSearch(payload) {
  const list = payload?.data?.list?.vlist || payload?.data?.list || [];
  const item = Array.isArray(list) ? list[0] : null;
  if (!item) return null;
  const bvid = String(item.bvid || item.bv_id || "");
  if (!bvid) return null;
  return {
    bvid,
    title: String(item.title || ""),
    creatorName: String(item.author || item.uname || ""),
    publishedAt: Number(item.created || item.pubdate || 0),
    url: `https://www.bilibili.com/video/${bvid}`
  };
}



async function fetchBilibiliVideoSnapshot(uid, env = {}) {
  const errors = [];
  const cookie = env.BILIBILI_COOKIE;
  const urls = [
    `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${encodeURIComponent(uid)}&timezone_offset=-480&features=itemOpusStyle`,
    `https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?host_mid=${encodeURIComponent(uid)}&timezone_offset=-480&features=itemOpusStyle`
  ];
  for (const endpoint of urls) {
    try {
      const payload = await fetchBilibiliJson(endpoint, 12000, { cookie });
      const video = extractBilibiliVideoFromDynamic(payload, uid);
      if (video) return video;
      errors.push("動態接口沒有找到影片稿件");
    } catch (error) {
      errors.push(String(error?.message || error));
      if (isBilibiliBlockedError(error) && !cookie) break;
    }
    await waitMs(1200);
  }
  try {
    const payload = await fetchBilibiliJson(`https://api.bilibili.com/x/space/arc/search?mid=${encodeURIComponent(uid)}&pn=1&ps=1&order=pubdate`, 12000, { cookie });
    const video = extractBilibiliVideoFromArchiveSearch(payload);
    if (video) return video;
    errors.push("投稿接口沒有返回影片");
  } catch (error) { errors.push(String(error?.message || error)); }
  throw new Error(errors.join("；").slice(0, 800) || "無法取得最新影片");
}



async function fetchBilibiliAutomaticSnapshot(uid, env = {}) {
  const errors = [];
  let live = null; let video = null;
  try { live = await fetchBilibiliLiveSnapshot(uid, env); }
  catch (error) {
    errors.push(`直播：${String(error?.message || error)}`);
    if (isBilibiliBlockedError(error)) throw new Error(errors.join("；"));
  }
  // 避免同一秒连续请求多个 B站接口，降低被风控的概率。
  await waitMs(1800);
  try { video = await fetchBilibiliVideoSnapshot(uid, env); }
  catch (error) { errors.push(`视频：${String(error?.message || error)}`); }
  if (!live && !video) throw new Error(errors.join("；") || "B站检查失败");
  return { checkedAt: Date.now(), live, video, errors };
}



async function listAllBilibiliConnectorIds(env) {
  const ids = await readJson(env, "bili:connector:index:all", []);
  return [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))].slice(0, 5000);
}



async function pollOneAutomaticBilibiliConnector(env, connector, now = Date.now(), { force = false } = {}) {
  if (!connector || connector.enabled === false) return { ok: true, skipped: "disabled" };
  const uid = normalizeBilibiliUid(connector.creatorId);
  if (!uid) return { ok: false, skipped: "missing_uid", message: "自动监控必须填写数字 UID。" };
  const intervalSeconds = bilibiliPollIntervalSeconds(connector.pollIntervalSeconds);
  if (force && connector.lastCheckStatus === "blocked" && Number(connector.nextPollAt || 0) > now) {
    return { ok: false, skipped: "blocked_backoff", message: `B站 412 风控暂停中，请等到 ${new Date(Number(connector.nextPollAt)).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" })} 后再检查。`, connector };
  }
  if (!force && Number(connector.nextPollAt || 0) > now) return { ok: true, skipped: "not_due" };
  connector.mode = "automatic_polling";
  connector.pollIntervalSeconds = intervalSeconds;
  connector.lastCheckAt = now;
  try {
    const snapshot = await fetchBilibiliAutomaticSnapshot(uid, env);
    const previous = connector.pollState || {};
    const initialized = Boolean(previous.initialized);
    const events = [];
    if (initialized && snapshot.live && snapshot.live.live && !previous.live) {
      events.push({
        type: "live_start", creatorId: uid,
        creatorName: snapshot.live.creatorName || connector.creatorName,
        title: snapshot.live.title || "直播已开始",
        roomId: snapshot.live.roomId || "", url: snapshot.live.url || `https://space.bilibili.com/${uid}`,
        eventId: `auto:live:${uid}:${snapshot.live.roomId || "room"}:${now}`
      });
    }
    if (initialized && snapshot.video?.bvid && previous.latestVideoBvid && snapshot.video.bvid !== previous.latestVideoBvid) {
      events.push({
        type: "video_publish", creatorId: uid,
        creatorName: snapshot.video.creatorName || connector.creatorName,
        title: snapshot.video.title || "已发布新视频", bvid: snapshot.video.bvid,
        url: snapshot.video.url, eventId: `auto:video:${uid}:${snapshot.video.bvid}`
      });
    }
    const results = [];
    for (const event of events) results.push(await sendBilibiliConnectorNotification(env, connector, event));
    connector.pollState = {
      initialized: true,
      live: snapshot.live ? Boolean(snapshot.live.live) : Boolean(previous.live),
      liveStatus: snapshot.live ? snapshot.live.liveStatus : previous.liveStatus,
      roomId: snapshot.live?.roomId || previous.roomId || "",
      liveTitle: snapshot.live?.title || previous.liveTitle || "",
      latestVideoBvid: snapshot.video?.bvid || previous.latestVideoBvid || "",
      latestVideoTitle: snapshot.video?.title || previous.latestVideoTitle || "",
      latestVideoPublishedAt: snapshot.video?.publishedAt || previous.latestVideoPublishedAt || 0,
      checkedAt: snapshot.checkedAt
    };
    if (!connector.creatorName) connector.creatorName = snapshot.live?.creatorName || snapshot.video?.creatorName || connector.creatorName;
    connector.lastCheckStatus = snapshot.errors.length ? "partial" : "ok";
    connector.lastCheckError = snapshot.errors.join("；").slice(0, 1000);
    connector.consecutiveFailures = 0;
    connector.nextPollAt = now + intervalSeconds * 1000 + Math.floor(Math.random() * 60000);
    connector.updatedAt = Date.now();
    await dbPut(env, `bili:connector:${connector.id}`, JSON.stringify(connector));
    await writeSystemAudit(env, { type: "bilibili_auto_poll", groupId: connector.groupId, actorId: "system", action: initialized ? "checked" : "baseline_created", connectorId: connector.id, events: events.map(x => x.type), partialErrors: snapshot.errors });
    return { ok: true, baseline: !initialized, events, results, connector };
  } catch (error) {
    connector.consecutiveFailures = Number(connector.consecutiveFailures || 0) + 1;
    const blocked = isBilibiliBlockedError(error);
    const backoffSeconds = blocked
      ? Math.min(BILIBILI_BLOCK_BACKOFF_MAX_SECONDS, 12 * 60 * 60 * (2 ** Math.min(2, connector.consecutiveFailures - 1)))
      : Math.min(BILIBILI_POLL_MAX_SECONDS, Math.max(intervalSeconds, 15 * 60 * (2 ** Math.min(4, connector.consecutiveFailures - 1))));
    connector.lastCheckStatus = blocked ? "blocked" : "failed";
    connector.lastCheckError = blocked
      ? `B站返回 412／429 風控或限流。輪詢已暫停 ${Math.round(backoffSeconds / 3600)} 小時；可設定 BILIBILI_COOKIE Worker secret 後再以低頻輪詢重試，不要提高抓取頻率。原始錯誤：${String(error?.message || error)}`.slice(0, 1200)
      : String(error?.message || error).slice(0, 1200);
    connector.nextPollAt = now + backoffSeconds * 1000;
    connector.updatedAt = Date.now();
    await dbPut(env, `bili:connector:${connector.id}`, JSON.stringify(connector));
    await writeSystemAudit(env, { type: "bilibili_auto_poll", groupId: connector.groupId, actorId: "system", action: "failed", connectorId: connector.id, error: connector.lastCheckError, nextPollAt: connector.nextPollAt });
    return { ok: false, message: connector.lastCheckError, connector };
  }
}



async function pollAutomaticBilibiliConnectors(env, now = Date.now()) {
  const lockAt = Number(await dbGet(env, "bili:auto_poll:lock") || 0);
  if (lockAt && now - lockAt < 25 * 60 * 1000) return;
  await dbPut(env, "bili:auto_poll:lock", String(now));
  try {
    const ids = await listAllBilibiliConnectorIds(env);
    if (!ids.length) return;
    const scanLimit = Math.max(5, Math.min(50, Number(env.BILIBILI_POLL_SCAN_LIMIT || 25)));
    const dueLimit = Math.max(1, Math.min(5, Number(env.BILIBILI_POLL_DUE_LIMIT || 3)));
    let cursor = Math.max(0, Number(await dbGet(env, "bili:auto_poll:cursor") || 0)) % ids.length;
    const due = [];
    const scanned = Math.min(scanLimit, ids.length);
    for (let offset = 0; offset < scanned; offset++) {
      const index = (cursor + offset) % ids.length;
      const connector = await readJson(env, `bili:connector:${ids[index]}`, null);
      if (!connector || connector.enabled === false) continue;
      if (Number(connector.nextPollAt || 0) > now) continue;
      due.push(connector);
      if (due.length >= dueLimit) break;
    }
    cursor = (cursor + scanned) % ids.length;
    await dbPut(env, "bili:auto_poll:cursor", String(cursor));
    for (let index = 0; index < due.length; index++) {
      await pollOneAutomaticBilibiliConnector(env, due[index], Date.now());
      if (index < due.length - 1) await waitMs(1500);
    }
  } finally {
    await dbDel(env, "bili:auto_poll:lock");
  }
}

export { BILIBILI_BLOCK_BACKOFF_MAX_SECONDS, BILIBILI_POLL_DEFAULT_SECONDS, BILIBILI_POLL_MAX_SECONDS, BILIBILI_POLL_MIN_SECONDS, bilibiliPollIntervalSeconds, extractBilibiliVideoFromArchiveSearch, extractBilibiliVideoFromDynamic, fetchBilibiliAutomaticSnapshot, fetchBilibiliJson, fetchBilibiliLiveSnapshot, fetchBilibiliVideoSnapshot, isBilibiliBlockedError, listAllBilibiliConnectorIds, listBilibiliConnectors, normalizeBilibiliEvent, normalizeBilibiliUid, pollAutomaticBilibiliConnectors, pollOneAutomaticBilibiliConnector, sendBilibiliConnectorNotification, waitMs };
