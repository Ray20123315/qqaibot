import { createQqOpenActionDispatcher } from "../platform/actions.js";
import { createInitialCommandRegistry } from "../commands/catalog.js";
import { createQqOpenApiClient } from "./api.js";
import { fromQqOpenEvent } from "./events.js";
import { qqOpenJoinRequestToLegacyBody, qqOpenLegacyAction, qqOpenMessageToLegacyBody, sendQqOpenLegacyMessage } from "./legacy-bridge.js";
import { syncQqOpenDiscovery } from "./discovery.js";
import { qqOpenClosePolicy, qqOpenDeliveryKey, qqOpenPassiveReplyPolicy, qqOpenShard } from "./protocol.js";
import { interactionControlAction, interactionDeliveryKey, lifecycleDeliveryKey, normalizeInteractionEvent, normalizeLifecycleEvent, normalizePushPermissionEvent, parseFeatureCommandMap } from "./official-events.js";
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
const CONNECT_TIMEOUT_MS = 20000;
const QQ_OPEN_COMMAND_REGISTRY = createInitialCommandRegistry();

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
  if (/^!qqid$/i.test(input)) {
    if (message?.scope !== "private") return "为了避免在群聊公开 OpenID，请私聊机器人发送 !qqid。";
    return `你的 QQ OpenID：${String(message?.userId || "").trim() || "未知"}`;
  }
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

function qqOpenReconnectDelay(failureStreak) {
  const streak = Math.max(0, Number(failureStreak || 0));
  const exponent = Math.min(4, Math.max(0, Math.floor(streak) - 1));
  return Math.min(60000, DEFAULT_RECONNECT_MS * (2 ** exponent));
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
    lastInboundUserId: "",
    lastApplicationAt: 0,
    lastApplicationKind: "",
    messageCache: [],
    joinRequestCache: [],
    pushPermissions: [],
    interactionCount: 0,
    interactionAckCount: 0,
    lastInteraction: null,
    lifecycleCount: 0,
    lastLifecycleEvent: null,
    lastOfficialStateEvent: null,
    recentDeliveries: [],
    replyUsage: [],
    duplicateDropCount: 0,
    gatewayMeta: {},
    lastDiscoverySyncAt: 0,
    lastDiscoverySyncFingerprint: "",
    lastDiscoverySyncError: "",
    lastReplyAt: 0,
    lastReplyId: "",
    lastHeartbeatSentAt: 0,
    lastErrorAt: 0,
    lastError: "",
    reconnectCount: 0,
    connectCount: 0,
    failureStreak: 0
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
    this.connectTimeoutTimer = null;
    this.connectPromise = null;
    this.eventTasks = new Set();
    this.inflightDeliveries = new Set();
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
      lastInboundUserId: String(this.persisted.lastInboundUserId || ""),
      lastApplicationAt: Number(this.persisted.lastApplicationAt || 0),
      lastApplicationKind: String(this.persisted.lastApplicationKind || ""),
      lastReplyAt: Number(this.persisted.lastReplyAt || 0),
      lastReplyId: String(this.persisted.lastReplyId || ""),
      lastHeartbeatSentAt: Number(this.persisted.lastHeartbeatSentAt || 0),
      lastErrorAt: Number(this.persisted.lastErrorAt || 0),
      lastError: String(this.persisted.lastError || ""),
      reconnectCount: Number(this.persisted.reconnectCount || 0),
      connectCount: Number(this.persisted.connectCount || 0),
      failureStreak: Number(this.persisted.failureStreak || 0),
      lastHeartbeatAckAt: Number(this.persisted.gateway?.lastAckAt || 0),
      heartbeatHealthy: !this.persisted.lastHeartbeatSentAt || Number(this.persisted.gateway?.lastAckAt || 0) >= Number(this.persisted.lastHeartbeatSentAt || 0),
      duplicateDropCount: Number(this.persisted.duplicateDropCount || 0),
      passiveReplyOrigins: Array.isArray(this.persisted.replyUsage) ? this.persisted.replyUsage.length : 0,
      pushPermissions: Array.isArray(this.persisted.pushPermissions) ? this.persisted.pushPermissions.slice(0, 50) : [],
      interaction: {
        count: Number(this.persisted.interactionCount || 0),
        ackCount: Number(this.persisted.interactionAckCount || 0),
        last: this.persisted.lastInteraction || null
      },
      lifecycle: {
        count: Number(this.persisted.lifecycleCount || 0),
        last: this.persisted.lastLifecycleEvent || null
      },
      lastOfficialStateEvent: this.persisted.lastOfficialStateEvent || null,
      gatewayMeta: this.persisted.gatewayMeta || {},
      discovery: {
        enabled: truthy(this.env.QQ_OPEN_DISCOVERY_SYNC),
        lastSyncAt: Number(this.persisted.lastDiscoverySyncAt || 0),
        fingerprint: String(this.persisted.lastDiscoverySyncFingerprint || ""),
        lastError: String(this.persisted.lastDiscoverySyncError || "")
      }
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

    if (request.method === "POST" && ["/legacy-action", "/api/v4/qqopen/legacy-action"].includes(path)) {
      const payload = await request.json().catch(() => ({}));
      try {
        const data = await qqOpenLegacyAction(this.api(), payload.action, payload.params || {}, payload.context || {}, {
          getCachedMessage: id => this.cachedMessage(id),
          getCachedJoinRequest: id => this.cachedJoinRequest(id),
          reserveReplySequences: (messageId, scope, count) => this.reserveReplySequences(messageId, scope, count)
        });
        return Response.json({ ok: true, data });
      } catch (error) {
        return Response.json({ ok: false, error: safeError(error) }, { status: 502 });
      }
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
        this.persisted.failureStreak = Number(this.persisted.failureStreak || 0) + 1;
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
    let gatewayInfo;
    try { gatewayInfo = await api.getGatewayBot(); }
    catch { gatewayInfo = await api.getGateway(); }
    const gatewayUrl = String(gatewayInfo?.url || "").trim();
    if (!/^wss:\/\//i.test(gatewayUrl)) throw new Error("QQ_OPEN_GATEWAY_URL_INVALID");

    const socket = new WebSocket(gatewayUrl);
    const generation = ++this.socketGeneration;
    this.socket = socket;
    this.persisted.gatewayUrl = gatewayUrl;
    this.persisted.gatewayMeta = {
      recommendedShards: Math.max(1, Number(gatewayInfo?.shards || 1) || 1),
      configuredShard: qqOpenShard(this.env),
      sessionStartLimit: gatewayInfo?.session_start_limit || null
    };
    this.persisted.connectCount = Number(this.persisted.connectCount || 0) + 1;
    await this.persist();

    this.startConnectTimeout(socket, generation);
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
    this.clearConnectTimeout();
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
        : createIdentifyPayload({ accessToken: this.accessToken, intents: qqOpenIntents(this.env), shard: qqOpenShard(this.env) });
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
      this.persisted.failureStreak = 0;
      this.persisted.lastError = "";
      await this.persist();
      this.track(this.syncDiscoveryIfNeeded());
      return;
    }

    if (eventType === "RESUMED") {
      this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
      await this.persist();
      this.track(this.syncDiscoveryIfNeeded());
      return;
    }

    await this.handleDispatch(payload);
    this.persisted.gateway = reduceGatewayPayload(this.persisted.gateway, payload);
    await this.persist();
  }

  registerPassiveOrigin(message) {
    const messageId = String(message?.messageId || "").trim();
    if (!messageId) return null;
    const scope = message?.scope === "group" ? "group" : "private";
    const sentAt = Number(message?.time || 0) > 0 ? Number(message.time) * 1000 : Date.now();
    const rows = Array.isArray(this.persisted.replyUsage) ? [...this.persisted.replyUsage] : [];
    let row = rows.find(item => String(item?.messageId || "") === messageId);
    if (!row) {
      row = { messageId, scope, receivedAt: sentAt, nextSeq: 1, repliedCount: 0 };
      rows.unshift(row);
    } else {
      row.scope = scope;
      row.receivedAt = Math.min(Number(row.receivedAt || sentAt), sentAt);
    }
    const maxTtl = 2 * 60 * 60 * 1000;
    this.persisted.replyUsage = rows
      .filter(item => Date.now() - Number(item?.receivedAt || 0) <= maxTtl)
      .slice(0, 120);
    return row;
  }

  async reserveReplySequences(messageIdValue, scopeValue, countValue = 1) {
    const messageId = String(messageIdValue || "").trim();
    if (!messageId) return { start: 1, count: 0, passive: false };
    const scope = String(scopeValue || "") === "group" ? "group" : "private";
    const count = Math.max(1, Math.trunc(Number(countValue || 1) || 1));
    let row = (Array.isArray(this.persisted.replyUsage) ? this.persisted.replyUsage : []).find(item => String(item?.messageId || "") === messageId);
    if (!row) {
      row = { messageId, scope, receivedAt: Date.now(), nextSeq: 1, repliedCount: 0 };
      this.persisted.replyUsage = [row, ...(Array.isArray(this.persisted.replyUsage) ? this.persisted.replyUsage : [])].slice(0, 120);
    }
    const policy = qqOpenPassiveReplyPolicy(scope);
    if (Date.now() - Number(row.receivedAt || 0) > policy.ttlMs) throw new Error("QQ_OPEN_PASSIVE_REPLY_EXPIRED");
    if (Number(row.repliedCount || 0) + count > policy.maxReplies) throw new Error("QQ_OPEN_PASSIVE_REPLY_LIMIT");
    const start = Math.max(1, Number(row.nextSeq || 1) || 1);
    row.nextSeq = start + count;
    row.repliedCount = Number(row.repliedCount || 0) + count;
    await this.persist();
    return { start, count, passive: true, remaining: Math.max(0, policy.maxReplies - row.repliedCount) };
  }

  deliverySeen(keyValue) {
    const key = String(keyValue || "");
    if (!key) return false;
    if (this.inflightDeliveries.has(key)) return true;
    const now = Date.now();
    return (Array.isArray(this.persisted.recentDeliveries) ? this.persisted.recentDeliveries : [])
      .some(item => String(item?.key || "") === key && now - Number(item?.at || 0) <= 2 * 60 * 60 * 1000);
  }

  async rememberDelivery(keyValue) {
    const key = String(keyValue || "");
    if (!key) return;
    const now = Date.now();
    this.persisted.recentDeliveries = [
      { key, at: now },
      ...(Array.isArray(this.persisted.recentDeliveries) ? this.persisted.recentDeliveries : [])
        .filter(item => String(item?.key || "") !== key && now - Number(item?.at || 0) <= 2 * 60 * 60 * 1000)
    ].slice(0, 240);
    await this.persist();
  }

  async syncDiscoveryIfNeeded() {
    if (!truthy(this.env.QQ_OPEN_DISCOVERY_SYNC)) return;
    try {
      const result = await syncQqOpenDiscovery(this.api(), QQ_OPEN_COMMAND_REGISTRY, {
        previousFingerprint: String(this.persisted.lastDiscoverySyncFingerprint || "")
      });
      this.persisted.lastDiscoverySyncAt = Date.now();
      this.persisted.lastDiscoverySyncFingerprint = String(result?.fingerprint || "");
      this.persisted.lastDiscoverySyncError = "";
      await this.persist();
    } catch (error) {
      this.persisted.lastDiscoverySyncAt = Date.now();
      this.persisted.lastDiscoverySyncError = safeError(error);
      await this.persist();
    }
  }

  featureCommandMap() {
    return parseFeatureCommandMap(this.env.QQ_OPEN_FEATURE_COMMAND_MAP || "");
  }

  upsertPushPermission(record) {
    if (!record?.targetId) return;
    const key = String(record.scope || "") + ":" + String(record.targetId || "");
    const rows = Array.isArray(this.persisted.pushPermissions) ? this.persisted.pushPermissions : [];
    this.persisted.pushPermissions = [
      { ...record, key },
      ...rows.filter(item => String(item?.key || "") !== key)
    ].slice(0, 200);
    this.persisted.lastOfficialStateEvent = {
      kind: "push_permission",
      eventType: String(record.eventType || ""),
      scope: String(record.scope || ""),
      targetId: String(record.targetId || ""),
      allowed: Boolean(record.allowed),
      at: Number(record.updatedAt || Date.now())
    };
  }

  async forwardControl(payload) {
    const response = await this.oneBotHub().fetch("https://onebot-hub/v4/qqopen/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok || data?.ok === false) throw new Error(String(data?.error || text || "QQ_OPEN_CONTROL_FAILED").slice(0, 500));
    return data || { ok: true };
  }

  async sendInteractionEventReply(interaction, value) {
    const content = String(value || "").trim();
    if (!content || !interaction?.id) return null;
    const body = { content, msg_type: 0, event_id: String(interaction.id) };
    if (interaction.scene === "group" && interaction.groupId) {
      return this.api().sendGroupMessage(interaction.groupId, body);
    }
    if (interaction.scene === "c2c" && interaction.userId) {
      return this.api().sendC2CMessage(interaction.userId, body);
    }
    return null;
  }

  interactionLegacyBody(interaction) {
    const command = String(interaction?.command || "").trim();
    if (!command || !interaction?.userId) return null;
    const group = interaction.scene === "group";
    return {
      time: Math.floor(Number(interaction.timestamp || Date.now()) / 1000),
      self_id: String(this.persisted.botUserId || ""),
      post_type: "message",
      message_type: group ? "group" : "private",
      sub_type: group ? "normal" : "friend",
      message_id: "",
      user_id: String(interaction.userId || ""),
      group_id: group ? String(interaction.groupId || "") : "",
      raw_message: command,
      message: [{ type: "text", data: { text: command } }],
      sender: { user_id: String(interaction.userId || ""), nickname: String(interaction.userId || ""), role: "member" },
      __qqai_platform: "qq-open",
      __qqai_explicit_question: true,
      __qqai_qqopen_event_type: "INTERACTION_CREATE",
      __qqai_qqopen_event_id: String(interaction.id || ""),
      __qqai_principal_id: String(interaction.userId || ""),
      __qqai_skip_plugins: true,
      __qqai_capture_message_sends: true
    };
  }

  async handleLifecycleEvent(payload) {
    const record = normalizeLifecycleEvent(payload);
    if (!record) return false;
    const key = lifecycleDeliveryKey(record);
    if (key && this.deliverySeen(key)) {
      this.persisted.duplicateDropCount = Number(this.persisted.duplicateDropCount || 0) + 1;
      await this.persist();
      return true;
    }
    this.persisted.lifecycleCount = Number(this.persisted.lifecycleCount || 0) + 1;
    this.persisted.lastLifecycleEvent = {
      eventType: String(record.eventType || ""),
      subject: String(record.subject || ""),
      groupId: String(record.groupId || ""),
      memberId: String(record.memberId || ""),
      userId: String(record.userId || ""),
      active: Boolean(record.active),
      at: Number(record.updatedAt || Date.now())
    };
    this.persisted.lastOfficialStateEvent = {
      kind: "lifecycle",
      eventType: String(record.eventType || ""),
      groupId: String(record.groupId || ""),
      userId: String(record.userId || record.memberId || ""),
      active: Boolean(record.active),
      at: Number(record.updatedAt || Date.now())
    };
    await this.forwardControl({
      action: "lifecycle",
      ...record
    }).catch(error => this.recordError(error));
    if (key) await this.rememberDelivery(key);
    await this.persist();
    return true;
  }

  async handlePushPermissionEvent(payload) {
    const record = normalizePushPermissionEvent(payload);
    if (!record) return false;
    const key = ["PUSH", record.eventType, record.targetId, record.updatedAt].join("|");
    if (this.deliverySeen(key)) {
      this.persisted.duplicateDropCount = Number(this.persisted.duplicateDropCount || 0) + 1;
      await this.persist();
      return true;
    }
    this.upsertPushPermission(record);
    await this.rememberDelivery(key);
    await this.forwardControl({
      action: "push_permission",
      scope: record.scope,
      targetId: record.targetId,
      allowed: record.allowed,
      operatorId: record.operatorId,
      eventType: record.eventType,
      updatedAt: record.updatedAt
    }).catch(error => this.recordError(error));
    await this.persist();
    return true;
  }

  async handleInteractionEvent(payload) {
    const interaction = normalizeInteractionEvent(payload, { featureMap: this.featureCommandMap() });
    if (!interaction) return false;
    const key = interactionDeliveryKey(interaction);
    if (key && this.deliverySeen(key)) {
      this.persisted.duplicateDropCount = Number(this.persisted.duplicateDropCount || 0) + 1;
      await this.persist();
      return true;
    }

    this.persisted.interactionCount = Number(this.persisted.interactionCount || 0) + 1;
    this.persisted.lastInteraction = {
      id: String(interaction.id || ""),
      type: Number(interaction.type || 0),
      scene: String(interaction.scene || ""),
      userId: String(interaction.userId || ""),
      groupId: String(interaction.groupId || ""),
      command: String(interaction.command || ""),
      at: Number(interaction.timestamp || Date.now())
    };

    if (interaction.requiresAck && interaction.id) {
      await this.api().respondInteraction(interaction.id, 0);
      this.persisted.interactionAckCount = Number(this.persisted.interactionAckCount || 0) + 1;
    }

    const action = interactionControlAction(interaction);
    if (action === "command") {
      const body = this.interactionLegacyBody(interaction);
      const result = body ? await this.forwardLegacyBody(body) : null;
      const chunks = Array.isArray(result?.reply_chunks) && result.reply_chunks.length
        ? result.reply_chunks
        : result?.reply ? [result.reply] : [];
      const reply = chunks.map(value => String(value || "").trim()).filter(Boolean).join("\n\n").slice(0, 3800);
      if (reply) await this.sendInteractionEventReply(interaction, reply);
      this.persisted.lastApplicationAt = Date.now();
      this.persisted.lastApplicationKind = "interaction_command";
    } else if (action === "feedback") {
      await this.forwardControl({
        action,
        scene: interaction.scene,
        userId: interaction.userId,
        groupId: interaction.groupId,
        interactionId: interaction.id,
        messageId: interaction.resolved.messageId,
        feedback: interaction.resolved.feedbackOpt,
        checked: interaction.resolved.checked,
        updatedAt: interaction.timestamp
      });
    } else if (action === "clear_session") {
      await this.forwardControl({
        action,
        scene: interaction.scene,
        userId: interaction.userId,
        groupId: interaction.groupId,
        interactionId: interaction.id,
        updatedAt: interaction.timestamp
      });
    } else if (action === "switch_model") {
      await this.forwardControl({
        action,
        scene: interaction.scene,
        userId: interaction.userId,
        groupId: interaction.groupId,
        interactionId: interaction.id,
        model: interaction.resolved.action,
        updatedAt: interaction.timestamp
      });
    } else if (action === "authorization") {
      const scope = interaction.resolved.authorizeScope;
      if ((interaction.type === 18 || interaction.type === 19) && scope) {
        const targetId = scope === "group_push" ? interaction.groupId : interaction.userId;
        if (targetId) {
          const record = {
            kind: "push_permission",
            eventType: "INTERACTION_AUTHORIZE",
            scope: scope === "group_push" ? "group" : "c2c",
            targetId,
            operatorId: interaction.userId,
            allowed: true,
            updatedAt: interaction.timestamp
          };
          this.upsertPushPermission(record);
          await this.forwardControl({ action: "push_permission", ...record }).catch(error => this.recordError(error));
        }
      }
      await this.forwardControl({
        action: "authorization",
        scene: interaction.scene,
        userId: interaction.userId,
        groupId: interaction.groupId,
        targetId: interaction.groupId || interaction.userId,
        detail: interaction.resolved,
        updatedAt: interaction.timestamp
      }).catch(error => this.recordError(error));
    } else {
      await this.forwardControl({
        action,
        scene: interaction.scene,
        userId: interaction.userId,
        groupId: interaction.groupId,
        targetId: interaction.groupId || interaction.userId,
        detail: interaction.resolved,
        updatedAt: interaction.timestamp
      }).catch(error => this.recordError(error));
    }

    if (key) await this.rememberDelivery(key);
    await this.persist();
    return true;
  }

  cachedMessage(id) {
    const key = String(id || "");
    return (Array.isArray(this.persisted.messageCache) ? this.persisted.messageCache : []).find(item => String(item?.message_id || "") === key) || null;
  }

  cachedJoinRequest(id) {
    const key = String(id || "");
    return (Array.isArray(this.persisted.joinRequestCache) ? this.persisted.joinRequestCache : []).find(item => String(item?.flag || "") === key) || null;
  }

  cacheMessage(body, source = "human") {
    if (!body?.message_id) return;
    const row = {
      message_id: String(body.message_id || ""),
      message: body.message || [],
      raw_message: String(body.raw_message || ""),
      message_type: String(body.message_type || ""),
      group_id: String(body.group_id || ""),
      user_id: String(body.user_id || ""),
      self_id: String(body.self_id || ""),
      sender: body.sender || {},
      time: Number(body.time || Math.floor(Date.now() / 1000)),
      source: String(source || "human")
    };
    this.persisted.messageCache = [
      row,
      ...(Array.isArray(this.persisted.messageCache) ? this.persisted.messageCache : []).filter(item => String(item?.message_id || "") !== row.message_id)
    ].slice(0, 60);
  }

  cacheJoinRequest(body) {
    if (!body?.flag) return;
    const row = {
      flag: String(body.flag || ""),
      group_id: String(body.group_id || ""),
      user_id: String(body.user_id || ""),
      comment: String(body.comment || ""),
      at: Date.now()
    };
    this.persisted.joinRequestCache = [
      row,
      ...(Array.isArray(this.persisted.joinRequestCache) ? this.persisted.joinRequestCache : []).filter(item => String(item?.flag || "") !== row.flag)
    ].slice(0, 40);
  }

  oneBotHub() {
    if (!this.env?.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    return this.env.ONEBOT_HUB.get(this.env.ONEBOT_HUB.idFromName("default"));
  }

  async forwardLegacyBody(body) {
    const response = await this.oneBotHub().fetch("https://onebot-hub/v4/qqopen/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(String(data?.error || text || ("QQ_OPEN_APP_" + response.status)).slice(0, 500));
    return data;
  }

  async sendApplicationReplies(message, payload, deliveryKey = "") {
    const body = qqOpenMessageToLegacyBody(message, payload, { botUserId: this.persisted.botUserId });
    if (!body) return;
    this.cacheMessage(body, "human");
    this.registerPassiveOrigin(message);
    await this.persist();

    const result = await this.forwardLegacyBody(body);
    await this.rememberDelivery(deliveryKey);
    this.persisted.lastApplicationAt = Date.now();
    this.persisted.lastApplicationKind = String(result?.reply_kind || (result?.reply ? "reply" : "no_reply"));

    const rawChunks = Array.isArray(result?.reply_chunks) && result.reply_chunks.length
      ? result.reply_chunks
      : result?.reply ? [result.reply] : [];
    const policy = qqOpenPassiveReplyPolicy(message.scope);
    const chunks = rawChunks.slice(0, policy.maxReplies);
    let lastMessageId = "";
    for (let index = 0; index < chunks.length; index += 1) {
      const reservation = await this.reserveReplySequences(message.messageId, message.scope, 1);
      let value = chunks[index];
      if (index === 0 && Array.isArray(result?.reply_plan?.mentionIds)) {
        const prefix = [...new Set(result.reply_plan.mentionIds.map(String).filter(Boolean))]
          .map(id => "[CQ:at,qq=" + id + "] ")
          .join("");
        if (prefix) value = prefix + String(value || "");
      }
      const sent = await sendQqOpenLegacyMessage(this.api(), {
        scope: message.scope,
        groupId: message.groupId,
        userId: message.userId,
        messageId: message.messageId
      }, value, { msgSeq: reservation.start, replyMessageId: message.messageId });
      const id = String(sent?.messageId || sent?.data?.id || sent?.data?.message_id || "");
      if (id) {
        lastMessageId = id;
        this.cacheMessage({
          message_id: id,
          message: [{ type: "text", data: { text: String(chunks[index] || "") } }],
          raw_message: String(chunks[index] || ""),
          message_type: message.scope === "group" ? "group" : "private",
          group_id: String(message.groupId || ""),
          user_id: String(this.persisted.botUserId || ""),
          self_id: String(this.persisted.botUserId || ""),
          sender: { user_id: String(this.persisted.botUserId || ""), nickname: "QQAI", role: "member" },
          time: Math.floor(Date.now() / 1000)
        }, "ai");
      }
    }
    if (lastMessageId) {
      this.persisted.lastReplyAt = Date.now();
      this.persisted.lastReplyId = lastMessageId;
    }
    await this.persist();
  }

  async handleDispatch(payload) {
    if (await this.handleLifecycleEvent(payload)) return;
    if (await this.handlePushPermissionEvent(payload)) return;
    if (await this.handleInteractionEvent(payload)) return;

    const message = fromQqOpenEvent(payload);
    if (message) {
      const eventType = String(payload?.t || "").toUpperCase();
      if (["GROUP_AT_MESSAGE_CREATE", "GROUP_MESSAGE_CREATE"].includes(eventType) && message.groupId) {
        const observedAt = Number(message.time || 0) > 0 ? Number(message.time) * 1000 : Date.now();
        const mediaTypes = [...new Set((Array.isArray(message.parts) ? message.parts : [])
          .map(part => String(part?.kind || "").toLowerCase())
          .filter(kind => ["image", "video", "audio", "file"].includes(kind)))];
        await this.forwardControl({
          action: "group_observation",
          eventType,
          groupOpenid: message.groupId,
          messageId: String(message.messageId || ""),
          text: String(message.text || ""),
          mediaTypes,
          fullGroup: eventType === "GROUP_MESSAGE_CREATE",
          updatedAt: observedAt
        }).catch(error => this.recordError(error));
        if (eventType === "GROUP_MESSAGE_CREATE") {
          this.persisted.lastOfficialStateEvent = {
            kind: "full_group_message",
            eventType,
            groupId: String(message.groupId || ""),
            at: observedAt
          };
        }
      }
      const deliveryKey = qqOpenDeliveryKey(payload, message);
      if (deliveryKey && this.deliverySeen(deliveryKey)) {
        this.persisted.duplicateDropCount = Number(this.persisted.duplicateDropCount || 0) + 1;
        await this.persist();
        return;
      }
      if (deliveryKey) this.inflightDeliveries.add(deliveryKey);
      try {
        this.persisted.lastInboundAt = Date.now();
        this.persisted.lastInboundId = String(message.messageId || "");
        this.persisted.lastInboundUserId = String(message.userId || "");
        this.registerPassiveOrigin(message);
        await this.persist();

        const reply = buildConnectivityReply(message);
        if (reply) {
          const reservation = await this.reserveReplySequences(message.messageId, message.scope, 1);
          const result = await this.actionDispatcher().dispatch("message.reply", {
            message,
            content: reply,
            msgSeq: reservation.start
          });
          await this.rememberDelivery(deliveryKey);
          this.persisted.lastReplyAt = Date.now();
          this.persisted.lastReplyId = String(result?.data?.id || result?.data?.message_id || "");
          this.persisted.lastApplicationAt = Date.now();
          this.persisted.lastApplicationKind = "connectivity";
          await this.persist();
          return;
        }

        await this.sendApplicationReplies(message, payload, deliveryKey);
        return;
      } finally {
        if (deliveryKey) this.inflightDeliveries.delete(deliveryKey);
      }
    }

    const requestBody = qqOpenJoinRequestToLegacyBody(payload, { botUserId: this.persisted.botUserId });
    if (requestBody) {
      const deliveryKey = qqOpenDeliveryKey(payload, { messageId: requestBody.flag });
      if (deliveryKey && this.deliverySeen(deliveryKey)) {
        this.persisted.duplicateDropCount = Number(this.persisted.duplicateDropCount || 0) + 1;
        await this.persist();
        return;
      }
      if (deliveryKey) this.inflightDeliveries.add(deliveryKey);
      try {
        this.persisted.lastInboundAt = Date.now();
        this.persisted.lastInboundId = String(requestBody.flag || "");
        this.persisted.lastInboundUserId = String(requestBody.user_id || "");
        this.cacheJoinRequest(requestBody);
        await this.forwardLegacyBody(requestBody);
        await this.rememberDelivery(deliveryKey);
        this.persisted.lastApplicationAt = Date.now();
        this.persisted.lastApplicationKind = "group_join_request";
        await this.persist();
      } finally {
        if (deliveryKey) this.inflightDeliveries.delete(deliveryKey);
      }
    }
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
    this.clearConnectTimeout();
    this.stopHeartbeat();
    this.socket = null;
    this.persisted.connected = false;
    this.persisted.connecting = false;

    const code = Number(event?.code || 0);
    const policy = this.persisted.suspended
      ? { retry: false, preserveSession: true, suspend: true, mode: "manual" }
      : qqOpenClosePolicy(code);
    this.persisted.suspended = Boolean(policy.suspend || this.persisted.suspended);
    this.persisted.gateway = policy.preserveSession
      ? createGatewayState({ ...this.persisted.gateway, ready: false })
      : createGatewayState();

    if (!this.persisted.suspended) {
      this.persisted.reconnectCount = Number(this.persisted.reconnectCount || 0) + 1;
      this.persisted.failureStreak = Number(this.persisted.failureStreak || 0) + 1;
    }
    this.persisted.lastErrorAt = Date.now();
    this.persisted.lastError = `QQ_OPEN_SOCKET_CLOSED:${code}:${String(event?.reason || "").slice(0, 180)}:${policy.mode}`;
    await this.persist();

    if (!this.persisted.suspended && policy.retry && qqOpenEnabled(this.env)) {
      this.scheduleReconnect("socket_closed", code === 4009 ? 500 : 0);
    }
  }

  async onError(socket, generation, event) {
    if (!this.isCurrent(socket, generation)) return;
    this.persisted.failureStreak = Number(this.persisted.failureStreak || 0) + 1;
    await this.recordError(new Error(`QQ_OPEN_SOCKET_ERROR:${String(event?.message || event?.type || "error")}`));
    await this.disconnect("socket_error", { preserveSession: true, suspend: false });
    this.scheduleReconnect("socket_error");
  }

  startConnectTimeout(socket, generation) {
    this.clearConnectTimeout();
    this.connectTimeoutTimer = setTimeout(() => {
      this.connectTimeoutTimer = null;
      if (!this.isCurrent(socket, generation) || socketOpen(socket)) return;
      this.persisted.failureStreak = Number(this.persisted.failureStreak || 0) + 1;
      this.track((async () => {
        await this.recordError(new Error("QQ_OPEN_CONNECT_TIMEOUT"));
        await this.disconnect("connect_timeout", { preserveSession: true, suspend: false });
        this.scheduleReconnect("connect_timeout");
      })());
    }, CONNECT_TIMEOUT_MS);
  }

  clearConnectTimeout() {
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    this.connectTimeoutTimer = null;
  }

  scheduleReconnect(reason, delayMs = 0) {
    if (this.persisted.suspended || !qqOpenEnabled(this.env) || this.reconnectTimer) return;
    const requested = Number(delayMs) || qqOpenReconnectDelay(this.persisted.failureStreak);
    const delay = Math.max(500, Math.min(60000, requested));
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
    this.clearConnectTimeout();
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
  CONNECT_TIMEOUT_MS,
  DEFAULT_QQ_OPEN_INTENTS,
  QQ_OPEN_GATEWAY_STORAGE_KEY,
  buildConnectivityReply,
  getQqOpenGateway,
  qqOpenConfigured,
  qqOpenEnabled,
  qqOpenIntents,
  qqOpenReconnectDelay,
  stripBotMention
};
