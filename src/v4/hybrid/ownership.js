import { dbAppendJsonArrayCapped, dbGet, dbPut } from "../../data/store.js";

const DYNAMIC_MAP_KEY = "qqopen_dynamic_group_map";
const MEMBER_MAP_KEY = "qqopen_dynamic_member_map";
const AUX_RECENT_KEY = "hybrid_aux_recent";
const OFFICIAL_RECENT_KEY = "hybrid_qqopen_recent";
const MAP_HISTORY_KEY = "qqopen_dynamic_group_map_history";
const CANDIDATE_STATUS_KEY = "qqopen_group_map_candidates";
const DEFAULT_MATCH_WINDOW_MS = 12000;
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

async function readJsonArray(env, key) {
  try {
    const value = JSON.parse(String(await dbGet(env, key) || "[]"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function readDynamicGroupMap(env = {}) {
  return parseDynamicGroupMap(await dbGet(env, DYNAMIC_MAP_KEY));
}

function parseDynamicMemberMap(raw) {
  if (!raw) return { groups: {}, updatedAt: 0 };
  try {
    const parsed = JSON.parse(String(raw));
    const groups = parsed?.groups && typeof parsed.groups === "object" && !Array.isArray(parsed.groups) ? parsed.groups : {};
    return { groups, updatedAt: Number(parsed?.updatedAt || 0) };
  } catch {
    return { groups: {}, updatedAt: 0 };
  }
}

async function readDynamicMemberMap(env = {}) {
  return parseDynamicMemberMap(await dbGet(env, MEMBER_MAP_KEY));
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

async function resolveOneBotUserForQqOpen(env = {}, qqOpenGroupId, qqOpenUserId) {
  const groupOpenid = clean(qqOpenGroupId);
  const userOpenid = clean(qqOpenUserId);
  if (!groupOpenid || !userOpenid) return "";
  const state = await readDynamicMemberMap(env);
  return clean(state.groups?.[groupOpenid]?.qqOpenToOneBotUser?.[userOpenid]);
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

function officialObservationRow(observation = {}) {
  return Object.freeze({
    source: "qq-open",
    scope: "group",
    groupOpenid: clean(observation.groupOpenid),
    userOpenid: clean(observation.userOpenid),
    messageId: clean(observation.messageId),
    text: String(observation.text || "").slice(0, 4000),
    mediaTypes: Object.freeze(normalizeMediaTypes(observation.mediaTypes).slice(0, 16)),
    observedAt: Number(observation.observedAt || Date.now())
  });
}

async function appendCandidateStatus(env, row) {
  await dbAppendJsonArrayCapped(env, CANDIDATE_STATUS_KEY, row, 240);
}

function closestOneBotObservation(rows, official, oneBotGroupId) {
  const fingerprint = hybridObservationFingerprint(official);
  if (!fingerprint) return null;
  const observedAt = Number(official?.observedAt || 0);
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row?.scope === "group" && clean(row.oneBotGroupId) === clean(oneBotGroupId))
    .filter(row => /^\d+$/.test(clean(row.userId)))
    .filter(row => Math.abs(observedAt - Number(row.observedAt || 0)) <= DEFAULT_MATCH_WINDOW_MS)
    .filter(row => hybridObservationFingerprint(row) === fingerprint)
    .sort((a, b) => Math.abs(observedAt - Number(a.observedAt || 0)) - Math.abs(observedAt - Number(b.observedAt || 0)))[0] || null;
}

async function recordConfirmedMemberMapping(env, official, oneBotRow, oneBotGroupId) {
  const groupOpenid = clean(official?.groupOpenid);
  const userOpenid = clean(official?.userOpenid);
  const oneBotId = clean(oneBotGroupId);
  const qq = clean(oneBotRow?.userId);
  if (!groupOpenid || !userOpenid || !oneBotId || !/^\d+$/.test(qq)) {
    return Object.freeze({ recorded: false, reason: "MEMBER_OBSERVATION_INCOMPLETE" });
  }
  const confirmedGroup = await resolveOneBotGroupForQqOpen(env, groupOpenid);
  if (clean(confirmedGroup) !== oneBotId) {
    return Object.freeze({ recorded: false, reason: "GROUP_MAPPING_NOT_CONFIRMED" });
  }

  const state = await readDynamicMemberMap(env);
  const current = state.groups?.[groupOpenid] || {};
  const qqOpenToOneBotUser = { ...(current.qqOpenToOneBotUser || {}) };
  const oneBotToQqOpenUser = { ...(current.oneBotToQqOpenUser || {}) };
  const existingQq = clean(qqOpenToOneBotUser[userOpenid]);
  const existingOpenid = clean(oneBotToQqOpenUser[qq]);
  if ((existingQq && existingQq !== qq) || (existingOpenid && existingOpenid !== userOpenid)) {
    await dbAppendJsonArrayCapped(env, MAP_HISTORY_KEY, {
      action: "member_conflict",
      groupOpenid,
      oneBotGroupId: oneBotId,
      userOpenid,
      oneBotUserId: qq,
      existingQq,
      existingOpenid,
      at: Date.now()
    }, 200);
    return Object.freeze({ recorded: false, reason: "MEMBER_MAP_CONFLICT" });
  }

  qqOpenToOneBotUser[userOpenid] = qq;
  oneBotToQqOpenUser[qq] = userOpenid;
  const now = Date.now();
  const next = {
    groups: {
      ...(state.groups || {}),
      [groupOpenid]: {
        oneBotGroupId: oneBotId,
        qqOpenToOneBotUser,
        oneBotToQqOpenUser,
        updatedAt: now
      }
    },
    updatedAt: now
  };
  await dbPut(env, MEMBER_MAP_KEY, JSON.stringify(next));
  await dbAppendJsonArrayCapped(env, MAP_HISTORY_KEY, {
    action: "member_confirmed",
    groupOpenid,
    oneBotGroupId: oneBotId,
    userOpenid,
    oneBotUserId: qq,
    at: now
  }, 200);
  return Object.freeze({ recorded: true, groupOpenid, oneBotGroupId: oneBotId, userOpenid, oneBotUserId: qq });
}

async function applyMappingEvidence(env, official, oneBotGroupId) {
  const groupOpenid = clean(official?.groupOpenid);
  const messageId = clean(official?.messageId);
  const oneBotId = clean(oneBotGroupId);
  if (!groupOpenid || !messageId || !oneBotId) {
    return Object.freeze({ confirmed: false, reason: "OBSERVATION_INCOMPLETE" });
  }

  const fixed = oneBotGroupForQqOpen(env, groupOpenid);
  if (fixed) return Object.freeze({ confirmed: true, source: "static", oneBotGroupId: fixed, groupOpenid });

  const evidenceKey = "qqopen_group_map_evidence:" + groupOpenid + ":" + oneBotId;
  let evidence = {};
  try { evidence = JSON.parse(String(await dbGet(env, evidenceKey) || "{}")); } catch {}
  const officialIds = [...new Set([...(Array.isArray(evidence.officialMessageIds) ? evidence.officialMessageIds : []), messageId])].slice(-20);
  const count = officialIds.length;
  const now = Date.now();
  evidence = {
    groupOpenid,
    oneBotGroupId: oneBotId,
    count,
    officialMessageIds: officialIds,
    firstSeenAt: Number(evidence.firstSeenAt || official.observedAt || now),
    lastSeenAt: Number(official.observedAt || now)
  };
  await dbPut(env, evidenceKey, JSON.stringify(evidence));

  const dynamic = await readDynamicGroupMap(env);
  const existingOfficial = clean(dynamic.oneBotToQqOpen[oneBotId]);
  const existingOneBot = clean(dynamic.qqOpenToOneBot[groupOpenid]);
  const conflict = (existingOfficial && existingOfficial !== groupOpenid) || (existingOneBot && existingOneBot !== oneBotId);
  if (conflict) {
    const status = { ...evidence, confirmed: false, reason: "DYNAMIC_MAP_CONFLICT", updatedAt: now };
    await appendCandidateStatus(env, status);
    return Object.freeze(status);
  }

  if (count < DEFAULT_EVIDENCE_REQUIRED) {
    const status = {
      ...evidence,
      confirmed: false,
      reason: "MORE_EVIDENCE_REQUIRED",
      required: DEFAULT_EVIDENCE_REQUIRED,
      updatedAt: now
    };
    await appendCandidateStatus(env, status);
    return Object.freeze(status);
  }

  const next = {
    oneBotToQqOpen: { ...dynamic.oneBotToQqOpen, [oneBotId]: groupOpenid },
    qqOpenToOneBot: { ...dynamic.qqOpenToOneBot, [groupOpenid]: oneBotId },
    updatedAt: now
  };
  await dbPut(env, DYNAMIC_MAP_KEY, JSON.stringify(next));
  const status = {
    ...evidence,
    confirmed: true,
    source: "dynamic",
    required: DEFAULT_EVIDENCE_REQUIRED,
    updatedAt: now
  };
  await appendCandidateStatus(env, status);
  await dbAppendJsonArrayCapped(env, MAP_HISTORY_KEY, {
    action: "confirmed",
    groupOpenid,
    oneBotGroupId: oneBotId,
    evidenceCount: count,
    at: now
  }, 200);
  return Object.freeze(status);
}

async function recordOneBotHybridObservation(env, row) {
  if (!row || row.scope !== "group" || !row.oneBotGroupId) {
    return Object.freeze({ matchedOfficial: false, reason: "OBSERVATION_INCOMPLETE" });
  }
  await dbAppendJsonArrayCapped(env, AUX_RECENT_KEY, row, 360);

  const fingerprint = hybridObservationFingerprint(row);
  if (!fingerprint) return Object.freeze({ matchedOfficial: false, reason: "LOW_INFORMATION" });

  const [officialRows, oneBotRows] = await Promise.all([
    readJsonArray(env, OFFICIAL_RECENT_KEY),
    readJsonArray(env, AUX_RECENT_KEY)
  ]);
  const matches = officialRows
    .filter(item => clean(item.groupOpenid) && clean(item.messageId))
    .filter(item => Math.abs(Number(row.observedAt || 0) - Number(item.observedAt || 0)) <= DEFAULT_MATCH_WINDOW_MS)
    .filter(item => hybridObservationFingerprint(item) === fingerprint);

  let best = null;
  for (const official of matches) {
    const candidate = selectHybridMappingCandidate(oneBotRows, official);
    if (candidate.ambiguous || candidate.oneBotGroupId !== clean(row.oneBotGroupId)) continue;
    const applied = await applyMappingEvidence(env, official, candidate.oneBotGroupId);
    if (applied?.confirmed) await recordConfirmedMemberMapping(env, official, row, candidate.oneBotGroupId);
    if (!best || Number(applied.count || 0) > Number(best.count || 0)) best = applied;
  }
  return Object.freeze({
    matchedOfficial: Boolean(matches.length),
    evidenceApplied: Boolean(best),
    ...(best || { reason: matches.length ? "CANDIDATE_AMBIGUOUS" : "NO_OFFICIAL_MATCH" })
  });
}

async function recordQqOpenHybridGroupObservation(env, observation = {}) {
  const official = officialObservationRow(observation);
  if (!official.groupOpenid || !official.messageId) {
    return Object.freeze({ confirmed: false, reason: "OBSERVATION_INCOMPLETE" });
  }

  await dbAppendJsonArrayCapped(env, OFFICIAL_RECENT_KEY, official, 360);

  const recent = await readJsonArray(env, AUX_RECENT_KEY);
  const fixed = oneBotGroupForQqOpen(env, official.groupOpenid);
  if (fixed) {
    const matched = closestOneBotObservation(recent, official, fixed);
    if (matched) await recordConfirmedMemberMapping(env, official, matched, fixed);
    return Object.freeze({ confirmed: true, source: "static", oneBotGroupId: fixed, groupOpenid: official.groupOpenid });
  }

  const candidate = selectHybridMappingCandidate(recent, official);
  if (!candidate.oneBotGroupId) {
    return Object.freeze({
      confirmed: false,
      pending: true,
      ambiguous: candidate.ambiguous,
      reason: candidate.ambiguous ? "MULTIPLE_CANDIDATES" : "WAITING_FOR_ONEBOT",
      groupOpenid: official.groupOpenid
    });
  }
  const applied = await applyMappingEvidence(env, official, candidate.oneBotGroupId);
  if (applied?.confirmed) {
    const matched = closestOneBotObservation(recent, official, candidate.oneBotGroupId);
    if (matched) await recordConfirmedMemberMapping(env, official, matched, candidate.oneBotGroupId);
  }
  return applied;
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
    source: "onebot-observation",
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

function latestCandidates(rows = []) {
  const latest = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const groupOpenid = clean(row?.groupOpenid);
    const oneBotGroupId = clean(row?.oneBotGroupId);
    if (!groupOpenid || !oneBotGroupId) continue;
    const key = groupOpenid + "|" + oneBotGroupId;
    const existing = latest.get(key);
    if (!existing || Number(row?.updatedAt || row?.lastSeenAt || 0) >= Number(existing?.updatedAt || existing?.lastSeenAt || 0)) {
      latest.set(key, row);
    }
  }
  return [...latest.values()]
    .sort((a,b) => Number(b?.updatedAt || b?.lastSeenAt || 0) - Number(a?.updatedAt || a?.lastSeenAt || 0))
    .slice(0, 12);
}

async function hybridRuntimeStatus(env = {}) {
  const staticStatus = hybridStatus(env);
  const [dynamic, memberMap, candidateRows] = await Promise.all([
    readDynamicGroupMap(env),
    readDynamicMemberMap(env),
    readJsonArray(env, CANDIDATE_STATUS_KEY)
  ]);
  const candidates = latestCandidates(candidateRows);
  return Object.freeze({
    ...staticStatus,
    dynamicMappedGroups: Object.keys(dynamic.oneBotToQqOpen).length,
    dynamicMappedMembers: Object.values(memberMap.groups || {}).reduce((sum, group) => sum + Object.keys(group?.qqOpenToOneBotUser || {}).length, 0),
    totalMappedGroups: new Set([
      ...Object.keys(parseGroupMap(env).oneBotToQqOpen),
      ...Object.keys(dynamic.oneBotToQqOpen)
    ]).size,
    dynamicUpdatedAt: Number(dynamic.updatedAt || 0),
    mappingEvidenceRequired: DEFAULT_EVIDENCE_REQUIRED,
    mappingCandidates: Object.freeze(candidates),
    pendingMappingCandidates: Object.freeze(candidates.filter(item => item?.confirmed !== true))
  });
}

export {
  AUX_RECENT_KEY,
  CANDIDATE_STATUS_KEY,
  DEFAULT_EVIDENCE_REQUIRED,
  DEFAULT_MATCH_WINDOW_MS,
  DYNAMIC_MAP_KEY,
  MEMBER_MAP_KEY,
  OFFICIAL_RECENT_KEY,
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
  readDynamicMemberMap,
  recordOneBotHybridObservation,
  recordQqOpenHybridGroupObservation,
  resolveOneBotGroupForQqOpen,
  resolveOneBotUserForQqOpen,
  resolveQqOpenGroupForOneBot,
  selectHybridMappingCandidate
};
