const QQ_OPEN_OPCODE = Object.freeze({ DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, RESUME: 6, RECONNECT: 7, INVALID_SESSION: 9, HELLO: 10, HEARTBEAT_ACK: 11 });
function tokenValue(accessToken) { const token = String(accessToken || "").trim(); if (!token) throw new Error("QQ_OPEN_ACCESS_TOKEN_REQUIRED"); return token.startsWith("QQBot ") ? token : `QQBot ${token}`; }
function normalizeShard(shard = [0, 1]) { const row = Array.isArray(shard) ? shard : [0, 1]; const id = Number(row[0]); const total = Number(row[1]); if (!Number.isInteger(id) || !Number.isInteger(total) || total < 1 || id < 0 || id >= total) throw new Error("QQ_OPEN_INVALID_SHARD"); return [id, total]; }
function createIdentifyPayload({ accessToken, intents, shard = [0, 1], properties = {} }) {
  const intentValue = Number(intents);
  if (!Number.isSafeInteger(intentValue) || intentValue < 0) throw new Error("QQ_OPEN_INVALID_INTENTS");
  return { op: QQ_OPEN_OPCODE.IDENTIFY, d: { token: tokenValue(accessToken), intents: intentValue, shard: normalizeShard(shard), properties: { "$os": "cloudflare-workers", "$browser": "qqaibot-v4", "$device": "qqaibot-v4", ...properties } } };
}
function createResumePayload({ accessToken, sessionId, seq }) {
  const session = String(sessionId || "").trim();
  if (!session) throw new Error("QQ_OPEN_SESSION_REQUIRED");
  const sequence = Number(seq);
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("QQ_OPEN_SEQ_REQUIRED");
  return { op: QQ_OPEN_OPCODE.RESUME, d: { token: tokenValue(accessToken), session_id: session, seq: sequence } };
}
function createHeartbeatPayload(seq = null) { return { op: QQ_OPEN_OPCODE.HEARTBEAT, d: Number.isSafeInteger(Number(seq)) ? Number(seq) : null }; }
function createGatewayState(value = {}) { return Object.freeze({ sessionId: String(value.sessionId || ""), seq: Number.isSafeInteger(Number(value.seq)) ? Number(value.seq) : null, heartbeatInterval: Number(value.heartbeatInterval || 0) || 0, ready: Boolean(value.ready), resumeEligible: Boolean(value.sessionId && Number.isSafeInteger(Number(value.seq))), lastAckAt: Number(value.lastAckAt || 0) || 0 }); }
function reduceGatewayPayload(previous, payload = {}, now = Date.now()) {
  const state = { ...createGatewayState(previous) };
  const op = Number(payload?.op);
  if (Number.isSafeInteger(Number(payload?.s))) state.seq = Number(payload.s);
  if (op === QQ_OPEN_OPCODE.HELLO) state.heartbeatInterval = Math.max(1000, Number(payload?.d?.heartbeat_interval || 0) || 0);
  if (op === QQ_OPEN_OPCODE.DISPATCH && String(payload?.t || "").toUpperCase() === "READY") { state.sessionId = String(payload?.d?.session_id || ""); state.ready = Boolean(state.sessionId); state.resumeEligible = Boolean(state.sessionId && Number.isSafeInteger(state.seq)); }
  if (op === QQ_OPEN_OPCODE.DISPATCH && String(payload?.t || "").toUpperCase() === "RESUMED") { state.ready = true; state.resumeEligible = Boolean(state.sessionId && Number.isSafeInteger(state.seq)); }
  if (op === QQ_OPEN_OPCODE.HEARTBEAT_ACK) state.lastAckAt = Number(now);
  if (op === QQ_OPEN_OPCODE.INVALID_SESSION) { state.ready = false; state.resumeEligible = false; state.sessionId = ""; }
  if (op === QQ_OPEN_OPCODE.RECONNECT) state.ready = false;
  return createGatewayState(state);
}
export { QQ_OPEN_OPCODE, createGatewayState, createHeartbeatPayload, createIdentifyPayload, createResumePayload, reduceGatewayPayload };
