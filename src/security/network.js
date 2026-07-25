// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { isDeveloperId } from "../core/identity.js";
import { dbGet, dbPut } from "../data/store.js";



function numericId(value) {
  const text = String(value ?? "");
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : text;
}



function isPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = m.slice(1).map(Number); if (a.some(n => n > 255)) return true;
  return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224;
}



function assertSafePublicUrl(value) {
  let url; try { url = new URL(String(value || "")); } catch { throw new Error("网址格式无效"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只允许 HTTP 或 HTTPS");
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error("不允许访问私有或本机地址");
  return url;
}



async function fetchPublicUrl(value, options = {}, maxRedirects = 3) {
  let url = assertSafePublicUrl(value);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(url.toString(), { ...options, redirect: "manual" });
    if (![301,302,303,307,308].includes(res.status)) return res;
    const location = res.headers.get("Location"); if (!location) return res;
    url = assertSafePublicUrl(new URL(location, url).toString());
  }
  throw new Error("重定向次数过多");
}



async function fetchMediaAsBase64(value, maxBytes, allowedPrefixes) {
  const res = await fetchPublicUrl(value, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "QQAIbot/0.2" } }, 2);
  if (!res.ok) throw new Error(`媒体下载失败：${res.status}`);
  const length = Number(res.headers.get("Content-Length") || 0); if (length && length > maxBytes) throw new Error("媒体文件过大");
  const mimeType = String(res.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!allowedPrefixes.some(p => mimeType.startsWith(p))) throw new Error(`不支持的媒体类型：${mimeType}`);
  const buffer = await res.arrayBuffer(); if (buffer.byteLength > maxBytes) throw new Error("媒体文件过大");
  const bytes = new Uint8Array(buffer); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binary), mimeType, size: buffer.byteLength };
}



function verifyOneBotAccess(request, env) {
  const expected = String(env.ONEBOT_ACCESS_TOKEN || "").trim();
  if (!expected) return false;
  const url = new URL(request.url);
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const queryToken = url.searchParams.get("access_token") || url.searchParams.get("token") || "";
  return bearer === expected || queryToken === expected;
}



async function getFeatureFlag(env, name, fallback = false) {
  const raw = await dbGet(env, `feature:${name}`);
  if (raw === null || raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}



function envFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).trim().toLowerCase());
}



async function setFeatureFlag(env, name, enabled) {
  await dbPut(env, `feature:${name}`, enabled ? "true" : "false");
}



async function isGroupWhitelisted(env, groupId) {
  if (!groupId) return false;
  return await dbGet(env, `group_whitelist:${groupId}`) === "true";
}



async function getPrivateAccessMode(env, userId) {
  if (isDeveloperId(env, userId)) return "full";
  const explicit = await dbGet(env, `private_access:${userId}`);
  if (["full", "commands", "none"].includes(explicit)) return explicit;
  return "none";
}

export { assertSafePublicUrl, envFlag, fetchMediaAsBase64, fetchPublicUrl, getFeatureFlag, getPrivateAccessMode, isGroupWhitelisted, isPrivateHost, numericId, setFeatureFlag, verifyOneBotAccess };
