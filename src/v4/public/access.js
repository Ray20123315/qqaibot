import { dbAddJsonArrayItemUnique, dbDel, dbGet, dbPut, dbRemoveJsonArrayItem } from "../../data/store.js";

const PLATFORM_ROLES = Object.freeze(["authorized_member", "ai_provider", "administrator", "developer"]);
const ROLE_LABELS_ZH = Object.freeze({
  authorized_member: "授權成員",
  ai_provider: "AI 提供者",
  administrator: "管理員",
  developer: "開發者"
});
const LEGAL_CONSENT_PREFIX = "v4_legal_consent:";
const LEGAL_GROUP_OVERRIDE_PREFIX = "v4_legal_group_override:";
const LEGAL_GROUP_OVERRIDE_INDEX = "v4_legal_group_override:index";

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function legalStatementVersion(env = {}) {
  return clean(env.AIBOT_LEGAL_STATEMENT_VERSION || "2026-09-28-v1", 80);
}

function resolvePlatformRole({ developer = false, administrator = false, aiProvider = false } = {}) {
  if (developer) return "developer";
  if (administrator) return "administrator";
  if (aiProvider) return "ai_provider";
  return "authorized_member";
}

function platformRoleLabel(value) {
  return ROLE_LABELS_ZH[String(value || "")] || ROLE_LABELS_ZH.authorized_member;
}

async function acceptLegalStatement(env, {
  principalId,
  version = legalStatementVersion(env),
  source = "web"
} = {}) {
  const principal = clean(principalId);
  const agreedVersion = clean(version, 80);
  if (!principal || !agreedVersion) throw new Error("LEGAL_CONSENT_IDENTITY_REQUIRED");
  const record = Object.freeze({
    principalId: principal,
    version: agreedVersion,
    source: clean(source, 40) || "web",
    acceptedAt: Date.now()
  });
  await dbPut(env, LEGAL_CONSENT_PREFIX + principal, JSON.stringify(record));
  return record;
}

async function readLegalConsent(env, principalId) {
  const principal = clean(principalId);
  if (!principal) return null;
  const raw = await dbGet(env, LEGAL_CONSENT_PREFIX + principal);
  if (!raw) return null;
  try {
    const record = JSON.parse(String(raw));
    return record && typeof record === "object" ? record : null;
  } catch {
    return null;
  }
}

async function setDeveloperGroupWhitelist(env, {
  groupId,
  enabled,
  actorId
} = {}) {
  const group = clean(groupId);
  const actor = clean(actorId);
  if (!group || !actor) throw new Error("LEGAL_GROUP_OVERRIDE_INPUT_REQUIRED");
  const key = LEGAL_GROUP_OVERRIDE_PREFIX + group;
  if (enabled === true) {
    const record = Object.freeze({ groupId: group, enabled: true, actorId: actor, updatedAt: Date.now() });
    await dbPut(env, key, JSON.stringify(record));
    await dbAddJsonArrayItemUnique(env, LEGAL_GROUP_OVERRIDE_INDEX, group, 5000);
    return record;
  }
  await dbDel(env, key);
  await dbRemoveJsonArrayItem(env, LEGAL_GROUP_OVERRIDE_INDEX, group);
  return Object.freeze({ groupId: group, enabled: false, actorId: actor, updatedAt: Date.now() });
}

async function readDeveloperGroupWhitelist(env, groupId) {
  const group = clean(groupId);
  if (!group) return null;
  const raw = await dbGet(env, LEGAL_GROUP_OVERRIDE_PREFIX + group);
  if (!raw) return null;
  try {
    const record = JSON.parse(String(raw));
    return record?.enabled === true ? record : null;
  } catch {
    return null;
  }
}

async function legalAccessState(env, {
  principalId,
  groupId = "",
  version = legalStatementVersion(env)
} = {}) {
  const [consent, override] = await Promise.all([
    readLegalConsent(env, principalId),
    groupId ? readDeveloperGroupWhitelist(env, groupId) : Promise.resolve(null)
  ]);
  if (consent && String(consent.version || "") === String(version || "")) {
    return Object.freeze({ allowed: true, basis: "consent", consent, override: null });
  }
  if (override?.enabled === true) {
    return Object.freeze({ allowed: true, basis: "developer_group_whitelist", consent: null, override });
  }
  return Object.freeze({
    allowed: false,
    basis: consent ? "consent_version_outdated" : "consent_required",
    consent,
    override: null
  });
}

export {
  LEGAL_CONSENT_PREFIX,
  LEGAL_GROUP_OVERRIDE_INDEX,
  LEGAL_GROUP_OVERRIDE_PREFIX,
  PLATFORM_ROLES,
  ROLE_LABELS_ZH,
  acceptLegalStatement,
  legalAccessState,
  legalStatementVersion,
  platformRoleLabel,
  readDeveloperGroupWhitelist,
  readLegalConsent,
  resolvePlatformRole,
  setDeveloperGroupWhitelist
};
