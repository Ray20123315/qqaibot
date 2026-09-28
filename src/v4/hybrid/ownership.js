import { dbAppendJsonArrayCapped, dbGet, dbPut } from "../../data/store.js";

const DYNAMIC_MAP_KEY = "qqopen_dynamic_group_map";
const AUX_RECENT_KEY = "hybrid_aux_recent";
const MAP_HISTORY_KEY = "qqopen_dynamic_group_map_history";
const DEFAULT_MATCH_WINDOW_MS = 6000;
const DEFAULT_EVIDENCE_REQUIRED = 3;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function hybridPrimaryTransport(env = {}) {
  const value = clean(env.QQ_HYBRID_PRIMARY || "qq-open").toLowerCase();
  if (["qq-open", "qqopen", "official"].includes(value)) return "qq-open";
  if (["onebot", "napcat", "legacy"].includes(value)) return "onebot";
  return "qq-open";
}

function parseGroupMap(env = {}) {
  const raw = clean(env.QQ_HYBRID_GROUP_MAP);
  if (!raw) return Object.freeze({ oneBotToQqOpen: Object.freeze({}), qqOpenToOneBot: Object.freeze({}) });
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("QQ_HYBRID_GROUP_MAP_INVALID_JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("QQ_HYBRID_GROUP_MAP_INVALID");
  const oneBotToQqOpen = {};
  const qqOpenToOneBot = {};
  for (const [oneBotIdValue, qqOpenIdValue] of Object.entries(parsed)) {
    const oneBotId = clean(oneBotIdValue);
    const qqOpenId = clean(qqOpenIdValue);
    if (!oneBotId || !qqOpenId) continue;
    if (!/^\d+$/.test(oneBotId)) throw new Error("QQ_HYBRID_GROUP_MAP_ONEBOT_ID_INVALID");
    oneBotToQqOpen[oneBotId] = qqOpenId;
    qqOpenToOneBot[qqOpenId] = oneBotId;
  }
  return Object.freeze({
    oneBotToQqOpen: Object.freeze(oneBotToQqOpen),
    qqOpenToOneBot: Object.freeze(qqOpenToOneBot)
  });
}

function parseDynamicGroupMap(raw) {
  if (!raw) return { oneBotToQqOpen: {}, qqOpenToOneBot: {}, updatedAt: 0 };
  try {
    const parsed = JSON.parse(String(raw));
    const oneBotToQqOpen = parsed?.oneBotToQqOpen && typeof parsed.oneBotToQqOpen === "object" ? parsed.oneBotToQqOpen : {};
    const qqOpenToOneBot = parsed?.qqOpenToOneBot && typeof parsed.qqOpenToOneBot === "object" ? parsed.qqOpenToOneBot : {};
    return { oneBotToQqOpen, qqOpenToOneBot, updatedAt: Number(parsed?.updatedAt || 0) };
  } catch {
    return { oneBotToQqOpen: {}, qqOpenToOneBot: {}, updatedAt: 0 };
  }
}

async function readDynamicGroupMap(env = {}) {
  return parseDynamicGroupMap(await dbGet(env, DYNAMIC_MAP_KEY));
}

function qqOpenGroupForOneBot(env = {}, oneBotGroupId) {
  const id = clean(oneBotGroupId);
  if (!id) return "";
  return clean(parseGroupMap(env).oneBotToQqOpen[id]);
}

function oneBotGroupForQqOpen(env = {}, qqOpenGroupId) {
  const id = clean(qqOpenGroupId);
  if (!id) return "";
  return clean(parseGroupMap(env).qqOpenToOneBot[id]);
}

async function resolveQqOpenGroupForOneBot(env = {}, oneBotGroupId) {
  const id = clean(oneBotGroupId);
  if (!id) return "";
  const fixed = qqOpenGroupForOneBot(env, id);
  if (fixed) return fixed;
  const dynamic = await readDynamicGroupMap(env);
  return clean(dynamic.oneBotToQqOpen[id]);
}

async function resolveOneBotGroupForQqOpen(env = {}, qqOpenGroupId) {
  const id = clean(qqOpenGroupId);
  if (!id) return "";
  const fixed = oneBotGroupForQqOpen(env, id);
  if (fixed) return fixed;
  const dynamic = await readDynamicGroupMap(env);
  return clean(dynamic.qqOpenToOneBot[id]);
}

function normalizeHybridObservationText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\[CQ:at,[^\]]+\]/gi, " ")
    .replace(/<@!?[^>]+>/g, " ")
    .replace(/@\d{5,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 1200);
}

function normalizeMediaTypes(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).map(v => v.toLowerCase()).filter(Boolean))].sort();
}

function hybridObservationFingerprint({ text = "", mediaTypes = [] } = {}) {
  const normalizedText = normalizeHybridObservationText(text);
  const media = normalizeMediaTypes(mediaTypes);
  if (normalizedText.length < 4 && media.length === 0) return "";
  if (/^(?:hi|嗨|你好|哈囉|hello|哈哈+|呵呵+|6+|好|可以|嗯+|哦+|啊+)$/i.test(normalizedText) && media.length === 0) return "";
  return normalizedText + "|media:" + media.join(",");
}

function selectHybridMappingCandidate(rows = [], observation = {}, { windowMs = DEFAULT_MATCH_WINDOW_MS } = {}) {
  const fingerprint = hybridObservationFingerprint(observation);
  if (!fingerprint) return Object.freeze({ oneBotGroupId: "", ambiguous: false, matches: 0 });
  const observedAt = Number(observation.observedAt || Date.now());
  const candidates = (Array.isArray(rows) ? rows : [])
    .filter(row => row?.scope === "group" && clean(row.oneBotGroupId))
    .filter(row => Math.abs(observedAt - Number(row.observedAt || 0)) <= Math.max(1000, Number(windowMs || DEFAULT_MATCH_WINDOW_MS)))
    .filter(row => hybridObservationFingerprint(row) === fingerprint);
  const groups = [...new Set(candidates.map(row => clean(row.oneBotGroupId)).filter(Boolean))];
  return Object.freeze({
    oneBotGroupId: groups.length === 1 ? groups[0] : "",
    ambiguous: groups.length > 1,
    matches: candidates.length
  });
}

async function recordOneBotHybridObservation(env, row) {
  if (!row || row.scope !== "group" || !row.oneBotGroupId) return;
  await dbAppendJsonArrayCapped(env, AUX_RECENT_KEY, row, 360);
}

async function recordQqOpenHybridGroupObservation(env, observation = {}) {
  const groupOpenid = clean(observation.groupOpenid);
  const messageId = clean(observation.messageId);
  if (!groupOpenid || !messageId) return Object.freeze({ confirmed: false, reason: "OBSERVATION_INCOMPLETE" });

  const fixed = oneBotGroupForQqOpen(env, groupOpenid);
  if (fixed) return Object.freeze({ confirmed: true, source: "static", oneBotGroupId: fixed, groupOpenid });

  let recent = [];
  try { recent = JSON.parse(String(await dbGet(env, AUX_RECENT_KEY) || "[]")); } catch {}
  const candidate = selectHybridMappingCandidate(recent, observation);
  if (!candidate.oneBotGroupId) {
    return Object.freeze({ confirmed: false, ambiguous: candidate.ambiguous, reason: candidate.ambiguous ? "MULTIPLE_CANDIDATES" : "NO_CANDIDATE" });
  }

  const evidenceKey = `qqopen_group_map_evidence:${groupOpenid}:${candidate.oneBotGroupId}`;
  let evidence = {};
  try { evidence = JSON.parse(String(await dbGet(env, evidenceKey) || "{}")); } catch {}
  const officialIds = [...new Set([...(Array.isArray(evidence.officialMessageIds) ? evidence.officialMessageIds : []), messageId])].slice(-12);
  const count = officialIds.length;
  evidence = {
    groupOpenid,
    oneBotGroupId: candidate.oneBotGroupId,
    count,
    officialMessageIds: officialIds,
    firstSeenAt: Number(evidence.firstSeenAt || observation.observedAt || Date.now()),
    lastSeenAt: Number(observation.observedAt || Date.now())
  };
  await dbPut(env, evidenceKey, JSON.stringify(evidence));

  if (count < DEFAULT_EVIDENCE_REQUIRED) {
    return Object.freeze({ confirmed: false, reason: "MORE_EVIDENCE_REQUIRED", count, required: DEFAULT_EVIDENCE_REQUIRED, oneBotGroupId: candidate.oneBotGroupId, groupOpenid });
  }

  const dynamic = await readDynamicGroupMap(env);
  const existingOfficial = clean(dynamic.oneBotToQqOpen[candidate.oneBotGroupId]);
  const existingOneBot = clean(dynamic.qqOpenToOneBot[groupOpenid]);
  if ((existingOfficial && existingOfficial !== groupOpenid) || (existingOneBot && existingOneBot !== candidate.oneBotGroupId)) {
    return Object.freeze({ confirmed: false, reason: "DYNAMIC_MAP_CONFLICT", oneBotGroupId: candidate.oneBotGroupId, groupOpenid });
  }

  const next = {
    oneBotToQqOpen: { ...dynamic.oneBotToQqOpen, [candidate.oneBotGroupId]: groupOpenid },
    qqOpenToOneBot: { ...dynamic.qqOpenToOneBot, [groupOpenid]: candidate.oneBotGroupId },
    updatedAt: Date.now()
  };
  await dbPut(env, DYNAMIC_MAP_KEY, JSON.stringify(next));
  await dbAppendJsonArrayCapped(env, MAP_HISTORY_KEY, {
    action: "confirmed",
    groupOpenid,
    oneBotGroupId: candidate.oneBotGroupId,
    evidenceCount: count,
    at: Date.now()
  }, 200);
  return Object.freeze({ confirmed: true, source: "dynamic", count, oneBotGroupId: candidate.oneBotGroupId, groupOpenid });
}

function isAuxiliaryOneBotMessage(env = {}, body = {}, { explicit = false, fullGroupOwned = false } = {}) {
  if (hybridPrimaryTransport(env) !== "qq-open") return false;
  if (clean(body.__qqai_platform).toLowerCase() === "qq-open") return false;
  const postType = clean(body.post_type).toLowerCase();
  if (!["message", "message_sent"].includes(postType)) return false;
  const messageType = clean(body.message_type).toLowerCase();
  if (messageType === "private") return true;
  if (messageType !== "group") return false;
  return explicit === true || fullGroupOwned === true;
}

function hybridObservationRow(body = {}, { mappedQqOpenGroupId = "", text = "", mentions = [], mediaTypes = [] } = {}) {
  const scope = clean(body.message_type).toLowerCase() === "group" ? "group" : "private";
  const sender = body.sender && typeof body.sender === "object" ? body.sender : {};
  return Object.freeze({
    source: "onebot-auxiliary",
    scope,
    oneBotGroupId: scope === "group" ? clean(body.group_id) : "",
    qqOpenGroupId: scope === "group" ? clean(mappedQqOpenGroupId) : "",
    userId: clean(body.user_id || body.sender_id),
    messageId: clean(body.message_id),
    senderName: clean(sender.card || sender.nickname || sender.name || body.nickname || body.user_id),
    senderRole: clean(sender.role || "member"),
    text: String(text || "").slice(0, 4000),
    mentions: Object.freeze([...new Set((mentions || []).map(clean).filter(Boolean))].slice(0, 32)),
    mediaTypes: Object.freeze(normalizeMediaTypes(mediaTypes).slice(0, 16)),
    observedAt: Number(body.time || 0) > 0 ? Number(body.time) * 1000 : Date.now()
  });
}

function hybridStatus(env = {}) {
  const map = parseGroupMap(env);
  return Object.freeze({
    primary: hybridPrimaryTransport(env),
    oneBotRole: hybridPrimaryTransport(env) === "qq-open" ? "auxiliary_observation" : "primary",
    mappedGroups: Object.keys(map.oneBotToQqOpen).length
  });
}

async function hybridRuntimeStatus(env = {}) {
  const staticStatus = hybridStatus(env);
  const dynamic = await readDynamicGroupMap(env);
  return Object.freeze({
    ...staticStatus,
    dynamicMappedGroups: Object.keys(dynamic.oneBotToQqOpen).length,
    totalMappedGroups: new Set([
      ...Object.keys(parseGroupMap(env).oneBotToQqOpen),
      ...Object.keys(dynamic.oneBotToQqOpen)
    ]).size,
    dynamicUpdatedAt: Number(dynamic.updatedAt || 0)
  });
}

export {
  AUX_RECENT_KEY,
  DEFAULT_EVIDENCE_REQUIRED,
  DYNAMIC_MAP_KEY,
  hybridObservationFingerprint,
  hybridObservationRow,
  hybridPrimaryTransport,
  hybridRuntimeStatus,
  hybridStatus,
  isAuxiliaryOneBotMessage,
  normalizeHybridObservationText,
  oneBotGroupForQqOpen,
  parseGroupMap,
  qqOpenGroupForOneBot,
  readDynamicGroupMap,
  recordOneBotHybridObservation,
  recordQqOpenHybridGroupObservation,
  resolveOneBotGroupForQqOpen,
  resolveQqOpenGroupForOneBot,
  selectHybridMappingCandidate
};
