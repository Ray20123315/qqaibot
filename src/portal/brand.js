import { dbGet } from "../data/store.js";

const PORTAL_BRAND_KEY = "portal_branding:v1";
const PORTAL_BRAND_LOGO_MAX_BYTES = 256 * 1024;
const PORTAL_BRAND_DEFAULTS = Object.freeze({
  brandName: "AI Control Center",
  tagline: "AI · Plugins · Your Resources",
  logoDataUrl: "",
  logoAlt: "AI Control Center"
});

function cleanBrandText(value, maxLength, fallback = "") {
  const text = String(value ?? "").normalize("NFKC").trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return (text || fallback).slice(0, maxLength);
}

function decodeBase64Size(base64) {
  const value = String(base64 || "").replace(/\s+/g, "");
  if (!value) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}

function normalizeLogoDataUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) {
    const error = new Error("LOGO_FORMAT_UNSUPPORTED");
    error.code = "LOGO_FORMAT_UNSUPPORTED";
    throw error;
  }
  const bytes = decodeBase64Size(match[2]);
  if (!bytes || bytes > PORTAL_BRAND_LOGO_MAX_BYTES) {
    const error = new Error("LOGO_TOO_LARGE");
    error.code = "LOGO_TOO_LARGE";
    error.bytes = bytes;
    throw error;
  }
  return `data:${match[1].toLowerCase()};base64,${match[2].replace(/\s+/g, "")}`;
}

function normalizePortalBranding(input, { allowLogo = true } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const record = {
    brandName: cleanBrandText(source.brandName, 48, PORTAL_BRAND_DEFAULTS.brandName),
    tagline: cleanBrandText(source.tagline, 96, PORTAL_BRAND_DEFAULTS.tagline),
    logoDataUrl: "",
    logoAlt: cleanBrandText(source.logoAlt, 80, source.brandName || PORTAL_BRAND_DEFAULTS.logoAlt)
  };
  if (allowLogo) record.logoDataUrl = normalizeLogoDataUrl(source.logoDataUrl);
  return record;
}

async function readPortalBranding(env) {
  if (!env?.DB) return { ...PORTAL_BRAND_DEFAULTS };
  try {
    const raw = await dbGet(env, PORTAL_BRAND_KEY);
    if (!raw) return { ...PORTAL_BRAND_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...PORTAL_BRAND_DEFAULTS, ...normalizePortalBranding(parsed) };
  } catch (error) {
    console.error("portal branding read failed", { error: String(error?.message || error).slice(0, 300) });
    return { ...PORTAL_BRAND_DEFAULTS };
  }
}

async function writePortalBranding(env, input) {
  if (!env?.DB) return { ok: false, code: "BRANDING_STORAGE_UNAVAILABLE", message: "D1 尚未綁定，無法保存品牌設定。" };
  let record;
  try {
    record = normalizePortalBranding(input);
  } catch (error) {
    if (error?.code === "LOGO_FORMAT_UNSUPPORTED") {
      return { ok: false, code: error.code, message: "Logo 只接受 PNG、JPEG 或 WebP 圖片。" };
    }
    if (error?.code === "LOGO_TOO_LARGE") {
      return { ok: false, code: error.code, message: "Logo 檔案過大；請控制在 256 KB 以內。" };
    }
    return { ok: false, code: "BRANDING_INVALID", message: "品牌設定格式不正確。" };
  }
  try {
    const serialized = JSON.stringify(record);
    const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(PORTAL_BRAND_KEY, serialized)
      .run();
    if (result?.success === false) throw new Error("D1 branding write returned success=false");
    const readBack = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(PORTAL_BRAND_KEY).first();
    if (!readBack || String(readBack.value || "") !== serialized) throw new Error("D1 branding write read-back mismatch");
    return { ok: true, branding: record };
  } catch (error) {
    console.error("portal branding write failed", { error: String(error?.message || error).slice(0, 300) });
    return { ok: false, code: "BRANDING_STORAGE_UNAVAILABLE", message: "品牌設定無法寫入 D1，請稍後再試。" };
  }
}

export {
  PORTAL_BRAND_DEFAULTS,
  PORTAL_BRAND_KEY,
  PORTAL_BRAND_LOGO_MAX_BYTES,
  normalizePortalBranding,
  readPortalBranding,
  writePortalBranding
};
