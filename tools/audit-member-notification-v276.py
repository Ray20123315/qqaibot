from pathlib import Path


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f"{label}: anchor not found")
    if text.find(start_marker, start + 1) >= 0:
        raise RuntimeError(f"{label}: start anchor is not unique")
    return text[:start] + replacement + text[end:]


routing_path = Path("src/notifications/routing.js")
routing = routing_path.read_text(encoding="utf-8")
if "function resolveNotificationRecipientIds" not in routing:
    list_replacement = r'''async function listNotificationCandidates(env, groupId) {
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

'''
    routing = replace_between(
        routing,
        "async function listNotificationCandidates(env, groupId) {",
        "function selectNotificationRecipientIds",
        list_replacement,
        "notification candidate source",
    )
    recipient_block = r'''function selectNotificationRecipientIds({ route, ownerEnabled = false, managers = [], owner = null, developer = "" } = {}) {
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

'''
    routing = replace_between(
        routing,
        "function selectNotificationRecipientIds",
        "async function saveNotificationRoutingConfig",
        recipient_block,
        "recipient resolver",
    )
    old_filter = '''  for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
    requested.routes[definition.id].managerIds = requested.routes[definition.id].managerIds.filter(id => eligibleManagerIds.has(id));
  }'''
    new_filter = '''  if (candidates.source !== "none") {
    for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
      requested.routes[definition.id].managerIds = requested.routes[definition.id].managerIds.filter(id => eligibleManagerIds.has(id));
    }
  }'''
    if routing.count(old_filter) != 1:
        raise RuntimeError("manager validation block is not unique")
    routing = routing.replace(old_filter, new_filter, 1)
    old_dispatch = '''  const recipientIds = selectNotificationRecipientIds({
    route,
    ownerEnabled: config.ownerEnabled,
    managers: candidates.managers,
    owner: candidates.owner,
    developer: developerId(env)
  });'''
    new_dispatch = '''  const recipientIds = resolveNotificationRecipientIds({
    route,
    ownerEnabled: config.ownerEnabled,
    candidates,
    developer: developerId(env)
  });'''
    if routing.count(old_dispatch) != 1:
        raise RuntimeError("dispatch recipient block is not unique")
    routing = routing.replace(old_dispatch, new_dispatch, 1)
    state_old = "    warning: candidates.warning\n  };"
    state_new = "    warning: candidates.warning,\n    candidateSource: candidates.source\n  };"
    if routing.count(state_old) != 1:
        raise RuntimeError("portal candidate source anchor is not unique")
    routing = routing.replace(state_old, state_new, 1)
    export_old = "  readNotificationRoutingConfig,\n  saveNotificationRoutingConfig,"
    export_new = "  readNotificationRoutingConfig,\n  resolveNotificationRecipientIds,\n  saveNotificationRoutingConfig,"
    if routing.count(export_old) != 1:
        raise RuntimeError("routing export anchor is not unique")
    routing = routing.replace(export_old, export_new, 1)
    routing_path.write_text(routing, encoding="utf-8")


details_path = Path("src/members/details.js")
details = details_path.read_text(encoding="utf-8")
old_entries = "  const entries = await Promise.all(Object.entries(keys).map(async ([name, key]) => [name, safeJsonParse(await dbGet(env, key), null)]));"
new_entries = '''  const entries = await Promise.all(Object.entries(keys).map(async ([name, key]) => {
    try { return [name, safeJsonParse(await dbGet(env, key), null)]; }
    catch (error) { return [name, { readError: String(error?.message || error).slice(0, 500) }]; }
  }));'''
if old_entries in details:
    details = details.replace(old_entries, new_entries, 1)
details = details.replace(
    "      unfriendly: Boolean(liveMember.unfriendly ?? stored?.snapshot?.unfriendly),",
    "      unfriendly: liveMember.unfriendly ?? stored?.snapshot?.unfriendly ?? null,",
    1,
)
details = details.replace(
    "      isRobot: Boolean(liveMember.is_robot || liveMember.isRobot || stored?.snapshot?.isRobot || stored?.cachedMember?.isRobot)",
    "      isRobot: liveMember.is_robot ?? liveMember.isRobot ?? stored?.snapshot?.isRobot ?? stored?.cachedMember?.isRobot ?? null",
    1,
)
details_path.write_text(details, encoding="utf-8")


worker_path = Path("worker.js")
worker = worker_path.read_text(encoding="utf-8")
if "!详细资料 [@成员]" not in worker:
    anchor = '                      `!查成分 [@成员] (AI属性分析)\\n` +\n'
    help_line = '                      `!详细资料 [@成员]（本人可查自己；查询他人仅限管理、群主、获授群操作权限者或开发者）\\n` +\n'
    if worker.count(anchor) != 1:
        raise RuntimeError("help insertion anchor is not unique")
    worker = worker.replace(anchor, anchor + help_line, 1)
    worker_path.write_text(worker, encoding="utf-8")


member_test_path = Path("verify-member-details.mjs")
member_test = member_test_path.read_text(encoding="utf-8")
if "member_full_details command integration" not in member_test:
    member_test = member_test.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport fs from "node:fs";\n',
        1,
    )
    marker = '\nconsole.log("verify-member-details: ok");\n'
    additions = '''
const workerSource = fs.readFileSync("worker.js", "utf8");
assert.match(workerSource, /fullMemberDetailsMatch/, "member_full_details command integration must exist");
assert.match(workerSource, /reply_kind: "member_full_details"/);
assert.match(workerSource, /!详细资料 \[@成员\]/, "help must document the privileged full-detail command");
assert.match(workerSource, /permissions: permissionSet/);
'''
    if member_test.count(marker) != 1:
        raise RuntimeError("member test completion marker is not unique")
    member_test = member_test.replace(marker, additions + marker, 1)
    member_test_path.write_text(member_test, encoding="utf-8")


routing_test_path = Path("verify-notification-routing.mjs")
routing_test = routing_test_path.read_text(encoding="utf-8")
if "configured recipients survive a temporary directory outage" not in routing_test:
    routing_test = routing_test.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport fs from "node:fs";\n',
        1,
    )
    routing_test = routing_test.replace(
        "  normalizeNotificationRoutingConfig,\n  selectNotificationRecipientIds",
        "  normalizeNotificationRoutingConfig,\n  resolveNotificationRecipientIds,\n  selectNotificationRecipientIds",
        1,
    )
    marker = '\nconsole.log("verify-notification-routing: ok");\n'
    additions = '''
assert.deepEqual(resolveNotificationRecipientIds({
  route: { enabled: true, mode: "managers", managerIds: ["10002"] },
  candidates: { managers: [], owner: null, source: "none" },
  developer: "90001"
}), ["10002"], "configured recipients survive a temporary directory outage");

const routingSource = fs.readFileSync("src/notifications/routing.js", "utf8");
const portalSource = fs.readFileSync("src/portal/notification-routing.js", "utf8");
const moderationSource = fs.readFileSync("src/moderation/runtime.js", "utf8");
const operationsSource = fs.readFileSync("src/operations/runtime.js", "utf8");
assert.match(routingSource, /group_members:/, "D1 member cache must back up live manager discovery");
assert.match(routingSource, /candidates\.source !== "none"/, "saving during a directory outage must preserve configured manager IDs");
assert.match(portalSource, /\/notification-routing/);
assert.match(portalSource, /notificationOwnerEnabled/);
for (const eventId of ["join_request_pending", "join_request_failed", "group_work_request"]) assert.match(moderationSource, new RegExp(eventId));
for (const eventId of ["appeal_created", "suggestion_created", "bug_created", "quality_feedback_created"]) assert.match(operationsSource, new RegExp(eventId));
'''
    if routing_test.count(marker) != 1:
        raise RuntimeError("routing test completion marker is not unique")
    routing_test = routing_test.replace(marker, additions + marker, 1)
    routing_test_path.write_text(routing_test, encoding="utf-8")

print("audit-member-notification-v276: applied or already current")
