const CODEX_BRIDGE_PROTOCOL = "qqai-codex-bridge-v1";
const CODEX_BRIDGE_PATH = "/v3/codex-bridge";
const CODEX_BRIDGE_INTERNAL_CHAT_PATH = "/v3/codex/chat";
const CODEX_BRIDGE_MAX_MESSAGES = 80;
const CODEX_BRIDGE_MAX_MESSAGE_CHARS = 50000;
const CODEX_BRIDGE_MAX_TOTAL_CHARS = 120000;
const CODEX_BRIDGE_MAX_OUTPUT_TOKENS = 8192;
const CODEX_BRIDGE_DEFAULT_TIMEOUT_MS = 45000;
const CODEX_BRIDGE_MAX_TIMEOUT_MS = 120000;

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function cleanMessages(value) {
  const source = Array.isArray(value) ? value.slice(-CODEX_BRIDGE_MAX_MESSAGES) : [];
  let remaining = CODEX_BRIDGE_MAX_TOTAL_CHARS;
  const output = [];
  for (const item of source) {
    if (remaining <= 0) break;
    const role = ["system", "assistant", "user"].includes(String(item?.role || "")) ? String(item.role) : "user";
    const text = String(item?.content ?? item?.text ?? "").slice(0, Math.min(CODEX_BRIDGE_MAX_MESSAGE_CHARS, remaining));
    if (!text) continue;
    output.push({ role, content: text });
    remaining -= text.length;
  }
  return output;
}

function normalizeCodexBridgeRequest(account = {}, input = {}) {
  const messages = cleanMessages(input.messages);
  if (!messages.length) {
    const system = String(input.system || "").slice(0, Math.min(20000, CODEX_BRIDGE_MAX_TOTAL_CHARS));
    const user = String(input.text ?? input.prompt ?? "").slice(0, CODEX_BRIDGE_MAX_MESSAGE_CHARS);
    if (system) messages.push({ role: "system", content: system });
    if (user) messages.push({ role: "user", content: user });
  }
  if (!messages.length) throw new Error("AI_PROVIDER_INPUT_REQUIRED");
  return Object.freeze({
    protocol: CODEX_BRIDGE_PROTOCOL,
    type: "request",
    task: String(input.task || "chat").trim().slice(0, 40) || "chat",
    model: String(account.model || input.model || "").trim().slice(0, 180),
    messages: Object.freeze(messages.map(row => Object.freeze(row))),
    maxOutputTokens: clampInteger(input.maxOutputTokens, 1000, 1, CODEX_BRIDGE_MAX_OUTPUT_TOKENS),
    timeoutMs: clampInteger(input.timeoutMs, CODEX_BRIDGE_DEFAULT_TIMEOUT_MS, 1000, CODEX_BRIDGE_MAX_TIMEOUT_MS),
    reasoningEffort: ["none", "low", "medium", "high", "xhigh", "max"].includes(String(input.reasoningEffort ?? input.reasoning_effort ?? "").trim().toLowerCase())
      ? String(input.reasoningEffort ?? input.reasoning_effort).trim().toLowerCase()
      : "",
    originalPromptOnly: input.originalPromptOnly === true || input.original_prompt_only === true,
    sessionKey: String(input.sessionKey || input.session_key || "").trim().slice(0, 240),
    contextHash: String(input.contextHash || input.context_hash || "").trim().slice(0, 128)
  });
}

function normalizeCodexBridgeResponse(payload = {}, fallbackModel = "") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("AI_PROVIDER_CODEX_BRIDGE_RESPONSE_INVALID");
  if (payload.ok === false || payload.error) {
    const detail = String(payload.error?.message || payload.error || payload.message || "local Codex bridge failed").slice(0, 500);
    throw new Error("AI_PROVIDER_CODEX_BRIDGE_ERROR:" + detail);
  }
  const text = String(payload.text ?? payload.result?.text ?? payload.output_text ?? "").trim();
  if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return Object.freeze({
    text,
    model: String(payload.model || payload.result?.model || fallbackModel || "codex").slice(0, 180),
    usage: payload.usage || payload.result?.usage || null,
    allowance: payload.allowance || payload.result?.allowance || null
  });
}

function usesWorkerCodexWebSocket(account = {}) {
  const endpoint = String(account.endpoint || "").trim().toLowerCase();
  const transport = String(account?.metadata?.transport || account?.metadata?.bridgeTransport || "").trim().toLowerCase();
  if (["worker_ws", "local_ws", "websocket", "ws"].includes(transport)) return true;
  if (!endpoint) return true;
  return endpoint === "worker://codex"
    || endpoint === "local://codex"
    || endpoint === CODEX_BRIDGE_PATH
    || /^wss?:\/\//i.test(endpoint);
}

function codexBridgeStub(env) {
  if (!env?.ONEBOT_HUB || typeof env.ONEBOT_HUB.idFromName !== "function" || typeof env.ONEBOT_HUB.get !== "function") {
    throw new Error("AI_PROVIDER_CODEX_BRIDGE_WS_UNAVAILABLE");
  }
  return env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("default"));
}

async function callCodexBridgeWebSocket(env, account, input = {}) {
  const request = normalizeCodexBridgeRequest(account, input);
  const stub = codexBridgeStub(env);
  const response = await stub.fetch("https://onebot-hub" + CODEX_BRIDGE_INTERNAL_CHAT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-QQAI-Internal": "codex-bridge" },
    body: JSON.stringify(request)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const detail = String(payload?.error || payload?.message || response.statusText || "bridge unavailable").slice(0, 500);
    throw new Error("AI_PROVIDER_CODEX_BRIDGE_WS_" + response.status + ":" + detail);
  }
  return normalizeCodexBridgeResponse(payload?.result || payload, account?.model || input?.model || "");
}

export {
  CODEX_BRIDGE_DEFAULT_TIMEOUT_MS,
  CODEX_BRIDGE_INTERNAL_CHAT_PATH,
  CODEX_BRIDGE_MAX_MESSAGE_CHARS,
  CODEX_BRIDGE_MAX_MESSAGES,
  CODEX_BRIDGE_MAX_OUTPUT_TOKENS,
  CODEX_BRIDGE_MAX_TIMEOUT_MS,
  CODEX_BRIDGE_MAX_TOTAL_CHARS,
  CODEX_BRIDGE_PATH,
  CODEX_BRIDGE_PROTOCOL,
  callCodexBridgeWebSocket,
  cleanMessages,
  normalizeCodexBridgeRequest,
  normalizeCodexBridgeResponse,
  usesWorkerCodexWebSocket
};
