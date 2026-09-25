#!/usr/bin/env node
import { createHash, createHmac, randomUUID } from "node:crypto";
import { brotliDecompressSync, inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const BILI_BASE = "https://open-live.bilibili.com";
const WS_HEADER_BYTES = 16;
const OP_HEARTBEAT = 2;
const OP_HEARTBEAT_REPLY = 3;
const OP_MESSAGE = 5;
const OP_AUTH = 7;
const OP_AUTH_REPLY = 8;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function bodyMd5(bodyText) {
  return createHash("md5").update(bodyText).digest("hex");
}

function signedHeaders(bodyText, accessKeyId, accessKeySecret, options = {}) {
  const unsigned = {
    "x-bili-accesskeyid": accessKeyId,
    "x-bili-content-md5": bodyMd5(bodyText),
    "x-bili-signature-method": "HMAC-SHA256",
    "x-bili-signature-nonce": String(options.nonce || randomUUID().replaceAll("-", "")),
    "x-bili-signature-version": "1.0",
    "x-bili-timestamp": String(options.timestamp || Math.floor(Date.now() / 1000))
  };
  const canonical = Object.keys(unsigned).sort().map(key => key + ":" + unsigned[key]).join("\n");
  const authorization = createHmac("sha256", accessKeySecret).update(canonical).digest("hex");
  return {
    ...unsigned,
    Authorization: authorization,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

async function biliPost(path, payload, config) {
  const bodyText = JSON.stringify(payload);
  const response = await fetch(BILI_BASE + path, {
    method: "POST",
    headers: signedHeaders(bodyText, config.accessKeyId, config.accessKeySecret),
    body: bodyText,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok || !data || Number(data.code) !== 0) {
    const message = data?.message || data?.msg || text.slice(0, 300) || response.statusText;
    throw new Error("BILIBILI_OPEN_LIVE_" + response.status + ":" + message);
  }
  return data;
}

async function startSession(config) {
  const response = await biliPost("/v2/app/start", {
    code: config.identityCode,
    app_id: Number(config.appId)
  }, config);
  const data = response.data || {};
  const gameId = String(data?.game_info?.game_id || "");
  const websocketInfo = data?.websocket_info || {};
  const links = Array.isArray(websocketInfo.wss_link) ? websocketInfo.wss_link.map(String).filter(Boolean) : [];
  const authBody = String(websocketInfo.auth_body || "");
  if (!gameId || !links.length || !authBody) throw new Error("BILIBILI_OPEN_LIVE_START_INCOMPLETE");
  return {
    gameId,
    links,
    authBody,
    anchor: {
      uid: String(data?.anchor_info?.uid || ""),
      uname: String(data?.anchor_info?.uname || ""),
      roomId: String(data?.anchor_info?.room_id || "")
    }
  };
}

async function heartbeatSession(config, gameId) {
  return biliPost("/v2/app/heartbeat", { game_id: gameId }, config);
}

async function endSession(config, gameId) {
  if (!gameId) return;
  try {
    await biliPost("/v2/app/end", { game_id: gameId, app_id: Number(config.appId) }, config);
  } catch (error) {
    console.error("[bili] end session failed:", String(error?.message || error));
  }
}

function makePacket(operation, body = "", version = 1) {
  const bodyBytes = new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body));
  const buffer = new ArrayBuffer(WS_HEADER_BYTES + bodyBytes.byteLength);
  const view = new DataView(buffer);
  view.setUint32(0, WS_HEADER_BYTES + bodyBytes.byteLength);
  view.setUint16(4, WS_HEADER_BYTES);
  view.setUint16(6, version);
  view.setUint32(8, operation);
  view.setUint32(12, 1);
  new Uint8Array(buffer, WS_HEADER_BYTES).set(bodyBytes);
  return buffer;
}

function splitPackets(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const packets = [];
  let offset = 0;
  while (offset + WS_HEADER_BYTES <= data.byteLength) {
    const view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
    const packetLength = view.getUint32(0);
    const headerLength = view.getUint16(4);
    const version = view.getUint16(6);
    const operation = view.getUint32(8);
    const sequence = view.getUint32(12);
    if (packetLength < headerLength || headerLength < WS_HEADER_BYTES || offset + packetLength > data.byteLength) break;
    packets.push({
      packetLength,
      headerLength,
      version,
      operation,
      sequence,
      body: data.slice(offset + headerLength, offset + packetLength)
    });
    offset += packetLength;
  }
  return packets;
}

function decodePackets(bytes, depth = 0) {
  if (depth > 4) throw new Error("BILIBILI_WS_NESTING_TOO_DEEP");
  const output = [];
  for (const packet of splitPackets(bytes)) {
    if (packet.version === 2) {
      const inflated = inflateSync(packet.body);
      output.push(...decodePackets(inflated, depth + 1));
      continue;
    }
    if (packet.version === 3) {
      const inflated = brotliDecompressSync(packet.body);
      output.push(...decodePackets(inflated, depth + 1));
      continue;
    }
    output.push(packet);
  }
  return output;
}

function parseJsonBody(packet) {
  const text = new TextDecoder().decode(packet.body).trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function normalizedTypeForCommand(command) {
  const cmd = String(command || "").toUpperCase();
  if (cmd.includes("LIVE_START")) return "live_start";
  if (cmd.includes("LIVE_END")) return "live_end";
  return "";
}

async function pushBridge(config, payload) {
  const response = await fetch(config.bridgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error("QQAI_BRIDGE_HTTP_" + response.status + ":" + text.slice(0, 240));
  return text;
}

async function connectWebSocket(config, session, linkIndex = 0) {
  if (typeof WebSocket !== "function") throw new Error("Node 22+ WebSocket runtime is required");
  const url = session.links[linkIndex % session.links.length];
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  let authenticated = false;
  let lastMessageAt = Date.now();
  let heartbeatTimer = null;

  const closeHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const done = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      ws.send(makePacket(OP_AUTH, session.authBody, 1));
      heartbeatTimer = setInterval(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(makePacket(OP_HEARTBEAT, "", 1));
        } catch {}
      }, 20000);
    });

    ws.addEventListener("message", async event => {
      lastMessageAt = Date.now();
      try {
        const raw = event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : event.data instanceof Blob
            ? new Uint8Array(await event.data.arrayBuffer())
            : new TextEncoder().encode(String(event.data || ""));
        for (const packet of decodePackets(raw)) {
          if (packet.operation === OP_AUTH_REPLY) {
            const auth = parseJsonBody(packet);
            if (Number(auth?.code ?? 0) !== 0) throw new Error("BILIBILI_WS_AUTH_FAILED:" + JSON.stringify(auth).slice(0, 300));
            authenticated = true;
            await pushBridge(config, {
              kind: "status",
              connected: true,
              gameId: session.gameId,
              anchor: session.anchor
            }).catch(error => console.error("[qqai] status push failed:", String(error?.message || error)));
            console.log("[bili] Open Live WebSocket authenticated.");
            continue;
          }
          if (packet.operation === OP_HEARTBEAT_REPLY) continue;
          if (packet.operation !== OP_MESSAGE) continue;
          const body = parseJsonBody(packet);
          const command = String(body?.cmd || body?.command || "");
          const normalizedType = normalizedTypeForCommand(command);
          if (!normalizedType) continue;
          await pushBridge(config, {
            kind: "event",
            normalizedType,
            event: {
              ...body,
              event_type: command,
              event_id: body?.event_id || body?.data?.event_id || (normalizedType + ":" + session.gameId + ":" + Date.now()),
              data: {
                ...(body?.data && typeof body.data === "object" ? body.data : {}),
                uid: body?.data?.uid || session.anchor.uid,
                uname: body?.data?.uname || session.anchor.uname,
                room_id: body?.data?.room_id || session.anchor.roomId
              }
            },
            gameId: session.gameId,
            anchor: session.anchor
          });
        }
      } catch (error) {
        console.error("[bili] message processing failed:", String(error?.message || error));
      }
    });

    ws.addEventListener("error", () => {
      closeHeartbeat();
      reject(new Error("BILIBILI_WS_ERROR"));
    });

    ws.addEventListener("close", event => {
      closeHeartbeat();
      resolve({
        authenticated,
        code: Number(event.code || 0),
        reason: String(event.reason || ""),
        lastMessageAt
      });
    });
  });

  return { ws, done };
}

async function main() {
  const config = {
    accessKeyId: required("BILIBILI_OPEN_LIVE_ACCESS_KEY_ID"),
    accessKeySecret: required("BILIBILI_OPEN_LIVE_ACCESS_KEY_SECRET"),
    appId: required("BILIBILI_OPEN_LIVE_APP_ID"),
    identityCode: required("BILIBILI_OPEN_LIVE_IDENTITY_CODE"),
    bridgeUrl: required("QQAI_BILIBILI_BRIDGE_URL"),
    sessionHeartbeatMs: Math.max(20000, Math.min(55000, envInt("BILIBILI_OPEN_LIVE_HEARTBEAT_MS", 25000)))
  };

  let stopping = false;
  let session = null;
  let ws = null;
  const stop = async signal => {
    if (stopping) return;
    stopping = true;
    console.log("[bridge] stopping:", signal);
    try { ws?.close(1000, "shutdown"); } catch {}
    if (session?.gameId) await endSession(config, session.gameId);
  };
  process.once("SIGINT", () => { stop("SIGINT").finally(() => process.exit(0)); });
  process.once("SIGTERM", () => { stop("SIGTERM").finally(() => process.exit(0)); });

  let restartDelay = 2000;
  while (!stopping) {
    try {
      session = await startSession(config);
      console.log("[bili] official Open Live session started for room", session.anchor.roomId || "(unknown)");
      await pushBridge(config, { kind: "hello", connected: true, gameId: session.gameId, anchor: session.anchor });

      let sessionHeartbeatRunning = true;
      let lastBridgeHealthPushAt = Date.now();
      const sessionHeartbeat = (async () => {
        while (!stopping && sessionHeartbeatRunning) {
          await sleep(config.sessionHeartbeatMs);
          if (stopping || !sessionHeartbeatRunning) break;
          await heartbeatSession(config, session.gameId);
          const now = Date.now();
          if (now - lastBridgeHealthPushAt >= 5 * 60 * 1000) {
            lastBridgeHealthPushAt = now;
            await pushBridge(config, { kind: "heartbeat", connected: true, gameId: session.gameId, anchor: session.anchor }).catch(() => {});
          }
        }
      })();

      let linkIndex = 0;
      while (!stopping && sessionHeartbeatRunning) {
        try {
          const connected = await connectWebSocket(config, session, linkIndex++);
          ws = connected.ws;
          const result = await connected.done;
          ws = null;
          if (stopping) break;
          console.error("[bili] websocket closed:", result.code, result.reason || "(no reason)");
        } catch (error) {
          ws = null;
          console.error("[bili] websocket connection failed:", String(error?.message || error));
        }
        if (!stopping) await sleep(Math.min(30000, 1500 * Math.max(1, linkIndex)));
      }

      sessionHeartbeatRunning = false;
      await sessionHeartbeat.catch(error => console.error("[bili] session heartbeat failed:", String(error?.message || error)));
      await endSession(config, session.gameId);
      session = null;
      restartDelay = 2000;
    } catch (error) {
      console.error("[bridge] Open Live session failed:", String(error?.message || error));
      if (session?.gameId) await endSession(config, session.gameId);
      session = null;
      if (!stopping) {
        await sleep(restartDelay);
        restartDelay = Math.min(60000, restartDelay * 2);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error("[bridge] fatal:", String(error?.stack || error));
    process.exitCode = 1;
  });
}

export {
  bodyMd5,
  decodePackets,
  makePacket,
  normalizedTypeForCommand,
  parseJsonBody,
  signedHeaders,
  splitPackets
};
