import { definePlugin } from "../api.js";

const BILIBILI_LIVE_PLUGIN_ID = "official.bilibili-live";
const BILIBILI_LIVE_JOB_NAME = "live-poll";
const BILIBILI_LIVE_API = "https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids";
const DEFAULT_POLL_INTERVAL_MS = 2 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 60 * 1000;
const MAX_POLL_INTERVAL_MS = 30 * 60 * 1000;
const MAX_CREATORS = 20;
const VALID_MODES = new Set(["auto", "force_live", "force_offline"]);
const TRANSIENT_BACKOFF_MS = Object.freeze([2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000]);
const BLOCKED_BACKOFF_MS = Object.freeze([5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000, 3 * 60 * 60 * 1000, 6 * 60 * 60 * 1000]);

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUid(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 24);
}

function normalizeHttpsUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw;
}

function normalizeMode(value) {
  const mode = String(value || "auto").trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : "auto";
}

function normalizeCreator(value) {
  const source = value && typeof value === "object" ? value : { uid: value };
  const uid = normalizeUid(source.uid ?? source.mid ?? source.id);
  if (!uid) return null;
  return Object.freeze({
    uid,
    label: String(source.label || source.name || "").trim().slice(0, 80),
    mode: normalizeMode(source.mode),
    forceTitle: String(source.forceTitle || "").trim().slice(0, 200),
    forceUrl: normalizeHttpsUrl(source.forceUrl),
    forceCover: normalizeHttpsUrl(source.forceCover),
    forceUpdatedAt: nullableNumber(source.forceUpdatedAt),
    forceUpdatedBy: String(source.forceUpdatedBy || "").trim().slice(0, 64)
  });
}

function normalizeCreators(value) {
  const rows = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const row of rows) {
    const creator = normalizeCreator(row);
    if (!creator || seen.has(creator.uid)) continue;
    seen.add(creator.uid);
    result.push(creator);
    if (result.length >= MAX_CREATORS) break;
  }
  return Object.freeze(result);
}

function normalizeConfig(value = {}, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaults && typeof defaults === "object" ? defaults : {};
  const creators = normalizeCreators(source.creators ?? source.creator ?? fallback.creators ?? fallback.creator ?? []);
  const pollIntervalMs = clampInteger(
    source.pollIntervalMs ?? fallback.pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS,
    MIN_POLL_INTERVAL_MS,
    MAX_POLL_INTERVAL_MS
  );
  return Object.freeze({
    creators,
    pollIntervalMs,
    updatedAt: nullableNumber(source.updatedAt),
    updatedBy: String(source.updatedBy || "").trim().slice(0, 64)
  });
}

function parseLiveTime(value) {
  if (value === undefined || value === null || value === "" || Number(value) === 0) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeProviderRecord(uid, value, checkedAt = Date.now()) {
  const data = value && typeof value === "object" ? value : {};
  const statusCode = Number(data.live_status ?? data.liveStatus ?? 0);
  const roomId = String(data.room_id ?? data.roomid ?? "").replace(/\D/g, "");
  return Object.freeze({
    uid: normalizeUid(data.uid || uid),
    available: Boolean(roomId || data.title || data.uname || data.face),
    live: statusCode === 1,
    rotating: statusCode === 2,
    statusCode: Number.isFinite(statusCode) ? statusCode : 0,
    roomId,
    title: String(data.title || "").trim().slice(0, 300),
    creatorName: String(data.uname || data.name || "").trim().slice(0, 120),
    online: Number.isFinite(Number(data.online)) ? Number(data.online) : null,
    areaName: String(data.area_v2_name || data.area_name || data.area || "").trim().slice(0, 120),
    face: normalizeHttpsUrl(data.face),
    cover: normalizeHttpsUrl(data.cover_from_user || data.cover_),
    ¶»§q«^