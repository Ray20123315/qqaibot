import { isDeveloperId } from "../core/identity.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";

const MAX_MUTE_SECONDS = 30 * 24 * 60 * 60;

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function muteLockKey(groupId, userId) {
  return `mute_lock:${cleanId(groupId)}:${cleanId(userId)}`;
}

function selfMuteIndexKey(userId) {
  return `self_mute_index:${cleanId(userId)}`;
}

function normalizeMuteLock(value) {
  const source = value && typeof value === "object" ? value : {};
  const groupId = cleanId(source.groupId);
  const userId = cleanId(source.userId);
  const expiresAt = Number(source.expiresAt || 0);
  return {
    active: Boolean(source.active && groupId && userId && expiresAt > Date.now()),
    groupId,
    userId,
    source: source.source === "self" ? "self" : "manual",
    createdBy: cleanId(source.createdBy),
    createdAt: Number(source.createdAt || 0),
    expiresAt,
    durationSeconds: Math.max(1, Math.min(MAX_MUTE_SECONDS, Math.trunc(Number(source.durationSeconds || Math.ceil((expiresAt - Number(source.createdAt || Date.now())) / 1000) || 1)))),
    allowOwnerUnmute: Boolean(source.allowOwnerUnmute),
    reason: String(source.reason || "").slice(0, 500),
    noticeSentAt: Number(source.noticeSentAt || 0),
    blockedAttempts: Math.max(0, Math.trunc(Number(source.blockedAttempts || 0))),
    lastBlockedBy: cleanId(source.lastBlockedBy),
    lastBlockedAt: Number(source.lastBlockedAt || 0),
    lastReappliedAt: Number(source.lastReappliedAt || 0)
  };
}

async function readJsonKey(env, key, fallback = null) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function updateSelfMuteIndex(env, userId, groupId, add) {
  const key = selfMuteIndexKey(userId);
  const rows = await readJsonKey(env, key, []);
  const next = [...new Set((Array.isArray(rows) ? rows : []).map(cleanId).filter(Boolean))];
  const id = cleanId(groupId);
  const output = add ? [...new Set([...next, id])] : next.filter(item => item !== id);
  if (output.length) await dbPut(env, key, JSON.stringify(output.slice(-200)));
  else await dbDel(env, key);
}

async function putMuteLock(env, input) {
  const now = Date.now();
  const groupId = cleanId(input?.groupId);
  const userId = cleanId(input?.userId);
  const durationSeconds = Math.max(1, Math.min(MAX_MUTE_SECONDS, Math.trunc(Number(input?.durationSeconds || 0))));
  if (!groupId || !userId || !durationSeconds) throw new Error("INVALID_MUTE_LOCK");
  const existing = normalizeMuteLock(await readJsonKey(env, muteLockKey(groupId, userId), null));
  const lock = normalizeMuteLock({
    ...existing,
    ...input,
    active: true,
    groupId,
    userId,
    durationSeconds,
    createdAt: Number(input?.createdAt || now),
    expiresAt: Number(input?.expiresAt || now + durationSeconds * 1000),
    noticeSentAt: Number(input?.noticeSentAt || 0),
    blockedAttempts: Number(input?.blockedAttempts || 0)
  });
  lock.active = true;
  await dbPut(env, muteLockKey(groupId, userId), JSON.stringify(lock));
  if (lock.source === "self") await updateSelfMuteIndex(env, userId, groupId, true);
  return lock;
}

async function createManualMuteLock(env, { groupId, userId, actorId, durationSeconds, allowOwnerUnmute = false, reason = "" }) {
  return putMuteLock(env, {
    groupId,
    userId,
    source: "manual",
    createdBy: actorId,
    durationSeconds,
    allowOwnerUnmute,
    reason
  });
}

async function createSelfMuteLock(env, { groupId, userId, durationSeconds, reason = "" }) {
  return putMuteLock(env, {
    groupId,
    userId,
    source: "self",
    createdBy: userId,
    durationSeconds,
    allowOwnerUnmute: false,
    reason: reason || "群友主动自我禁言"
  });
}

async function getMuteLock(env, groupId, userId) {
  const key = muteLockKey(groupId, userId);
  const lock = normalizeMuteLock(await readJsonKey(env, key, null));
  if (!lock.active) {
    if (lock.groupId && lock.userId) {
      await dbDel(env, key).catch(() => {});
      if (lock.source === "self") await updateSelfMuteIndex(env, lock.userId, lock.groupId, false).catch(() => {});
    }
    return null;
  }
  return lock;
}

async function clearMuteLock(env, groupId, userId) {
  const lock = await getMuteLock(env, groupId, userId);
  await dbDel(env, muteLockKey(groupId, userId));
  if (lock?.source === "self") await updateSelfMuteIndex(env, userId, groupId, false);
  return lock;
}

function canUnlockMute(env, lock, { actorId = "", actorRole = "", isDeveloper = false, privateSelfCommand = false } = {}) {
  if (!lock?.active) return { allowed: true, reason: "no_lock" };
  const actor = cleanId(actorId);
  if (lock.source === "self") {
    if (privateSelfCommand && actor && actor === lock.userId) return { allowed: true, reason: "self_private_release" };
    return { allowed: false, reason: "self_mute_private_only" };
  }
  if (isDeveloper || isDeveloperId(env, actor)) return { allowed: true, reason: "developer" };
  if (lock.allowOwnerUnmute && String(actorRole || "") === "owner") return { allowed: true, reason: "owner_allowed" };
  return { allowed: false, reason: lock.allowOwnerUnmute ? "developer_or_owner_only" : "developer_only" };
}

async function markMuteUnlockBlocked(env, lock, operatorId) {
  const current = await getMuteLock(env, lock?.groupId, lock?.userId);
  if (!current) return { lock: null, shouldNotify: false };
  const shouldNotify = !current.noticeSentAt;
  current.blockedAttempts += 1;
  current.lastBlockedBy = cleanId(operatorId);
  current.lastBlockedAt = Date.now();
  if (shouldNotify) current.noticeSentAt = current.lastBlockedAt;
  await dbPut(env, muteLockKey(current.groupId, current.userId), JSON.stringify(current));
  return { lock: current, shouldNotify };
}

async function markMuteLockReapplied(env, lock) {
  const current = await getMuteLock(env, lock?.groupId, lock?.userId);
  if (!current) return null;
  current.lastReappliedAt = Date.now();
  await dbPut(env, muteLockKey(current.groupId, current.userId), JSON.stringify(current));
  return current;
}

async function listActiveSelfMuteLocks(env, userId) {
  const groups = await readJsonKey(env, selfMuteIndexKey(userId), []);
  const output = [];
  for (const groupId of Array.isArray(groups) ? groups : []) {
    const lock = await getMuteLock(env, groupId, userId);
    if (lock?.source === "self") output.push(lock);
  }
  return output;
}

async function listGroupMuteLocks(env, groupId) {
  const prefix = `mute_lock:${cleanId(groupId)}:`;
  const output = {};
  if (!env?.DB || !cleanId(groupId)) return output;
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE substr(key, 1, ?) = ?").bind(prefix.length, prefix).all();
    for (const row of rows.results || []) {
      let parsed = null;
      try { parsed = JSON.parse(String(row?.value || "{}")); } catch {}
      const lock = normalizeMuteLock(parsed);
      if (lock.active) output[lock.userId] = lock;
      else if (lock.userId) await dbDel(env, muteLockKey(groupId, lock.userId)).catch(() => {});
    }
  } catch (error) {
    console.warn("list group mute locks failed", error?.message || error);
  }
  return output;
}

function muteLockRemainingSeconds(lock, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(lock?.expiresAt || 0) - now) / 1000));
}

export {
  MAX_MUTE_SECONDS,
  canUnlockMute,
  clearMuteLock,
  createManualMuteLock,
  createSelfMuteLock,
  getMuteLock,
  listActiveSelfMuteLocks,
  listGroupMuteLocks,
  markMuteLockReapplied,
  markMuteUnlockBlocked,
  muteLockKey,
  muteLockRemainingSeconds,
  putMuteLock
};
