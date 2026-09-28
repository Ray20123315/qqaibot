import { dbCompareAndSwapStrict, dbGet, dbPut } from "../../data/store.js";

const RESOURCE_TICKET_PREFIX = "v4_resource_ticket:";
const IDENTITY_LINK_PREFIX = "v4_identity_link:";

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function ticketKey(token) {
  const raw = clean(token, 300);
  if (!raw) throw new Error("RESOURCE_TICKET_REQUIRED");
  return RESOURCE_TICKET_PREFIX + await sha256Hex(raw);
}

function portalPrincipal(session = {}) {
  if (session?.systemAdmin === true) return "";
  const qq = String(session?.qq || "").replace(/\D/g, "");
  return qq ? `qq:${qq}` : "";
}

function qqOpenPrincipal(openid) {
  const value = clean(openid, 180);
  return value ? `qqopen:${value}` : "";
}

async function resolveCanonicalPrincipal(env, principalId) {
  const principal = clean(principalId);
  if (!principal) return "";
  const raw = await dbGet(env, IDENTITY_LINK_PREFIX + principal);
  if (!raw) return principal;
  try {
    const record = JSON.parse(raw);
    return clean(record?.targetPrincipalId) || principal;
  } catch {
    return principal;
  }
}

async function createResourceInputTicket(env, {
  principalId,
  kind,
  source = "portal",
  ttlMs = 10 * 60 * 1000
} = {}) {
  const principal = clean(principalId);
  const normalizedKind = ["ai", "storage"].includes(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "";
  if (!principal || !normalizedKind) throw new Error("RESOURCE_TICKET_INPUT_INVALID");
  const token = crypto.randomUUID() + crypto.randomUUID();
  const key = await ticketKey(token);
  const now = Date.now();
  const record = {
    principalId: principal,
    claimedPrincipalId: "",
    kind: normalizedKind,
    source: clean(source, 40) || "portal",
    createdAt: now,
    expiresAt: now + Math.max(60_000, Math.min(30 * 60 * 1000, Number(ttlMs) || 600_000)),
    usedAt: 0
  };
  await dbPut(env, key, JSON.stringify(record));
  return Object.freeze({ token, kind: normalizedKind, expiresAt: record.expiresAt });
}

async function readResourceInputTicket(env, token) {
  const raw = await dbGet(env, await ticketKey(token));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record || Date.now() > Number(record.expiresAt || 0) || Number(record.usedAt || 0) > 0) return null;
    return record;
  } catch {
    return null;
  }
}

async function claimResourceInputTicket(env, token, targetPrincipalId) {
  const key = await ticketKey(token);
  const raw = await dbGet(env, key);
  if (!raw) throw new Error("RESOURCE_TICKET_NOT_FOUND");
  let record;
  try { record = JSON.parse(raw); } catch { throw new Error("RESOURCE_TICKET_INVALID"); }
  if (Date.now() > Number(record.expiresAt || 0) || Number(record.usedAt || 0) > 0) throw new Error("RESOURCE_TICKET_EXPIRED");
  const target = clean(targetPrincipalId);
  if (!target) throw new Error("RESOURCE_TICKET_TARGET_REQUIRED");
  const canonicalSource = await resolveCanonicalPrincipal(env, record.principalId);
  if (canonicalSource === target || record.claimedPrincipalId === target) return Object.freeze({ ...record, effectivePrincipalId: target });
  if (!String(record.principalId || "").startsWith("qqopen:") || !target.startsWith("qq:")) throw new Error("RESOURCE_TICKET_PRINCIPAL_MISMATCH");
  if (record.claimedPrincipalId && record.claimedPrincipalId !== target) throw new Error("RESOURCE_TICKET_ALREADY_CLAIMED");

  const linkKey = IDENTITY_LINK_PREFIX + record.principalId;
  const existingLink = await dbGet(env, linkKey);
  if (existingLink) {
    try {
      const link = JSON.parse(existingLink);
      if (clean(link?.targetPrincipalId) !== target) throw new Error("QQ_IDENTITY_ALREADY_LINKED");
    } catch (error) {
      if (error?.message === "QQ_IDENTITY_ALREADY_LINKED") throw error;
      throw new Error("QQ_IDENTITY_LINK_INVALID");
    }
  } else {
    await dbPut(env, linkKey, JSON.stringify({
      sourcePrincipalId: record.principalId,
      targetPrincipalId: target,
      linkedAt: Date.now(),
      source: "resource_ticket_claim"
    }));
  }
  const next = { ...record, claimedPrincipalId: target, claimedAt: Date.now() };
  const updated = await dbCompareAndSwapStrict(env, key, raw, JSON.stringify(next));
  if (!updated) throw new Error("RESOURCE_TICKET_CLAIM_CONFLICT");
  return Object.freeze({ ...next, effectivePrincipalId: target });
}

async function consumeResourceInputTicket(env, token, targetPrincipalId, expectedKind) {
  const key = await ticketKey(token);
  const raw = await dbGet(env, key);
  if (!raw) throw new Error("RESOURCE_TICKET_NOT_FOUND");
  let record;
  try { record = JSON.parse(raw); } catch { throw new Error("RESOURCE_TICKET_INVALID"); }
  const target = clean(targetPrincipalId);
  const kind = String(expectedKind || "").toLowerCase();
  if (Date.now() > Number(record.expiresAt || 0) || Number(record.usedAt || 0) > 0) throw new Error("RESOURCE_TICKET_EXPIRED");
  if (kind && record.kind !== kind) throw new Error("RESOURCE_TICKET_KIND_MISMATCH");
  const effective = clean(record.claimedPrincipalId) || await resolveCanonicalPrincipal(env, record.principalId);
  if (!target || effective !== target) throw new Error("RESOURCE_TICKET_PRINCIPAL_MISMATCH");
  const next = { ...record, usedAt: Date.now() };
  const consumed = await dbCompareAndSwapStrict(env, key, raw, JSON.stringify(next));
  if (!consumed) throw new Error("RESOURCE_TICKET_CONSUME_CONFLICT");
  return Object.freeze({ ...next, effectivePrincipalId: target });
}

export {
  IDENTITY_LINK_PREFIX,
  RESOURCE_TICKET_PREFIX,
  claimResourceInputTicket,
  consumeResourceInputTicket,
  createResourceInputTicket,
  portalPrincipal,
  qqOpenPrincipal,
  readResourceInputTicket,
  resolveCanonicalPrincipal
};
