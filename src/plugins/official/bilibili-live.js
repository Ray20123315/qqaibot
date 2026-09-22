import { definePlugin } from "../api.js";

const BILIBILI_LIVE_PLUGIN_ID = "official.bilibili-live";
const BILIBILI_LIVE_JOB_NAME = "live-poll";
const BILIBILI_LIVE_API = "https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids";
const DEFAULT_POLL_INTERVAL_MS = 2 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 60 * 1000;
const MAX_POLL_INTERVAL_MS = 30 * 60 * 1000;
const MAX_CREATORS = 20;
const VALID_MODES = new Set(["auto", "force_live", "force_offline"]);
const TRANSIENT_BACKOFF_MS = Object.freeze([2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000]);
const BLOCKED_BACKOFF_MS = Object.freeze([5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000, 3 * 60 * 60 * 1000, 6 * 60 * 60 * 1000]);

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUid(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 24);
}

function normalizeHttpsUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw;
}

function normalizeMode(value) {
  const mode = String(value || "auto").trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : "auto";
}

function normalizeCreator(value) {
  const source = value && typeof value === "object" ? value : { uid: value };
  const uid = normalizeUid(source.uid ?? source.mid ?? source.id);
  if (!uid) return null;
  return Object.freeze({
    uid,
    label: String(source.label || source.name || "").trim().slice(0, 80),
    mode: normalizeMode(source.mode),
    forceTitle: String(source.forceTitle || "").trim().slice(0, 200),
    forceUrl: normalizeHttpsUrl(source.forceUrl),
    forceCover: normalizeHttpsUrl(source.forceCover),
    forceUpdatedAt: nullableNumber(source.forceUpdatedAt),
    forceUpdatedBy: String(source.forceUpdatedBy || "").trim().slice(0, 64)
  });
}

function normalizeCreators(value) {
  const rows = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const row of rows) {
    const creator = normalizeCreator(row);
    if (!creator || seen.has(creator.uid)) continue;
    seen.add(creator.uid);
    result.push(creator);
    if (result.length >= MAX_CREATORS) break;
  }
  return Object.freeze(result);
}

function normalizeConfig(value = {}, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaults && typeof defaults === "object" ? defaults : {};
  const creators = normalizeCreators(source.creators ?? source.creator ?? fallback.creators ?? fallback.creator ?? []);
  const pollIntervalMs = clampInteger(
    source.pollIntervalMs ?? fallback.pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS,
    MIN_POLL_INTERVAL_MS,
    MAX_POLL_INTERVAL_MS
  );
  return Object.freeze({
    creators,
    pollIntervalMs,
    updatedAt: nullableNumber(source.updatedAt),
    updatedBy: String(source.updatedBy || "").trim().slice(0, 64)
  });
}

function parseLiveTime(value) {
  if (value === undefined || value === null || value === "" || Number(value) === 0) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeProviderRecord(uid, value, checkedAt = Date.now()) {
  const data = value && typeof value === "object" ? value : {};
  const statusCode = Number(data.live_status ?? data.liveStatus ?? 0);
  const roomId = String(data.room_id ?? data.roomid ?? "").replace(/\D/g, "");
  return Object.freeze({
    uid: normalizeUid(data.uid || uid),
    available: Boolean(roomId || data.title || data.uname || data.face),
    live: statusCode === 1,
    rotating: statusCode === 2,
    statusCode: Number.isFinite(statusCode) ? statusCode : 0,
    roomId,
    title: String(data.title || "").trim().slice(0, 300),
    creatorName: String(data.uname || data.name || "").trim().slice(0, 120),
    online: Number.isFinite(Number(data.online)) ? Number(data.online) : null,
    areaName: String(data.area_v2_name || data.area_name || data.area || "").trim().slice(0, 120),
    face: normalizeHttpsUrl(data.face),
    cover: normalizeHttpsUrl(data.cover_from_user || data.cover),
    keyframe: normalizeHttpsUrl(data.keyframe),
    liveStartedAt: parseLiveTime(data.live_time),
    url: roomId ? `https://live.bilibili.com/${roomId}` : `https://space.bilibili.com/${normalizeUid(data.uid || uid)}`,
    checkedAt: Number(checkedAt)
  });
}

function isBlockedProviderError(error) {
  return /BILIBILI_LIVE_HTTP_(?:412|429)|BILIBILI_LIVE_API_-412|rate.?limit|request was banned|risk.?control/i.test(String(error?.message || error || ""));
}

function providerBackoffMs(failureCount, blocked = false) {
  const table = blocked ? BLOCKED_BACKOFF_MS : TRANSIENT_BACKOFF_MS;
  const index = Math.max(0, Math.min(table.length - 1, Number(failureCount || 1) - 1));
  return table[index];
}

function transitionFor(previous, current) {
  if (!previous) return "initialized";
  if (previous.live === false && current.live === true) return "went_live";
  if (previous.live === true && current.live === false) return "went_offline";
  if (previous.rotating !== current.rotating) return current.rotating ? "went_rotating" : "left_rotating";
  return "unchanged";
}

function buildEffectiveState(creator, provider, health = {}) {
  const mode = normalizeMode(creator?.mode);
  const stale = health?.ok === false || health?.missing === true;
  const base = provider || Object.freeze({
    uid: creator?.uid || "",
    available: false,
    live: false,
    rotating: false,
    statusCode: 0,
    roomId: "",
    title: "",
    creatorName: creator?.label || "",
    online: null,
    areaName: "",
    face: "",
    cover: "",
    keyframe: "",
    liveStartedAt: null,
    url: creator?.uid ? `https://space.bilibili.com/${creator.uid}` : "",
    checkedAt: null
  });
  if (mode === "auto") {
    return Object.freeze({ ...base, mode, source: "bilibili", providerLive: Boolean(base.live), stale });
  }
  const forceLive = mode === "force_live";
  return Object.freeze({
    ...base,
    live: forceLive,
    rotating: false,
    statusCode: forceLive ? 1 : 0,
    title: forceLive ? (creator.forceTitle || base.title || "Forced live") : (creator.forceTitle || base.title || ""),
    cover: creator.forceCover || base.cover || "",
    url: creator.forceUrl || base.url || (creator.uid ? `https://space.bilibili.com/${creator.uid}` : ""),
    mode,
    source: mode,
    providerLive: Boolean(base.live),
    stale,
    forcedAt: creator.forceUpdatedAt || null,
    forcedBy: creator.forceUpdatedBy || ""
  });
}

function effectiveSnapshot(config, snapshot = {}, health = {}) {
  const byUid = snapshot?.byUid && typeof snapshot.byUid === "object" ? snapshot.byUid : {};
  const missing = new Set(Array.isArray(health?.missingUids) ? health.missingUids.map(String) : []);
  return Object.freeze(config.creators.map(creator => buildEffectiveState(
    creator,
    byUid[creator.uid] || null,
    { ok: health?.ok !== false, missing: missing.has(creator.uid) }
  )));
}

async function fetchBilibiliLiveBatch(ctx, creators, checkedAt = Date.now()) {
  const rows = normalizeCreators(creators);
  if (!rows.length) return Object.freeze({ byUid: Object.freeze({}), missingUids: Object.freeze([]), checkedAt });
  const url = new URL(BILIBILI_LIVE_API);
  for (const creator of rows) url.searchParams.append("uids[]", creator.uid);
  const response = await ctx.network.fetch({
    url: url.toString(),
    init: {headers: { Accept: "application/json" } }
  });
  if (!response?.ok) throw new Error(`BILIBILI_LIVE_HTTP_${Number(response?.status || 0)}`);
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new Error("BILIBILI_LIVE_INVALID_JSON");
  if (Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) {
    throw new Error(`BILIBILI_LIVE_API_${Number(payload.code)}:${String(payload.message || payload.msg || "error").slice(0, 160)}`);
  }
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const byUid = {};
  const missingUids = [];
  for (const creator of rows) {
    const raw = data[creator.uid] || data[Number(creator.uid)] || null;
    if (!raw) {
      missingUids.push(creator.uid);
      continue;
    }
    byUid[creator.uid] = normalizeProviderRecord(creator.uid, raw, checkedAt);
  }
  return Object.freeze({ byUid: Object.freeze(byUid), missingUids: Object.freeze(missingUids), checkedAt });
}

function mergeSnapshot(config, previous = {}, batch = {}) {
  const oldByUid = previous?.byUid && typeof previous.byUid === "object" ? previous.byUid : {};
  const nextByUid = { ...oldByUid };
  const transitions = [];
  for (const creator of config.creators) {
    const current = batch?.byUid?.[creator.uid];
    if (!current) continue;
    const previousRecord = oldByUid[creator.uid] || null;
    const transition = transitionFor(previousRecord, current);
    nextByUid[creator.uid] = Object.freeze({ ...current, transition });
    if (transition !== "unchanged" && transition !== "initialized") {
      transitions.push(Object.freeze({ uid: creator.uid, transition, at: batch.checkedAt, live: current.live, roomId: current.roomId, title: current.title }));
    }
  }
  return Object.freeze({
    checkedAt: Number(batch.checkedAt || Date.now()),
    byUid: Object.freeze(nextByUid),
    transitions: Object.freeze(transitions)
  });
}

function parseCommandArgs(input) {
  if (Array.isArray(input?.args)) return input.args.map(value => String(value));
  const text = String(input?.text || input?.raw || "").trim();
  return text ? text.split(/\s+/) : [];
}

function creatorByUid(config, uid) {
  const normalized = normalizeUid(uid);
  return config.creators.find(item => item.uid === normalized) || null;
}

function updateCreatorMode(config, uid, mode, meta = {}) {
  const normalizedUid = normalizeUid(uid);
  const normalizedMode = normalizeMode(mode);
  if (!normalizedUid || !creatorByUid(config, normalizedUid)) throw new Error("BILIBILI_LIVE_CREATOR_NOT_FOUND");
  const creators = config.creators.map(creator => creator.uid === normalizedUid
    ? normalizeCreator({
      ...creator,
      mode: normalizedMode,
      forceTitle: meta.forceTitle ?? creator.forceTitle,
      forceUrl: meta.forceUrl ?? creator.forceUrl,
      forceCover: meta.forceCover ?? creator.forceCover,
      forceUpdatedAt: Date.now(),
      forceUpdatedBy: meta.actorId || ""
    })
    : creator);
  return normalizeConfig({ ...config, creators, updatedAt: Date.now(), updatedBy: meta.actorId || "" }, config);
}

function createBilibiliLivePlugin(options = {}) {
  const initialConfig = normalizeConfig({
    creators: options.creators ?? options.creator ?? (options.uid ? [{ uid: options.uid, label: options.label }] : []),
    pollIntervalMs: options.pollIntervalMs
  });
  const adminUserIds = new Set((Array.isArray(options.adminUserIds) ? options.adminUserIds : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));

  async function readConfig(ctx) {
    return normalizeConfig(await ctx.storage.get("config", initialConfig), initialConfig);
  }

  async function ensureConfig(ctx) {
    const stored = await ctx.storage.get("config", null);
    if (stored === null) {
      await ctx.storage.set("config", initialConfig);
      return initialConfig;
    }
    return normalizeConfig(stored, initialConfig);
  }

  async function ensurePollJob(ctx, config) {
    const jobs = await ctx.scheduler.list({includeTerminal: false});
    const existing = jobs.find(job => job.name === BILIBILI_LIVE_JOB_NAME && job.status === "active") || null;
    if (!config.creators.length) {
      if (existing) await ctx.scheduler.cancel(existing.id);
      return null;
    }
    if (existing && existing.intervalMs === config.pollIntervalMs) return existing;
    if (existing) await ctx.scheduler.cancel(existing.id);
    return ctx.scheduler.create({
      name: BILIBILI_LIVE_JOB_NAME,
      intervalMs: config.pollIntervalMs,
      payload: { task: "poll" }
    });
  }

  async function poll(ctx, reason = "cron") {
    const config = await readConfig(ctx);
    if (!config.creators.length) return Object.freeze({ ok: true, skipped: "no_creators", reason });
    const previousSnapshot = await ctx.storage.get("snapshot", { checkedAt: null, byUid: {}, transitions: [] });
    const previousHealth = await ctx.storage.get("health", { ok: true, consecutiveFailures: 0, lastSuccessAt: null, nextPollNotBefore: null, blocked: false });
    const attemptedAt = Date.now();
    const nextPollNotBefore = nullableNumber(previousHealth?.nextPollNotBefore);
    const backoffActive = nextPollNotBefore !== null && nextPollNotBefore > attemptedAt;
    if (backoffActive && (reason === "cron" || previousHealth?.blocked === true)) {
      return Object.freeze({
        ok: false,
        stale: true,
        skipped: "provider_backoff",
        snapshot: previousSnapshot,
        health: previousHealth,
        effective: effectiveSnapshot(config, previousSnapshot, previousHealth)
      });
    }
    try {
      const batch = await fetchBilibiliLiveBatch(ctx, config.creators, attemptedAt);
      const snapshot = mergeSnapshot(config, previousSnapshot, batch);
      const health = Object.freeze({
        ok: true,
        partial: batch.missingUids.length > 0,
        missingUids: batch.missingUids,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: attemptedAt,
        consecutiveFailures: 0,
        lastError: "",
        blocked: false,
        nextPollNotBefore: null,
        reason
      });
      await ctx.storage.set("snapshot", snapshot);
      await ctx.storage.set("health", health);
      return Object.freeze({ ok: true, partial: health.partial, snapshot, health, effective: effectiveSnapshot(config, snapshot, health) });
    } catch (error) {
      const consecutiveFailures = Number(previousHealth?.consecutiveFailures || 0) + 1;
      const blocked = isBlockedProviderError(error);
      const backoffMs = providerBackoffMs(consecutiveFailures, blocked);
      const health = Object.freeze({
        ok: false,
        partial: false,
        missingUids: [],
        lastAttemptAt: attemptedAt,
        lastSuccessAt: previousHealth?.lastSuccessAt || previousSnapshot?.checkedAt || null,
        consecutiveFailures,
        lastError: String(error?.message || error).slice(0, 500),
        blocked,
        nextPollNotBefore: attemptedAt + backoffMs,
        backoffMs,
        reason
      });
      await ctx.storage.set("health", health);
      return Object.freeze({ ok: false, stale: true, snapshot: previousSnapshot, health, effective: effectiveSnapshot(config, previousSnapshot, health) });
    }
  }

  async function readSurfaceStatus(ctx, publicView = false) {
    const config = await readConfig(ctx);
    const snapshot = await ctx.storage.get("snapshot", { checkedAt: null, byUid: {}, transitions: [] });
    const health = await ctx.storage.get("health", { ok: true, consecutiveFailures: 0, lastSuccessAt: null });
    const rows = effectiveSnapshot(config, snapshot, health);
    const state = !config.creators.length ? "DISABLED" : (health?.ok === false || health?.partial === true) ? "DEGRADED" : "OK";
    const base = {
      state,
      provider: "bilibili",
      creatorCount: config.creators.length,
      checkedAt: snapshot?.checkedAt || null,
      stale: health?.ok === false || health?.partial === true
    };
    if (!publicView) return { ...base, rows, health };
    return {
      ...base,
      rows: rows.map(row => ({
        uid: row.uid,
        available: row.available,
        live: row.live,
        rotating: row.rotating,
        statusCode: row.statusCode,
        roomId: row.roomId,
        title: row.title,
        creatorName: row.creatorName,
        online: row.online,
        areaName: row.areaName,
        cover: row.cover,
        keyframe: row.keyframe,
        liveStartedAt: row.liveStartedAt,
        url: row.url,
        checkedAt: row.checkedAt,
        mode: row.mode,
        source: row.source,
        providerLive: row.providerLive,
        stale: row.stale
      }))
    };
  }

  function assertAdmin(ctx) {
    if (!ctx.userId || !adminUserIds.has(String(ctx.userId))) throw new Error("BILIBILI_LIVE_ADMIN_REQUIRED");
  }

  return definePlugin({
    manifest: {
      id: BILIBILI_LIVE_PLUGIN_ID,
      name: "QQAI Official Bilibili Live",
      version: "1.0.0",
      apiVersion: "1",
      description: "Webhook-free Bilibili live-status polling with AUTO/FORCE fallback state.",
      author: "QQAI",
      official: true,
      officialBeta: true,
      releaseChannel: "preview",
      publicStatus: true,
      capabilities: ["network", "storage", "scheduler"],
      requiredCapabilities: ["network", "storage", "scheduler"],
      permissionDetails: {
        network: {
          labelZh: "連線 Bilibili 直播 API",
          descriptionZh: "查詢已設定 UP 主的公開直播狀態。",
          accessTypes: ["external"],
          externalDestinations: ["api.live.bilibili.com"]
        },
        storage: {
          labelZh: "讀寫 Bilibili 插件資料",
          descriptionZh: "保存此插件自己的設定、最後成功直播狀態與健康狀態。",
          accessTypes: ["read", "write"]
        },
        scheduler: {
          labelZh: "執行 Bilibili 定時檢查",
          descriptionZh: "建立此插件自己的直播狀態輪詢工作。",
          accessTypes: ["action"]
        }
      },
      settings: {
        creators: {
          type: "json",
          label: "Creators",
          description: "Array of Bilibili creator objects: uid, label, mode and optional FORCE metadata."
        },
        pollintervalms: {
          type: "number",
          label: "Poll interval (ms)",
          description: "Bilibili live-status polling interval.",
          min: MIN_POLL_INTERVAL_MS,
          max: MAX_POLL_INTERVAL_MS,
          step: 60000
        }
      }
    },
    commands: [
      {
        name: "bili-live-status",
        aliases: ["bilibili-live-status"],
        description: "Return the effective Bilibili live state snapshot.",
        async run(ctx, input) {
          const config = await readConfig(ctx);
          const snapshot = await ctx.storage.get("snapshot", { checkedAt: null, byUid: {}, transitions: [] });
          const health = await ctx.storage.get("health", { ok: true, consecutiveFailures: 0, lastSuccessAt: null });
          const args = parseCommandArgs(input);
          const uid = normalizeUid(args[0]);
          const rows = effectiveSnapshot(config, snapshot, health);
          return uid ? (rows.find(row => row.uid === uid) || null) : Object.freeze({ rows, health, checkedAt: snapshot?.checkedAt || null });
        }
      },
      {
        name: "bili-live-refresh",
        aliases: ["bilibili-live-refresh"],
        description: "Manually refresh Bilibili live state. Admin allowlist required.",
        async run(ctx) {
          assertAdmin(ctx);
          return poll(ctx, "manual");
        }
      },
      {
        name: "bili-live-mode",
        aliases: ["bilibili-live-mode"],
        description: "Set AUTO / FORCE_LIVE / FORCE_OFFLINE for one configured creator. Admin allowlist required.",
        async run(ctx, input) {
          assertAdmin(ctx);
          const args = parseCommandArgs(input);
          const uid = normalizeUid(args[0]);
          const mode = normalizeMode(args[1]);
          if (!uid || !args[1] || !VALID_MODES.has(String(args[1]).toLowerCase())) throw new Error("BILIBILI_LIVE_MODE_USAGE");
          const config = await readConfig(ctx);
          const next = updateCreatorMode(config, uid, mode, {
            actorId: ctx.userId,
            forceTitle: input?.forceTitle,
            forceUrl: input?.forceUrl,
            forceCover: input?.forceCover
          });
          await ctx.storage.set("config", next);
          const snapshot = await ctx.storage.get("snapshot", { checkedAt: null, byUid: {}, transitions: [] });
          const health = await ctx.storage.get("health", { ok: true, consecutiveFailures: 0, lastSuccessAt: null });
          return Object.freeze({ config: next, effective: effectiveSnapshot(next, snapshot, health) });
        }
      }
    ],
    surface: {
      async readSettings(ctx) {
        const config = await readConfig(ctx);
        return {
          creators: config.creators,
          pollintervalms: config.pollIntervalMs,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy
        };
      },
      async updateSettings(ctx, input) {
        assertAdmin(ctx);
        const current = await readConfig(ctx);
        const source = input && typeof input === "object" ? input : {};
        const next = normalizeConfig({
          creators: Object.prototype.hasOwnProperty.call(source, "creators") ? source.creators : current.creators,
          pollIntervalMs: Object.prototype.hasOwnProperty.call(source, "pollintervalms") ? source.pollintervalms : current.pollIntervalMs,
          updatedAt: Date.now(),
          updatedBy: ctx.userId
        }, initialConfig);
        await ctx.storage.set("config", next);
        await ensurePollJob(ctx, next);
        return next;
      },
      async status(ctx) {
        return readSurfaceStatus(ctx, false);
      },
      async publicStatus(ctx) {
        return readSurfaceStatus(ctx, true);
      }
    },
    async onLoad(ctx) {
      const config = await ensureConfig(ctx);
      await ensurePollJob(ctx, config);
    },
    async onCron(ctx, event) {
      if (event?.name !== BILIBILI_LIVE_JOB_NAME) return null;
      return poll(ctx, "cron");
    }
  });
}

export {
  BILIBILI_LIVE_API,
  BILIBILI_LIVE_JOB_NAME,
  BILIBILI_LIVE_PLUGIN_ID,
  DEFAULT_POLL_INTERVAL_MS,
  MAX_CREATORS,
  MAX_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  BLOCKED_BACKOFF_MS,
  TRANSIENT_BACKOFF_MS,
  buildEffectiveState,
  createBilibiliLivePlugin,
  effectiveSnapshot,
  fetchBilibiliLiveBatch,
  mergeSnapshot,
  normalizeConfig,
  normalizeCreator,
  normalizeCreators,
  isBlockedProviderError,
  normalizeMode,
  normalizeProviderRecord,
  normalizeUid,
  nullableNumber,
  providerBackoffMs,
  transitionFor,
  updateCreatorMode
};
