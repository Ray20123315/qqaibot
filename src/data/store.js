// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { DEFAULTS } from "../config/runtime.js";



// ==========================================
// 🗄️ D1 資料庫操作小幫手 (模擬 KV 行為)
// ==========================================
async function dbGet(env, key) {
  if (!env || !env.DB) return null; // 防呆安全鎖
  try {
    return await dbGetStrict(env, key);
  } catch (e) {
    console.error(`讀取 DB 失敗 [${key}]:`, e);
    throw e;
  }
}



async function dbPut(env, key, value) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    return await dbPutStrict(env, key, value);
  } catch (e) {
    console.error(`寫入 DB 失敗 [${key}]:`, e);
    throw e;
  }
}



function d1StorageError(operation, key, cause) {
  const error = new Error(`D1 ${operation} failed${key ? ` for ${key}` : ""}`);
  error.code = "D1_STORAGE_UNAVAILABLE";
  if (cause) error.cause = cause;
  return error;
}



async function dbRetryStrict(operation, key, fn, attempts = 3) {
  let lastError = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (index + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 40 * (index + 1)));
    }
  }
  throw d1StorageError(operation, key, lastError);
}



async function dbGetStrict(env, key) {
  if (!env?.DB) throw d1StorageError("read", key);
  return dbRetryStrict("read", key, async () => {
    const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    return result ? result.value : null;
  });
}



async function dbPutStrict(env, key, value) {
  if (!env?.DB) throw d1StorageError("write", key);
  return dbRetryStrict("write", key, async () => {
    const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE kv_store.value IS NOT excluded.value").bind(key, value).run();
    if (result?.success === false) throw new Error("D1 reported write failure");
    return result;
  });
}



async function dbDelStrict(env, key) {
  if (!env?.DB) throw d1StorageError("delete", key);
  return dbRetryStrict("delete", key, async () => {
    const result = await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
    if (result?.success === false) throw new Error("D1 reported delete failure");
    return result;
  });
}



async function dbCompareAndSwapStrict(env, key, expectedValue, value) {
  if (!env?.DB) throw d1StorageError("compare-and-swap", key);
  const expected = expectedValue === null || expectedValue === undefined ? null : String(expectedValue);
  const result = await dbRetryStrict("compare-and-swap", key, async () => expected === null
    ? env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING").bind(key, value).run()
    : env.DB.prepare("UPDATE kv_store SET value = ? WHERE key = ? AND value = ?").bind(value, key, expected).run());
  if (result?.success === false) throw d1StorageError("compare-and-swap", key);
  return Number(result?.meta?.changes || 0) === 1;
}



async function dbAppendJsonArrayCapped(env, key, item, limit = 1000) {
  if (!env?.DB) throw d1StorageError("append", key);
  const cap = Math.max(1, Math.min(10000, Number(limit) || 1000));
  const encoded = JSON.stringify(item);
  return dbRetryStrict("append", key, async () => {
    const result = await env.DB.prepare(`INSERT INTO kv_store (key, value) VALUES (?, json_array(json(?)))
      ON CONFLICT(key) DO UPDATE SET value = CASE
        WHEN json_valid(kv_store.value) AND json_type(kv_store.value) = 'array' THEN json_insert(
          CASE WHEN json_array_length(kv_store.value) >= ? THEN json_remove(kv_store.value, '$[0]') ELSE kv_store.value END,
          '$[#]', json(?)
        )
        ELSE json_array(json(?))
      END`).bind(key, encoded, cap, encoded, encoded).run();
    if (result?.success === false) throw new Error("D1 reported JSON append failure");
    return result;
  });
}



async function dbAddJsonArrayItemUnique(env, key, item, limit = 2000) {
  if (!env?.DB) throw d1StorageError("index update", key);
  const cap = Math.max(1, Math.min(10000, Number(limit) || 2000));
  const value = String(item);
  return dbRetryStrict("index update", key, async () => {
    const result = await env.DB.prepare(`INSERT INTO kv_store (key, value) VALUES (?, json_array(?))
      ON CONFLICT(key) DO UPDATE SET value = CASE
        WHEN NOT json_valid(kv_store.value) OR json_type(kv_store.value) != 'array' THEN json_array(?)
        WHEN EXISTS (SELECT 1 FROM json_each(kv_store.value) WHERE CAST(value AS TEXT) = ?) THEN kv_store.value
        ELSE json_insert(
          CASE WHEN json_array_length(kv_store.value) >= ? THEN json_remove(kv_store.value, '$[0]') ELSE kv_store.value END,
          '$[#]', ?
        )
      END`).bind(key, value, value, value, cap, value).run();
    if (result?.success === false) throw new Error("D1 reported JSON index append failure");
    return result;
  });
}



async function dbRemoveJsonArrayItem(env, key, item) {
  if (!env?.DB) throw d1StorageError("index delete", key);
  const value = String(item);
  return dbRetryStrict("index delete", key, async () => {
    const result = await env.DB.prepare(`UPDATE kv_store SET value = CASE
      WHEN json_valid(value) AND json_type(value) = 'array' AND EXISTS (SELECT 1 FROM json_each(kv_store.value) WHERE CAST(value AS TEXT) = ?)
      THEN json_remove(value, '$[' || (SELECT key FROM json_each(kv_store.value) WHERE CAST(value AS TEXT) = ? ORDER BY CAST(key AS INTEGER) LIMIT 1) || ']')
      ELSE value
    END WHERE key = ?`).bind(value, value, key).run();
    if (result?.success === false) throw new Error("D1 reported JSON index delete failure");
    return result;
  });
}



async function dbClaimLeaseStrict(env, key, owner, now = Date.now(), leaseMs = 180000) {
  if (!env?.DB) throw d1StorageError("lease claim", key);
  const value = JSON.stringify({ owner: String(owner), startedAt: now, heartbeatAt: now, expiresAt: now + Math.max(1000, Number(leaseMs) || 180000) });
  const result = await dbRetryStrict("lease claim", key, async () => env.DB.prepare(`INSERT INTO kv_store (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    WHERE CAST(coalesce(json_extract(kv_store.value, '$.expiresAt'), 0) AS INTEGER) <= ?
       OR json_extract(kv_store.value, '$.owner') = ?`).bind(key, value, now, String(owner)).run());
  if (result?.success === false) throw d1StorageError("lease claim", key);
  if (Number(result?.meta?.changes || 0) <= 0) return false;
  const confirmed = await dbGetStrict(env, key);
  try { return JSON.parse(confirmed || "null")?.owner === String(owner); } catch { return false; }
}



async function dbRenewLeaseStrict(env, key, owner, now = Date.now(), leaseMs = 180000) {
  if (!env?.DB) throw d1StorageError("lease renew", key);
  const result = await dbRetryStrict("lease renew", key, async () => env.DB.prepare(`UPDATE kv_store SET value = json_set(value, '$.heartbeatAt', ?, '$.expiresAt', ?)
    WHERE key = ? AND json_extract(value, '$.owner') = ?`).bind(now, now + Math.max(1000, Number(leaseMs) || 180000), key, String(owner)).run());
  if (result?.success === false) throw d1StorageError("lease renew", key);
  return Number(result?.meta?.changes || 0) > 0;
}



async function dbDeleteKeyIfJsonFieldEquals(env, key, field, expected) {
  if (!env?.DB) throw d1StorageError("conditional delete", key);
  if (!/^\$\.[A-Za-z0-9_]+$/.test(String(field || ""))) throw d1StorageError("invalid JSON field", key);
  const result = await dbRetryStrict("conditional delete", key, async () => env.DB.prepare("DELETE FROM kv_store WHERE key = ? AND json_extract(value, ?) = ?").bind(key, field, String(expected)).run());
  if (result?.success === false) throw d1StorageError("conditional delete", key);
  return Number(result?.meta?.changes || 0) > 0;
}



function prefixRangeEnd(prefix) {
  // Current KV namespaces use ASCII; U+FFFF is a strict upper bound for their suffixes.
  return `${String(prefix)}\uFFFF`;
}



async function dbDel(env, key) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    return await dbDelStrict(env, key);
  } catch (e) {
    console.error(`删除 DB 失敗 [${key}]:`, e);
    throw e;
  }
}



async function dbDeletePrefix(env, prefix) {
  if (!env?.DB || !prefix) return;
  return dbDeletePrefixStrict(env, prefix);
}



async function dbDeletePrefixStrict(env, prefix) {
  if (!env?.DB) throw d1StorageError("delete prefix", prefix);
  const normalized = String(prefix || "");
  if (!normalized) throw d1StorageError("delete empty prefix");
  return dbRetryStrict("delete prefix", normalized, async () => {
    const result = await env.DB.prepare("DELETE FROM kv_store WHERE key >= ? AND key < ?").bind(normalized, prefixRangeEnd(normalized)).run();
    if (result?.success === false) throw new Error("D1 reported prefix delete failure");
    return result;
  });
}



function parseStoredHistory(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}



async function readChatHistory(env, sessionKey, limit = DEFAULTS.conversationHistoryItems) {
  const boundedLimit = Math.max(2, Math.min(200, Number(limit || DEFAULTS.conversationHistoryItems)));
  const isGroupSession = String(sessionKey).startsWith("chat:group:");
  if (!isGroupSession || !env?.DB) {
    return parseStoredHistory(await dbGet(env, sessionKey)).slice(-boundedLimit);
  }
  try {
    const turnLimit = Math.max(1, Math.ceil(boundedLimit / 2) + 4);
    const turnPrefix = `chat_turn:${sessionKey}:`;
    const rows = await env.DB.prepare("SELECT value FROM kv_store WHERE key >= ? AND key < ? ORDER BY key DESC LIMIT ?")
      .bind(turnPrefix, prefixRangeEnd(turnPrefix), turnLimit)
      .all();
    const recent = (rows.results || []).reverse().flatMap(row => {
      try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {
        return [];
      }
    });
    if (recent.length >= boundedLimit) return recent.slice(-boundedLimit);
    const legacy = parseStoredHistory(await dbGet(env, sessionKey));
    return [...legacy, ...recent].slice(-boundedLimit);
  } catch (error) {
    console.error(`读取并发群聊历史失败 [${sessionKey}]:`, error);
    return parseStoredHistory(await dbGet(env, sessionKey)).slice(-boundedLimit);
  }
}


async function appendChatHistoryTurn(env, sessionKey, items, metadata = {}) {
  const cleanItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanItems.length) return;
  if (!String(sessionKey).startsWith("chat:group:") || !env?.DB) {
    const current = await readChatHistory(env, sessionKey, DEFAULTS.conversationHistoryItems);
    await dbPutStrict(env, sessionKey, JSON.stringify([...current, ...cleanItems].slice(-DEFAULTS.conversationHistoryItems)));
    return;
  }
  const createdAt = Math.max(0, Number(metadata.createdAt || Date.now()));
  const sourceMessageId = String(metadata.messageId || "").replace(/\D/g, "").padStart(20, "0");
  const key = `chat_turn:${sessionKey}:${String(createdAt).padStart(13, "0")}:${sourceMessageId}:${crypto.randomUUID()}`;
  const retentionMs = Math.max(24 * 60 * 60 * 1000, Number(metadata.retentionMs || 30 * 24 * 60 * 60 * 1000));
  await dbPutStrict(env, key, JSON.stringify({ items: cleanItems, createdAt, expiresAt: createdAt + retentionMs, messageId: String(metadata.messageId || ""), userId: String(metadata.userId || "") }));
}



async function clearChatSessionHistory(env, sessionKey) {
  await Promise.all([dbDelStrict(env, sessionKey), dbDelStrict(env, `context_summary:${sessionKey}`)]);
  if (String(sessionKey).startsWith("chat:group:")) await dbDeletePrefixStrict(env, `chat_turn:${sessionKey}:`);
}




function remainingTimeout(deadlineAt, capMs, floorMs = 800) {
  const remaining = Math.max(0, Number(deadlineAt || 0) - Date.now());
  return Math.max(floorMs, Math.min(Number(capMs || remaining || floorMs), remaining || floorMs));
}



function isDeadlineExceeded(deadlineAt, reserveMs = 0) {
  return Date.now() + Math.max(0, reserveMs) >= Number(deadlineAt || 0);
}



function withTimeout(promise, timeoutMs, label = "TASK_TIMEOUT") {
  const ms = Math.max(500, Number(timeoutMs || 0));
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

export { appendChatHistoryTurn, clearChatSessionHistory, dbAddJsonArrayItemUnique, dbAppendJsonArrayCapped, dbClaimLeaseStrict, dbCompareAndSwapStrict, dbDel, dbDelStrict, dbDeleteKeyIfJsonFieldEquals, dbDeletePrefix, dbDeletePrefixStrict, dbGet, dbGetStrict, dbPut, dbPutStrict, dbRemoveJsonArrayItem, dbRenewLeaseStrict, isDeadlineExceeded, parseStoredHistory, prefixRangeEnd, readChatHistory, remainingTimeout, withTimeout };
