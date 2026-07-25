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



async function dbPut(env, key, value) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value);
    await stmt.run();
  } catch (e) {
    console.error(`寫入 DB 失敗 [${key}]:`, e);
  }
}



async function dbDel(env, key) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key);
    await stmt.run();
  } catch (e) {
    console.error(`删除 DB 失敗 [${key}]:`, e);
  }
}



async function dbDeletePrefix(env, prefix) {
  if (!env?.DB || !prefix) return;
  try {
    await env.DB.prepare("DELETE FROM kv_store WHERE substr(key, 1, ?) = ?").bind(prefix.length, prefix).run();
  } catch (error) {
    console.error(`批量删除 DB 失败 [${prefix}]:`, error);
  }
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
  await dbPut(env, key, JSON.stringify({ items: cleanItems, createdAt, messageId: String(metadata.messageId || ""), userId: String(metadata.userId || "") }));
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

export { appendChatHistoryTurn, clearChatSessionHistory, dbDel, dbDeletePrefix, dbGet, dbPut, isDeadlineExceeded, parseStoredHistory, readChatHistory, remainingTimeout, withTimeout };
