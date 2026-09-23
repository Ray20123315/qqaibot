// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { DEFAULTS } from "../config/runtime.js";



// ==========================================
// 🗄️ D1 資料庫操作小幫手 (模擬 KV 行為)
// ==========================================
async function dbGet(env, key) {
  if (!env || !env.DB) return null; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key);
    const result = await stmt.first();
    return result ? result.value : null;
  } catch (e) {
    console.error(`讀取 DB 失敗 [${key}]:`, e);
    return null;
  }
}



function dbStorageError(cause) {
  const error = new Error("Persistent storage is temporarily unavailable");
  error.code = "D1_STORAGE_UNAVAILABLE";
  error.retryable = true;
  if (cause) error.cause = cause;
  return error;
}



async function dbGetStrict(env, key) {
  if (!env?.DB) throw dbStorageError();
  try {
    const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    return result ? result.value : null;
  } catch (error) {
    throw dbStorageError(error);
  }
}



async function runStrict(env, sql, values) {
  if (!env?.DB) throw dbStorageError();
  try {
    const result = await env.DB.prepare(sql).bind(...values).run();
    if (result?.success === false || result?.error) throw new Error("D1 statement reported failure");
    return result;
  } catch (error) {
    throw dbStorageError(error);
  }
}



async function dbCompareAndSwap(env, key, expectedValue, nextValue) {
  const result = expectedValue === null
    ? await runStrict(env, "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING", [key, nextValue])
    : await runStrict(env, "UPDATE kv_store SET value = ? WHERE key = ? AND value = ?", [nextValue, key, expectedValue]);
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return changes === 1;
}



function dbExpiryIndexKey(key, expiresAt) {
  const timestamp = Math.max(0, Math.trunc(Number(expiresAt) || 0));
  return `expiry:${String(timestamp).padStart(13, "0")}:${encodeURIComponent(String(key || ""))}`;
}



async function dbPutExpiring(env, key, value, expiresAt, previousExpiryKey = "") {
  if (!env?.DB) throw dbStorageError();
  const expiryKey = dbExpiryIndexKey(key, expiresAt);
  const statements = [
    env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value)
  ];
  if (previousExpiryKey && previousExpiryKey !== expiryKey) {
    statements.push(env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(previousExpiryKey));
  }
  statements.push(env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(expiryKey, key));
  try {
    const results = await env.DB.batch(statements);
    if (results?.some(result => result?.success === false || result?.error)) throw new Error("D1 batch reported failure");
    return expiryKey;
  } catch (error) {
    throw dbStorageError(error);
  }
}



async function dbPutExpiringBestEffort(env, key, value, expiresAt) {
  try {
    return await dbPutExpiring(env, key, value, expiresAt);
  } catch {
    console.warn("Optional expiring persistent write was skipped");
    return "";
  }
}



async function dbCleanupExpiredRows(env, now = Date.now(), limit = 25) {
  if (!env?.DB) return 0;
  const batchLimit = Math.max(1, Math.min(25, Math.trunc(Number(limit) || 25)));
  const before = `expiry:${String(Math.max(0, Math.trunc(Number(now) || 0) + 1)).padStart(13, "0")}:`;
  let rows;
  try {
    const result = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'expiry:%' AND key < ? ORDER BY key LIMIT ?")
      .bind(before, batchLimit).all();
    rows = result?.results || [];
  } catch (error) {
    throw dbStorageError(error);
  }
  if (!rows.length) return 0;
  const indexKeys = rows.map(row => String(row.key || "")).filter(Boolean);
  const targetKeys = rows.map(row => String(row.value || "")).filter(Boolean);
  const placeholders = values => values.map(() => "?").join(",");
  const statements = [];
  if (targetKeys.length) statements.push(env.DB.prepare(`DELETE FROM kv_store WHERE key IN (${placeholders(targetKeys)})`).bind(...targetKeys));
  if (indexKeys.length) statements.push(env.DB.prepare(`DELETE FROM kv_store WHERE key IN (${placeholders(indexKeys)})`).bind(...indexKeys));
  try {
    const results = await env.DB.batch(statements);
    if (results?.some(result => result?.success === false || result?.error)) throw new Error("D1 cleanup batch reported failure");
    return rows.length;
  } catch (error) {
    throw dbStorageError(error);
  }
}



async function dbPut(env, key, value) {
  await runStrict(env,
    "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]);
}



async function dbPutBestEffort(env, key, value) {
  try {
    await dbPut(env, key, value);
    return true;
  } catch {
    console.warn("Optional persistent write was skipped");
    return false;
  }
}



async function dbDel(env, key) {
  await runStrict(env, "DELETE FROM kv_store WHERE key = ?", [key]);
}



async function dbDeletePrefix(env, prefix) {
  if (!prefix) return;
  await runStrict(env, "DELETE FROM kv_store WHERE substr(key, 1, ?) = ?", [prefix.length, prefix]);
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
  const legacy = parseStoredHistory(await dbGet(env, sessionKey));
  if (!String(sessionKey).startsWith("chat:group:") || !env?.DB) return legacy.slice(-boundedLimit);
  try {
    const turnLimit = Math.max(1, Math.ceil(boundedLimit / 2) + 4);
    const turnPrefix = `chat_turn:${sessionKey}:`;
    const rows = await env.DB.prepare("SELECT value FROM kv_store WHERE substr(key, 1, ?) = ? ORDER BY key DESC LIMIT ?")
      .bind(turnPrefix.length, turnPrefix, turnLimit)
      .all();
    const recent = (rows.results || []).reverse().flatMap(row => {
      try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {
        return [];
      }
    });
    return [...legacy, ...recent].slice(-boundedLimit);
  } catch (error) {
    console.error(`读取并发群聊历史失败 [${sessionKey}]:`, error);
    return legacy.slice(-boundedLimit);
  }
}



async function appendChatHistoryTurn(env, sessionKey, items, metadata = {}) {
  const cleanItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanItems.length) return;
  if (!String(sessionKey).startsWith("chat:group:") || !env?.DB) {
    const current = await readChatHistory(env, sessionKey, DEFAULTS.conversationHistoryItems);
    await dbPut(env, sessionKey, JSON.stringify([...current, ...cleanItems].slice(-DEFAULTS.conversationHistoryItems)));
    return;
  }
  const createdAt = Math.max(0, Number(metadata.createdAt || Date.now()));
  const sourceMessageId = String(metadata.messageId || "").replace(/\D/g, "").padStart(20, "0");
  const key = `chat_turn:${sessionKey}:${String(createdAt).padStart(13, "0")}:${sourceMessageId}:${crypto.randomUUID()}`;
  await dbPutExpiring(env, key, JSON.stringify({ items: cleanItems, createdAt, messageId: String(metadata.messageId || ""), userId: String(metadata.userId || "") }), createdAt + 7 * 24 * 60 * 60 * 1000);
}



async function clearChatSessionHistory(env, sessionKey) {
  await dbDel(env, sessionKey);
  await dbDel(env, `context_summary:${sessionKey}`);
  if (String(sessionKey).startsWith("chat:group:")) await dbDeletePrefix(env, `chat_turn:${sessionKey}:`);
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

export { appendChatHistoryTurn, clearChatSessionHistory, dbCleanupExpiredRows, dbCompareAndSwap, dbDel, dbDeletePrefix, dbExpiryIndexKey, dbGet, dbGetStrict, dbPut, dbPutBestEffort, dbPutExpiring, dbPutExpiringBestEffort, isDeadlineExceeded, parseStoredHistory, readChatHistory, remainingTimeout, withTimeout };
