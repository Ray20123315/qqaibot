// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callGeminiGenerate, deepSeekApiKeys, effectiveRuntimeModels, geminiSearchApiKeys, geminiVisionApiKeys, googleApiKeysFor, imageInspectionEnabled, parseList, roundRobinKeys } from "../ai/runtime.js";
import { BUILD_DATE, DEFAULTS, VERSION } from "../config/runtime.js";
import { callOneBotAction } from "../core/permissions.js";
import { dbDel, dbGet, dbPut, withTimeout } from "../data/store.js";
import { getOneBotHub } from "../portal/auth.js";
import { getFeatureFlag } from "../security/network.js";



function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "未设置";
  if (text.length <= 8) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 4)}••••••${text.slice(-3)}`;
}



async function runTimedHealthCheck(name, fn, options = {}) {
  const startedAt = Date.now();
  try {
    const detail = await withTimeout(Promise.resolve().then(fn), Number(options.timeoutMs || 12000), `HEALTH_${name}_TIMEOUT`);
    return { name, status: "ok", latencyMs: Date.now() - startedAt, detail: detail ?? null, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { name, status: options.optional ? "warning" : "error", latencyMs: Date.now() - startedAt, error: String(error?.message || error), checkedAt: new Date().toISOString() };
  }
}



function apiModelHealthCandidates(env) {
  const rows = [];
  const add = (provider, model, keyPool, label) => {
    const id = String(model || "").trim();
    if (!id || rows.some(item => item.provider === provider && item.model === id && item.keyPool === keyPool)) return;
    rows.push({ provider, model: id, keyPool, label: label || id });
  };
  for (const model of parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it"])) add("gemini", model, "gemma_decision", `Google／Gemma 审查／${model}`);
  for (const model of parseList(env.GEMMA_LAST_RESORT_MODELS || env.GEMMA_CHAT_MODELS, ["gemma-4-31b-it"])) add("gemini", model, "gemma_chat", `Google／Gemma 聊天备用／${model}`);
  for (const model of parseList(env.GEMINI_DECISION_MODELS, ["gemini-3.1-flash-lite", "gemini-3.5-flash"])) add("gemini", model, "gemini_decision", `Google／Gemini 审查备用／${model}`);
  for (const model of parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"])) {
    if (/^gemma-/i.test(model)) add("gemini", model, "gemma_chat", `Google／Gemma 聊天备用／${model}`);
    else add("gemini", model, "gemini_chat", `Google／Gemini 聊天／${model}`);
  }
  for (const model of parseList(env.GEMINI_VISION_MODELS)) add("gemini", model, "vision", `Google 图片／${model}`);
  add("deepseek", env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel, "deepseek", `DeepSeek／上下文整理与紧急聊天／${env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel}`);
  add("workers_ai", "@cf/baai/bge-m3", "binding", "Workers AI／向量嵌入／@cf/baai/bge-m3");
  return rows;
}



function apiModelHealthKeys(env, provider, keyPool) {
  if (provider === "deepseek") return deepSeekApiKeys(env);
  if (provider !== "gemini") return [];
  if (keyPool === "vision") return roundRobinKeys(geminiVisionApiKeys(env), "gemini_vision");
  if (keyPool === "search") return roundRobinKeys(geminiSearchApiKeys(env), "gemini_search");
  if (keyPool === "gemma_decision") return roundRobinKeys(googleApiKeysFor(env, "gemma_decision"), "gemma_decision");
  if (keyPool === "gemma_chat") return roundRobinKeys(googleApiKeysFor(env, "gemma_chat"), "gemma_chat");
  if (keyPool === "gemini_decision") return roundRobinKeys(googleApiKeysFor(env, "gemini_decision"), "gemini_decision");
  return roundRobinKeys(googleApiKeysFor(env, "gemini_chat"), "gemini_chat");
}



async function runSingleApiModelHealthCheck(env, { provider, model, keyPool = "chat" } = {}) {
  const normalizedProvider = String(provider || "gemini").trim().toLowerCase();
  const modelId = String(model || "").trim().slice(0, 240);
  if (!modelId) throw new Error("请输入模型 ID");
  const startedAt = Date.now();
  if (normalizedProvider === "workers_ai") {
    if (!env.AI) throw new Error("Workers AI 尚未绑定");
    let result;
    if (/bge|embed/i.test(modelId)) result = await withTimeout(env.AI.run(modelId, { text: ["health check"] }), 20000, "WORKERS_AI_MODEL_TIMEOUT");
    else result = await withTimeout(env.AI.run(modelId, { messages: [{ role: "user", content: "只输出 OK" }], max_tokens: 8 }), 20000, "WORKERS_AI_MODEL_TIMEOUT");
    return { ok: true, provider: "Workers AI", model: modelId, keyPool: "Cloudflare Binding", latencyMs: Date.now() - startedAt, responsePreview: JSON.stringify(result).slice(0, 500), checkedAt: new Date().toISOString() };
  }
  if (normalizedProvider === "deepseek") {
    const keys = apiModelHealthKeys(env, "deepseek", "deepseek");
    if (!keys.length) throw new Error("未配置 DeepSeek API Key");
    const attempts = [];
    for (const key of keys) {
      const attemptAt = Date.now();
      try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "只输出 OK" }], temperature: 0, max_tokens: 8, stream: false }),
          signal: AbortSignal.timeout(20000)
        });
        const data = await response.json().catch(() => ({}));
        attempts.push({ key: maskSecret(key), status: response.status, latencyMs: Date.now() - attemptAt, message: String(data?.error?.message || "").slice(0, 240) });
        if (response.ok) return { ok: true, provider: "DeepSeek API", model: modelId, keyPool: "DeepSeek", key: maskSecret(key), latencyMs: Date.now() - startedAt, responsePreview: String(data?.choices?.[0]?.message?.content || "").slice(0, 200), usage: data?.usage || null, attempts, checkedAt: new Date().toISOString() };
      } catch (error) {
        attempts.push({ key: maskSecret(key), status: 0, latencyMs: Date.now() - attemptAt, message: String(error?.message || error).slice(0, 240) });
      }
    }
    const error = new Error("该 DeepSeek 模型检查失败");
    error.attempts = attempts;
    throw error;
  }
  if (normalizedProvider !== "gemini") throw new Error("不支持的模型提供者");
  const keys = apiModelHealthKeys(env, "gemini", keyPool);
  if (!keys.length) throw new Error(keyPool === "vision" ? "未配置图片检查 API Key" : keyPool === "search" ? "未配置搜索 API Key" : "未配置 Gemini API Key");
  const attempts = [];
  for (const key of keys) {
    const attemptAt = Date.now();
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await response.json().catch(() => ({}));
      attempts.push({ key: maskSecret(key), status: response.status, latencyMs: Date.now() - attemptAt, message: String(data?.error?.message || "").slice(0, 240) });
      if (response.ok) {
        const responsePreview = (data?.candidates?.[0]?.content?.parts || []).map(part => part?.text || "").join("").slice(0, 200);
        return { ok: true, provider: "Google Gemini API", model: modelId, keyPool: keyPool === "vision" ? "图片检查" : keyPool === "search" ? "联网搜索" : "一般聊天", key: maskSecret(key), latencyMs: Date.now() - startedAt, responsePreview, usage: data?.usageMetadata || null, attempts, checkedAt: new Date().toISOString() };
      }
    } catch (error) {
      attempts.push({ key: maskSecret(key), status: 0, latencyMs: Date.now() - attemptAt, message: String(error?.message || error).slice(0, 240) });
    }
  }
  const error = new Error("该 Google 模型检查失败");
  error.attempts = attempts;
  throw error;
}



async function runHealthChecks(env, { mode = "quick" } = {}) {
  const checks = [];
  checks.push(await runTimedHealthCheck("D1 数据库", async () => {
    if (!env.DB) throw new Error("DB_NOT_BOUND");
    if (mode === "full") {
      const key = `health:test:${crypto.randomUUID()}`;
      await dbPut(env, key, "ok");
      const value = await dbGet(env, key);
      await dbDel(env, key);
      if (value !== "ok") throw new Error("D1_WRITE_READ_MISMATCH");
      return "读写删除正常";
    }
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    if (!row?.ok) throw new Error("D1_QUERY_FAILED");
    return "查询正常";
  }, { timeoutMs: 10000 }));

  checks.push(await runTimedHealthCheck("Durable Object／NapCat", async () => {
    if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    const state = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json();
    if (!state.connected) throw new Error("NAPCAT_NOT_CONNECTED");
    // WebSocket 顯示 OPEN 不代表 OneBot action 能往返；以無副作用的 get_login_info 驗證 RPC。
    const rpc = await callOneBotAction(env, { action: "get_login_info", params: {} }, 8000);
    return {
      connected: true,
      rpcRoundTrip: true,
      botUserId: String(rpc?.user_id || rpc?.userId || ""),
      sockets: state.sockets,
      transportMode: state.transportMode,
      connectionId: state.connectionId,
      connectedAt: state.connectedAt,
      lastHeartbeatAt: state.lastHeartbeatAt,
      heartbeatAgeMs: state.heartbeatAgeMs,
      reconnectCount: state.reconnectCount,
      closeCount: state.closeCount,
      errorCount: state.errorCount,
      lastClose: state.lastClose,
      lastSocketError: state.lastSocketError,
      pendingRpc: state.pendingRpc,
      inFlightQuestions: state.inFlightQuestions,
      queuedQuestions: state.queuedQuestions,
      recentGroupIngress: state.recentGroupIngress || []
    };
  }, { timeoutMs: 10000 }));

  const keys = roundRobinKeys(googleApiKeysFor(env, "gemini_chat"), "gemini_chat");
  checks.push(await runTimedHealthCheck("Gemini 实际生成", async () => {
    if (!keys.length) throw new Error("GEMINI_API_KEY_MISSING");
    const models = await effectiveRuntimeModels(env, "chat");
    const result = await callGeminiGenerate(env, {
      models,
      apiKeys: [keys[0]],
      keyProvider: "gemini_health",
      system: "你是健康检查。只输出 OK。",
      contents: [{ role: "user", parts: [{ text: "只输出 OK" }] }],
      maxOutputTokens: 8,
      temperature: 0,
      useSearch: false,
      requireSearch: false,
      timeoutMs: 9000,
      deadlineAt: Date.now() + 12000,
      maxAttempts: Math.min(4, Math.max(1, models.length))
    });
    if (!/^ok$/i.test(String(result.text || "").trim())) throw new Error("GEMINI_GENERATION_UNEXPECTED_OUTPUT");
    return { key: maskSecret(keys[0]), reachable: true, generationTested: true, model: result.model };
  }, { timeoutMs: 14000 }));

  const visionKeys = roundRobinKeys(geminiVisionApiKeys(env), "gemini_vision");
  checks.push(await runTimedHealthCheck("Gemini 图片检查", async () => {
    if (!visionKeys.length) return { configured: false, enabled: false, mode: "auto_off" };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(visionKeys[0])}&pageSize=1`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`GEMINI_VISION_${response.status}`);
    return {
      configured: true,
      enabled: true,
      keys: visionKeys.length,
      key: maskSecret(visionKeys[0]),
      models: parseList(env.GEMINI_VISION_MODELS, parseList(env.GEMINI_CHAT_MODELS))
    };
  }, { timeoutMs: 10000, optional: true }));

  checks.push(await runTimedHealthCheck("Gemma 4 26B 模型", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-26b-a4b-it"), generationTested: false };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA26_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-26b-a4b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("Gemma 4 31B 模型", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-31b-it"), generationTested: false };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA31_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-31b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("DeepSeek API 连通性", async () => {
    const deepseekKeys = deepSeekApiKeys(env);
    if (!deepseekKeys.length) return { configured: false };
    if (mode !== "full") return { configured: true, keys: deepseekKeys.length, key: maskSecret(deepseekKeys[0]), generationTested: false };
    const response = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${deepseekKeys[0]}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`DEEPSEEK_${response.status}`);
    return { configured: true, reachable: true };
  }, { timeoutMs: 10000, optional: true }));

  checks.push(await runTimedHealthCheck("Workers AI 绑定", async () => {
    if (!env.AI) throw new Error("AI_NOT_BOUND");
    if (mode !== "full") return "绑定存在";
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["health check"] });
    if (!Array.isArray(result?.data?.[0])) throw new Error("WORKERS_AI_EMBEDDING_FAILED");
    return { dimensions: result.data[0].length };
  }, { timeoutMs: 15000 }));

  checks.push(await runTimedHealthCheck("Vectorize 向量库", async () => {
    if (!env.VECTORIZE) throw new Error("VECTORIZE_NOT_BOUND");
    if (mode !== "full") return "绑定存在";
    if (!env.AI) throw new Error("AI_REQUIRED_FOR_VECTOR_TEST");
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["vector health"] });
    const vector = result?.data?.[0];
    if (!Array.isArray(vector)) throw new Error("VECTOR_EMBEDDING_FAILED");
    const query = await env.VECTORIZE.query(vector, { topK: 1, returnMetadata: "all" });
    return { matches: query?.matches?.length || 0 };
  }, { timeoutMs: 18000 }));

  const lastCron = await dbGet(env, "system:last_cron");
  checks.push({ name: "Cron 定时任务", status: lastCron && Date.now() - Number(lastCron) < 5 * 60 * 1000 ? "ok" : "warning", latencyMs: 0, detail: { lastRunAt: lastCron ? new Date(Number(lastCron)).toISOString() : null }, checkedAt: new Date().toISOString() });
  checks.push({ name: "D1 动态限速", status: env.DB ? "ok" : "warning", latencyMs: 0, detail: env.DB ? "D1 动态限速已启用" : "D1 未绑定", checkedAt: new Date().toISOString() });

  const summary = {
    ok: !checks.some(item => item.status === "error"),
    mode,
    version: VERSION,
    buildDate: BUILD_DATE,
    checkedAt: new Date().toISOString(),
    counts: {
      ok: checks.filter(item => item.status === "ok").length,
      warning: checks.filter(item => item.status === "warning").length,
      error: checks.filter(item => item.status === "error").length
    },
    checks
  };
  await dbPut(env, `health:last:${mode}`, JSON.stringify(summary));
  return summary;
}



async function buildHealthState(env) {
  const health = await runHealthChecks(env, { mode: "quick" });
  let onebot = null;
  try { onebot = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json(); } catch {}
  const latestIngress = Array.isArray(onebot?.recentGroupIngress) ? onebot.recentGroupIngress[0] || null : null;
  return {
    ...health,
    at: new Date().toISOString(),
    replyPath: latestIngress ? {
      groupId: latestIngress.groupId || "",
      status: latestIngress.lastDisposition || "unknown",
      lastUpdatedAt: latestIngress.lastUpdatedAt || null,
      preview: latestIngress.preview || "",
      error: latestIngress.error || ""
    } : null,
    bindings: { db: Boolean(env.DB), vectorize: Boolean(env.VECTORIZE), ai: Boolean(env.AI), onebotHub: Boolean(env.ONEBOT_HUB) },
    providers: {
      gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS),
      geminiVision: {
        enabled: imageInspectionEnabled(env),
        keys: geminiVisionApiKeys(env).length,
        models: parseList(env.GEMINI_VISION_MODELS, parseList(env.GEMINI_CHAT_MODELS))
      },
      gemmaDecisionModels: parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      gemmaChatModels: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      deepseek: deepSeekApiKeys(env).length > 0,
      liveModel: env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview"
    },
    onebot,
    privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
    privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
    privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
  };
}

export { apiModelHealthCandidates, apiModelHealthKeys, buildHealthState, maskSecret, runHealthChecks, runSingleApiModelHealthCheck, runTimedHealthCheck };
