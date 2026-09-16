const PLUGIN_SCHEDULER_INDEX_KEY = "plugin_scheduler:index";
const PLUGIN_SCHEDULER_RECORD_PREFIX = "plugin_scheduler:job:";
const DEFAULT_MIN_INTERVAL_MS = 60_000;
const DEFAULT_MAX_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ACTIVE_JOBS_PER_PLUGIN = 100;
const DEFAULT_MAX_GLOBAL_JOBS = 5000;
const DEFAULT_PAYLOAD_BYTES = 16 * 1024;
const DEFAULT_EXECUTION_TIMEOUT_MS = 25_000;
const DEFAULT_LEASE_MS = 60_000;
const MAX_FAILURES = 5;

class PluginSchedulerError extends Error {
  constructor(code, message = code, details = {}) {
    super(message);
    this.name = "PluginSchedulerError";
    this.code = String(code || "PLUGIN_SCHEDULER_ERROR");
    this.details = Object.freeze({ ...details });
  }
}

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function schedulerRecordKey(id) {
  return `${PLUGIN_SCHEDULER_RECORD_PREFIX}${String(id || "")}`;
}

function safePluginId(value) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(id)) throw new PluginSchedulerError("PLUGIN_SCHEDULER_PLUGIN_ID_INVALID");
  return id;
}

function safeJobName(value) {
  const name = String(value || "job").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(name)) throw new PluginSchedulerError("PLUGIN_SCHEDULER_JOB_NAME_INVALID");
  return name;
}

function safePayload(value, maxBytes = DEFAULT_PAYLOAD_BYTES) {
  let json;
  try {
    json = JSON.stringify(value === undefined ? null : value);
  } catch (error) {
    throw new PluginSchedulerError("PLUGIN_SCHEDULER_PAYLOAD_INVALID", String(error?.message || error).slice(0, 240));
  }
  const bytes = new TextEncoder().encode(json).byteLength;
  const limit = clampInteger(maxBytes, DEFAULT_PAYLOAD_BYTES, 1024, 64 * 1024);
  if (bytes > limit) throw new PluginSchedulerError("PLUGIN_SCHEDULER_PAYLOAD_TOO_LARGE", "scheduler payload exceeds configured limit", { bytes, limit });
  return JSON.parse(json);
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScheduleInput(input, now = Date.now()) {
  const source = input && typeof input === "object" ? input : {};
  const intervalRaw = source.intervalMs ?? source.everyMs;
  const intervalMs = intervalRaw === undefined || intervalRaw === null || intervalRaw === "" ? null : Number(intervalRaw);
  const delayRaw = source.delayMs;
  const delayMs = delayRaw === undefined || delayRaw === null || delayRaw === "" ? null : Number(delayRaw);
  const requestedAt = parseTimestamp(source.runAt ?? source.at ?? source.startAt);
  const maxRuns = source.maxRuns === undefined || source.maxRuns === null || source.maxRuns === ""
    ? null
    : clampInteger(source.maxRuns, 1, 1, 1_000_000);

  if (intervalMs !== null) {
    if (!Number.isFinite(intervalMs)) throw new PluginSchedulerError("PLUGIN_SCHEDULER_INTERVAL_INVALID");
    if (intervalMs < DEFAULT_MIN_INTERVAL_MS || intervalMs > DEFAULT_MAX_INTERVAL_MS) {
      throw new PluginSchedulerError("PLUGIN_SCHEDULER_INTERVAL_OUT_OF_RANGE", "interval must be between 1 minute and 30 days", {
        minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
        maxIntervalMs: DEFAULT_MAX_INTERVAL_MS
      });
    }
    let nextRunAt = requestedAt;
    if (!nextRunAt && delayMs !== null) {
      if (!Number.isFinite(delayMs) || delayMs < 0) throw new PluginSchedulerError("PLUGIN_SCHEDULER_DELAY_INVALID");
      nextRunAt = now + Math.trunc(delayMs);
    }
    if (!nextRunAt) nextRunAt = now + Math.trunc(intervalMs);
    if (nextRunAt <= now) nextRunAt = now + Math.trunc(intervalMs);
    return Object.freeze({ type: "interval", intervalMs: Math.trunc(intervalMs), nextRunAt, maxRuns });
  }

  let nextRunAt = requestedAt;
  if (!nextRunAt && delayMs !== null) {
    if (!Number.isFinite(delayMs) || delayMs < 1000 || delayMs > 365 * 24 * 60 * 60 * 1000) {
      throw new PluginSchedulerError("PLUGIN_SCHEDULER_DELAY_OUT_OF_RANGE");
    }
    nextRunAt = now + Math.trunc(delayMs);
  }
  if (!nextRunAt) throw new PluginSchedulerError("PLUGIN_SCHEDULER_TIME_REQUIRED", "provide runAt/at, delayMs, or intervalMs");
  if (nextRunAt <= now) throw new PluginSchedulerError("PLUGIN_SCHEDULER_TIME_PAST");
  return Object.freeze({ type: "once", intervalMs: null, nextRunAt, maxRuns: 1 });
}

async function readJson(storage, key, fallback) {
  const raw = await storage.get(key);
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch { return fallback; }
}

async function writeJson(storage, key, value) {
  await storage.put(key, JSON.stringify(value));
}

function publicJob(record) {
  if (!record) return null;
  return Object.freeze({
    id: String(record.id || ""),
    pluginId: String(record.pluginId || ""),
    name: String(record.name || ""),
    type: String(record.type || ""),
    status: String(record.status || ""),
    enabled: record.enabled === true,
    nextRunAt: Number.isFinite(Number(record.nextRunAt)) ? Number(record.nextRunAt) : null,
    intervalMs: Number.isFinite(Number(record.intervalMs)) ? Number(record.intervalMs) : null,
    maxRuns: Number.isFinite(Number(record.maxRuns)) ? Number(record.maxRuns) : null,
    runCount: Number(record.runCount || 0),
    failureCount: Number(record.failureCount || 0),
    createdAt: String(record.createdAt || ""),
    updatedAt: String(record.updatedAt || ""),
    lastRunAt: String(record.lastRunAt || ""),
    lastError: String(record.lastError || ""),
    payload: safePayload(record.payload, DEFAULT_PAYLOAD_BYTES)
  });
}

function nextIntervalRun(record, now) {
  const interval = Number(record.intervalMs || 0);
  if (!Number.isFinite(interval) || interval < DEFAULT_MIN_INTERVAL_MS) return null;
  const anchor = Number(record.retryForRunAt || record.nextRunAt || now);
  if (anchor > now) return anchor;
  const jumps = Math.floor((now - anchor) / interval) + 1;
  return anchor + jumps * interval;
}

function timeoutPromise(promise, timeoutMs) {
  const ms = clampInteger(timeoutMs, DEFAULT_EXECUTION_TIMEOUT_MS, 1000, 30_000);
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new PluginSchedulerError("PLUGIN_SCHEDULER_EXECUTION_TIMEOUT")), ms))
  ]);
}

function createPluginScheduler(storage, options = {}) {
  if (!storage || typeof storage.get !== "function" || typeof storage.put !== "function" || typeof storage.del !== "function") {
    throw new PluginSchedulerError("PLUGIN_SCHEDULER_STORAGE_REQUIRED");
  }
  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => Date.now();
  const maxActive = clampInteger(options.maxActiveJobsPerPlugin, DEFAULT_MAX_ACTIVE_JOBS_PER_PLUGIN, 1, 500);
  const maxGlobal = clampInteger(options.maxGlobalJobs, DEFAULT_MAX_GLOBAL_JOBS, 100, 20_000);
  const executionTimeoutMs = clampInteger(options.executionTimeoutMs, DEFAULT_EXECUTION_TIMEOUT_MS, 1000, 30_000);
  const leaseMs = clampInteger(options.leaseMs, DEFAULT_LEASE_MS, 10_000, 5 * 60_000);

  async function readIndex() {
    const value = await readJson(storage, PLUGIN_SCHEDULER_INDEX_KEY, []);
    return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
  }

  async function getRecord(id) {
    return readJson(storage, schedulerRecordKey(id), null);
  }

  async function list(pluginId, query = {}) {
    const owner = safePluginId(pluginId);
    const includeTerminal = query?.includeTerminal !== false;
    const index = await readIndex();
    const rows = [];
    for (const id of index) {
      const record = await getRecord(id);
      if (!record || String(record.pluginId || "") !== owner) continue;
      if (!includeTerminal && ["completed", "cancelled", "paused"].includes(String(record.status || ""))) continue;
      rows.push(publicJob(record));
    }
    return Object.freeze(rows.sort((a, b) => Number(a.nextRunAt || Infinity) - Number(b.nextRunAt || Infinity)));
  }

  async function create(pluginId, input = {}) {
    const owner = safePluginId(pluginId);
    const now = Number(nowProvider());
    const schedule = normalizeScheduleInput(input, now);
    const current = await list(owner, { includeTerminal: false });
    if (current.length >= maxActive) throw new PluginSchedulerError("PLUGIN_SCHEDULER_PLUGIN_LIMIT", "plugin has too many active jobs", { limit: maxActive });
    const index = await readIndex();
    if (index.length >= maxGlobal) throw new PluginSchedulerError("PLUGIN_SCHEDULER_GLOBAL_LIMIT", "global plugin scheduler index is full", { limit: maxGlobal });
    const id = `pjob_${now.toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    const iso = new Date(now).toISOString();
    const record = {
      id,
      pluginId: owner,
      name: safeJobName(input?.name || "job"),
      payload: safePayload(input?.payload, options.maxPayloadBytes),
      type: schedule.type,
      intervalMs: schedule.intervalMs,
      nextRunAt: schedule.nextRunAt,
      maxRuns: schedule.maxRuns,
      runCount: 0,
      failureCount: 0,
      enabled: true,
      status: "active",
      createdAt: iso,
      updatedAt: iso,
      lastRunAt: "",
      lastError: "",
      retryForRunAt: null,
      leaseUntil: 0,
      leaseToken: ""
    };
    await writeJson(storage, schedulerRecordKey(id), record);
    await writeJson(storage, PLUGIN_SCHEDULER_INDEX_KEY, [...index, id]);
    return publicJob(record);
  }

  async function get(pluginId, id) {
    const owner = safePluginId(pluginId);
    const record = await getRecord(id);
    if (!record || String(record.pluginId || "") !== owner) return null;
    return publicJob(record);
  }

  async function cancel(pluginId, id) {
    const owner = safePluginId(pluginId);
    const record = await getRecord(id);
    if (!record || String(record.pluginId || "") !== owner) throw new PluginSchedulerError("PLUGIN_SCHEDULER_JOB_NOT_FOUND");
    if (["completed", "cancelled"].includes(String(record.status || ""))) return publicJob(record);
    const now = Number(nowProvider());
    record.enabled = false;
    record.status = "cancelled";
    record.nextRunAt = null;
    record.leaseUntil = 0;
    record.leaseToken = "";
    record.updatedAt = new Date(now).toISOString();
    await writeJson(storage, schedulerRecordKey(id), record);
    return publicJob(record);
  }

  async function runDue(execute, runOptions = {}) {
    if (typeof execute !== "function") throw new PluginSchedulerError("PLUGIN_SCHEDULER_EXECUTOR_REQUIRED");
    const now = Number(runOptions.now ?? nowProvider());
    const limit = clampInteger(runOptions.limit, 50, 1, 200);
    const index = await readIndex();
    const due = [];
    for (const id of index) {
      const record = await getRecord(id);
      if (!record || !record.enabled || record.status !== "active") continue;
      if (Number(record.leaseUntil || 0) > now) continue;
      if (!Number.isFinite(Number(record.nextRunAt)) || Number(record.nextRunAt) > now) continue;
      due.push(record);
    }
    due.sort((a, b) => Number(a.nextRunAt || 0) - Number(b.nextRunAt || 0));
    const results = [];
    for (const record of due.slice(0, limit)) {
      const scheduledAt = Number(record.nextRunAt || now);
      const leaseToken = crypto.randomUUID();
      record.leaseToken = leaseToken;
      record.leaseUntil = now + leaseMs;
      record.updatedAt = new Date(now).toISOString();
      await writeJson(storage, schedulerRecordKey(record.id), record);
      const event = Object.freeze({
        jobId: String(record.id),
        name: String(record.name),
        payload: safePayload(record.payload, options.maxPayloadBytes),
        scheduledAt,
        runCount: Number(record.runCount || 0),
        attempt: Number(record.failureCount || 0) + 1
      });
      try {
        const value = await timeoutPromise(execute(String(record.pluginId), event), runOptions.executionTimeoutMs ?? executionTimeoutMs);
        const fresh = await getRecord(record.id);
        if (!fresh || fresh.leaseToken !== leaseToken) {
          results.push(Object.freeze({ id: record.id, pluginId: record.pluginId, ok: false, skipped: true, reason: "lease_lost" }));
          continue;
        }
        fresh.runCount = Number(fresh.runCount || 0) + 1;
        fresh.failureCount = 0;
        fresh.lastRunAt = new Date(now).toISOString();
        fresh.lastError = "";
        fresh.leaseUntil = 0;
        fresh.leaseToken = "";
        fresh.updatedAt = new Date(now).toISOString();
        const reachedMaxRuns = Number.isFinite(Number(fresh.maxRuns)) && fresh.runCount >= Number(fresh.maxRuns);
        if (fresh.type === "once" || reachedMaxRuns) {
          fresh.enabled = false;
          fresh.status = "completed";
          fresh.nextRunAt = null;
          fresh.retryForRunAt = null;
        } else {
          fresh.nextRunAt = nextIntervalRun(fresh, now);
          fresh.retryForRunAt = null;
        }
        await writeJson(storage, schedulerRecordKey(fresh.id), fresh);
        results.push(Object.freeze({ id: fresh.id, pluginId: fresh.pluginId, ok: true, value, job: publicJob(fresh) }));
      } catch (error) {
        const fresh = await getRecord(record.id);
        if (!fresh || fresh.leaseToken !== leaseToken) {
          results.push(Object.freeze({ id: record.id, pluginId: record.pluginId, ok: false, skipped: true, reason: "lease_lost" }));
          continue;
        }
        fresh.failureCount = Number(fresh.failureCount || 0) + 1;
        fresh.lastError = String(error?.message || error).slice(0, 500);
        fresh.leaseUntil = 0;
        fresh.leaseToken = "";
        fresh.updatedAt = new Date(now).toISOString();
        if (!fresh.retryForRunAt) fresh.retryForRunAt = scheduledAt;
        if (fresh.failureCount >= MAX_FAILURES) {
          fresh.enabled = false;
          fresh.status = "paused";
          fresh.nextRunAt = null;
        } else {
          const backoffs = [60_000, 120_000, 300_000, 600_000];
          fresh.nextRunAt = now + backoffs[Math.min(fresh.failureCount - 1, backoffs.length - 1)];
        }
        await writeJson(storage, schedulerRecordKey(fresh.id), fresh);
        results.push(Object.freeze({ id: fresh.id, pluginId: fresh.pluginId, ok: false, error: fresh.lastError, job: publicJob(fresh) }));
      }
    }
    return Object.freeze(results);
  }

  return Object.freeze({ cancel, create, get, list, runDue });
}

export {
  DEFAULT_EXECUTION_TIMEOUT_MS,
  DEFAULT_LEASE_MS,
  DEFAULT_MAX_ACTIVE_JOBS_PER_PLUGIN,
  DEFAULT_MAX_GLOBAL_JOBS,
  DEFAULT_MAX_INTERVAL_MS,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_PAYLOAD_BYTES,
  MAX_FAILURES,
  PLUGIN_SCHEDULER_INDEX_KEY,
  PLUGIN_SCHEDULER_RECORD_PREFIX,
  PluginSchedulerError,
  createPluginScheduler,
  normalizeScheduleInput,
  publicJob,
  safePayload,
  schedulerRecordKey
};
