import { developerId } from "../core/identity.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbGet, dbPut } from "../data/store.js";
import { numericId } from "../security/network.js";

const ROUTING_KEY_PREFIX = "human_notification_routing:";
const NOTIFICATION_ROUTE_MODES = Object.freeze(["managers", "developer", "none", "owner"]);

const NOTIFICATION_EVENT_DEFINITIONS = Object.freeze([
  { id: "join_request_pending", label: "入群申请待人工审核", description: "AI 无法安全自动处理，或资料不足时通知。", defaultEnabled: true, defaultMode: "managers" },
  { id: "join_request_failed", label: "入群申请自动处理失败", description: "自动同意、拒绝或分群成员直通执行失败时通知。", defaultEnabled: true, defaultMode: "managers" },
  { id: "moderation_proposal", label: "群管理操作待确认", description: "Portal 建立禁言、踢出、管理员调整等待确认操作时通知。", defaultEnabled: true, defaultMode: "managers" },
  { id: "group_work_request", label: "群务请求待处理", description: "机器人建立需要管理人工决定的群务工作单时通知。", defaultEnabled: true, defaultMode: "managers" },
  { id: "appeal_created", label: "申诉待处理", description: "成员提交新的申诉对话串时通知。", defaultEnabled: true, defaultMode: "managers" },
  { id: "suggestion_created", label: "建议箱有新内容", description: "成员提交新建议时通知。", defaultEnabled: false, defaultMode: "managers" },
  { id: "bug_created", label: "问题追踪有新回报", description: "成员提交新问题追踪时通知。", defaultEnabled: true, defaultMode: "developer" },
  { id: "quality_feedback_created", label: "质量回报待处理", description: "成员提交新的质量回报时通知。", defaultEnabled: true, defaultMode: "managers" }
]);

const EVENT_BY_ID = new Map(NOTIFICATION_EVENT_DEFINITIONS.map(item => [item.id, item]));

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function cleanManagerIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(cleanId).filter(Boolean))].slice(0, 30);
}

function defaultRouteFor(definition) {
  return {
    enabled: definition.defaultEnabled !== false,
    mode: NOTIFICATION_ROUTE_MODES.includes(definition.defaultMode) ? definition.defaultMode : "none",
    managerIds: []
  };
}

function normalizeRoute(value, definition) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaultRouteFor(definition);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    mode: NOTIFICATION_ROUTE_MODES.includes(String(source.mode || "")) ? String(source.mode) : fallback.mode,
    managerIds: cleanManagerIds(source.managerIds)
  };
}

function normalizeNotificationRoutingConfig(value, groupId = "") {
  const source = value && typeof value === "object" ? value : {};
  const routes = {};
  for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
    routes[definition.id] = normalizeRoute(source?.routes?.[definition.id], definition);
  }
  return {
    version: 1,
    groupId: cleanId(source.groupId || groupId),
    ownerEnabled: source.ownerEnabled === true,
    routes,
    updatedAt: Number(source.updatedAt || 0),
    updatedBy: cleanId(source.updatedBy)
  };
}

function routingKey(groupId) {
  return `${ROUTING_KEY_PREFIX}${cleanId(groupId)}`;
}

async function readNotificationRoutingConfig(env, groupId) {
  const raw = await dbGet(env, routingKey(groupId));
  if (!raw) return normalizeNotificationRoutingConfig(null, groupId);
  try {
    return normalizeNotificationRoutingConfig(JSON.parse(raw), groupId);
  } catch {
    return normalizeNotificationRoutingConfig(null, groupId);
  }
}

async function listNotificationCandidates(env, groupId) {
  let source = [];
  let warning = "";
  let sourceType = "none";
  try {
    const response = await callOneBotAction(env, {
      action: "get_group_member_list",
      params: { group_id: numericId(groupId), no_cache: false }
    }, 20000);
    source = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
    if (source.length) sourceType = "onebot";
  } catch (error) {
    warning = `OneBot 管理名单读取失败：${String(error?.message || error).slice(0, 400)}`;
  }
  if (!source.length) {
    try {
      const cachedRaw = await dbGet(env, `group_members:${cleanId(groupId)}`);
      const cached = cachedRaw ? JSON.parse(String(cachedRaw)) : [];
      if (Array.isArray(cached) && cached.length) {
        source = cached;
        sourceType = "cache";
        warning = warning ? `${warning}；已使用 D1 群成员缓存。` : "OneBot 未返回成员名单，已使用 D1 群成员缓存。";
      }
    } catch (error) {
      if (!warning) warning = `群成员缓存读取失败：${String(error?.message || error).slice(0, 400)}`;
    }
  }
  const members = source.map(item => ({
    qq: cleanId(item?.user_id || item?.qq),
    name: String(item?.card || item?.nickname || item?.name || item?.user_id || item?.qq || "").slice(0, 200),
    role: String(item?.role || "member"),
    isRobot: Boolean(item?.is_robot || item?.isRobot)
  })).filter(item => item.qq && !item.isRobot);
  return {
    managers: members.filter(item => item.role === "admin"),
    owner: members.find(item => item.role === "owner") || null,
    members,
    warning,
    source: sourceType
  };
}

function selectNotificationRecipientIds({ route, ownerEnabled = false, managers = [], owner = null, developer = "" } = {}) {
  const normalizedRoute = {
    enabled: route?.enabled !== false,
    mode: NOTIFICATION_ROUTE_MODES.includes(String(route?.mode || "")) ? String(route.mode) : "none",
    managerIds: cleanManagerIds(route?.managerIds)
  };
  if (!normalizedRoute.enabled || normalizedRoute.mode === "none") return [];
  if (normalizedRoute.mode === "developer") return cleanId(developer) ? [cleanId(developer)] : [];
  if (normalizedRoute.mode === "owner") return ownerEnabled && cleanId(owner?.qq) ? [cleanId(owner.qq)] : [];
  const eligible = new Set((Array.isArray(managers) ? managers : []).map(item => cleanId(item?.qq || item)).filter(Boolean));
  const selected = normalizedRoute.managerIds.filter(id => eligible.has(id));
  return normalizedRoute.managerIds.length ? selected : [...eligible];
}

function resolveNotificationRecipientIds({ route, ownerEnabled = false, candidates = {}, developer = "" } = {}) {
  const resolved = selectNotificationRecipientIds({
    route,
    ownerEnabled,
    managers: candidates?.managers || [],
    owner: candidates?.owner || null,
    developer
  });
  if (resolved.length) return resolved;
  const explicitManagerIds = cleanManagerIds(route?.managerIds);
  if (route?.enabled !== false && String(route?.mode || "") === "managers" && candidates?.source === "none" && explicitManagerIds.length) {
    return explicitManagerIds;
  }
  return resolved;
}

async function saveNotificationRoutingConfig(env, groupId, value, actorId = "") {
  const current = await readNotificationRoutingConfig(env, groupId);
  const candidates = await listNotificationCandidates(env, groupId);
  const eligibleManagerIds = new Set(candidates.managers.map(item => item.qq));
  const requested = normalizeNotificationRoutingConfig({
    ...current,
    ...(value && typeof value === "object" ? value : {}),
    routes: { ...current.routes, ...(value?.routes || {}) },
    groupId,
    updatedAt: Date.now(),
    updatedBy: actorId
  }, groupId);
  if (candidates.source !== "none") {
    for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
      requested.routes[definition.id].managerIds = requested.routes[definition.id].managerIds.filter(id => eligibleManagerIds.has(id));
    }
  }
  await dbPut(env, routingKey(groupId), JSON.stringify(requested));
  await writeSystemAudit(env, {
    type: "human_notification_routing_updated",
    groupId: cleanId(groupId),
    actorId: cleanId(actorId),
    action: "save",
    ownerEnabled: requested.ownerEnabled,
    routes: Object.fromEntries(Object.entries(requested.routes).map(([key, route]) => [key, { enabled: route.enabled, mode: route.mode, managerIds: route.managerIds }]))
  }).catch(() => {});
  return requested;
}

async function getNotificationRoutingPortalState(env, groupId) {
  const [config, candidates] = await Promise.all([
    readNotificationRoutingConfig(env, groupId),
    listNotificationCandidates(env, groupId)
  ]);
  return {
    config,
    definitions: NOTIFICATION_EVENT_DEFINITIONS,
    modes: [
      { id: "managers", label: "指定管理员" },
      { id: "developer", label: "开发者" },
      { id: "none", label: "不通知" },
      { id: "owner", label: "群主" }
    ],
    managers: candidates.managers,
    owner: candidates.owner,
    developerId: cleanId(developerId(env)),
    warning: candidates.warning,
    candidateSource: candidates.source
  };
}

async function dispatchHumanAttentionNotification(env, { groupId, eventId, message, audit = {} } = {}) {
  const group = cleanId(groupId);
  const definition = EVENT_BY_ID.get(String(eventId || ""));
  if (!group || !definition) return { ok: false, skipped: true, reason: "unknown_event", eventId: String(eventId || "") };
  const [config, candidates] = await Promise.all([
    readNotificationRoutingConfig(env, group),
    listNotificationCandidates(env, group)
  ]);
  const route = config.routes[definition.id] || defaultRouteFor(definition);
  const recipientIds = resolveNotificationRecipientIds({
    route,
    ownerEnabled: config.ownerEnabled,
    candidates,
    developer: developerId(env)
  });
  const suppressedOwner = route.enabled && route.mode === "owner" && !config.ownerEnabled;
  if (!recipientIds.length) {
    const reason = !route.enabled || route.mode === "none" ? "disabled" : suppressedOwner ? "owner_not_enabled" : "no_valid_recipient";
    await writeSystemAudit(env, {
      type: "human_notification_skipped",
      groupId: group,
      actorId: String(audit.actorId || "system"),
      action: definition.id,
      eventId: definition.id,
      mode: route.mode,
      reason,
      ...audit
    }).catch(() => {});
    return { ok: true, skipped: true, reason, eventId: definition.id, mode: route.mode, recipientIds: [] };
  }

  const text = String(message || "").trim().slice(0, 3500);
  const results = [];
  for (const recipientId of recipientIds) {
    try {
      await callOneBotAction(env, {
        action: "send_private_msg",
        params: { user_id: numericId(recipientId), message: text, auto_escape: false }
      }, 12000);
      results.push({ recipientId, ok: true });
    } catch (error) {
      results.push({ recipientId, ok: false, error: String(error?.message || error).slice(0, 500) });
    }
  }
  const sent = results.filter(item => item.ok).map(item => item.recipientId);
  const failed = results.filter(item => !item.ok);
  await writeSystemAudit(env, {
    type: failed.length ? "human_notification_partial_failure" : "human_notification_dispatched",
    groupId: group,
    actorId: String(audit.actorId || "system"),
    action: definition.id,
    eventId: definition.id,
    mode: route.mode,
    recipientIds,
    sentRecipientIds: sent,
    failures: failed,
    ...audit
  }).catch(() => {});
  return {
    ok: sent.length > 0,
    skipped: false,
    eventId: definition.id,
    mode: route.mode,
    recipientIds,
    sentRecipientIds: sent,
    failures: failed,
    warning: candidates.warning || ""
  };
}

export {
  NOTIFICATION_EVENT_DEFINITIONS,
  NOTIFICATION_ROUTE_MODES,
  dispatchHumanAttentionNotification,
  getNotificationRoutingPortalState,
  listNotificationCandidates,
  normalizeNotificationRoutingConfig,
  readNotificationRoutingConfig,
  resolveNotificationRecipientIds,
  saveNotificationRoutingConfig,
  selectNotificationRecipientIds
};
