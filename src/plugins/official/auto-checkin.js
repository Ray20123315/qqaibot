import { definePlugin } from "../api.js";

const AUTO_CHECKIN_PLUGIN_ID = "qqai.auto-checkin";
const AUTO_CHECKIN_JOB_NAME = "qqai-auto-checkin-daily";
const AUTO_CHECKIN_CONTINUE_JOB_NAME = "qqai-auto-checkin-continue";
const DAY_MS = 24 * 60 * 60 * 1000;

function integer(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1","true","yes","on","enabled","開","开启","開啟"].includes(raw)) return true;
  if (["0","false","no","off","disabled","關","关闭","關閉"].includes(raw)) return false;
  return fallback;
}

function normalizeSettings(input = {}, fallback = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.freeze({
    enabled: bool(source.enabled, fallback.enabled ?? true),
    batchSize: integer(source.batchSize ?? source.batchsize, fallback.batchSize ?? 20, 1, 20),
    startSecond: integer(source.startSecond ?? source.startsecond, fallback.startSecond ?? 20, 0, 59)
  });
}

function taipeiDayKey(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

function nextTaipeiMidnight(now = Date.now(), second = 20) {
  const shifted = new Date(now + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const nextUtcMs = Date.UTC(y, m, d + 1, 0, 0, integer(second, 20, 0, 59)) - 8 * 60 * 60 * 1000;
  return nextUtcMs;
}

function dataOf(result) {
  return result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
}

function normalizeGroups(result) {
  const data = dataOf(result);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : [];
  const seen = new Set();
  return rows.map(row => ({
    groupId: String(row?.group_id ?? row?.groupId ?? ""),
    groupName: String(row?.group_name ?? row?.groupName ?? "")
  })).filter(row => row.groupId && !seen.has(row.groupId) && seen.add(row.groupId));
}

function createAutoCheckinPlugin(options = {}) {
  const defaults = normalizeSettings(options);
  let settings = defaults;

  async function readSettings(ctx) {
    settings = normalizeSettings(await ctx.storage.get("settings", defaults), defaults);
    return settings;
  }

  async function ensureDailyJob(ctx) {
    const jobs = await ctx.scheduler.list({ includeTerminal: false });
    const active = jobs.filter(job => job.name === AUTO_CHECKIN_JOB_NAME && job.status === "active");
    if (!settings.enabled) {
      for (const job of active) await ctx.scheduler.cancel(job.id);
      return null;
    }
    if (active.length) return active[0];
    return ctx.scheduler.create({
      name: AUTO_CHECKIN_JOB_NAME,
      intervalMs: DAY_MS,
      runAt: nextTaipeiMidnight(Date.now(), settings.startSecond),
      payload: { task: "daily", offset: 0 }
    });
  }

  async function signOne(ctx, groupId) {
    try {
      await ctx.onebot.call("set_group_sign", { group_id: groupId }, 10000);
      return { groupId, ok: true, action: "set_group_sign" };
    } catch (firstError) {
      try {
        await ctx.onebot.call("send_group_sign", { group_id: groupId }, 10000);
        return { groupId, ok: true, action: "send_group_sign", fallback: true };
      } catch (secondError) {
        return {
          groupId,
          ok: false,
          error: String(secondError?.message || secondError || firstError?.message || firstError).slice(0, 240)
        };
      }
    }
  }

  async function runBatch(ctx, event) {
    if (!settings.enabled) return { ok: true, skipped: "disabled" };
    const groups = normalizeGroups(await ctx.onebot.call("get_group_list", { no_cache: false }, 15000));
    if (!groups.length) return { ok: true, day: taipeiDayKey(), total: 0, success: 0, failed: 0 };
    const offset = integer(event?.payload?.offset, 0, 0, Math.max(0, groups.length - 1));
    const batch = groups.slice(offset, offset + settings.batchSize);
    const results = [];
    for (const group of batch) results.push(await signOne(ctx, group.groupId));
    const nextOffset = offset + batch.length;
    if (nextOffset < groups.length) {
      await ctx.scheduler.create({
        name: AUTO_CHECKIN_CONTINUE_JOB_NAME,
        delayMs: 5 * 60 * 1000,
        payload: { task: "continue", offset: nextOffset }
      });
    }
    return {
      ok: results.every(item => item.ok),
      day: taipeiDayKey(),
      totalGroups: groups.length,
      offset,
      processed: batch.length,
      success: results.filter(item => item.ok).length,
      failed: results.filter(item => !item.ok).length,
      nextOffset: nextOffset < groups.length ? nextOffset : null,
      results
    };
  }

  return definePlugin({
    manifest: {
      id: AUTO_CHECKIN_PLUGIN_ID,
      name: "QQAI Official Auto Check-in",
      version: "1.0.0",
      apiVersion: "1",
      description: "Daily automatic QQ group check-in with bounded NapCat subrequests.",
      author: "QQAI",
      official: true,
      releaseChannel: "stable",
      capabilities: ["onebot.call", "scheduler", "storage"],
      requiredCapabilities: ["onebot.call", "scheduler", "storage"],
      permissionDetails: {
        "onebot.call": { labelZh: "執行群打卡", descriptionZh: "每日呼叫 NapCat set_group_sign／send_group_sign。", accessTypes: ["action"] },
        scheduler: { labelZh: "排程每日打卡", descriptionZh: "只建立此插件自己的每日與續批工作。", accessTypes: ["action"] },
        storage: { labelZh: "保存打卡設定", descriptionZh: "保存啟用狀態與安全批次大小。", accessTypes: ["read","write"] }
      },
      settings: {
        enabled: { type: "boolean", label: "自動打卡", description: "預設開啟；不提供 QQ 手動執行指令。" },
        batchsize: { type: "number", label: "每批群數", min: 1, max: 20, step: 1, description: "上限 20，最壞情況含 fallback 仍低於 Workers Free 50 subrequests。" },
        startsecond: { type: "number", label: "00:00 後延遲秒數", min: 0, max: 59, step: 1 }
      }
    },
    surface: {
      async readSettings(ctx) { return readSettings(ctx); },
      async updateSettings(ctx, input) {
        settings = normalizeSettings(input, settings || defaults);
        await ctx.storage.set("settings", settings);
        await ensureDailyJob(ctx);
        return settings;
      },
      async status(ctx) {
        const jobs = await ctx.scheduler.list({ includeTerminal: false });
        const job = jobs.find(item => item.name === AUTO_CHECKIN_JOB_NAME && item.status === "active") || null;
        return { ...settings, nextRunAt: job?.nextRunAt || null, batchSafety: "1 get_group_list + up to 2 calls per group <= 41 subrequests" };
      }
    },
    async onLoad(ctx) {
      await readSettings(ctx);
      await ensureDailyJob(ctx);
    },
    async onCron(ctx, event) {
      if (![AUTO_CHECKIN_JOB_NAME, AUTO_CHECKIN_CONTINUE_JOB_NAME].includes(String(event?.name || ""))) return null;
      return runBatch(ctx, event);
    }
  });
}

const autoCheckinPlugin = createAutoCheckinPlugin();

export {
  AUTO_CHECKIN_CONTINUE_JOB_NAME,
  AUTO_CHECKIN_JOB_NAME,
  AUTO_CHECKIN_PLUGIN_ID,
  DAY_MS,
  autoCheckinPlugin,
  createAutoCheckinPlugin,
  nextTaipeiMidnight,
  normalizeGroups,
  normalizeSettings,
  taipeiDayKey
};
