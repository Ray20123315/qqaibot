import {
  getProviderAccount,
  providerQuotaState,
  readProviderRoute,
  recordProviderUsage
} from "./provider-registry.js";
import { callCodexBridgeWebSocket, usesWorkerCodexWebSocket } from "../v3/ai/codex-bridge.js";

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeMessages(input = {}) {
  if (Array.isArray(input.messages) && input.messages.length) {
    return input.messages.slice(-80).map(row => ({
      role: ["system", "assistant", "user"].includes(String(row?.role || "")) ? String(row.role) : "user",
      content: String(row?.content ?? row?.text ?? "").slice(0, 50000)
    })).filter(row => row.content);
  }
  const messages = [];
  if (input.system) messages.push({ role: "system", content: String(input.system).slice(0, 20000) });
  const text = String(input.text ?? input.prompt ?? "").slice(0, 80000);
  if (text) messages.push({ role: "user", content: text });
  return messages;
}

function accountMoneyEstimate(account, usage = {}) {
  const inputTokens = Number(usage.inputTokens || usage.prompt_tokens || usage.promptTokenCount || 0);
  const outputTokens = Number(usage.outputTokens || usage.completion_tokens || usage.candidatesTokenCount || 0);
  const inputPerMillion = Number(account?.metadata?.inputMoneyPerMillion ?? account?.metadata?.inputCnyPerMillion ?? 0);
  const outputPerMillion = Number(account?.metadata?.outputMoneyPerMillion ?? account?.metadata?.outputCnyPerMillion ?? 0);
  return Math.max(0, inputTokens / 1e6 * inputPerMillion + outputTokens / 1e6 * outputPerMillion);
}

function normalizeUsage(provider, payload = {}) {
  const usage = payload?.usage || payload?.usageMetadata || payload?.result?.usage || {};
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? usage.inputTokens ?? 0) || 0;
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? usage.outputTokens ?? 0) || 0;
  return { inputTokens, outputTokens, money: 0, requests: 1, provider };
}

function joinUrl(base, suffix) {
  const root = String(base || "").replace(/\/+$/g, "");
  const tail = String(suffix || "").replace(/^\/+/g, "");
  return root ? root + "/" + tail : "";
}

async function responseJson(response) {
  const payload = await response.json().catch(async () => ({ text: await response.text().catch(() => "") }));
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.message || payload?.text || response.statusText || "request failed").slice(0, 500);
    throw new Error("AI_PROVIDER_HTTP_" + response.status + ":" + detail);
  }
  return payload;
}

function extractOpenAiText(payload) {
  const choice = payload?.choices?.[0];
  if (typeof choice?.message?.content === "string") return choice.message.content.trim();
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content.map(part => part?.text || part?.content || "").join("").trim();
  }
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  if (Array.isArray(payload?.output)) {
    return payload.output.flatMap(item => Array.isArray(item?.content) ? item.content : [])
      .map(part => part?.text || part?.content || "").join("").trim();
  }
  return "";
}

async function callOpenAiCompatible(account, secret, input, fetchImpl) {
  const endpoint = account.endpoint || (
    account.provider === "deepseek" ? "https://api.deepseek.com" :
    account.provider === "openai_api" ? "https://api.openai.com/v1" : ""
  );
  if (!endpoint) throw new Error("AI_PROVIDER_ENDPOINT_REQUIRED");
  const url = /\/chat\/completions(?:\?|$)/i.test(endpoint) ? endpoint : joinUrl(endpoint, "chat/completions");
  const messages = normalizeMessages(input);
  if (!messages.length) throw new Error("AI_PROVIDER_INPUT_REQUIRED");
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: "Bearer " + secret } : {})
    },
    body: JSON.stringify({
      model: account.model || input.model,
      messages,
      temperature: clampNumber(input.temperature, 0.4, 0, 2),
      max_tokens: clampNumber(input.maxOutputTokens, 1000, 1, 8192)
    }),
    signal: AbortSignal.timeout(clampNumber(input.timeoutMs, 20000, 1000, 60000))
  });
  const payload = await responseJson(response);
  const text = extractOpenAiText(payload);
  if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return { text, model: String(payload?.model || account.model || ""), usage: normalizeUsage(account.provider, payload), rawUsage: payload?.usage || null };
}

function toGeminiContents(messages) {
  const contents = [];
  let system = "";
  for (const row of messages) {
    if (row.role === "system") {
      system += (system ? "\n" : "") + row.content;
      continue;
    }
    contents.push({ role: row.role === "assistant" ? "model" : "user", parts: [{ text: row.content }] });
  }
  return { system, contents };
}

async function callGoogleGenerativeLanguage(account, secret, input, fetchImpl) {
  if (!secret) throw new Error("AI_PROVIDER_SECRET_REQUIRED");
  const model = String(account.model || input.model || "").trim();
  if (!model) throw new Error("AI_PROVIDER_MODEL_REQUIRED");
  const messages = normalizeMessages(input);
  if (!messages.length) throw new Error("AI_PROVIDER_INPUT_REQUIRED");
  const compiled = toGeminiContents(messages);
  const endpoint = account.endpoint || "https://generativelanguage.googleapis.com/v1beta";
  const url = joinUrl(endpoint, "models/" + encodeURIComponent(model) + ":generateContent") + "?key=" + encodeURIComponent(secret);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: compiled.contents,
      ...(compiled.system ? { systemInstruction: { parts: [{ text: compiled.system }] } } : {}),
      generationConfig: {
        maxOutputTokens: clampNumber(input.maxOutputTokens, 1000, 1, 8192),
        temperature: clampNumber(input.temperature, 0.4, 0, 2)
      }
    }),
    signal: AbortSignal.timeout(clampNumber(input.timeoutMs, 20000, 1000, 60000))
  });
  const payload = await responseJson(response);
  const text = (payload?.candidates?.[0]?.content?.parts || []).filter(part => !part?.thought).map(part => part?.text || "").join("").trim();
  if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return { text, model, usage: normalizeUsage(account.provider, payload), rawUsage: payload?.usageMetadata || null };
}

async function callCloudflareWorkersAi(account, secret, input, fetchImpl) {
  if (!secret) throw new Error("AI_PROVIDER_SECRET_REQUIRED");
  if (!account.accountId) throw new Error("AI_PROVIDER_CLOUDFLARE_ACCOUNT_ID_REQUIRED");
  const model = String(account.model || input.model || "").trim();
  if (!model) throw new Error("AI_PROVIDER_MODEL_REQUIRED");
  const endpoint = account.endpoint || "https://api.cloudflare.com/client/v4";
  const url = joinUrl(endpoint, "accounts/" + encodeURIComponent(account.accountId) + "/ai/run/" + model.split("/").map(encodeURIComponent).join("/"));
  const messages = normalizeMessages(input);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + secret },
    body: JSON.stringify({ messages, max_tokens: clampNumber(input.maxOutputTokens, 1000, 1, 8192), temperature: clampNumber(input.temperature, 0.4, 0, 2) }),
    signal: AbortSignal.timeout(clampNumber(input.timeoutMs, 20000, 1000, 60000))
  });
  const payload = await responseJson(response);
  const result = payload?.result;
  const text = String(result?.response ?? result?.text ?? payload?.response ?? "").trim();
  if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return { text, model, usage: normalizeUsage(account.provider, payload), rawUsage: result?.usage || payload?.usage || null };
}

async function callCodexBridge(account, secret, input, fetchImpl, env = null) {
  if (usesWorkerCodexWebSocket(account)) {
    if (!env) throw new Error("AI_PROVIDER_CODEX_BRIDGE_WS_ENV_REQUIRED");
    const result = await callCodexBridgeWebSocket(env, account, input);
    return {
      text: result.text,
      model: result.model,
      usage: normalizeUsage(account.provider, { usage: result.usage || {} }),
      rawUsage: result.usage || null,
      allowance: result.allowance || null
    };
  }
  if (!account.endpoint) throw new Error("AI_PROVIDER_CODEX_BRIDGE_ENDPOINT_REQUIRED");
  const url = /\/v1\/qqai\/chat(?:\?|$)/i.test(account.endpoint) ? account.endpoint : joinUrl(account.endpoint, "v1/qqai/chat");
  const messages = normalizeMessages(input);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: "Bearer " + secret } : {})
    },
    body: JSON.stringify({
      protocol: "qqai-codex-bridge-v1",
      task: String(input.task || "chat"),
      model: account.model || input.model || "",
      messages,
      maxOutputTokens: clampNumber(input.maxOutputTokens, 1000, 1, 8192)
    }),
    signal: AbortSignal.timeout(clampNumber(input.timeoutMs, 30000, 1000, 120000))
  });
  const payload = await responseJson(response);
  const text = String(payload?.text || payload?.result?.text || "").trim();
  if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return {
    text,
    model: String(payload?.model || account.model || "codex"),
    usage: normalizeUsage(account.provider, payload),
    rawUsage: payload?.usage || null,
    allowance: payload?.allowance || null
  };
}

async function executeProviderAccount(env, account, input = {}, dependencies = {}) {
  if (!account?.enabled) throw new Error("AI_PROVIDER_ACCOUNT_DISABLED");
  const fetchImpl = dependencies.fetchImpl || fetch;
  const full = await getProviderAccount(env, account.id, { includeSecret: true });
  if (!full) throw new Error("AI_PROVIDER_ACCOUNT_NOT_FOUND");
  const secret = String(full.secret || "");
  let result;
  if (["openai_api", "deepseek", "openai_compatible", "cloudflare_ai_gateway"].includes(full.provider)) {
    result = await callOpenAiCompatible(full, secret, input, fetchImpl);
  } else if (["google_gemini", "google_gemma"].includes(full.provider)) {
    result = await callGoogleGenerativeLanguage(full, secret, input, fetchImpl);
  } else if (full.provider === "cloudflare_workers_ai") {
    result = await callCloudflareWorkersAi(full, secret, input, fetchImpl);
  } else if (full.provider === "codex_bridge") {
    result = await callCodexBridge(full, secret, input, fetchImpl, env);
  } else {
    throw new Error("AI_PROVIDER_NOT_IMPLEMENTED:" + full.provider);
  }
  const usage = { ...result.usage, money: accountMoneyEstimate(full, result.usage) };
  await recordProviderUsage(env, full.id, usage).catch(() => {});
  return Object.freeze({ ...result, provider: full.provider, accountId: full.id, usage });
}

async function callProviderRoute(env, task, input = {}, dependencies = {}) {
  const kind = String(task || "").trim().toLowerCase();
  const route = await readProviderRoute(env, kind);
  if (!route.length) return null;
  const attempts = [];
  for (const id of route) {
    const account = await getProviderAccount(env, id);
    if (!account || !account.enabled || !account.tasks.includes(kind)) continue;
    const estimate = {
      inputTokens: Math.max(1, Math.ceil(JSON.stringify(normalizeMessages(input)).length / 3)),
      outputTokens: clampNumber(input.maxOutputTokens, 1000, 1, 8192),
      money: 0,
      requests: 1
    };
    const quota = await providerQuotaState(env, id, estimate);
    if (!quota.ok) {
      attempts.push({ accountId: id, provider: account.provider, ok: false, stage: "quota", reason: quota.reason });
      continue;
    }
    try {
      const result = await executeProviderAccount(env, account, { ...input, task: kind }, dependencies);
      return Object.freeze({ ...result, task: kind, attempts: Object.freeze(attempts) });
    } catch (error) {
      attempts.push({ accountId: id, provider: account.provider, ok: false, stage: "call", error: String(error?.message || error).slice(0, 300) });
    }
  }
  const error = new Error("AI_PROVIDER_ROUTE_EXHAUSTED");
  error.attempts = attempts;
  throw error;
}

export {
  accountMoneyEstimate,
  callCodexBridge,
  callCloudflareWorkersAi,
  callGoogleGenerativeLanguage,
  callOpenAiCompatible,
  callProviderRoute,
  executeProviderAccount,
  extractOpenAiText,
  normalizeMessages,
  normalizeUsage
};
