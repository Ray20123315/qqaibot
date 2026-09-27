import { createQqOpenActionDispatcher } from "../platform/actions.js";
import { createQqOpenApiClient } from "./api.js";
import { fromQqOpenEvent } from "./events.js";
import {
  QQ_OPEN_OPCODE,
  createGatewayState,
  createHeartbeatPayload,
  createIdentifyPayload,
  createResumePayload,
  reduceGatewayPayload
} from "./gateway.js";

const QQ_OPEN_GATEWAY_STORAGE_KEY = "v4:qqopen:gateway";
const DEFAULT_QQ_OPEN_INTENTS = 1 << 25;
const DEFAULT_RECONNECT_MS = 5000;

function truthy(value) {
  return /^(?:1|true|yes|on|enabled)$/i.test(String(value ?? "").trim());
}

function qqOpenEnabled(env = {}) {
  return truthy(env.QQ_OPEN_ENABLED);
}

function qqOpenConfigured(env = {}) {
  return Boolean(String(env.QQ_OPEN_APP_ID || "").trim() && String(env.QQ_OPEN_CLIENT_SECRET || "").trim());
}

function qqOpenIntents(env = {}) {
  const raw = String(env.QQ_OPEN_INTENTS ?? "").trim();
  if (!raw) return DEFAULT_QQ_OPEN_INTENTS;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("QQ_OPEN_INVALID_INTENTS");
  return n;
}

function getQqOpenGateway(env) {
  if (!env?.QQ_OPEN_GATEWAY) throw new Error("QQ_OPEN_GATEWAY_NOT_BOUND");
  return env.QQ_OPEN_GATEWAY.get(env.QQ_OPEN_GATEWAY.idFromName("default"));
}

function stripBotMention(value) {
  return String(value ?? "").replace(/<@!?[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildConnectivityReply(message) {
  const input = stripBotMention(message?.text || "");
  if (/^!qqping$/i.test(input)) return "QQ Open V4 已连接并可回话。";
  const echo = input.match(/^!qqecho(?:\s+([\s\S]*))?$/i);
  if (echo) {
    const value = String(echo[1] || "").trim();
    return value ? `QQ Open V4 echo：${value}` : "格式：!qqecho 内容";
  }
  return "";
}

function socketOpen(socket) {
  return Boolean(socket && socket.readyState === 1);
}

function socketConnecting(socket) {
  return Boolean(socket && socket.readyState === 0);
}

function safeError(error) {
  return String(error?.message || error || "UNKNOWN_ERROR").slice(0, 500);
}

function defaultPersistedState() {
  return {
    gateway: createGatewayState(),
    suspended: false,
    connected: false,
    connecting: false,
    gatewayUrl: "",
    botUserId: "",
    connectedAt: 0,
    lastEventAt: 0,
    lastEventType: "",
    lastInboundAt: 0,
    lastInboundId: "",
    lastReplyAt: 0,
    lastReplyId: "",
    lastHeartbeatSentAt: 0,
    lastErrorAt: 0,
    lastError: "",
    reconnectCount: 0,
    connectCount: 0
  };
}

export class QqOpenGateway {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.socket = null;
    this.socketGeneration = 0;
    this.accessToken = "";
    this.apiClient = null;
    this.dispatcher = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.connectPromise = null;
    this.eventTasks = new Set();
    this.persisted = defaultPersistedState();

    this.ready = Promise.resolve();
    if (state?.storage && typeof state.blockConcurrencyWhile === "function") {
      this.ready = state.blockConcurrencyWhile(async () => {
        const saved = await state.storage.get(QQ_OPEN_GATEWAY_STORAGE_KEY);
        if (saved && typeof saved === "object") {
          this.persisted = {
            ...defaultPersistedState(),
            ...saved,
            gateway: createGatewayState(saved.gateway || {})
          };
          this.persisted.connected = false;
          this.persisted.connecting = false;
        }
      });
    }
  }

  track(promise) {
    const task = Promise.resolve(promise)
      .catch(error => this.recordError(error))
      .finally(() => this.eventTasks.delete(task));
    this.eventTasks.add(task);
    try { this.state?.waitUntil?.(task); } catch {}
    return task;
  }

  async persist() {
    if (!this.state?.storage) return;
    await this.state.storage.put(QQ_OPEN_GATEWAY_STORAGE_KEY, {
      ...this.persisted,
      gateway: createGatewayState(this.persisted.gateway || {})
    });
  }

  async recordError(error) {
    this.persisted.lastErrorAt = Date.now();
    this.persisted.lastError = safeError(error);
    await this.persist().catch(() => {});
  }

  status() {
    return Object.freeze({
      ok: true,
      enabled: qqOpenEnabled(this.env),
      configured: qqOpenConfigured(this.env),
      suspended: Boolean(this.persisted.suspended),
      connected: socketOpen(this.socket) || Boolean(this.persisted.connected),
      connecting: socketConnecting(this.socket) || Boolean(this.persisted.connecting),
      ready: Boolean(this.persisted.gateway?.ready),
      resumeEligible: Boolean(this.persisted.gateway?.resumeEligible),
      seq: this.persisted.gateway?.seq ?? null,
      heartbeatInterval: Number(this.persisted.gateway?.heartbeatInterval || 0),
      botUserId: String(this.persisted.botUserId || ""),
      connectedAt: Number(this.persisted.connectedAt || 0),
      lastEventAt: Number(this.persisted.lastEventAt || 0),
      lastEventType: String(this.persisted.lastEventType || ""),
      lastInboundAt: Number(this.persisted.lastInboundAt || 0),
      lastInboundId: String(this.persisted.lastInboundId || ""),
      lastReplyAt: Number(this.persisted.lastReplyAt || 0),
      lastReplyId: String(this.persisted.lastReplyId || ""),
      lastHeartbeatSentAt: Number(this.persisted.lastHeartbeatSentAt || 0),
      lastErrorAt: Number(this.persisted.lastErrorAt || 0),
      lastError: String(this.persisted.lastError || ""),
      reconnectCount: Number(this.persisted.reconnectCount || 0),
      connectCount: Number(this.persisted.connectCount || 0)
    });
  }

  api() {
    if (!this.apiClient) {
      this.apiClient = createQqOpenApiClient({
        appId: this.env.QQ_OPEN_APP_ID,
        clientSecret: this.env.QQ_OPEN_CLIENT_SECRET
      });
    }
    return this.apiClient;
  }

  actionDispatcher() {
    if (!this.dispatcher) this.dispatcher = createQqOpenActionDispatcher({ api: this.api() });
    return this.dispatcher;
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && ["/status", "/api/v4/qqopen/status"].includes(path)) {
      return Response.json(this.status());
    }

    if (request.method === "POST" && ["/connect", "/api/v4/qqopen/connect"].includes(path)) {
      this.persisted.suspended = false;
      await this.persist();
      const status = await this.ensureConnected({ force: false });
      return Response.json(status, { status: status.ok === false ? 503 : 200 });
    }

    if (request.method === "POST" && ["/ensure", "/api/v4/qqopen/ensure"].includes(path)) {
      if (this.persisted.suspended) return Response.json(this.status());
      const status = await this.ensureConnected({ force: false });
      return Response.json(status, { status: status.ok === false ? 503 : 200 });
    }

    if (request.method === "POST" && ["/disconnect", "/api/v4/qqopen/disconnect"].includes(path)) {
      this.persisted.suspended = true;
      await this.disconnect("manual");
      await this.persist();
      return Response.json(this.status());
    }

    return new Response("QqOpenGateway OK", { status: 200 });
  }

  async ensureConnected({ force = false } = {}) {
    await this.ready;
    if (!qqOpenEnabled(this.env)) return { ...this.status(), ok: false, error: "QQ_OPEN_DISABLED" };
    if (!qqOpenConfigured(this.env)) return { ...this.status(), ok: false, error: "QQ_OPEN_NOT_CONFIGURED" };
    if (this.persisted.suspended) return { ...this.status(), ok: false, error: "QQ_OPEN_SUSPENDED" };

    if (!force && (socketOpen(this.socket) || socketConnecting(this.socket))) return this.status();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.connect()
      .catch(async error => {
        await this.recordError(error);
        this.scheduleReconnect("connect_failed");
        return { ...this.status(), ok: false, error: safeError(error) };
      })
      .finally(() => { this.connectPromise = null; });
    return this.connectPromise;
  }

  async connect() {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.socket && this.socket.readyState <= 1) {
      try { this.socket.close(4000, "QQ Open reconnect"); } catch {}
    }

    this.persisted.connecting = true;
    this.persisted.connected = false;
    this.persisted.gateway = createGatewayState({
      ...this.persisted.gateway,
      ready: false
    });
    await this.persist();

    const api = this.api();
    this.accessToken = await api.getAccessToken();
    const gatewayInfo = await api.getGateway();
    const gatewayUrl = String(gatewayInfo?.url || "").trim();
    if (!/^wss:\/\//i.test(gatewayUrl)) throw new Error("QQ_OPEN_GATEWAY_URL_INVALID");

    const socket = new WebSocket(gatewayUrl);
    const generation = ++this.socketGeneration;
    this.socket = socket;
    this.persisted.gatewayUrl = gatewayUrl;
    this.persisted.connectCount = Number(this.persisted.connectCount || 0) + 1;
    await this.persist();

    socket.addEventListener("open", () => {
      this.track(this.onOpen(socket, generation));
    });
    socket.addEventListener("message", event => {
      this.track(this.onMessage(socket, generation, event?.data));
    });
    socket.addEventListener("close", event => {
      this.track(this.onClose(socket, generation, event));
    });
    socket.addEventListener("error", event => {
      this.track(this.onError(socket, generation, event));
    });

    return this.status();
  }

  isCurrent(socket, generation) {
    return this.socket === socket && this.socketGeneration === generation;
  }

  async onOpen(socket, generation) {
    if (!this.isCurrent(socket, generation)) return;
    this.persisted.connecting = false;
    this.persisted.connected = true;
    this.persisted.connectedAt = Date.now();
    this.persisted.lastError = "";
    await this.persist();
  }

  async onMessage(socket, generation, raw) {
    if (!this.isCurrent(socket, generation)) return;
    const text = typeof raw === "string" ? raw : raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : String(raw ?? "");
    let payload;
    try { payload = JSON.parse(text); }
    catch { throw new Error("QQ_OPEN_GATEWAY_BAD_JSON"); }

    const op = Number(payload?.op);
    this.persisted.lastEventAt = Date.now();
    this.persisted.lastEventType = String(payload?.t || `OP_${op}`);

    if (op === QQ_OPEN_OPCODE.HELLO) {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      this.startHeartbeat(this.persisted.gateway.heartbeatInterval);
      const canResume = Boolean(this.persisted.gateway.sessionId && Number.isSafeInteger(this.persisted.gateway.seq));
      const authPayload = canResume
        ? createResumePayload({ accessToken: this.accessToken, sessionId: this.persisted.gateway.sessionId, seq: this.persisted.gateway.seq })
        : createIdentifyPayload({ accessToken: this.accessToken, intents: qqOpenIntents(this.env), shard: [0, 1] });
      socket.send(JSON.stringify(authPayload));
      await this.persist();
      return;
    }

    if (op === QQ_OPEN_OPCODE.HEARTBEAT_ACK) {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      await this.persist();
      return;
    }

    if (op === QQ_OPEN_OPCODE.RECONNECT) {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      await this.persist();
      await this.disconnect("server_reconnect", { preserveSession: true, suspend: false });
      this.scheduleReconnect("server_reconnect", 1000);
      return;
    }

    if (op === QQ_OPEN_OPCODE.INVALID_SESSION) {
      this.persisted.gateway = createGatewayState();
      await this.persist();
      await this.disconnect("invalid_session", { preserveSession: false, suspend: false });
      this.scheduleReconnect("invalid_session", 1500);
      return;
    }

    if (op !== QQ_OPEN_OPCODE.DISPATCH) {
      await this.persist();
      return;
    }

    const eventType = String(payload?.t || "").toUpperCase();
    if (eventType === "READY") {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      this.persisted.botUserId = String(payload?.d?.user?.id || "");
      await this.persist();
      return;
    }

    if (eventType === "RESUMED") {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      await this.persist();
      return;
    }

    await this.handleDispatch(payload);
    this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
    await this.persist();
  }

  async handleDispatch(payload) {
    const message = fromQqOpenEvent(payload);
    if (!message) return;

    this.persisted.lastInboundAt = Date.now();
    this.persisted.lastInboundId = String(message.messageId || "");

    const reply = buildConnectivityReply(message);
    if (!reply) return;

    const result = await this.actionDispatcher().dispatch("message.reply", {
      message,
      content: reply,
      msgSeq: 1
    });
    this.persisted.lastReplyAt = Date.now();
    this.persisted.lastReplyId = String(result?.data?.id || result?.data?.message_id || "");
  }

  startHeartbeat(intervalMs) {
    this.stopHeartbeat();
    const interval = Math.max(1000, Number(intervalMs || 0) || 45000);
    this.heartbeatTimer = setInterval(() => {
      this.track(this.sendHeartbeat(interval));
    }, interval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async sendHeartbeat(interval) {
    if (!socketOpen(this.socket)) return;
    const now = Date.now();
    const lastSent = Number(this.persisted.lastHeartbeatSentAt || 0);
    const lastAck = Number(this.persisted.gateway?.lastAckAt || 0);
    if (lastSent && lastAck < lastSent && now - lastSent > Math.max(5000, interval * 2)) {
      await this.disconnect("heartbeat_timeout", { preserveSession: true, suspend: false });
      this.scheduleReconnect("heartbeat_timeout", 1000);
      return;
    }
    this.socket.send(JSON.stringify(createHeartbeatPayload(this.persisted.gateway?.seq ?? null)));
    this.persisted.lastHeartbeatSentAt = now;
    await this.persist();
  }

  async onClose(socket, generation, event) {
    if (!this.isCurrent(socket, generation)) return;
    this.stopHeartbeat();
    this.socket = null;
    this.persisted.connected = false;
    this.persisted.connecting = false;
    this.persisted.gateway = createGatewayState({
      ...this.persisted.gateway,
      ready: false
    });
    if (!this.persisted.suspended) {
      this.persisted.reconnectCount = Number(this.persisted.reconnectCount || 0) + 1;
      this.persisted.lastErrorAt = Date.now();
      this.persisted.lastError = `QQ_OPEN_SOCKET_CLOSED:${Number(event?.code || 0)}:${String(event?.reason || "").slice(0, 180)}`;
    }
    await this.persist();
    if (!this.persisted.suspended && qqOpenEnabled(this.env)) this.scheduleReconnect("socket_closed");
  }

  async onError(socket, generation, event) {
    if (!this.isCurrent(socket, generation)) return;
    await this.recordError(new Error(`QQ_OPEN_SOCKET_ERROR:${String(event?.message || event?.type || "error")}`));
  }

  scheduleReconnect(reason, delayMs = DEFAULT_RECONNECT_MS) {
    if (this.persisted.suspended || !qqOpenEnabled(this.env) || this.reconnectTimer) return;
    const delay = Math.max(500, Math.min(60000, Number(delayMs) || DEFAULT_RECONNECT_MS));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.track(this.ensureConnected({ force: true }).catch(error => this.recordError(new Error(`${reason}:${safeError(error)}`))));
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  async disconnect(reason = "disconnect", { preserveSession = true, suspend = true } = {}) {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (suspend) this.persisted.suspended = true;
    const socket = this.socket;
    this.socket = null;
    this.socketGeneration += 1;
    if (socket && socket.readyState <= 1) {
      try { socket.close(1000, String(reason).slice(0, 120)); } catch {}
    }
    this.persisted.connected = false;
    this.persisted.connecting = false;
    this.persisted.gateway = preserveSession
      ? createGatewayState({ ...this.persisted.gateway, ready: false })
      : createGatewayState();
    await this.persist();
  }
}

export {
  DEFAULT_QQ_OPEN_INTENTS,
  QQ_OPEN_GATEWAY_STORAGE_KEY,
  buildConnectivityReply,
  getQqOpenGateway,
  qqOpenConfigured,
  qqOpenEnabled,
  qqOpenIntents,
  stripBotMention
};
