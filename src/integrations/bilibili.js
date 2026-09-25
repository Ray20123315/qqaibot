// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { VERSION } from "../config/runtime.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbClaimLeaseStrict, dbDel, dbDeleteKeyIfJsonFieldEquals, dbGet, dbPut, dbPutStrict } from "../data/store.js";
import { getBotGroupRole } from "../group/runtime.js";
import { jsonResponse, readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";



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
const BILIBILI_PROVIDER_REVISION = 2;
const BILIBILI_VIDEO_BLOCK_BACKOFF_SECONDS = 6 * 60 * 60;
const BILIBILI_WBI_CACHE_KEY = "bili:wbi:key:v1";
const BILIBILI_WBI_CACHE_TTL_MS = 30 * 60 * 1000;
const BILIBILI_LIVE_BATCH_API = "https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids";
const BILIBILI_WBI_NAV_API = "https://api.bilibili.com/x/web-interface/nav";
const BILIBILI_ARCHIVE_WBI_API = "https://api.bilibili.com/x/space/wbi/arc/search";
const BILIBILI_WBI_MIXIN_KEY_ENC_TAB = Object.freeze([46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]);



function normalizeBilibiliUid(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 24);
}



function bilibiliPollIntervalSeconds(value) {
  const n = Number(value || BILIBILI_POLL_DEFAULT_SECONDS);
  return Math.max(BILIBILI_POLL_MIN_SECONDS, Math.min(BILIBILI_POLL_MAX_SECONDS, Number.isFinite(n) ? Math.floor(n) : BILIBILI_POLL_DEFAULT_SECONDS));
}



function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0))); }


function bilibiliBrowserHeaders(cookie = "") {
  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.bilibili.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  };
  const value = String(cookie || "").trim();
  if (value) headers.Cookie = value;
  return headers;
}


function md5Hex(value) {
  const text = unescape(encodeURIComponent(String(value ?? "")));
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cmn(q, a, b, x, bits, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << bits) | (a >>> (32 - bits)), b);
  }
  function ff(a,b,c,d,x,bits,t){ return cmn((b & c) | ((~b) & d), a, b, x, bits, t); }
  function gg(a,b,c,d,x,bits,t){ return cmn((b & d) | (c & (~d)), a, b, x, bits, t); }
  function hh(a,b,c,d,x,bits,t){ return cmn(b ^ c ^ d, a, b, x, bits, t); }
  function ii(a,b,c,d,x,bits,t){ return cmn(c ^ (b | (~d)), a, b, x, bits, t); }
  function cycle(state, k) {
    let [a,b,c,d] = state;
    a=ff(a,b,c,d,k[0],7,-680876936); d=ff(d,a,b,c,k[1],12,-389564586); c=ff(c,d,a,b,k[2],17,606105819); b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897); d=ff(d,a,b,c,k[5],12,1200080426); c=ff(c,d,a,b,k[6],17,-1473231341); b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416); d=ff(d,a,b,c,k[9],12,-1958414417); c=ff(c,d,a,b,k[10],17,-42063); b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682); d=ff(d,a,b,c,k[13],12,-40341101); c=ff(c,d,a,b,k[14],17,-1502002290); b=ff(b,c,d,a,k[15],22,1236535329);
    a=gg(a,b,c,d,k[1],5,-165796510); d=gg(d,a,b,c,k[6],9,-1069501632); c=gg(c,d,a,b,k[11],14,643717713); b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691); d=gg(d,a,b,c,k[10],9,38016083); c=gg(c,d,a,b,k[15],14,-660478335); b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438); d=gg(d,a,b,c,k[14],9,-1019803690); c=gg(c,d,a,b,k[3],14,-187363961); b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467); d=gg(d,a,b,c,k[2],9,-51403784); c=gg(c,d,a,b,k[7],14,1735328473); b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558); d=hh(d,a,b,c,k[8],11,-2022574463); c=hh(c,d,a,b,k[11],16,1839030562); b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060); d=hh(d,a,b,c,k[4],11,1272893353); c=hh(c,d,a,b,k[7],16,-155497632); b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174); d=hh(d,a,b,c,k[0],11,-358537222); c=hh(c,d,a,b,k[3],16,-722521979); b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487); d=hh(d,a,b,c,k[12],11,-421815835); c=hh(c,d,a,b,k[15],16,530742520); b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844); d=ii(d,a,b,c,k[7],10,1126891415); c=ii(c,d,a,b,k[14],15,-1416354905); b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571); d=ii(d,a,b,c,k[3],10,-1894986606); c=ii(c,d,a,b,k[10],15,-1051523); b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359); d=ii(d,a,b,c,k[15],10,-30611744); c=ii(c,d,a,b,k[6],15,-1560198380); b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070); d=ii(d,a,b,c,k[11],10,-1120210379); c=ii(c,d,a,b,k[2],15,718787259); b=ii(b,c,d,a,k[9],21,-343485551);
    state[0]=add32(a,state[0]); state[1]=add32(b,state[1]); state[2]=add32(c,state[2]); state[3]=add32(d,state[3]);
  }
  function block(str) {
    const out = Array(16).fill(0);
    for (let i=0;i<64;i++) out[i>>2] |= str.charCodeAt(i) << ((i%4)<<3);
    return out;
  }
  const state=[1732584193,-271733879,-1732584194,271733878];
  let i=64;
  for (; i<=text.length; i+=64) cycle(state, block(text.substring(i-64,i)));
  const tail=Array(16).fill(0);
  const rest=text.substring(i-64);
  for(let j=0;j<rest.length;j++) tail[j>>2] |= rest.charCodeAt(j) << ((j%4)<<3);
  tail[rest.length>>2] |= 0x80 << ((rest.length%4)<<3);
  if(rest.length>55){ cycle(state,tail); for(let j=0;j<16;j++) tail[j]=0; }
  tail[14]=text.length*8;
  cycle(state,tail);
  const hex="0123456789abcdef";
  return state.map(n=>[0,8,16,24].map(shift=>hex[(n>>(shift+4))&15]+hex[(n>>shift)&15]).join("")).join("");
}


function bilibiliWbiKeyFromUrl(value) {
  const raw = String(value || "");
  const slash = raw.lastIndexOf("/");
  const dot = raw.lastIndexOf(".");
  return slash >= 0 && dot > slash ? raw.slice(slash + 1, dot) : "";
}


function bilibiliWbiMixinKey(imgKey, subKey) {
  const source = String(imgKey || "") + String(subKey || "");
  return BILIBILI_WBI_MIXIN_KEY_ENC_TAB.map(index => source[index] || "").join("").slice(0, 32);
}


function bilibiliWbiSignedQuery(params, imgKey, subKey, now = Date.now()) {
  const wts = Math.floor(Number(now) / 1000);
  const entries = Object.entries({ ...(params || {}), wts })
    .map(([key, value]) => [String(key), String(value ?? "").replace(/[!'()*]/g, "")])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const query = entries.map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(value)).join("&");
  const wRid = md5Hex(query + bilibiliWbiMixinKey(imgKey, subKey));
  return query + "&w_rid=" + wRid;
}


async function fetchBilibiliWbiKeys(env = {}, cookie = "") {
  const cached = await readJson(env, BILIBILI_WBI_CACHE_KEY, null);
  const now = Date.now();
  if (cached?.imgKey && cached?.subKey && Number(cached.expiresAt || 0) > now) {
    return { imgKey: String(cached.imgKey), subKey: String(cached.subKey) };
  }
  const payload = await fetchBilibiliJson(BILIBILI_WBI_NAV_API, 12000, { cookie, allowCodes: [-101] });
  const imgKey = bilibiliWbiKeyFromUrl(payload?.data?.wbi_img?.img_url);
  const subKey = bilibiliWbiKeyFromUrl(payload?.data?.wbi_img?.sub_url);
  if (!imgKey || !subKey) throw new Error("B站 WBI 密钥不可用");
  await dbPut(env, BILIBILI_WBI_CACHE_KEY, JSON.stringify({ imgKey, subKey, expiresAt: now + BILIBILI_WBI_CACHE_TTL_MS }));
  return { imgKey, subKey };
}


function isBilibiliBlockedError(error) { return /HTTP\s*(?:412|429)|错误\s*-412|request was banned|请求被拦截|風控|风控|rate.?limit/i.test(String(error?.message || error || "")); }



async function fetchBilibiliJson(url, timeoutMs = 12000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const headers = bilibiliBrowserHeaders(options?.cookie);
    const response = await fetch(url, { headers, signal: controller.signal });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0, 180)}`);
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error(`B站返回的不是 JSON：${raw.slice(0, 180)}`); }
    if (payload && Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) {
      const allowedCodes = new Set((Array.isArray(options?.allowCodes) ? options.allowCodes : []).map(Number));
      if (!allowedCodes.has(Number(payload.code))) throw new Error(`B站接口错误 ${payload.code}：${payload.message || payload.msg || "未知错误"}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}



async function fetchBilibiliLiveSnapshot(uid, env = {}) {
  const url = new URL(BILIBILI_LIVE_BATCH_API);
  url.searchParams.append("uids[]", String(uid));
  const payload = await fetchBilibiliJson(url.toString(), 12000, { cookie: env.BILIBILI_COOKIE });
  const data = payload?.data?.[String(uid)] || {};
  const roomId = String(data.room_id || data.roomid || "");
  return {
    available: Boolean(roomId || data.title || data.uname),
    live: Number(data.live_status ?? data.liveStatus ?? 0) === 1,
    liveStatus: Number(data.live_status ?? data.liveStatus ?? 0),
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

  try {
    const { imgKey, subKey } = await fetchBilibiliWbiKeys(env, cookie);
    const query = bilibiliWbiSignedQuery({ mid: uid, pn: 1, ps: 1, order: "pubdate" }, imgKey, subKey);
    const payload = await fetchBilibiliJson(BILIBILI_ARCHIVE_WBI_API + "?" + query, 12000, { cookie });
    const video = extractBilibiliVideoFromArchiveSearch(payload);
    if (video) return video;
    errors.push("WBI 投稿接口没有返回影片");
  } catch (error) {
    errors.push("WBI 投稿：" + String(error?.message || error));
    if (isBilibiliBlockedError(error)) throw new Error(errors.join("；").slice(0, 800));
  }

  const urls = [
    `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${encodeURIComponent(uid)}&timezone_offset=-480&features=itemOpusStyle`,
    `https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?host_mid=${encodeURIComponent(uid)}&timezone_offset=-480&features=itemOpusStyle`
  ];
  for (const endpoint of urls) {
    try {
      const payload = await fetchBilibiliJson(endpoint, 12000, { cookie });
      const video = extractBilibiliVideoFromDynamic(payload, uid);
      if (video) return video;
      errors.push("动态接口没有找到影片稿件");
    } catch (error) {
      errors.push(String(error?.message || error));
      if (isBilibiliBlockedError(error)) break;
    }
    await waitMs(1200);
  }
  throw new Error(errors.join("；").slice(0, 800) || "无法取得最新影片");
}



async function fetchBilibiliAutomaticSnapshot(uid, env = {}, options = {}) {
  const errors = [];
  let live = null; let video = null; let videoBlocked = false;
  try { live = await fetchBilibiliLiveSnapshot(uid, env); }
  catch (error) {
    errors.push(`直播：${String(error?.message || error)}`);
    if (isBilibiliBlockedError(error)) throw new Error(errors.join("；"));
  }
  if (options?.skipVideo !== true) {
    await waitMs(1800);
    try { video = await fetchBilibiliVideoSnapshot(uid, env); }
    catch (error) {
      videoBlocked = isBilibiliBlockedError(error);
      errors.push(`视频：${String(error?.message || error)}`);
    }
  }
  if (!live && !video) throw new Error(errors.join("；") || "B站检查失败");
  return { checkedAt: Date.now(), live, video, errors, videoBlocked, videoSkipped: options?.skipVideo === true };
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
  const providerRevision = Number(connector.providerRevision || 0);
  if (providerRevision < BILIBILI_PROVIDER_REVISION) {
    connector.providerRevision = BILIBILI_PROVIDER_REVISION;
    connector.consecutiveFailures = 0;
    connector.nextPollAt = 0;
    if (connector.lastCheckStatus === "blocked") {
      connector.lastCheckStatus = "migrating";
      connector.lastCheckError = "Bilibili provider 已升级，将使用新的直播批量接口与 WBI 影片接口重新建立状态。";
    }
  }
  if (force && connector.lastCheckStatus === "blocked" && Number(connector.nextPollAt || 0) > now) {
    return { ok: false, skipped: "blocked_backoff", message: `B站 412 风控暂停中，请等到 ${new Date(Number(connector.nextPollAt)).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" })} 后再检查。`, connector };
  }
  if (!force && Number(connector.nextPollAt || 0) > now) return { ok: true, skipped: "not_due" };
  connector.mode = "automatic_polling";
  connector.pollIntervalSeconds = intervalSeconds;
  connector.lastCheckAt = now;
  try {
    const skipVideo = Number(connector.videoNextPollAt || 0) > now;
    const snapshot = await fetchBilibiliAutomaticSnapshot(uid, env, { skipVideo });
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
    connector.providerRevision = BILIBILI_PROVIDER_REVISION;
    if (snapshot.videoBlocked) connector.videoNextPollAt = now + BILIBILI_VIDEO_BLOCK_BACKOFF_SECONDS * 1000;
    else if (!snapshot.videoSkipped) connector.videoNextPollAt = 0;
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
    connector.providerRevision = BILIBILI_PROVIDER_REVISION;
    connector.lastCheckError = blocked
      ? `B站仍返回 412／429 风控或限流。直播已改用匿名批量接口、影片已改用 WBI 签名；若仍发生，较可能是 Cookie／请求特征或出口 IP 风控，而不是轮询频率本身。已暂停 ${Math.round(backoffSeconds / 3600)} 小时；可设置 BILIBILI_COOKIE Worker secret 后重试。原始错误：${String(error?.message || error)}`.slice(0, 1200)
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
      const staleProviderRevision = Number(connector.providerRevision || 0) < BILIBILI_PROVIDER_REVISION;
      if (!staleProviderRevision && Number(connector.nextPollAt || 0) > now) continue;
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

export { BILIBILI_ARCHIVE_WBI_API, BILIBILI_BLOCK_BACKOFF_MAX_SECONDS, BILIBILI_LIVE_BATCH_API, BILIBILI_POLL_DEFAULT_SECONDS, BILIBILI_POLL_MAX_SECONDS, BILIBILI_POLL_MIN_SECONDS, BILIBILI_PROVIDER_REVISION, BILIBILI_VIDEO_BLOCK_BACKOFF_SECONDS, bilibiliBrowserHeaders, bilibiliPollIntervalSeconds, bilibiliWbiKeyFromUrl, bilibiliWbiMixinKey, bilibiliWbiSignedQuery, extractBilibiliVideoFromArchiveSearch, extractBilibiliVideoFromDynamic, fetchBilibiliAutomaticSnapshot, fetchBilibiliJson, fetchBilibiliLiveSnapshot, fetchBilibiliVideoSnapshot, fetchBilibiliWbiKeys, isBilibiliBlockedError, listAllBilibiliConnectorIds, listBilibiliConnectors, md5Hex, normalizeBilibiliUid, pollAutomaticBilibiliConnectors, pollOneAutomaticBilibiliConnector, sendBilibiliConnectorNotification, waitMs };
