import { isDeveloperId } from "../core/identity.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { jsonResponse } from "./auth.js";
import { numericId } from "../security/network.js";

const SNAPSHOT_PREFIX = "member_snapshot:";
const META_PREFIX = "member_snapshot_meta:";
const POLICY_PREFIX = "member_cleanup_policy:";
const PREVIEW_PREFIX = "member_cleanup_preview:";
const DEEP_BATCH_LIMIT = 30;
const EXECUTE_CHUNK_SIZE = 5;
const PREVIEW_TTL_MS = 5 * 60 * 1000;

const DEFAULT_POLICY = Object.freeze({
  newMemberDays: 7,
  neverSpokeGraceDays: 14,
  activeDays: 30,
  coolingDays: 90,
  dormantDays: 180,
  longDormantDays: 365,
  protectHonors: true,
  protectRelationships: true,
  requireCompleteData: true,
  protectedTags: ["保留", "免清", "核心", "长期保留", "赞助", "贊助"]
});

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeRequestedMemberIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(cleanId).filter(Boolean))];
}

function boundedInt(value, fallback, min, max) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeEpochMs(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number > 100000000000 ? Math.trunc(number) : Math.trunc(number * 1000);
}

function normalizeOptionalBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function normalizeSex(value) {
  const source = String(value ?? "").trim().toLowerCase();
  if (["male", "m", "1", "男", "男性"].includes(source)) return "male";
  if (["female", "f", "2", "女", "女性"].includes(source)) return "female";
  return "unknown";
}

function memberMissingFields(member) {
  const missing = [];
  if (normalizeSex(member?.sex) === "unknown") missing.push("sex");
  if (!Number(member?.age || 0)) missing.push("age");
  if (!String(member?.area || "").trim()) missing.push("area");
  return missing;
}

function mergeRawMember(groupRaw, strangerRaw) {
  const group = groupRaw && typeof groupRaw === "object" ? groupRaw : {};
  const stranger = strangerRaw && typeof strangerRaw === "object" ? strangerRaw : {};
  const merged = { ...group };
  if (!cleanId(group.user_id || group.userId || group.qq)) merged.user_id = stranger.user_id ?? stranger.userId ?? stranger.qq;
  if (!String(group.nickname || group.name || "").trim() && String(stranger.nickname || stranger.name || "").trim()) merged.nickname = stranger.nickname || stranger.name;
  if (normalizeSex(group.sex) === "unknown" && normalizeSex(stranger.sex) !== "unknown") merged.sex = stranger.sex;
  if (!Number(group.age || 0) && Number(stranger.age || 0)) merged.age = stranger.age;
  const groupArea = String(group.area || group.location || [group.province, group.city].filter(Boolean).join(" ") || "").trim();
  if (!groupArea) merged.area = String(stranger.area || stranger.location || [stranger.province, stranger.city].filter(Boolean).join(" ") || "");
  if (!Number(group.qq_level ?? group.qqLevel ?? 0)) merged.qq_level = Number(stranger.qq_level ?? stranger.qqLevel ?? stranger.level ?? 0);
  merged._data_sources = ["group_member_info", ...(Object.keys(stranger).length ? ["stranger_info"] : [])];
  return merged;
}

function preserveEnrichedMember(previous, current) {
  const before = previous && typeof previous === "object" ? previous : {};
  const next = current && typeof current === "object" ? current : {};
  const nextRawFields = Array.isArray(next.rawFields) ? next.rawFields : [];
  const hasTitleField = nextRawFields.some(field => ["title", "special_title", "specialTitle"].includes(String(field)));
  const hasTitleExpireField = nextRawFields.some(field => ["title_expire_time", "titleExpireTime"].includes(String(field)));
  const title = hasTitleField ? String(next.title || "") : String(next.title || before.title || "");
  let titleExpireTime = 0;
  if (title) {
    if (hasTitleExpireField) titleExpireTime = Number(next.titleExpireTime || 0);
    else if (title === String(before.title || "")) titleExpireTime = Number(before.titleExpireTime || 0);
    else titleExpireTime = Number(next.titleExpireTime || 0);
  }
  const merged = {
    ...before,
    ...next,
    sex: normalizeSex(next.sex) !== "unknown" ? normalizeSex(next.sex) : normalizeSex(before.sex),
    age: Number(next.age || 0) || Number(before.age || 0),
    area: String(next.area || before.area || ""),
    qqLevel: Number(next.qqLevel || 0) || Number(before.qqLevel || 0),
    title,
    specialTitle: title,
    titleExpireTime,
    titleStatus: !title ? "none" : titleExpireTime ? "expires" : "unspecified",
    cardChangeable: next.cardChangeable ?? before.cardChangeable ?? null,
    extra: { ...(before.extra || {}), ...(next.extra || {}) },
    rawFields: [...new Set([...(before.rawFields || []), ...nextRawFields])].slice(0, 100),
    dataSources: [...new Set([...(before.dataSources || []), ...(next.dataSources || [])])]
  };
  merged.missingFields = memberMissingFields(merged);
  return merged;
}

function safeScalar(value) {
  if (value == null) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return typeof value === "string" ? value.slice(0, 500) : value;
  if (Array.isArray(value)) return value.slice(0, 20).map(safeScalar);
  return null;
}

function extractExtraFields(raw) {
  const known = new Set([
    "group_id", "groupId", "user_id", "userId", "qq", "nickname", "name", "card", "sex", "age", "area",
    "join_time", "joinTime", "last_sent_time", "lastSentTime", "level", "qq_level", "qqLevel", "role",
    "unfriendly", "title", "special_title", "specialTitle", "title_expire_time", "titleExpireTime",
    "card_changeable", "cardChangeable", "is_robot", "isRobot", "shut_up_timestamp", "mute_until", "muteUntil"
  ]);
  const out = {};
  for (const [key, value] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    if (known.has(key) || String(key).startsWith("_")) continue;
    const normalized = safeScalar(value);
    if (normalized !== null) out[String(key).slice(0, 80)] = normalized;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}

function normalizeFullMember(raw, capturedAt = Date.now()) {
  const source = raw && typeof raw === "object" ? raw : {};
  const qq = cleanId(source.user_id || source.userId || source.qq);
  const groupId = cleanId(source.group_id || source.groupId);
  const nickname = String(source.nickname || source.name || qq).slice(0, 200);
  const card = String(source.card || "").slice(0, 200);
  const title = String(source.title || source.special_title || source.specialTitle || "").slice(0, 200);
  const muteUntil = normalizeEpochMs(source.shut_up_timestamp ?? source.mute_until ?? source.muteUntil);
  const sex = normalizeSex(source.sex);
  const age = Math.max(0, Math.min(200, Math.trunc(Number(source.age ?? source.qq_age ?? 0))));
  const area = String(source.area || source.location || [source.province, source.city].filter(Boolean).join(" ") || "").slice(0, 200);
  const titleExpireTime = normalizeEpochMs(source.title_expire_time ?? source.titleExpireTime);
  const result = {
    groupId,
    qq,
    userId: qq,
    nickname,
    card,
    name: card || nickname || qq,
    sex,
    age,
    area,
    joinTime: normalizeEpochMs(source.join_time ?? source.joinTime),
    lastSentTime: normalizeEpochMs(source.last_sent_time ?? source.lastSentTime),
    level: String(source.level || "").slice(0, 100),
    qqLevel: Math.max(0, Math.trunc(Number(source.qq_level ?? source.qqLevel ?? 0))),
    role: ["owner", "admin", "member"].includes(String(source.role || "")) ? String(source.role) : "member",
    unfriendly: Boolean(source.unfriendly),
    title,
    specialTitle: title,
    titleExpireTime,
    titleStatus: !title ? "none" : titleExpireTime ? "expires" : "unspecified",
    cardChangeable: normalizeOptionalBoolean(source.card_changeable ?? source.cardChangeable),
    isRobot: Boolean(source.is_robot || source.isRobot),
    muteUntil,
    muted: muteUntil > capturedAt,
    capturedAt: Number(capturedAt || Date.now()),
    rawFields: Object.keys(source).filter(key => !String(key).startsWith("_")).map(String).sort().slice(0, 100),
    extra: extractExtraFields(source),
    dataSources: Array.isArray(source._data_sources) ? source._data_sources.map(String) : [],
    supplementWarning: String(source._supplement_warning || "").slice(0, 500)
  };
  result.missingFields = memberMissingFields(result);
  return result;
}


function normalizeHonorEntry(value, type) {
  const source = value && typeof value === "object" ? value : {};
  return {
    type,
    userId: cleanId(source.user_id || source.userId),
    nickname: String(source.nickname || "").slice(0, 200),
    avatar: String(source.avatar || "").slice(0, 1000),
    description: String(source.description || "").slice(0, 500),
    dayCount: Math.max(0, Math.trunc(Number(source.day_count || source.dayCount || 0)))
  };
}

function honorMapFromResponse(response) {
  const raw = response?.data && typeof response.data === "object" ? response.data : (response && typeof response === "object" ? response : {});
  const map = new Map();
  const add = (entry, type) => {
    const item = normalizeHonorEntry(entry, type);
    if (!item.userId) return;
    const list = map.get(item.userId) || [];
    if (!list.some(existing => existing.type === type && existing.description === item.description)) list.push(item);
    map.set(item.userId, list);
  };
  const current = raw.current_talkative || raw.currentTalkative;
  if (current) add(current, "current_talkative");
  for (const [fields, type] of [
    [["talkative_list", "talkativeList"], "talkative"],
    [["performer_list", "performerList"], "performer"],
    [["legend_list", "legendList"], "legend"],
    [["strong_newbie_list", "strongNewbieList"], "strong_newbie"],
    [["emotion_list", "emotionList"], "emotion"]
  ]) {
    const list = fields.map(field => raw[field]).find(Array.isArray) || [];
    for (const entry of list) add(entry, type);
  }
  return map;
}


function normalizePolicy(value) {
  const source = value && typeof value === "object" ? value : {};
  const policy = {
    newMemberDays: boundedInt(source.newMemberDays, DEFAULT_POLICY.newMemberDays, 1, 60),
    neverSpokeGraceDays: boundedInt(source.neverSpokeGraceDays, DEFAULT_POLICY.neverSpokeGraceDays, 1, 120),
    activeDays: boundedInt(source.activeDays, DEFAULT_POLICY.activeDays, 1, 180),
    coolingDays: boundedInt(source.coolingDays, DEFAULT_POLICY.coolingDays, 7, 365),
    dormantDays: boundedInt(source.dormantDays, DEFAULT_POLICY.dormantDays, 30, 730),
    longDormantDays: boundedInt(source.longDormantDays, DEFAULT_POLICY.longDormantDays, 60, 1825),
    protectHonors: source.protectHonors !== false,
    protectRelationships: source.protectRelationships !== false,
    requireCompleteData: source.requireCompleteData !== false,
    protectedTags: [...new Set((Array.isArray(source.protectedTags) ? source.protectedTags : DEFAULT_POLICY.protectedTags)
      .map(item => String(item || "").trim().slice(0, 30)).filter(Boolean))].slice(0, 30)
  };
  policy.coolingDays = Math.max(policy.activeDays + 1, policy.coolingDays);
  policy.dormantDays = Math.max(policy.coolingDays + 1, policy.dormantDays);
  policy.longDormantDays = Math.max(policy.dormantDays + 1, policy.longDormantDays);
  return policy;
}

function categoryLabel(category) {
  return ({
    protected: "受保护",
    incomplete_data: "资料不足",
    new_member: "新成员观察期",
    active: "活跃",
    cooling: "轻度潜水",
    inactive: "长期低活跃",
    dormant: "沉睡成员",
    long_dormant: "超长期未活跃",
    never_spoke_grace: "未发言但仍在观察期",
    never_spoke_established: "长期从未发言"
  })[category] || "待复核";
}

function classifyMemberForCleanup(member, context = {}, policyInput = DEFAULT_POLICY, now = Date.now()) {
  const policy = normalizePolicy(policyInput);
  const profile = context.profile || {};
  const tags = Array.isArray(profile.tags) ? profile.tags.map(String) : [];
  const honors = Array.isArray(context.honors || member?.honors) ? (context.honors || member.honors) : [];
  const joinTime = Number(member?.joinTime || 0);
  const lastSentTime = Number(member?.lastSentTime || 0);
  const joinDays = joinTime ? Math.max(0, Math.floor((now - joinTime) / 86400000)) : null;
  const inactiveDays = lastSentTime ? Math.max(0, Math.floor((now - lastSentTime) / 86400000)) : null;
  const reasons = [];
  const protection = [];

  if (["owner", "admin"].includes(String(member?.role || ""))) protection.push("群主或管理员");
  if (member?.isRobot) protection.push("机器人账号");
  if (context.isDeveloper) protection.push("核心开发者");
  if (policy.protectRelationships && context.hasRelationship) protection.push("存在对象或主人关系");
  const protectedTag = tags.find(tag => policy.protectedTags.includes(tag));
  if (protectedTag) protection.push(`管理标签：${protectedTag}`);
  if (policy.protectHonors && honors.length) protection.push(`群荣誉：${honors.map(item => item.type).join("、")}`);

  if (protection.length) {
    return { category: "protected", label: categoryLabel("protected"), recommendation: "keep", score: 0, protected: true, reasons: protection, joinDays, inactiveDays };
  }

  if (policy.requireCompleteData && (!joinTime || (!lastSentTime && joinDays == null))) {
    return { category: "incomplete_data", label: categoryLabel("incomplete_data"), recommendation: "sync_first", score: 0, protected: false, reasons: ["入群时间或最后发言资料不完整，禁止直接列为清理对象"], joinDays, inactiveDays };
  }

  if (joinDays != null && joinDays < policy.newMemberDays) {
    reasons.push(`加入群聊仅 ${joinDays} 天`);
    return { category: "new_member", label: categoryLabel("new_member"), recommendation: "keep", score: 5, protected: false, reasons, joinDays, inactiveDays };
  }

  if (!lastSentTime) {
    const established = joinDays != null && joinDays > policy.neverSpokeGraceDays;
    reasons.push(established ? `加入 ${joinDays} 天仍无可用发言时间` : "尚无可用发言时间，但仍在观察期");
    const category = established ? "never_spoke_established" : "never_spoke_grace";
    return { category, label: categoryLabel(category), recommendation: established ? "cleanup_candidate" : "watch", score: established ? 80 : 25, protected: false, reasons, joinDays, inactiveDays: null };
  }

  let category = "active";
  let recommendation = "keep";
  let score = 5;
  if (inactiveDays <= policy.activeDays) {
    category = "active";
    reasons.push(`${inactiveDays} 天内有发言`);
  } else if (inactiveDays <= policy.coolingDays) {
    category = "cooling";
    recommendation = "watch";
    score = 20;
    reasons.push(`已 ${inactiveDays} 天未发言`);
  } else if (inactiveDays <= policy.dormantDays) {
    category = "inactive";
    recommendation = "review";
    score = 45;
    reasons.push(`已 ${inactiveDays} 天未发言，建议人工复核`);
  } else if (inactiveDays <= policy.longDormantDays) {
    category = "dormant";
    recommendation = "cleanup_candidate";
    score = 70;
    reasons.push(`已 ${inactiveDays} 天未发言`);
  } else {
    category = "long_dormant";
    recommendation = "cleanup_candidate";
    score = 90;
    reasons.push(`已 ${inactiveDays} 天未发言，超过超长期阈值`);
  }

  if (member?.title) {
    score = Math.max(0, score - 10);
    reasons.push(`具有专属头衔「${String(member.title).slice(0, 40)}」，已降低清理优先级`);
  }
  if (tags.includes("清理候选")) {
    score = Math.min(100, score + 10);
    reasons.push("管理已标记为清理候选");
  }
  return { category, label: categoryLabel(category), recommendation, score, protected: false, reasons, joinDays, inactiveDays };
}

function buildCleanupSummary(records) {
  const summary = { total: 0, protected: 0, keep: 0, watch: 0, review: 0, cleanupCandidates: 0, incomplete: 0, categories: {} };
  for (const record of Array.isArray(records) ? records : []) {
    const classification = record.classification || {};
    summary.total += 1;
    summary.categories[classification.category] = (summary.categories[classification.category] || 0) + 1;
    if (classification.protected) summary.protected += 1;
    else if (classification.recommendation === "keep") summary.keep += 1;
    else if (classification.recommendation === "watch") summary.watch += 1;
    else if (classification.recommendation === "review") summary.review += 1;
    else if (classification.recommendation === "cleanup_candidate") summary.cleanupCandidates += 1;
    else summary.incomplete += 1;
  }
  return summary;
}

function snapshotKey(groupId, userId) {
  return `${SNAPSHOT_PREFIX}${cleanId(groupId)}:${cleanId(userId)}`;
}

function metaKey(groupId) {
  return `${META_PREFIX}${cleanId(groupId)}`;
}

function policyKey(groupId) {
  return `${POLICY_PREFIX}${cleanId(groupId)}`;
}

async function readJsonValue(env, key, fallback = null) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function readPolicy(env, groupId) {
  return normalizePolicy(await readJsonValue(env, policyKey(groupId), DEFAULT_POLICY));
}

async function writePolicy(env, groupId, value) {
  const policy = normalizePolicy(value);
  await dbPut(env, policyKey(groupId), JSON.stringify(policy));
  return policy;
}

async function listSnapshots(env, groupId) {
  const group = cleanId(groupId);
  if (!env?.DB || !group) return [];
  const prefix = `${SNAPSHOT_PREFIX}${group}:`;
  const rows = await env.DB.prepare("SELECT value FROM kv_store WHERE substr(key, 1, ?) = ? ORDER BY key ASC").bind(prefix.length, prefix).all();
  const out = [];
  for (const row of rows.results || []) {
    try {
      const parsed = JSON.parse(String(row?.value || "{}"));
      if (parsed?.qq) out.push(parsed);
    } catch {}
  }
  return out;
}

async function writeSnapshots(env, groupId, snapshots) {
  const list = (Array.isArray(snapshots) ? snapshots : []).filter(item => item?.qq);
  if (!list.length || !env?.DB) return;
  if (typeof env.DB.batch === "function") {
    for (let index = 0; index < list.length; index += 50) {
      const chunk = list.slice(index, index + 50);
      await env.DB.batch(chunk.map(item => env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(snapshotKey(groupId, item.qq), JSON.stringify(item))));
    }
  } else {
    for (const item of list) await dbPut(env, snapshotKey(groupId, item.qq), JSON.stringify(item));
  }
}

async function fetchHonors(env, groupId) {
  try {
    const response = await callOneBotAction(env, { action: "get_group_honor_info", params: { group_id: numericId(groupId), type: "all" } }, 15000);
    const map = honorMapFromResponse(response);
    map.ok = true;
    map.warning = "";
    return map;
  } catch (error) {
    const map = new Map();
    map.ok = false;
    map.warning = String(error?.message || error).slice(0, 300);
    return map;
  }
}


async function fastSync(env, groupId) {
  const capturedAt = Date.now();
  const existing = new Map((await listSnapshots(env, groupId)).map(item => [String(item.qq), item]));
  const [memberResponse, honors] = await Promise.all([
    callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: true } }, 30000),
    fetchHonors(env, groupId)
  ]);
  const source = Array.isArray(memberResponse) ? memberResponse : Array.isArray(memberResponse?.data) ? memberResponse.data : [];
  const snapshots = source.map(raw => {
    const current = normalizeFullMember({ ...raw, _data_sources: ["group_member_list"] }, capturedAt);
    const previous = existing.get(current.qq) || {};
    const merged = preserveEnrichedMember(previous, current);
    const liveHonors = honors.get(current.qq);
    return {
      ...merged,
      honors: honors.ok === false ? (previous.honors || []) : (liveHonors || []),
      honorSyncOk: honors.ok !== false,
      honorSyncWarning: honors.warning || "",
      syncMode: String(previous.syncMode || "").includes("deep") ? "deep+fast" : "fast",
      dataSources: [...new Set([...(merged.dataSources || []), "group_member_list", "group_honor_info"])]
    };
  }).filter(item => item.qq);
  await writeSnapshots(env, groupId, snapshots);
  const meta = {
    groupId: cleanId(groupId),
    fastSyncedAt: capturedAt,
    deepSyncedAt: Number((await readJsonValue(env, metaKey(groupId), {}))?.deepSyncedAt || 0),
    memberCount: snapshots.length,
    honorMemberCount: snapshots.filter(item => item.honors?.length).length,
    honorSyncOk: honors.ok !== false,
    honorSyncWarning: honors.warning || "",
    deepPreservedCount: snapshots.filter(item => String(item.syncMode).includes("deep")).length,
    lastMode: "fast"
  };
  await dbPut(env, metaKey(groupId), JSON.stringify(meta));
  return { snapshots, meta };
}


async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const output = [];
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      output.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return output;
}

async function deepSync(env, groupId, userIds) {
  const ids = normalizeRequestedMemberIds(userIds).slice(0, DEEP_BATCH_LIMIT);
  if (!ids.length) return { updated: [], failed: [], meta: await readJsonValue(env, metaKey(groupId), {}) };
  const existing = new Map((await listSnapshots(env, groupId)).map(item => [String(item.qq), item]));
  const honors = await fetchHonors(env, groupId);
  const capturedAt = Date.now();
  const results = await runPool(ids, 4, async userId => {
    try {
      const response = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: true } }, 15000);
      const groupRaw = response?.data && typeof response.data === "object" ? response.data : response;
      const groupMember = normalizeFullMember(groupRaw, capturedAt);
      let strangerRaw = null;
      let supplementWarning = "";
      if (groupMember.missingFields.length || !groupMember.qqLevel) {
        try {
          const strangerResponse = await callOneBotAction(env, { action: "get_stranger_info", params: { user_id: numericId(userId), no_cache: true } }, 15000);
          strangerRaw = strangerResponse?.data && typeof strangerResponse.data === "object" ? strangerResponse.data : strangerResponse;
        } catch (error) {
          supplementWarning = String(error?.message || error).slice(0, 300);
        }
      }
      const raw = mergeRawMember(groupRaw, strangerRaw);
      raw._supplement_warning = supplementWarning;
      const current = normalizeFullMember(raw, capturedAt);
      const snapshot = preserveEnrichedMember(existing.get(userId) || {}, current);
      snapshot.honors = honors.ok === false ? (existing.get(userId)?.honors || []) : (honors.get(userId) || []);
      snapshot.honorSyncOk = honors.ok !== false;
      snapshot.honorSyncWarning = honors.warning || "";
      snapshot.syncMode = "deep";
      snapshot.dataSources = [...new Set([...(snapshot.dataSources || []), "group_member_info", ...(strangerRaw ? ["stranger_info"] : []), "group_honor_info"])]
      return { ok: true, userId, snapshot };
    } catch (error) {
      return { ok: false, userId, error: String(error?.message || error).slice(0, 300) };
    }
  });
  const updated = results.filter(item => item.ok).map(item => item.snapshot);
  await writeSnapshots(env, groupId, updated);
  const previous = await readJsonValue(env, metaKey(groupId), {});
  const meta = {
    ...previous,
    groupId: cleanId(groupId),
    deepSyncedAt: capturedAt,
    deepSyncedCount: Number(previous?.deepSyncedCount || 0) + updated.length,
    honorSyncOk: honors.ok !== false,
    honorSyncWarning: honors.warning || "",
    lastMode: "deep"
  };
  await dbPut(env, metaKey(groupId), JSON.stringify(meta));
  return { updated, failed: results.filter(item => !item.ok), meta };
}


function relationshipUsers(relationships) {
  const set = new Set();
  for (const relationship of Array.isArray(relationships) ? relationships : []) {
    for (const id of relationship?.userIds || [relationship?.masterId, relationship?.memberId, relationship?.leftId, relationship?.rightId]) {
      const clean = cleanId(id);
      if (clean) set.add(clean);
    }
  }
  return set;
}

async function buildRecords(env, groupId, helpers, policy) {
  let snapshots = await listSnapshots(env, groupId);
  if (!snapshots.length && typeof helpers?.listPortalMembers === "function") {
    const listing = await helpers.listPortalMembers(env, groupId);
    snapshots = (listing?.members || []).map(item => ({ ...item, capturedAt: Date.now(), syncMode: "directory", rawFields: [], extra: {}, honors: [] }));
  }
  const [profiles, relationships, locks] = await Promise.all([
    typeof helpers?.listMemberProfileSummaries === "function" ? helpers.listMemberProfileSummaries(env, groupId) : {},
    typeof helpers?.listGroupBindings === "function" ? helpers.listGroupBindings(env, groupId) : [],
    typeof helpers?.listGroupMuteLocks === "function" ? helpers.listGroupMuteLocks(env, groupId) : {}
  ]);
  const related = relationshipUsers(relationships);
  return snapshots.map(member => {
    const profile = profiles?.[member.qq] || null;
    const context = {
      profile,
      honors: member.honors || [],
      hasRelationship: related.has(String(member.qq)),
      isDeveloper: isDeveloperId(env, member.qq)
    };
    return {
      member: { ...member, relationship: context.hasRelationship, muteLock: locks?.[member.qq] || null, memberProfile: profile },
      classification: classifyMemberForCleanup(member, context, policy),
      dataCompleteness: {
        joinTime: Boolean(member.joinTime),
        lastSentTime: Boolean(member.lastSentTime),
        deep: String(member.syncMode || "").includes("deep"),
        fields: Array.isArray(member.rawFields) ? member.rawFields.length : 0,
        missingFields: Array.isArray(member.missingFields) ? member.missingFields : memberMissingFields(member),
        sources: Array.isArray(member.dataSources) ? member.dataSources : []
      }
    };
  }).sort((left, right) => Number(right.classification.score || 0) - Number(left.classification.score || 0) || String(left.member.name || left.member.qq).localeCompare(String(right.member.name || right.member.qq), "zh-CN"));
}

function canExecuteCleanup(authed) {
  const permissions = authed?.permissions || {};
  return Boolean(permissions.developer || permissions.nativeAdmin || permissions.groupOps || ["owner", "admin", "developer"].includes(String(authed?.role || "")));
}

async function liveMember(env, groupId, userId) {
  const response = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: true } }, 15000);
  const raw = response?.data && typeof response.data === "object" ? response.data : response;
  return normalizeFullMember(raw);
}

async function createCleanupPreview(env, groupId, authed, body, helpers) {
  const ids = normalizeRequestedMemberIds(body?.userIds);
  if (!ids.length) return { ok: false, status: 400, message: "请至少选择一位候选成员。" };
  const policy = await readPolicy(env, groupId);
  const records = await buildRecords(env, groupId, helpers, policy);
  const byId = new Map(records.map(item => [String(item.member.qq), item]));
  const eligible = [];
  const excluded = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (!record) { excluded.push({ userId: id, reason: "不在当前快照中" }); continue; }
    if (record.classification.protected) { excluded.push({ userId: id, reason: record.classification.reasons.join("；") }); continue; }
    if (!["cleanup_candidate", "review"].includes(record.classification.recommendation)) { excluded.push({ userId: id, reason: `当前分类为${record.classification.label}` }); continue; }
    eligible.push({ userId: id, name: record.member.name || id, category: record.classification.category, label: record.classification.label, score: record.classification.score, reasons: record.classification.reasons });
  }
  if (!eligible.length) return { ok: false, status: 409, message: "所选成员均不符合清理预览条件。", excluded };
  const token = crypto.randomUUID();
  const preview = { token, groupId: cleanId(groupId), actorId: cleanId(authed?.qq), eligible, excluded, offset: 0, succeeded: 0, failed: 0, createdAt: Date.now(), expiresAt: Date.now() + PREVIEW_TTL_MS };
  await dbPut(env, `${PREVIEW_PREFIX}${token}`, JSON.stringify(preview));
  return { ok: true, preview, confirmText: `确认清理 ${eligible.length} 人`, message: `预览完成：可清理 ${eligible.length} 人，排除 ${excluded.length} 人。` };
}

async function claimPreviewToken(env, token, groupId, actorId, confirmationText) {
  const key = `${PREVIEW_PREFIX}${String(token || "")}`;
  const raw = await dbGet(env, key);
  if (!raw || !env?.DB) return { ok: false, status: 409, message: "清理预览不存在、已过期、正在使用或不属于当前账号，请重新建立预览。" };
  let preview = null;
  try { preview = JSON.parse(raw); } catch { return { ok: false, status: 409, message: "清理预览资料损坏，请重新建立预览。" }; }
  if (preview.claimedAt || preview.claimId) return { ok: false, status: 409, message: "这张清理预览已被使用，请勿重复提交。" };
  if (preview.groupId !== cleanId(groupId) || preview.actorId !== cleanId(actorId) || Number(preview.expiresAt || 0) < Date.now()) {
    return { ok: false, status: 409, message: "清理预览不存在、已过期或不属于当前账号，请重新建立预览。" };
  }
  const expected = `确认清理 ${preview.eligible.length} 人`;
  if (String(confirmationText || "").trim() !== expected) return { ok: false, status: 400, message: `请输入：${expected}` };
  const claimId = crypto.randomUUID();
  const claimed = JSON.stringify({ ...preview, claimedAt: Date.now(), claimId });
  const result = await env.DB.prepare("UPDATE kv_store SET value = ? WHERE key = ? AND value = ?").bind(claimed, key, raw).run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes !== 1) return { ok: false, status: 409, message: "这张清理预览已被使用，请勿重复提交。" };
  await dbDel(env, key);
  return { ok: true, preview };
}

async function executeCleanup(env, groupId, authed, body, helpers) {
  const token = String(body?.token || "");
  const claim = await claimPreviewToken(env, token, groupId, authed?.qq, body?.confirmationText);
  if (!claim.ok) return claim;
  const preview = claim.preview;
  const policy = await readPolicy(env, groupId);
  const [profiles, relationships, liveHonors] = await Promise.all([
    typeof helpers?.listMemberProfileSummaries === "function" ? helpers.listMemberProfileSummaries(env, groupId) : {},
    typeof helpers?.listGroupBindings === "function" ? helpers.listGroupBindings(env, groupId) : [],
    fetchHonors(env, groupId)
  ]);
  const related = relationshipUsers(relationships);
  const start = Math.max(0, Math.trunc(Number(preview.offset || 0)));
  const end = Math.min(preview.eligible.length, start + EXECUTE_CHUNK_SIZE);
  const chunk = preview.eligible.slice(start, end);
  const results = await runPool(chunk, Math.min(3, chunk.length || 1), async requested => {
    const userId = cleanId(requested.userId);
    try {
      const member = await liveMember(env, groupId, userId);
      const context = { profile: profiles?.[userId] || null, honors: liveHonors.get(userId) || [], hasRelationship: related.has(userId), isDeveloper: isDeveloperId(env, userId) };
      const classification = classifyMemberForCleanup(member, context, policy);
      if (classification.protected || member.role !== "member" || member.isRobot || !["cleanup_candidate", "review"].includes(classification.recommendation)) {
        throw new Error(`即时复核不通过：${classification.reasons.join("；") || classification.label}`);
      }
      await callOneBotAction(env, { action: "set_group_kick", params: { group_id: numericId(groupId), user_id: numericId(userId), reject_add_request: false } }, 15000);
      return { userId, ok: true, name: member.name || userId };
    } catch (error) {
      return { userId, ok: false, error: String(error?.message || error).slice(0, 300) };
    }
  });
  const chunkSucceeded = results.filter(item => item.ok).length;
  const chunkFailed = results.length - chunkSucceeded;
  const succeeded = Number(preview.succeeded || 0) + chunkSucceeded;
  const failed = Number(preview.failed || 0) + chunkFailed;
  let continuationToken = "";
  if (end < preview.eligible.length) {
    continuationToken = crypto.randomUUID();
    const continuation = { ...preview, token: continuationToken, offset: end, succeeded, failed, expiresAt: Date.now() + PREVIEW_TTL_MS };
    delete continuation.claimedAt;
    delete continuation.claimId;
    await dbPut(env, `${PREVIEW_PREFIX}${continuationToken}`, JSON.stringify(continuation));
  }
  await writeSystemAudit(env, {
    type: continuationToken ? "portal_member_cleanup_execute_chunk" : "portal_member_cleanup_execute",
    groupId: cleanId(groupId),
    actorId: cleanId(authed?.qq),
    action: "kick_reviewed_members",
    requested: preview.eligible.length,
    processedFrom: start,
    processedTo: end,
    chunkSucceeded,
    chunkFailed,
    succeeded,
    failed,
    completed: !continuationToken,
    targets: results.map(item => item.userId)
  }).catch(() => {});
  return {
    ok: true,
    completed: !continuationToken,
    continuationToken,
    processed: end,
    total: preview.eligible.length,
    remaining: Math.max(0, preview.eligible.length - end),
    succeeded,
    failed,
    message: continuationToken
      ? `清理处理中：已处理 ${end}/${preview.eligible.length} 人，累计成功 ${succeeded}，失败 ${failed}。`
      : `清理执行完成：成功 ${succeeded}，失败 ${failed}。`,
    results
  };
}

async function handleMemberCleanupApi(request, env, url, path, body, authed, helpers = {}) {
  if (!path.startsWith("/members/cleanup")) return null;
  const groupId = cleanId(authed?.groupId);
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);

  if (request.method === "GET" && path === "/members/cleanup") {
    const policy = await readPolicy(env, groupId);
    const records = await buildRecords(env, groupId, helpers, policy);
    const meta = await readJsonValue(env, metaKey(groupId), {});
    return jsonResponse({ ok: true, policy, meta, records, summary: buildCleanupSummary(records), permissions: { sync: canExecuteCleanup(authed), execute: canExecuteCleanup(authed) }, generatedAt: Date.now() });
  }

  if (request.method === "POST" && path === "/members/cleanup/policy") {
    if (!canExecuteCleanup(authed)) return jsonResponse({ ok: false, message: "没有修改清人策略的权限。" }, 403);
    const policy = await writePolicy(env, groupId, body || {});
    await writeSystemAudit(env, { type: "portal_member_cleanup_policy", groupId, actorId: cleanId(authed?.qq), action: "update", policy }).catch(() => {});
    return jsonResponse({ ok: true, message: "清人分类阈值已保存。", policy });
  }

  if (request.method === "POST" && path === "/members/cleanup/sync") {
    if (!canExecuteCleanup(authed)) return jsonResponse({ ok: false, message: "没有同步群成员资料的权限。" }, 403);
    try {
      const mode = String(body?.mode || "fast");
      const result = mode === "deep" ? await deepSync(env, groupId, body?.userIds) : await fastSync(env, groupId);
      await writeSystemAudit(env, { type: "portal_member_cleanup_sync", groupId, actorId: cleanId(authed?.qq), action: mode, count: mode === "deep" ? result.updated.length : result.snapshots.length, failed: mode === "deep" ? result.failed.length : 0 }).catch(() => {});
      return jsonResponse({ ok: true, message: mode === "deep" ? `深度补全完成：成功 ${result.updated.length}，失败 ${result.failed.length}。` : `已同步 ${result.snapshots.length} 位群成员及群荣誉资料。`, result });
    } catch (error) {
      return jsonResponse({ ok: false, message: `同步失败：${String(error?.message || error).slice(0, 500)}` }, 502);
    }
  }

  if (request.method === "POST" && path === "/members/cleanup/preview") {
    if (!canExecuteCleanup(authed)) return jsonResponse({ ok: false, message: "没有建立清理预览的权限。" }, 403);
    const result = await createCleanupPreview(env, groupId, authed, body, helpers);
    return jsonResponse(result, result.status || 200);
  }

  if (request.method === "POST" && path === "/members/cleanup/execute") {
    if (!canExecuteCleanup(authed)) return jsonResponse({ ok: false, message: "没有执行清理的权限。" }, 403);
    const result = await executeCleanup(env, groupId, authed, body, helpers);
    return jsonResponse(result, result.status || 200);
  }

  return jsonResponse({ ok: false, message: "未知群成员清理接口。" }, 404);
}

function injectMemberCleanupClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-member-cleanup-client")) return source;
  const dataRoot = '<div id="memberDataRoot"><div class="empty">尚未读取成员详细资料</div></div>';
  const cleanupRoot = '<div id="memberCleanupRoot"><div class="empty">尚未读取清人分析</div></div>';
  const legacyAnchor = '<div id="memberList" class="list"><div class="empty">尚未读取群友列表</div></div>';
  const dataPanel = `
  <div class="card member-data-console">
    <div class="section-head compact"><div><h3>成员资料补全</h3><p>先快速同步名单，再按需逐人读取无缓存群资料；性别或年龄缺失时会尝试陌生人资料接口。QQ／NapCat 未提供的字段会明确标示，不会伪造。</p></div><div class="cleanup-head-actions"><button id="cleanupRefresh" class="btn ghost">刷新资料</button><button id="cleanupFastSync" class="btn">快速同步</button><button id="cleanupDeepAll" class="btn">补全全部</button><button id="cleanupDeepSync" class="btn ghost">深度补全所选</button></div></div>
    <div class="member-data-toolbar"><div class="field"><label>搜索</label><input id="memberDataSearch" placeholder="昵称、群名片或 QQ"></div><label class="member-toggle"><input id="memberDataMissingOnly" type="checkbox">只看平台未提供字段</label><button id="memberDataSelectAll" class="btn ghost">选择当前结果</button><button id="cleanupExport" class="btn ghost">导出完整 CSV</button></div>
    <div class="notice" id="memberDataStatus">未同步。快速同步不会覆盖先前已补全资料。</div>
    <div id="memberDataList" class="list"><div class="empty">尚无成员资料</div></div>
  </div>`;
  const cleanupPanel = `
  <div class="card cleanup-console">
    <div class="section-head compact"><div><h3>清人分析</h3><p>这里只显示分类、分数与清理理由；完整个人字段已移至“成员资料”。所选清理人数不设上限，执行前仍需预览、即时复核及确认文字。</p></div></div>
    <div class="cleanup-summary" id="cleanupSummary"><div class="empty">尚未同步清人资料</div></div>
    <div class="cleanup-policy">
      <div class="field"><label>活跃天数</label><input id="cleanupActiveDays" type="number" min="1" max="180" value="30"></div>
      <div class="field"><label>轻度潜水上限</label><input id="cleanupCoolingDays" type="number" min="7" max="365" value="90"></div>
      <div class="field"><label>沉睡门槛</label><input id="cleanupDormantDays" type="number" min="30" max="730" value="180"></div>
      <div class="field"><label>超长期门槛</label><input id="cleanupLongDormantDays" type="number" min="60" max="1825" value="365"></div>
      <label class="member-toggle"><input id="cleanupProtectHonors" type="checkbox" checked>群荣誉默认保留</label>
      <label class="member-toggle"><input id="cleanupProtectRelationships" type="checkbox" checked>关系成员默认保留</label>
      <button id="cleanupSavePolicy" class="btn ghost">保存阈值</button>
    </div>
    <div class="cleanup-filters"><div class="field"><label>分类</label><select id="cleanupCategory"><option value="">全部</option><option value="cleanup_candidate">清理候选</option><option value="review">人工复核</option><option value="watch">观察</option><option value="keep">保留</option><option value="protected">受保护</option><option value="sync_first">资料不足</option></select></div><div class="field"><label>搜索</label><input id="cleanupSearch" placeholder="昵称、群名片或 QQ"></div><label class="member-toggle"><input id="cleanupHideProtected" type="checkbox" checked>隐藏受保护成员</label><button id="cleanupSelectCandidates" class="btn ghost">选择全部候选</button><button id="cleanupPreview" class="btn danger">建立清理预览</button></div>
    <div class="notice" id="cleanupStatus">尚未读取分析。</div>
    <div id="cleanupList" class="list"><div class="empty">尚无分析资料</div></div>
    <div id="cleanupExecutePanel" class="cleanup-execute hidden"><div id="cleanupPreviewText" class="notice"></div><div class="field"><label>输入确认文字</label><input id="cleanupConfirmationText" placeholder="例如：确认清理 3 人"></div><button id="cleanupExecute" class="btn danger">执行已复核清理</button></div>
  </div>`;
  if (source.includes(dataRoot)) source = source.replace(dataRoot, dataPanel);
  if (source.includes(cleanupRoot)) source = source.replace(cleanupRoot, cleanupPanel);
  if (!source.includes('id="memberDataList"') && source.includes(legacyAnchor)) source = source.replace(legacyAnchor, dataPanel + cleanupPanel + legacyAnchor);
  const style = `<style id="qqai-member-cleanup-style">
.cleanup-console,.member-data-console{margin-bottom:16px}.cleanup-head-actions,.cleanup-filters,.member-data-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.cleanup-summary{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:10px;margin:12px 0}.cleanup-stat{padding:10px;border:1px solid var(--line);border-radius:8px}.cleanup-stat b{display:block;font-size:22px}.cleanup-policy{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr)) auto auto auto;gap:10px;align-items:end;margin:12px 0}.cleanup-filters,.member-data-toolbar{margin:12px 0}.cleanup-filters .field,.member-data-toolbar .field{min-width:180px;margin:0}.cleanup-row{display:grid;grid-template-columns:auto minmax(220px,1.25fr) minmax(140px,.7fr) minmax(260px,1.3fr);gap:12px;align-items:start}.member-data-row{display:grid;grid-template-columns:auto minmax(190px,.9fr) minmax(300px,1.5fr);gap:12px;align-items:start}.cleanup-score{font-size:20px;font-weight:800}.cleanup-reasons,.member-data-fields{font-size:12px;color:var(--muted);line-height:1.65;white-space:pre-wrap}.member-data-source{font-size:12px;font-weight:700;margin-top:6px}.field-unavailable{color:#b45309}.cleanup-execute{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}@media(max-width:1000px){.cleanup-summary,.cleanup-policy,.cleanup-row,.member-data-row{grid-template-columns:1fr}.cleanup-head-actions .btn,.cleanup-filters .btn,.member-data-toolbar .btn{flex:1 1 140px}}
</style>`;
  source = source.includes("</head>") ? source.replace("</head>", style + "\n</head>") : style + source;
  const script = `<script id="qqai-member-cleanup-client">
(function(){
  var cleanupRecords=[],cleanupPolicy={},cleanupPermissions={},cleanupPreviewToken='',cleanupConfirmText='';
  function ce(id){return document.getElementById(id)}
  function cs(value){return typeof esc==='function'?esc(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  async function cc(path,method,body){try{if(typeof api==='function')return await api(path,method||'GET',body);var r=await fetch('/api/portal'+path,{method:method||'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});var t=await r.text(),d={};try{d=t?JSON.parse(t):{}}catch(e){d={ok:false,message:'接口返回格式错误'}}if(!r.ok)d.ok=false;return d}catch(e){return{ok:false,message:String(e&&e.message||e)}}}
  function cn(message){if(typeof toast==='function')toast(message);else window.alert(message)}
  function cd(value){var n=Number(value||0);return n?new Date(n).toLocaleString():'未提供'}
  function cdays(value){return value==null?'未提供':String(value)+' 天'}
  function sexText(value){return value==='male'?'男':value==='female'?'女':'平台未提供'}
  function titleText(m){if(!m.title)return'无专属头衔';return m.titleExpireTime?m.title+'｜到期 '+cd(m.titleExpireTime):m.title+'｜期限永久或平台未提供'}
  function honorsText(m){var list=(m.honors||[]).map(function(x){return x.description||x.type}).filter(Boolean);if(list.length)return list.join('、');return m.honorSyncOk===false?'群荣誉接口读取失败':'无已授予群荣誉'}
  function unavailable(value,empty){return value?String(value):(empty||'平台未提供')}
  function cselected(){return Array.prototype.slice.call(document.querySelectorAll('.cleanup-select:checked')).map(function(n){return n.value})}
  function dataSelected(){return Array.prototype.slice.call(document.querySelectorAll('.member-data-select:checked')).map(function(n){return n.value})}
  function policyFromInputs(){return{activeDays:Number(ce('cleanupActiveDays')&&ce('cleanupActiveDays').value||30),coolingDays:Number(ce('cleanupCoolingDays')&&ce('cleanupCoolingDays').value||90),dormantDays:Number(ce('cleanupDormantDays')&&ce('cleanupDormantDays').value||180),longDormantDays:Number(ce('cleanupLongDormantDays')&&ce('cleanupLongDormantDays').value||365),protectHonors:!!(ce('cleanupProtectHonors')&&ce('cleanupProtectHonors').checked),protectRelationships:!!(ce('cleanupProtectRelationships')&&ce('cleanupProtectRelationships').checked)}}
  function applyPolicy(p){cleanupPolicy=p||{};if(ce('cleanupActiveDays'))ce('cleanupActiveDays').value=p.activeDays||30;if(ce('cleanupCoolingDays'))ce('cleanupCoolingDays').value=p.coolingDays||90;if(ce('cleanupDormantDays'))ce('cleanupDormantDays').value=p.dormantDays||180;if(ce('cleanupLongDormantDays'))ce('cleanupLongDormantDays').value=p.longDormantDays||365;if(ce('cleanupProtectHonors'))ce('cleanupProtectHonors').checked=p.protectHonors!==false;if(ce('cleanupProtectRelationships'))ce('cleanupProtectRelationships').checked=p.protectRelationships!==false}
  function renderSummary(summary){var root=ce('cleanupSummary');if(!root)return;var items=[['总人数',summary.total],['受保护',summary.protected],['保留',summary.keep],['观察',summary.watch],['人工复核',summary.review],['清理候选',summary.cleanupCandidates]];root.innerHTML=items.map(function(i){return'<div class="cleanup-stat"><span>'+cs(i[0])+'</span><b>'+cs(i[1]||0)+'</b></div>'}).join('')}
  function filtered(){var query=String(ce('cleanupSearch')&&ce('cleanupSearch').value||'').toLowerCase(),category=String(ce('cleanupCategory')&&ce('cleanupCategory').value||''),hide=!!(ce('cleanupHideProtected')&&ce('cleanupHideProtected').checked);return cleanupRecords.filter(function(r){var m=r.member||{},c=r.classification||{};if(query&&[m.qq,m.name,m.nickname,m.card].every(function(v){return String(v||'').toLowerCase().indexOf(query)<0}))return false;if(category&&String(c.recommendation)!==category&&String(c.category)!==category)return false;if(hide&&c.protected)return false;return true})}
  function renderCleanup(){var root=ce('cleanupList');if(!root)return;root.innerHTML=filtered().map(function(r){var m=r.member||{},c=r.classification||{};return'<div class="item cleanup-row"><label><input class="cleanup-select" type="checkbox" value="'+cs(m.qq)+'" '+((c.recommendation==='cleanup_candidate'||c.recommendation==='review')&&!c.protected?'':'disabled')+'></label><div><div class="member-name">'+cs(m.name||m.qq)+'</div><div class="member-meta">QQ '+cs(m.qq)+'｜'+cs(m.role||'member')+'｜入群 '+cs(cd(m.joinTime))+'｜最后发言 '+cs(cd(m.lastSentTime))+'</div></div><div><div class="cleanup-score">'+cs(c.score||0)+'</div><b>'+cs(c.label||c.category)+'</b><div class="member-meta">入群 '+cs(cdays(c.joinDays))+'｜未发言 '+cs(cdays(c.inactiveDays))+'</div></div><div class="cleanup-reasons">'+cs((c.reasons||[]).join('；')||'无分类理由')+'</div></div>'}).join('')||'<div class="empty">没有符合筛选条件的成员</div>'}
  function renderMemberData(){var root=ce('memberDataList');if(!root)return;var q=String(ce('memberDataSearch')&&ce('memberDataSearch').value||'').toLowerCase(),missingOnly=!!(ce('memberDataMissingOnly')&&ce('memberDataMissingOnly').checked);var rows=cleanupRecords.filter(function(r){var m=r.member||{},missing=(m.missingFields||[]).length;if(q&&[m.qq,m.name,m.nickname,m.card].every(function(v){return String(v||'').toLowerCase().indexOf(q)<0}))return false;if(missingOnly&&!missing)return false;return true});root.innerHTML=rows.map(function(r){var m=r.member||{},missing=m.missingFields||[],fields='群等级：'+unavailable(m.level)+'｜QQ等级：'+unavailable(m.qqLevel)+'\\n专属头衔：'+titleText(m)+'\\n地区：'+unavailable(m.area)+'｜年龄：'+unavailable(m.age)+'｜性别：'+sexText(m.sex)+'\\n群荣誉：'+honorsText(m);var sources=(m.dataSources||[]).join('、')||'旧缓存';var warning=m.supplementWarning?('｜补全警告：'+m.supplementWarning):'';return'<div class="item member-data-row"><label><input class="member-data-select" type="checkbox" value="'+cs(m.qq)+'"></label><div><div class="member-name">'+cs(m.name||m.qq)+'</div><div class="member-meta">QQ '+cs(m.qq)+'｜'+cs(m.role||'member')+'｜'+cs(m.syncMode||'未同步')+'</div><div class="member-data-source">来源：'+cs(sources)+cs(warning)+'</div></div><div class="member-data-fields">'+cs(fields)+(missing.length?'\\n平台未提供：'+cs(missing.join('、')):'')+'</div></div>'}).join('')||'<div class="empty">没有符合条件的成员资料</div>'}
  async function loadCleanup(){var ds=ce('memberDataStatus'),status=ce('cleanupStatus');if(ds)ds.textContent='正在读取成员资料…';if(status)status.textContent='正在读取分析资料…';var r=await cc('/members/cleanup');if(!r.ok){if(ds)ds.textContent=r.message||'读取失败';if(status)status.textContent=r.message||'读取失败';return}cleanupRecords=r.records||[];cleanupPermissions=r.permissions||{};applyPolicy(r.policy||{});renderSummary(r.summary||{});renderCleanup();renderMemberData();var meta=r.meta||{},time=Math.max(meta.fastSyncedAt||0,meta.deepSyncedAt||0);if(ds)ds.textContent='资料 '+cleanupRecords.length+' 人｜最近模式 '+String(meta.lastMode||'未同步')+'｜深度保留 '+String(meta.deepPreservedCount||0)+'｜群荣誉 '+String(meta.honorMemberCount||0)+' 人｜更新时间 '+cd(time)+(meta.honorSyncOk===false?'｜群荣誉接口失败：'+String(meta.honorSyncWarning||'未知错误'):'');if(status)status.textContent='分析完成｜快照 '+cleanupRecords.length+' 人｜更新时间 '+cd(time)}
  async function fastSync(){var r=await cc('/members/cleanup/sync','POST',{mode:'fast'});cn(r.message||'同步完成');if(r.ok)loadCleanup()}
  async function deepSyncSelected(){var ids=dataSelected();if(!ids.length){cn('请先在成员资料页勾选成员');return}var r=await cc('/members/cleanup/sync','POST',{mode:'deep',userIds:ids.slice(0,30)});cn(r.message||'补全完成');if(r.ok)loadCleanup()}
  async function deepSyncAll(){var ids=cleanupRecords.filter(function(r){var m=r.member||{};return !String(m.syncMode||'').includes('deep')||(m.missingFields||[]).length}).map(function(r){return r.member.qq});if(!ids.length)ids=cleanupRecords.map(function(r){return r.member.qq});if(!ids.length){cn('没有可补全成员');return}var status=ce('memberDataStatus'),ok=0,failed=0;for(var i=0;i<ids.length;i+=30){if(status)status.textContent='正在补全 '+String(Math.min(i+30,ids.length))+'/'+String(ids.length)+' 人…';var r=await cc('/members/cleanup/sync','POST',{mode:'deep',userIds:ids.slice(i,i+30)});if(!r.ok){failed+=Math.min(30,ids.length-i);continue}ok+=Number(r.result&&r.result.updated&&r.result.updated.length||0);failed+=Number(r.result&&r.result.failed&&r.result.failed.length||0)}cn('全部补全完成：成功 '+ok+'，失败 '+failed);loadCleanup()}
  async function savePolicy(){var r=await cc('/members/cleanup/policy','POST',policyFromInputs());cn(r.message||'保存完成');if(r.ok)loadCleanup()}
  function selectCandidates(){document.querySelectorAll('.cleanup-select:not(:disabled)').forEach(function(n){n.checked=true})}
  function selectData(){document.querySelectorAll('.member-data-select').forEach(function(n){n.checked=true})}
  function exportCleanup(){var rows=[['QQ','名称','身份','分类','建议','分数','入群时间','最后发言时间','群等级','QQ等级','专属头衔','头衔到期','地区','年龄','性别','群荣誉','分类理由','抓取模式','资料来源','平台未提供字段','原始字段']];cleanupRecords.forEach(function(r){var m=r.member||{},c=r.classification||{};rows.push([m.qq,m.name,m.role,c.label,c.recommendation,c.score,cd(m.joinTime),cd(m.lastSentTime),m.level,m.qqLevel,m.title,m.titleExpireTime?cd(m.titleExpireTime):(m.title?'永久或平台未提供':'无专属头衔'),m.area,m.age,m.sex,(m.honors||[]).map(function(x){return x.type}).join('|'),(c.reasons||[]).join('|'),m.syncMode,(m.dataSources||[]).join('|'),(m.missingFields||[]).join('|'),(m.rawFields||[]).join('|')])});function cell(v){return'"'+String(v==null?'':v).replace(/"/g,'""')+'"'}var csv='\\ufeff'+rows.map(function(row){return row.map(cell).join(',')}).join('\\r\\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='群成员完整资料-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
  async function previewCleanup(){var ids=cselected();if(!ids.length){cn('请先选择候选成员');return}var r=await cc('/members/cleanup/preview','POST',{userIds:ids});cn(r.message||'预览完成');if(!r.ok)return;cleanupPreviewToken=r.preview.token;cleanupConfirmText=r.confirmText;var panel=ce('cleanupExecutePanel'),text=ce('cleanupPreviewText'),input=ce('cleanupConfirmationText');if(panel)panel.classList.remove('hidden');if(text)text.textContent='可清理 '+r.preview.eligible.length+' 人；排除 '+r.preview.excluded.length+' 人。请输入：'+r.confirmText;if(input){input.value='';input.placeholder=r.confirmText}}
  async function executeCleanup(){if(!cleanupPreviewToken){cn('请先建立清理预览');return}var text=String(ce('cleanupConfirmationText')&&ce('cleanupConfirmationText').value||'');if(text!==cleanupConfirmText){cn('确认文字不正确，应为：'+cleanupConfirmText);return}var button=ce('cleanupExecute'),status=ce('cleanupPreviewText'),token=cleanupPreviewToken,previousToken='',last=null;if(button)button.disabled=true;while(token){if(token===previousToken){cn('服务器返回重复续传凭证，已停止以避免重复操作');break}previousToken=token;var r=await cc('/members/cleanup/execute','POST',{token:token,confirmationText:text});last=r;if(!r.ok){cn(r.message||'执行失败');break}token=String(r.continuationToken||'');cleanupPreviewToken=token;if(status)status.textContent=r.message||('已处理 '+String(r.processed||0)+'/'+String(r.total||0)+' 人')}if(button)button.disabled=false;if(last&&last.completed){cn(last.message||'执行完成');cleanupPreviewToken='';cleanupConfirmText='';ce('cleanupExecutePanel')&&ce('cleanupExecutePanel').classList.add('hidden');if(typeof window.qqaiLoadMembers==='function')window.qqaiLoadMembers();loadCleanup()}else if(token){cn('清理尚未完成，可再次点击继续处理剩余成员。')}}
  document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('button'):e.target;if(!t)return;if(t.id==='cleanupRefresh'||t.id==='memberDataNav'||t.id==='memberCleanupNav')setTimeout(loadCleanup,0);else if(t.id==='cleanupFastSync')fastSync();else if(t.id==='cleanupDeepAll')deepSyncAll();else if(t.id==='cleanupDeepSync')deepSyncSelected();else if(t.id==='memberDataSelectAll')selectData();else if(t.id==='cleanupSavePolicy')savePolicy();else if(t.id==='cleanupSelectCandidates')selectCandidates();else if(t.id==='cleanupExport')exportCleanup();else if(t.id==='cleanupPreview')previewCleanup();else if(t.id==='cleanupExecute')executeCleanup()});
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='cleanupSearch')renderCleanup();if(e.target&&e.target.id==='memberDataSearch')renderMemberData()});document.addEventListener('change',function(e){if(e.target&&['cleanupCategory','cleanupHideProtected'].indexOf(e.target.id)>=0)renderCleanup();if(e.target&&e.target.id==='memberDataMissingOnly')renderMemberData()});
  window.qqaiLoadCleanup=loadCleanup;var oldLoad=window.qqaiLoadMembers;window.qqaiLoadMembers=async function(){if(typeof oldLoad==='function')await oldLoad();setTimeout(loadCleanup,0)};if(['v-member-data','v-member-cleanup'].some(function(id){var v=ce(id);return v&&v.classList.contains('active')}))setTimeout(loadCleanup,0)
})();
</script>`;
  return source.includes("</body>") ? source.replace("</body>", script + "\n</body>") : source + script;
}


export {
  DEFAULT_POLICY,
  buildCleanupSummary,
  categoryLabel,
  classifyMemberForCleanup,
  handleMemberCleanupApi,
  honorMapFromResponse,
  injectMemberCleanupClient,
  mergeRawMember,
  normalizeFullMember,
  normalizeSex,
  preserveEnrichedMember,
  normalizePolicy,
  normalizeRequestedMemberIds
};
