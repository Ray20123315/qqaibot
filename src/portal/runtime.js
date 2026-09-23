// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { baseGoogleApiKeys, deepSeekApiKeys, effectiveRuntimeModels, geminiSearchApiKeys, geminiVisionApiKeys, getQuotaNumber, googleApiKeysFor, imageInspectionEnabled, immutableRuntimeModelDefaults, listDeepSeekEmergencyWindows, normalizeRuntimeModelKind, notifyDeveloper, parseList, partitionGoogleApiKeys, readCustomRuntimeModels, roundRobinKeys, runtimeModelRegistryState, taipeiDateKey, validRuntimeModelId, writeCustomRuntimeModels } from "../ai/runtime.js";
import { AI_MEDIA_LIMITS, DEFAULTS, PLATFORM_FEATURE_COUNT, VERSION } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { appendIndex, callOneBotAction, enrichAuditLogsForPortal, getEffectivePermissions, getRuntimeRateLimitSeconds, listAiDecisionLogs, listExplicitProgramPermissions, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, normalizeModelPreference, normalizePermissionName, removeFromIndex, setExplicitPermission, writeSystemAudit } from "../core/permissions.js";
import { clearChatSessionHistory, dbDel, dbGet, dbPut } from "../data/store.js";
import { botCanRunRuleMonitor, enrichPortalGroupsWithBindings, filterAuthorizedReviewers, getAppealEligibleGroupsForUser, getBotGroupRole, getGroupFamilyForGroup, getGroupOwnerId, getLiveGroupMemberList, getWhitelistedGroupsForUser, isBotVerifiedGroupOwner, isVerifiedGroupOwner, normalizeJoinUrl, notifyModerationProposalGroup, saveGroupFamily, sendGroupSelectedMentions, sendMissingHeadGroupGuide, verifyGroupMembership } from "../group/runtime.js";
import { apiModelHealthCandidates, buildHealthState, runHealthChecks, runSingleApiModelHealthCheck } from "../health/runtime.js";
import { toSimplifiedChinese } from "../i18n/commands.js";
import { portalI18nPayload } from "../i18n/portal.js";
import { portalPluginCatalog, portalPluginCatalogState, portalPluginForApiPath, readPortalPluginEnabled, setPortalPluginEnabled } from "../plugins/runtime.js";
import { BILIBILI_POLL_DEFAULT_SECONDS, bilibiliPollIntervalSeconds, listBilibiliConnectors, normalizeBilibiliUid, pollOneAutomaticBilibiliConnector, sendBilibiliConnectorNotification } from "../integrations/bilibili.js";
import { appendRuleViolationRecord, createModerationProposal, defaultRuleCategoryPolicies, getGroupMemberSafe, getRuleCategoryPolicies, getRuleProgressivePolicy, handleGroupWorkDecision, handleModerationConfirmation, listModerationProposals, localModerationIntent, moderationActionLabel, moderationActionNeedsTarget, normalizeRuleCategoryPolicies, normalizeRulePolicyActions, normalizeRuleProgressivePolicy, normalizeRuleProxyMode, normalizeRuleSeverity, normalizeRuleStrictness, parseUnlimitedNonNegativeInteger, performRuleProxyAction, recordRuleViolationFeedback, reverseRuleViolationAction, updateRuleViolationRecord } from "../moderation/runtime.js";
import { fetchConversationAttachmentResponse, getForwardMessageSnapshot, getTaipeiTimeContext, parseDurationSeconds, sendGroupRoleMentions, updatePortalConversationRecord } from "../onebot/messages.js";
import { OPS_CAPABILITIES, OPS_RECORD_TYPES, opsActiveRuleRecords, opsActivityParticipants, opsActivitySummary, opsAnalytics, opsAnnounceActivity, opsCapabilityDef, opsCleanupThinking, opsConsumeQuota, opsCreateScheduleFromSpec, opsDeleteRecord, opsDependencyCheck, opsEffectiveCapability, opsExecuteHandoff, opsFuseState, opsGetRecord, opsGetSettings, opsImpactPreview, opsInviteActivityParticipant, opsJoinActivity, opsLeaveActivity, opsListRecords, opsMemberSummary, opsModelMetrics, opsParticipantsKey, opsPermissionKey, opsPollVotesKey, opsPreviewMessage, opsPublishAnnouncement, opsPurgeRemovedRecordTypes, opsRecordKey, opsRecordQualityFeedback, opsRemovedType, opsRequire, opsResetFuse, opsRestoreSnapshot, opsRetentionCleanup, opsRoleRank, opsRuleConflictCheck, opsRuleSandbox, opsSaveRecord, opsSaveSettings, opsSchedulePreview, opsSendDailyDigest, opsSendDraftNow, opsSnapshotConfig, opsTaipeiDateKey, opsTaskAction, opsTaskCenter, opsTypeDef, opsVersionKey, opsVotePoll, opsWelcomePreview } from "../operations/runtime.js";
import { appendPlatformTrace, enqueuePlatformJob, listPlatformFeatures, listPlatformJobs, listPlatformTraces, platformFeatureById, setPlatformFeature } from "../platform/runtime.js";
import { PORTAL_SETTING_DEFINITIONS, authDbDelStrict, authDbPutStrict, base32Encode, createPortalPasswordRecord, decryptPortalAuthSecret, deleteMemoryVector, encryptPortalAuthSecret, extractGroupId, generateBackupCodes, generateSixDigitCode, getOneBotHub, getPortalSession, getUserQuota, hashBackupCode, isMemoryBanned, jsonResponse, migratePortalMemories, portalAuthEncryptionMaterial, portalRoleRank, portalSessionCookie, randomBytes, readCookie, readJson, readPortalAuthJson, readPortalSettingValue, resolvePortalRole, searchPortalVectors, sendOneBotAction, sendPortalVerificationMessage, sha256Hex, upsertMemoryVector, validatePortalPassword, verifyPortalPassword, verifyPortalVerificationCode, verifyTotpCode, writeMemoryAudit, writePortalSettingValue } from "./auth.js";
import { readPortalBranding, writePortalBranding } from "./brand.js";
import { handlePortalMemberApi } from "./members.js";
import { cancelSchedule, countActiveSchedulesForUser, createScheduleRecord, deleteScheduleRecord, extractScheduleMentionIds, listUserSchedules, parseManagementScheduleAction, parseScheduleRequest, reviewScheduleWithGemma, reviseScheduleRecord, sanitizeAppealForReviewer, scheduleSpecFromRecord, skipScheduleOnce, voteAppeal, voteSchedule } from "../scheduler/runtime.js";
import { envFlag, getFeatureFlag, getPrivateAccessMode, isGroupWhitelisted, numericId, setFeatureFlag } from "../security/network.js";



async function handleOpsPortalApi(request, env, url, path, body, authed) {
  if (!path.startsWith("/ops/")) return null;
  await opsPurgeRemovedRecordTypes(env).catch(error => console.warn("Removed operations data purge failed:", error?.message || error));
  if (["/ops/schedule-template/apply","/ops/draft/send","/ops/draft/to-schedule","/ops/quality-feedback","/ops/snapshot","/ops/snapshot/restore"].includes(path)) return jsonResponse({ ok: false, message: "此功能已从系统删除。" }, 410);
  const groupId = String(authed.groupId || "");
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);

  if (request.method === "POST" && path === "/ops/action") {
    if (!(authed.permissions?.groupOps || authed.permissions?.nativeAdmin || authed.permissions?.developer || isDeveloperId(env, authed.qq))) {
      return jsonResponse({ ok: false, message: "缺少群操作权限。" }, 403);
    }
    const action = String(body.action || "");
    const preventUnmute = action === "mute" && body.preventUnmute === true;
    const allowOwnerUnmute = preventUnmute && body.allowOwnerUnmute === true;
    const skipConfirmation = body.skipConfirmation === true;
    const target = String(body.qq || "").replace(/\D/g, "");
    const proposedActions = ["mute", "unmute", "kick", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (!proposedActions.includes(action)) return jsonResponse({ ok: false, message: "不支持的待确认操作。" }, 400);
    if (["set_admin", "unset_admin"].includes(action) && !(await isBotVerifiedGroupOwner(env, groupId))) {
      return jsonResponse({ ok: false, message: "机器人账号当前不是本群群主，真正 QQ 管理员任免功能不可用。" }, 403);
    }
    if (moderationActionNeedsTarget(action) && !target) return jsonResponse({ ok: false, message: "请输入目标 QQ。" }, 400);
    const member = target ? await getGroupMemberSafe(env, groupId, target) : null;
    const actorMember = await getGroupMemberSafe(env, groupId, authed.qq);
    const actorName = actorMember?.card || actorMember?.nickname || actorMember?.name || authed.qq;
    const proposal = await createModerationProposal(env, {
      groupId,
      actorId: authed.qq,
      actorName,
      actorRole: isDeveloperId(env, authed.qq) ? "developer" : authed.role,
      action,
      targetId: target,
      targetName: member?.card || member?.nickname || target,
      targetRole: member?.role || "member",
      durationSeconds: action === "mute" ? Math.max(60, parseDurationSeconds(String(body.duration || "10分"))) : 0,
      preventUnmute,
      allowOwnerUnmute,
      skipConfirmation,
      sourceText: `Portal 提出 ${moderationActionLabel(action)}`,
      classifierReason: "Portal 手动确认单",
      reason: String(body.reason || "").trim(),
      messageId: ""
    });
    const notification = await notifyModerationProposalGroup(env, proposal);
    return jsonResponse({
      ok: true,
      pendingConfirmation: true,
      proposal: await readJson(env, `moderation:proposal:${proposal.id}`, proposal),
      notification,
      message: notification.skipped
        ? `已建立待确认操作 ${proposal.id}；当前通知路由未发送消息（${notification.reason || "已关闭"}）。尚未执行。`
        : notification.ok
          ? `已建立待确认操作 ${proposal.id}，并已按通知路由私讯 ${notification.sentRecipientIds?.length || 0} 位接收者。尚未执行。`
          : `已建立待确认操作 ${proposal.id}，但通知路由发送失败：${notification.error || notification.failures?.[0]?.error || "未知错误"}`
    });
  }

  if (request.method === "GET" && path === "/ops/bootstrap") {
    const gate = await opsRequire(env, authed, "operations.view");
    if (!gate.ok) return gate.response;
    const settings = await opsGetSettings(env, groupId);
    const capabilities = [];
    for (const def of OPS_CAPABILITIES) {
      capabilities.push({ ...def, ...(await opsEffectiveCapability(env, { groupId, qq: authed.qq, role: authed.role, capability: def.id })) });
    }
    const summaries = {};
    for (const type of Object.keys(OPS_RECORD_TYPES)) summaries[type] = (await opsListRecords(env, type, { groupId, qq: authed.qq, role: authed.role, limit: 100 })).length;
    return jsonResponse({ ok: true, version: VERSION, settings, capabilities, recordTypes: OPS_RECORD_TYPES, summaries });
  }

  if (request.method === "GET" && path === "/ops/records") {
    const type = String(url.searchParams.get("type") || "");
    const def = opsTypeDef(type);
    if (!def) return jsonResponse({ ok: false, message: opsRemovedType(type) ? "此功能已从系统删除。" : "未知记录类型。" }, opsRemovedType(type) ? 410 : 400);
    const viewCap = type === "activity" ? "activity.view"
      : type === "poll" ? "poll.view"
      : ["faq", "knowledge"].includes(type) ? "knowledge.view"
      : type === "quality_feedback" ? (opsRoleRank(authed.role) >= opsRoleRank("admin") ? "quality.manage" : "quality.report")
      : type === "suggestion" ? (opsRoleRank(authed.role) >= opsRoleRank("admin") ? "suggestion.manage" : "suggestion.create")
      : type === "bug" ? (opsRoleRank(authed.role) >= opsRoleRank("admin") ? "bug.manage" : "bug.create")
      : def.capability;
    const gate = await opsRequire(env, authed, viewCap);
    if (!gate.ok) return gate.response;
    let records = await opsListRecords(env, type, { groupId, qq: authed.qq, role: authed.role, limit: Number(url.searchParams.get("limit") || 300) });
    if (type === "activity") {
      const manageDecision = await opsEffectiveCapability(env, { groupId, qq: authed.qq, role: authed.role, capability: "activity.manage" });
      const detailed = [];
      for (const item of records) detailed.push(await opsActivitySummary(env, item, { viewerId: authed.qq, canManage: manageDecision.allowed }));
      records = detailed;
    }
    if (type === "poll") {
      const detailed = [];
      for (const item of records) {
        const votes = await readJson(env, opsPollVotesKey(item.id), {});
        const counts = (item.options || []).map((_, index) => Object.values(votes).filter(v => (v.indexes || []).includes(index)).length);
        detailed.push({ ...item, voteCounts: counts, voterCount: Object.keys(votes).length, myVote: votes[authed.qq] || null });
      }
      records = detailed;
    }
    if (type === "suggestion") {
      const settings = await opsGetSettings(env, groupId);
      const canResolveIdentity = isDeveloperId(env, authed.qq) && settings.suggestionDeveloperCanResolveIdentity;
      records = await Promise.all(records.map(async item => {
        const mine = String(item.creatorId || "") === String(authed.qq);
        if (mine || canResolveIdentity) return item;
        const anonymousId = `匿名-${(await sha256Hex(`${groupId}|${item.creatorId || ""}`)).slice(0, 8)}`;
        return { ...item, creatorId: undefined, creatorName: anonymousId, anonymousId, identityPolicy: "审核画面不显示真实身份" };
      }));
    }
    return jsonResponse({ ok: true, records });
  }

  if (request.method === "POST" && path === "/ops/records") {
    const type = String(body.type || "");
    const def = opsTypeDef(type);
    if (!def) return jsonResponse({ ok: false, message: opsRemovedType(type) ? "此功能已从系统删除。" : "未知记录类型。" }, opsRemovedType(type) ? 410 : 400);
    const gate = await opsRequire(env, authed, def.capability);
    if (!gate.ok) return gate.response;
    const requestedGroups = [...new Set((Array.isArray(body.groupIds) ? body.groupIds : [groupId]).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
    if (requestedGroups.some(id => id !== groupId)) {
      const cross = await opsRequire(env, authed, type === "activity" ? "activity.cross_group" : "settings.export_import");
      if (!cross.ok) return cross.response;
      for (const targetGroupId of requestedGroups) {
        const targetGate = await opsRequire(env, authed, type === "activity" ? "activity.manage" : def.capability, targetGroupId);
        if (!targetGate.ok) return targetGate.response;
      }
    }
    if (type === "activity" && String(body.activityGroupId || "").replace(/\D/g, "")) {
      const inviteGroupGate = await opsRequire(env, authed, "activity.invite", String(body.activityGroupId).replace(/\D/g, ""));
      if (!inviteGroupGate.ok) return inviteGroupGate.response;
    }
    if (type === "activity" && body.announceOnCreate) {
      for (const targetGroupId of requestedGroups) {
        const announceGate = await opsRequire(env, authed, "activity.announce", targetGroupId);
        if (!announceGate.ok) return announceGate.response;
        if (body.announceMode === "all") {
          const mentionAllGate = await opsRequire(env, authed, "activity.mention_all", targetGroupId);
          if (!mentionAllGate.ok) return mentionAllGate.response;
        }
      }
    }
    const existing = body.id ? await readJson(env, opsRecordKey(type, body.id), null) : null;
    if (body.id && !existing) return jsonResponse({ ok: false, message: "找不到记录。" }, 404);
    if (existing && ["suggestion", "bug", "quality_feedback"].includes(type) && String(existing.creatorId || "") !== String(authed.qq)) {
      const manageCap = type === "suggestion" ? "suggestion.manage" : type === "bug" ? "bug.manage" : "quality.manage";
      const manageGate = await opsRequire(env, authed, manageCap);
      if (!manageGate.ok) return manageGate.response;
    }
    const item = await opsSaveRecord(env, { type, existing, groupId, actorId: authed.qq, actorName: type === "suggestion" ? "匿名提交者" : authed.qq, data: { ...body, groupIds: requestedGroups } });
    let announcement = null;
    if (type === "activity" && body.announceOnCreate && !existing) announcement = await opsAnnounceActivity(env, item, { actorId: authed.qq, mode: body.announceMode || "none" });
    return jsonResponse({ ok: true, message: existing ? "记录已更新。" : announcement ? `记录已建立。${announcement.message}` : "记录已建立。", item, announcement });
  }

  if (request.method === "DELETE" && path === "/ops/records") {
    const type = String(body.type || "");
    const id = String(body.id || "");
    const def = opsTypeDef(type);
    if (!def) return jsonResponse({ ok: false, message: opsRemovedType(type) ? "此功能已从系统删除。" : "未知记录类型。" }, opsRemovedType(type) ? 410 : 400);
    const existing = await readJson(env, opsRecordKey(type, id), null);
    const deleteCap = ["suggestion", "bug", "quality_feedback"].includes(type) && existing && String(existing.creatorId || "") !== String(authed.qq)
      ? (type === "suggestion" ? "suggestion.manage" : type === "bug" ? "bug.manage" : "quality.manage")
      : def.capability;
    const gate = await opsRequire(env, authed, deleteCap);
    if (!gate.ok) return gate.response;
    const ok = await opsDeleteRecord(env, type, id, authed.qq);
    return jsonResponse({ ok, message: ok ? "记录已删除。" : "找不到记录。" }, ok ? 200 : 404);
  }

  if (request.method === "GET" && path === "/ops/versions") {
    const type = String(url.searchParams.get("type") || "");
    const id = String(url.searchParams.get("id") || "");
    const def = opsTypeDef(type);
    if (!def) return jsonResponse({ ok: false, message: "未知记录类型。" }, 400);
    const gate = await opsRequire(env, authed, def.capability);
    if (!gate.ok) return gate.response;
    return jsonResponse({ ok: true, versions: await readJson(env, opsVersionKey(type, id), []) });
  }

  if (request.method === "POST" && path === "/ops/activity/join") {
    const gate = await opsRequire(env, authed, "activity.join");
    if (!gate.ok) return gate.response;
    const activity = await readJson(env, opsRecordKey("activity", body.id), null);
    const result = await opsJoinActivity(env, activity, { userId: authed.qq, userName: authed.qq, sourceGroupId: groupId });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/activity/leave") {
    const gate = await opsRequire(env, authed, "activity.join");
    if (!gate.ok) return gate.response;
    const activity = await readJson(env, opsRecordKey("activity", body.id), null);
    const result = activity ? await opsLeaveActivity(env, activity, authed.qq) : { ok: false, message: "找不到活动。" };
    return jsonResponse(result, result.ok ? 200 : 404);
  }

  if (request.method === "POST" && path === "/ops/activity/announce") {
    const activity = await readJson(env, opsRecordKey("activity", body.id), null);
    if (!activity) return jsonResponse({ ok: false, message: "找不到活动。" }, 404);
    const mode = body.mode === "all" ? "all" : "none";
    const targetGroups = [...new Set((activity.groupIds || [activity.groupId]).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
    for (const targetGroupId of targetGroups) {
      const announceGate = await opsRequire(env, authed, "activity.announce", targetGroupId);
      if (!announceGate.ok) return announceGate.response;
      if (mode === "all") {
        const mentionAllGate = await opsRequire(env, authed, "activity.mention_all", targetGroupId);
        if (!mentionAllGate.ok) return mentionAllGate.response;
      }
    }
    const result = await opsAnnounceActivity(env, activity, { actorId: authed.qq, mode });
    return jsonResponse(result, result.ok ? 200 : result.partial ? 207 : 400);
  }

  if (request.method === "POST" && path === "/ops/activity/invite") {
    const gate = await opsRequire(env, authed, "activity.invite");
    if (!gate.ok) return gate.response;
    const activity = await readJson(env, opsRecordKey("activity", body.id), null);
    if (!activity) return jsonResponse({ ok: false, message: "找不到活动。" }, 404);
    const targetActivityGroupId = String(activity.activityGroupId || "").replace(/\D/g, "");
    if (!targetActivityGroupId) return jsonResponse({ ok: false, message: "此活动没有设置额外活动群。" }, 400);
    const targetGate = await opsRequire(env, authed, "activity.invite", targetActivityGroupId);
    if (!targetGate.ok) return targetGate.response;
    const rows = await opsActivityParticipants(env, activity.id);
    const participant = rows.find(item => String(item.userId) === String(body.userId));
    if (!participant) return jsonResponse({ ok: false, message: "找不到参与者。" }, 404);
    if (participant.status !== "confirmed") return jsonResponse({ ok: false, message: "只有正式报名者可以收到活动群邀请。" }, 400);
    const quota = await opsConsumeQuota(env, targetActivityGroupId, authed.qq, "activityInvite", 1);
    if (!quota.ok) return jsonResponse(quota, 429);
    const result = await opsInviteActivityParticipant(env, activity, participant, authed.qq);
    await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows));
    await writeSystemAudit(env, { type: "ops_activity_invite", groupId, actorId: authed.qq, targetId: participant.userId, action: participant.inviteStatus, activityId: activity.id, activityGroupId: activity.activityGroupId || "" });
    return jsonResponse(result, result.ok ? 200 : 502);
  }

  if (request.method === "POST" && path === "/ops/poll/vote") {
    const gate = await opsRequire(env, authed, "poll.vote");
    if (!gate.ok) return gate.response;
    const poll = await readJson(env, opsRecordKey("poll", body.id), null);
    const result = await opsVotePoll(env, poll, { userId: authed.qq, optionIndexes: body.optionIndexes });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/message-preview") {
    const gate = await opsRequire(env, authed, "schedule.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsPreviewMessage(env, { groupId, text: body.text, mentionIds: body.mentionIds, replyId: body.replyId, attachments: body.attachments }));
  }

  if (request.method === "GET" && path === "/ops/settings") {
    const gate = await opsRequire(env, authed, "operations.view");
    if (!gate.ok) return gate.response;
    return jsonResponse({ ok: true, settings: await opsGetSettings(env, groupId) });
  }

  if (request.method === "POST" && path === "/ops/settings") {
    const fields = body || {};
    const capabilityFields = [
      { cap: "quiet_hours.manage", keys: ["quietHoursEnabled", "quietStart", "quietEnd", "quietPolicy"] },
      { cap: "retention.manage", keys: ["retentionDays"] },
      { cap: "maintenance.manage", keys: ["maintenanceMode", "maintenanceUntil", "emergencyLock", "testMode"] },
      { cap: "automation.fuse.manage", keys: ["fuseEnabled", "fuseFailureThreshold", "anomalyDetectionEnabled", "operationQuota"] },
      { cap: "schedule.manage", keys: ["scheduleRetryEnabled", "scheduleRetryMax", "scheduleRetryGraceMinutes"] },
      { cap: "todo.manage", keys: ["dailyDigestEnabled", "dailyDigestTime", "dailyDigestRecipientIds"] },
      { cap: "rules.manage", keys: ["ruleSampleReviewPercent"] },
      { cap: "suggestion.manage", keys: ["suggestionDeveloperCanResolveIdentity"] }
    ];
    for (const entry of capabilityFields) {
      if (!entry.keys.some(key => Object.prototype.hasOwnProperty.call(fields, key))) continue;
      const gate = await opsRequire(env, authed, entry.cap);
      if (!gate.ok) return gate.response;
    }
    if (!Object.keys(fields).length) return jsonResponse({ ok: false, message: "没有可保存的设置。" }, 400);
    const settings = await opsSaveSettings(env, groupId, fields);
    await writeSystemAudit(env, { type: "ops_settings", groupId, actorId: authed.qq, action: "update", changedKeys: Object.keys(fields) });
    return jsonResponse({ ok: true, message: "营运设置已保存。", settings });
  }

  if (request.method === "GET" && path === "/ops/permissions") {
    const gate = await opsRequire(env, authed, "permissions.manage");
    if (!gate.ok) return gate.response;
    const targetQq = String(url.searchParams.get("qq") || authed.qq).replace(/\D/g, "");
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const capabilities = [];
    for (const def of OPS_CAPABILITIES) capabilities.push({ ...def, ...(await opsEffectiveCapability(env, { groupId, qq: targetQq, role: targetRole, capability: def.id })) });
    return jsonResponse({ ok: true, targetQq, targetRole, capabilities });
  }

  if (request.method === "POST" && path === "/ops/permissions") {
    const gate = await opsRequire(env, authed, "permissions.manage");
    if (!gate.ok) return gate.response;
    const targetQq = String(body.qq || "").replace(/\D/g, "");
    const capability = String(body.capability || "");
    if (!targetQq || !opsCapabilityDef(capability)) return jsonResponse({ ok: false, message: "QQ 或权限项目无效。" }, 400);
    const expiresAt = body.expiresAt ? Number(body.expiresAt) : 0;
    await dbPut(env, opsPermissionKey(groupId, targetQq, capability), JSON.stringify({
      allowed: Boolean(body.allowed),
      reason: String(body.reason || "").slice(0, 500),
      expiresAt,
      actorId: authed.qq,
      updatedAt: Date.now()
    }));
    await writeSystemAudit(env, { type: "ops_permission", groupId, actorId: authed.qq, targetId: targetQq, action: body.allowed ? "allow" : "deny", capability, expiresAt, reason: String(body.reason || "") });
    return jsonResponse({ ok: true, message: "功能权限已更新。" });
  }

  if (request.method === "POST" && path === "/ops/rule-sandbox") {
    const gate = await opsRequire(env, authed, "rules.sandbox");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsRuleSandbox(env, { groupId, text: body.text, context: body.context, role: body.role }));
  }

  if (request.method === "POST" && path === "/ops/impact-preview") {
    const gate = await opsRequire(env, authed, "rules.manage");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsImpactPreview(env, groupId, body));
  }

  if (request.method === "GET" && path === "/ops/timeline") {
    const gate = await opsRequire(env, authed, "diagnostics.view");
    if (!gate.ok) return gate.response;
    const q = String(url.searchParams.get("q") || "").toLowerCase();
    const logs = await readJson(env, `audit:system:group:${groupId}`, []);
    return jsonResponse({ ok: true, events: logs.filter(item => !q || JSON.stringify(item).toLowerCase().includes(q)).slice(-500).reverse() });
  }

  if (request.method === "GET" && path === "/ops/analytics") {
    const gate = await opsRequire(env, authed, "diagnostics.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsAnalytics(env, groupId));
  }

  if (request.method === "GET" && path === "/ops/dependencies") {
    const gate = await opsRequire(env, authed, "diagnostics.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsDependencyCheck(env, groupId));
  }

  if (request.method === "POST" && path === "/ops/thinking-cleanup") {
    const gate = await opsRequire(env, authed, "diagnostics.manage");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsCleanupThinking(env, groupId, body.messageIds));
  }


  if (request.method === "POST" && path === "/ops/versions/restore") {
    const type = String(body.type || "");
    const id = String(body.id || "");
    const def = opsTypeDef(type);
    if (!def) return jsonResponse({ ok: false, message: "未知记录类型。" }, 400);
    const gate = await opsRequire(env, authed, def.capability);
    if (!gate.ok) return gate.response;
    const current = await opsGetRecord(env, type, id);
    const versions = await readJson(env, opsVersionKey(type, id), []);
    const version = versions[Number(body.versionIndex ?? versions.length - 1)];
    if (!current || !version?.snapshot) return jsonResponse({ ok: false, message: "找不到可恢复版本。" }, 404);
    const item = await opsSaveRecord(env, { type, existing: current, groupId, actorId: authed.qq, actorName: authed.qq, data: { ...version.snapshot, id: current.id } });
    await writeSystemAudit(env, { type: "ops_version_restore", groupId, actorId: authed.qq, action: type, recordId: id, versionAt: version.at });
    return jsonResponse({ ok: true, message: "记录已恢复为指定版本。", item });
  }

  if (request.method === "POST" && path === "/ops/schedule-preview") {
    const gate = await opsRequire(env, authed, "schedule.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsSchedulePreview(env, { groupId, scheduleSpec: body.scheduleSpec, excludeId: body.excludeId }));
  }

  if (request.method === "POST" && path === "/ops/schedule-template/apply") {
    const gate = await opsRequire(env, authed, "schedule.manage");
    if (!gate.ok) return gate.response;
    const template = await opsGetRecord(env, "schedule_template", body.id);
    if (!template) return jsonResponse({ ok: false, message: "找不到排程模板。" }, 404);
    const targetGroupId = String(body.targetGroupId || template.defaultGroupId || groupId).replace(/\D/g, "");
    const targetGate = await opsRequire(env, authed, "schedule.manage", targetGroupId);
    if (!targetGate.ok) return targetGate.response;
    const spec = String(body.scheduleSpec || template.scheduleSpec || template.description || "").trim();
    const result = await opsCreateScheduleFromSpec(env, { groupId: targetGroupId, actorId: authed.qq, actorRole: targetGate.role, scheduleSpec: spec, templateId: template.id });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/draft/send") {
    const gate = await opsRequire(env, authed, "draft.send");
    if (!gate.ok) return gate.response;
    const draft = await opsGetRecord(env, "draft", body.id);
    if (!draft) return jsonResponse({ ok: false, message: "找不到草稿。" }, 404);
    const targetGroupId = String(draft.targetGroupId || draft.groupId || groupId).replace(/\D/g, "");
    const targetGate = await opsRequire(env, authed, "draft.send", targetGroupId);
    if (!targetGate.ok) return targetGate.response;
    const result = await opsSendDraftNow(env, { draft, groupId: targetGroupId, actorId: authed.qq });
    return jsonResponse(result, result.ok ? 200 : 502);
  }

  if (request.method === "POST" && path === "/ops/draft/to-schedule") {
    const draftGate = await opsRequire(env, authed, "draft.send");
    if (!draftGate.ok) return draftGate.response;
    const scheduleGate = await opsRequire(env, authed, "schedule.manage");
    if (!scheduleGate.ok) return scheduleGate.response;
    const draft = await opsGetRecord(env, "draft", body.id);
    if (!draft) return jsonResponse({ ok: false, message: "找不到草稿。" }, 404);
    const targetGroupId = String(draft.targetGroupId || draft.groupId || groupId).replace(/\D/g, "");
    const targetGate = await opsRequire(env, authed, "schedule.manage", targetGroupId);
    if (!targetGate.ok) return targetGate.response;
    let spec = String(body.scheduleSpec || "").trim();
    if (!spec && body.when) spec = `${String(body.when).trim()} ${String(draft.text || draft.description || "").trim()}`;
    const result = await opsCreateScheduleFromSpec(env, { groupId: targetGroupId, actorId: authed.qq, actorRole: targetGate.role, scheduleSpec: spec, draftId: draft.id });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "GET" && path === "/ops/tasks") {
    const gate = await opsRequire(env, authed, "task.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsTaskCenter(env, groupId, Number(url.searchParams.get("limit") || 300)));
  }

  if (request.method === "POST" && path === "/ops/tasks/action") {
    const gate = await opsRequire(env, authed, "task.manage");
    if (!gate.ok) return gate.response;
    const result = await opsTaskAction(env, { groupId, actorId: authed.qq, kind: String(body.kind || ""), id: String(body.id || ""), action: String(body.action || "") });
    await writeSystemAudit(env, { type: "ops_task_action", groupId, actorId: authed.qq, action: String(body.action || ""), taskKind: String(body.kind || ""), taskId: String(body.id || ""), result: result.message });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/quality-feedback") {
    const gate = await opsRequire(env, authed, "quality.report");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsRecordQualityFeedback(env, { groupId, actorId: authed.qq, actorName: authed.qq, body }));
  }

  if (request.method === "GET" && path === "/ops/model-metrics") {
    const gate = await opsRequire(env, authed, "model.analytics.view");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsModelMetrics(env, groupId, Number(url.searchParams.get("days") || 7)));
  }

  if (request.method === "GET" && path === "/ops/rule-conflicts") {
    const gate = await opsRequire(env, authed, "rules.manage");
    if (!gate.ok) return gate.response;
    const active = await opsActiveRuleRecords(env, groupId);
    return jsonResponse({ ok: true, conflicts: opsRuleConflictCheck([...active.tempRules, ...active.exceptions, ...active.priorities]), active });
  }

  if (request.method === "GET" && path === "/ops/fuses") {
    const gate = await opsRequire(env, authed, "diagnostics.view");
    if (!gate.ok) return gate.response;
    const features = ["schedule", "rule_monitor", "join_review", "thinking_cleanup", "bilibili"];
    const states = [];
    for (const feature of features) states.push(await opsFuseState(env, groupId, feature));
    return jsonResponse({ ok: true, states });
  }

  if (request.method === "POST" && path === "/ops/fuses/reset") {
    const gate = await opsRequire(env, authed, "automation.fuse.manage");
    if (!gate.ok) return gate.response;
    return jsonResponse({ ok: true, state: await opsResetFuse(env, groupId, String(body.feature || "schedule"), authed.qq), message: "保险丝已重置。" });
  }

  if (request.method === "POST" && path === "/ops/retention/run") {
    const gate = await opsRequire(env, authed, "retention.manage");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsRetentionCleanup(env, groupId));
  }

  if (request.method === "POST" && path === "/ops/digest/run") {
    const gate = await opsRequire(env, authed, "todo.manage");
    if (!gate.ok) return gate.response;
    await dbDel(env, `ops:digest:sent:${groupId}:${opsTaipeiDateKey()}`);
    return jsonResponse(await opsSendDailyDigest(env, groupId));
  }

  if (request.method === "GET" && path === "/ops/member-summary") {
    const gate = await opsRequire(env, authed, "member.summary.view");
    if (!gate.ok) return gate.response;
    const userId = String(url.searchParams.get("qq") || "").replace(/\D/g, "");
    if (!userId) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    return jsonResponse(await opsMemberSummary(env, groupId, userId));
  }

  if (request.method === "POST" && path === "/ops/welcome-preview") {
    const gate = await opsRequire(env, authed, "knowledge.manage");
    if (!gate.ok) return gate.response;
    const userId = String(body.userId || "").replace(/\D/g, "");
    if (!userId) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    return jsonResponse(await opsWelcomePreview(env, groupId, { userId, templateId: body.templateId, text: body.text }));
  }

  if (request.method === "POST" && path === "/ops/announcement/publish") {
    const gate = await opsRequire(env, authed, "announcement.publish");
    if (!gate.ok) return gate.response;
    const record = await opsGetRecord(env, "announcement_version", body.id);
    const result = await opsPublishAnnouncement(env, { groupId, actorId: authed.qq, record, asTodo: Boolean(body.asTodo) });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/handoff") {
    const gate = await opsRequire(env, authed, "handoff.manage");
    if (!gate.ok) return gate.response;
    const result = await opsExecuteHandoff(env, { groupId, actorId: authed.qq, actorRole: gate.role, body });
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "POST" && path === "/ops/appeal/message") {
    const gate = await opsRequire(env, authed, "appeal.manage");
    if (!gate.ok) return gate.response;
    const item = await opsGetRecord(env, "appeal_thread", body.id);
    if (!item) return jsonResponse({ ok: false, message: "找不到申诉对话串。" }, 404);
    const text = String(body.text || "").trim().slice(0, 4000);
    if (!text) return jsonResponse({ ok: false, message: "消息不能为空。" }, 400);
    item.messages = [...(Array.isArray(item.messages) ? item.messages : []), { at: Date.now(), actorId: authed.qq, actorRole: authed.role, text }].slice(-200);
    item.status = String(body.status || item.status || "pending");
    item.updatedAt = Date.now();
    await dbPut(env, opsRecordKey("appeal_thread", item.id), JSON.stringify(item));
    return jsonResponse({ ok: true, message: "申诉对话已更新。", item });
  }

  if (request.method === "POST" && path === "/ops/activity/invite-all") {
    const gate = await opsRequire(env, authed, "activity.invite");
    if (!gate.ok) return gate.response;
    const activity = await opsGetRecord(env, "activity", body.id);
    if (!activity) return jsonResponse({ ok: false, message: "找不到活动。" }, 404);
    const targetGroupId = String(activity.activityGroupId || "").replace(/\D/g, "");
    if (!targetGroupId) return jsonResponse({ ok: false, message: "活动没有设置活动群。" }, 400);
    const targetGate = await opsRequire(env, authed, "activity.invite", targetGroupId);
    if (!targetGate.ok) return targetGate.response;
    const settings = await opsGetSettings(env, targetGroupId);
    const cursor = Math.max(0, Number(body.cursor || 0));
    const requestedLimit = Math.max(1, Number(body.limit || settings.operationQuota.activityInviteBatchMax));
    const batchLimit = Math.min(settings.operationQuota.activityInviteBatchMax, requestedLimit);
    const rows = await opsActivityParticipants(env, activity.id);
    const eligible = rows.filter(item => item.status === "confirmed" && !["already_member", "pending_request_approved", "group_card_sent"].includes(String(item.inviteStatus || "")));
    const batch = eligible.slice(cursor, cursor + batchLimit);
    if (!batch.length) return jsonResponse({ ok: true, results: [], completed: true, remaining: 0, message: "没有尚待邀请的正式报名者。" });
    const quota = await opsConsumeQuota(env, targetGroupId, authed.qq, "activityInvite", batch.length);
    if (!quota.ok) return jsonResponse(quota, 429);
    const results = [];
    for (const participant of batch) {
      results.push({ userId: participant.userId, ...(await opsInviteActivityParticipant(env, activity, participant, authed.qq)) });
    }
    await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows));
    const remaining = Math.max(0, eligible.length - cursor - batch.length);
    const nextCursor = remaining > 0 ? cursor + batch.length : null;
    return jsonResponse({
      ok: results.every(item => item.ok),
      results,
      completed: remaining === 0,
      nextCursor,
      remaining,
      batchLimit,
      message: `本批已处理 ${results.length} 位，尚余 ${remaining} 位。为避免 Worker 超时与 QQ 风控，批次上限为 ${batchLimit}。`
    });
  }

  if (request.method === "POST" && path === "/ops/poll/close") {
    const gate = await opsRequire(env, authed, "poll.manage");
    if (!gate.ok) return gate.response;
    const poll = await opsGetRecord(env, "poll", body.id);
    if (!poll) return jsonResponse({ ok: false, message: "找不到投票。" }, 404);
    poll.status = "closed";
    poll.closedAt = Date.now();
    poll.closedBy = authed.qq;
    await dbPut(env, opsRecordKey("poll", poll.id), JSON.stringify(poll));
    return jsonResponse({ ok: true, message: "投票已结束。", poll });
  }

  if (request.method === "POST" && path === "/ops/snapshot") {
    const gate = await opsRequire(env, authed, "deployment.manage");
    if (!gate.ok) return gate.response;
    return jsonResponse(await opsSnapshotConfig(env, groupId, authed.qq, body.title));
  }

  if (request.method === "POST" && path === "/ops/snapshot/restore") {
    const gate = await opsRequire(env, authed, "deployment.manage");
    if (!gate.ok) return gate.response;
    const result = await opsRestoreSnapshot(env, groupId, authed.qq, String(body.id || ""), body.previewOnly !== false);
    return jsonResponse(result, result.ok ? 200 : 400);
  }

  if (request.method === "GET" && path === "/ops/export") {
    const gate = await opsRequire(env, authed, "settings.export_import");
    if (!gate.ok) return gate.response;
    const records = {};
    for (const type of Object.keys(OPS_RECORD_TYPES)) {
      if (["suggestion", "bug", "appeal_thread"].includes(type)) continue;
      records[type] = await opsListRecords(env, type, { groupId, qq: authed.qq, role: authed.role, limit: 2000 });
    }
    const payload = {
      schema: "qqai-ops-v1",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      groupId,
      settings: await opsGetSettings(env, groupId),
      records,
      portalSettings: Object.fromEntries(await Promise.all(PORTAL_SETTING_DEFINITIONS.filter(def => def.scope === "group").map(async def => [def.key, await readPortalSettingValue(env, def, groupId, authed.qq)])))
    };
    return jsonResponse({ ok: true, payload });
  }

  if (request.method === "POST" && path === "/ops/import") {
    const gate = await opsRequire(env, authed, "settings.export_import");
    if (!gate.ok) return gate.response;
    const payload = body.payload || {};
    if (payload.schema !== "qqai-ops-v1") return jsonResponse({ ok: false, message: "不支持的汇入格式。" }, 400);
    if (body.previewOnly !== false) {
      const counts = Object.fromEntries(Object.entries(payload.records || {}).map(([type, rows]) => [type, Array.isArray(rows) ? rows.length : 0]));
      return jsonResponse({ ok: true, preview: true, counts, settings: payload.settings || {}, message: "这是差异预览，尚未写入。" });
    }
    const settings = await opsSaveSettings(env, groupId, payload.settings || {});
    let imported = 0;
    for (const [type, rows] of Object.entries(payload.records || {})) {
      if (!opsTypeDef(type) || !Array.isArray(rows)) continue;
      for (const row of rows.slice(0, 2000)) {
        await opsSaveRecord(env, { type, groupId, actorId: authed.qq, actorName: authed.qq, data: { ...row, id: undefined, groupId, groupIds: [groupId], importedFrom: payload.groupId || "" } });
        imported += 1;
      }
    }
    await writeSystemAudit(env, { type: "ops_import", groupId, actorId: authed.qq, action: "import", imported });
    return jsonResponse({ ok: true, message: `已汇入 ${imported} 笔记录。`, settings });
  }

  if (request.method === "POST" && path === "/ops/predeploy") {
    const gate = await opsRequire(env, authed, "deployment.manage");
    if (!gate.ok) return gate.response;
    const dependencies = await opsDependencyCheck(env, groupId);
    const quickHealth = await runHealthChecks(env, { mode: "quick" });
    return jsonResponse({ ok: dependencies.ok && quickHealth.ok, dependencies, health: quickHealth, version: VERSION, message: "这里只执行非破坏性检查；不会自动向正式群发送测试消息。" });
  }

  return jsonResponse({ ok: false, message: "未知营运中心接口。" }, 404);
}




async function handlePortalApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || readCookie(request, "qqai_session") || body.token || url.searchParams.get("token") || "";
  let session;
  try {
    session = await getPortalSession(env, token);
  } catch (error) {
    return jsonResponse({ ok: false, code: "SESSION_STORAGE_UNAVAILABLE", retryable: true, message: "登录会话资料库暂时不可用，系统没有将你登出。请稍后重试。" }, 503);
  }
  if (!session) return jsonResponse({ ok: false, code: "SESSION_INVALID", message: "未登录或登录已过期。" }, 401);
  const path = url.pathname.replace("/api/portal", "");

  if (request.method === "POST" && path === "/heartbeat") {
    return jsonResponse({
      ok: true,
      message: "会话已续期。",
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt
    }, 200, { "Set-Cookie": portalSessionCookie(token, session.persistent ? DEFAULTS.portalSessionCookieSeconds : null) });
  }

  if (request.method === "GET" && path === "/security/auth-state") {
    try {
      const passwordRecord = await readPortalAuthJson(env, `portal_auth_password:${session.qq}`, null);
      const twoFactor = await readPortalAuthJson(env, `portal_auth_2fa:${session.qq}`, null);
      let encryptionReady = true;
      try { portalAuthEncryptionMaterial(env); } catch (error) { encryptionReady = false; }
      return jsonResponse({ ok: true, passwordSet: Boolean(passwordRecord), twoFactorEnabled: Boolean(twoFactor?.enabled), backupCodesRemaining: Array.isArray(twoFactor?.backupCodeHashes) ? twoFactor.backupCodeHashes.length : 0, encryptionReady, recentAuthentication: Date.now() - Number(session.authenticatedAt || 0) <= 15 * 60 * 1000, authMethod: session.authMethod || "unknown" });
    } catch (error) {
      return jsonResponse({ ok: false, code: "AUTH_STORAGE_UNAVAILABLE", message: "无法读取登录安全设置，请稍后重试。" }, 503);
    }
  }

  if (request.method === "POST" && path === "/security/password") {
    const newPassword = String(body.newPassword || "");
    const currentPassword = String(body.currentPassword || "");
    const verificationCode = String(body.verificationCode || "").replace(/\D/g, "");
    const validation = validatePortalPassword(newPassword);
    if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);
    try {
      const existing = await readPortalAuthJson(env, `portal_auth_password:${session.qq}`, null);
      const recent = Date.now() - Number(session.authenticatedAt || 0) <= 15 * 60 * 1000;
      let authorized = !existing && recent;
      if (existing && currentPassword) authorized = await verifyPortalPassword(currentPassword, existing);
      if (!authorized && verificationCode) authorized = (await verifyPortalVerificationCode(env, session.qq, verificationCode, { consume: false })).ok;
      if (!authorized) return jsonResponse({ ok: false, code: "REAUTHENTICATION_REQUIRED", message: existing ? "请输入当前密码，或发送 QQ 验证码后再修改。" : "登录时间已超过 15 分钟，请发送 QQ 验证码后再设置密码。" }, 403);
      const record = await createPortalPasswordRecord(newPassword);
      await authDbPutStrict(env, `portal_auth_password:${session.qq}`, JSON.stringify(record));
      if (verificationCode) await authDbDelStrict(env, `portal_auth_code:${session.qq}`);
      await writeSystemAudit(env, { type: "portal_auth_security", actorId: session.qq, action: existing ? "password_changed" : "password_created" }).catch(() => {});
      return jsonResponse({ ok: true, message: existing ? "密码已更新。" : "密码已设置，之后可使用 QQ 号和密码登录。" });
    } catch (error) {
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: error?.code === "PASSWORD_POLICY" ? error.message : "密码无法安全保存，请稍后重试。" }, error?.code === "PASSWORD_POLICY" ? 400 : 503);
    }
  }

  if (request.method === "POST" && path === "/security/2fa/setup") {
    try {
      portalAuthEncryptionMaterial(env);
      const passwordRecord = await readPortalAuthJson(env, `portal_auth_password:${session.qq}`, null);
      if (!passwordRecord) return jsonResponse({ ok: false, code: "PASSWORD_REQUIRED", message: "请先设置登录密码，再启用双因数验证。" }, 400);
      const currentPassword = String(body.currentPassword || "");
      const recent = Date.now() - Number(session.authenticatedAt || 0) <= 15 * 60 * 1000;
      if (!recent && !(await verifyPortalPassword(currentPassword, passwordRecord))) return jsonResponse({ ok: false, code: "REAUTHENTICATION_REQUIRED", message: "请输入当前密码后再设置双因数验证。" }, 403);
      const secret = base32Encode(randomBytes(20));
      const pending = { secret: await encryptPortalAuthSecret(env, secret), createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000 };
      await authDbPutStrict(env, `portal_auth_2fa_pending:${session.qq}`, JSON.stringify(pending));
      const issuer = "QQAIbot";
      const label = `${issuer}:${session.qq}`;
      const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
      return jsonResponse({ ok: true, secret, uri, message: "请将密钥加入验证器，然后输入当前六位动态码完成启用。此设置请求 10 分钟后失效。" });
    } catch (error) {
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: error?.code === "PORTAL_AUTH_SECRET_MISSING" ? "请管理员先设置至少 16 字符的 PORTAL_AUTH_SECRET，再启用 2FA。" : "无法建立双因数验证设置，请稍后重试。" }, 503);
    }
  }

  if (request.method === "POST" && path === "/security/2fa/enable") {
    try {
      const pending = await readPortalAuthJson(env, `portal_auth_2fa_pending:${session.qq}`, null);
      if (!pending || Date.now() > Number(pending.expiresAt || 0)) return jsonResponse({ ok: false, message: "双因数设置请求不存在或已过期，请重新开始。" }, 400);
      const secret = await decryptPortalAuthSecret(env, pending.secret);
      if (!(await verifyTotpCode(secret, body.code))) return jsonResponse({ ok: false, message: "动态验证码错误，请确认手机时间与验证器设置。" }, 400);
      const backupCodes = generateBackupCodes(10);
      const backupCodeHashes = [];
      for (const code of backupCodes) backupCodeHashes.push(await hashBackupCode(env, code));
      const record = { enabled: true, secret: pending.secret, backupCodeHashes, createdAt: Date.now(), updatedAt: Date.now() };
      await authDbPutStrict(env, `portal_auth_2fa:${session.qq}`, JSON.stringify(record));
      await authDbDelStrict(env, `portal_auth_2fa_pending:${session.qq}`);
      await writeSystemAudit(env, { type: "portal_auth_security", actorId: session.qq, action: "two_factor_enabled" }).catch(() => {});
      return jsonResponse({ ok: true, backupCodes, message: "双因数验证已启用。请立即保存以下 10 组单次备用码；关闭页面后不会再次显示原文。" });
    } catch (error) {
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: "双因数验证无法安全启用，请稍后重试。" }, 503);
    }
  }

  if (request.method === "POST" && path === "/security/2fa/backup-codes") {
    try {
      const record = await readPortalAuthJson(env, `portal_auth_2fa:${session.qq}`, null);
      if (!record?.enabled) return jsonResponse({ ok: false, message: "尚未启用双因数验证。" }, 400);
      const secret = await decryptPortalAuthSecret(env, record.secret);
      if (!(await verifyTotpCode(secret, body.code))) return jsonResponse({ ok: false, message: "请输入验证器当前六位动态码。" }, 403);
      const backupCodes = generateBackupCodes(10);
      record.backupCodeHashes = [];
      for (const code of backupCodes) record.backupCodeHashes.push(await hashBackupCode(env, code));
      record.updatedAt = Date.now();
      await authDbPutStrict(env, `portal_auth_2fa:${session.qq}`, JSON.stringify(record));
      return jsonResponse({ ok: true, backupCodes, message: "已重新生成 10 组备用码，旧备用码全部失效。" });
    } catch (error) {
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: "无法重新生成备用码，请稍后重试。" }, 503);
    }
  }

  if (request.method === "POST" && path === "/security/2fa/disable") {
    try {
      const passwordRecord = await readPortalAuthJson(env, `portal_auth_password:${session.qq}`, null);
      const record = await readPortalAuthJson(env, `portal_auth_2fa:${session.qq}`, null);
      if (!record?.enabled) return jsonResponse({ ok: true, message: "双因数验证本来就是关闭状态。" });
      if (!passwordRecord || !(await verifyPortalPassword(String(body.currentPassword || ""), passwordRecord))) return jsonResponse({ ok: false, message: "当前密码错误。" }, 403);
      const secret = await decryptPortalAuthSecret(env, record.secret);
      if (!(await verifyTotpCode(secret, body.code))) return jsonResponse({ ok: false, message: "验证器动态码错误。" }, 403);
      await authDbDelStrict(env, `portal_auth_2fa:${session.qq}`);
      await authDbDelStrict(env, `portal_auth_2fa_pending:${session.qq}`).catch(() => {});
      await writeSystemAudit(env, { type: "portal_auth_security", actorId: session.qq, action: "two_factor_disabled" }).catch(() => {});
      return jsonResponse({ ok: true, message: "双因数验证已关闭，所有备用码同时失效。" });
    } catch (error) {
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: "无法关闭双因数验证，请稍后重试。" }, 503);
    }
  }

  if (request.method === "GET" && path === "/groups") {
    const groups = await enrichPortalGroupsWithBindings(env, await getWhitelistedGroupsForUser(env, session.qq));
    return jsonResponse({ ok: true, groups, selectedGroupId: session.groupId || "" });
  }

  if (request.method === "POST" && path === "/select-group") {
    const groupId = String(body.groupId || "").replace(/\D/g, "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群不在 AI 白名单。" }, 403);
    if (!(await verifyGroupMembership(env, groupId, session.qq))) return jsonResponse({ ok: false, message: "无法确认你是该群成员。" }, 403);
    const groups = await getWhitelistedGroupsForUser(env, session.qq);
    const selected = groups.find(g => g.groupId === groupId);
    const role = await resolvePortalRole(env, session.qq, groupId);
    const permissions = await getEffectivePermissions(env, groupId, session.qq, role, role === "developer");
    const now = Date.now();
    session = {
      ...session,
      groupId,
      group: selected?.groupName || groupId,
      role,
      permissions,
      lastActivityAt: now,
      expiresAt: Math.min(now + Number(session.idleTtlMs || DEFAULTS.portalSessionTtlMs), Number(session.absoluteExpiresAt || now + Number(session.absoluteTtlMs || DEFAULTS.portalSessionAbsoluteTtlMs)))
    };
    await authDbPutStrict(env, `portal_session:${token}`, JSON.stringify(session));
    await dbPut(env, `private_default_group:${session.qq}`, groupId);
    return jsonResponse({ ok: true, message: "群组已切换。", session });
  }

  const groupId = String(session.groupId || "");
  const role = groupId ? await resolvePortalRole(env, session.qq, groupId) : (isDeveloperId(env, session.qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, session.qq, role, role === "developer") : session.permissions || {};
  const authed = { ...session, groupId, role, permissions };
  const portalIsDeveloper = permissions.developer || isDeveloperId(env, authed.qq);

  if (request.method === "GET" && path === "/branding") {
    return jsonResponse({ ok: true, branding: await readPortalBranding(env) });
  }

  if (request.method === "POST" && path === "/branding") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, code: "BRANDING_MANAGE_FORBIDDEN", message: "只有 Developer / Root 可以修改品牌設定。" }, 403);
    const result = await writePortalBranding(env, body || {});
    if (!result.ok) {
      const badRequest = ["BRANDING_INVALID", "LOGO_FORMAT_UNSUPPORTED", "LOGO_TOO_LARGE"].includes(result.code);
      return jsonResponse(result, badRequest ? 400 : 503);
    }
    await writeSystemAudit(env, { type: "portal_branding", actorId: authed.qq, action: "updated" }).catch(() => {});
    return jsonResponse({ ...result, message: "品牌設定已保存。" });
  }

  if (request.method === "GET" && path === "/plugins") {
    return jsonResponse({
      ok: true,
      plugins: await portalPluginCatalogState(env, { developer: portalIsDeveloper }),
      canManage: Boolean(portalIsDeveloper)
    });
  }

  if (request.method === "POST" && path.startsWith("/plugins/")) {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, code: "PLUGIN_MANAGE_FORBIDDEN", message: "只有 Developer / Root 可以啟用或停用全域插件。" }, 403);
    const pluginId = decodeURIComponent(path.slice("/plugins/".length)).trim().toLowerCase();
    if (typeof body.enabled !== "boolean") return jsonResponse({ ok: false, code: "PLUGIN_STATE_INVALID", message: "enabled 必須是布林值。" }, 400);
    const result = await setPortalPluginEnabled(env, pluginId, body.enabled);
    if (!result.ok) return jsonResponse(result, result.code === "PLUGIN_NOT_FOUND" ? 404 : 503);
    await writeSystemAudit(env, {
      type: "portal_plugin_state",
      actorId: authed.qq,
      action: body.enabled ? "enabled" : "disabled",
      pluginId
    }).catch(() => {});
    return jsonResponse({ ...result, message: body.enabled ? "插件已啟用。" : "插件已停用。" });
  }

  const ownedPlugin = portalPluginForApiPath(path);
  if (ownedPlugin && !(await readPortalPluginEnabled(env, ownedPlugin.id))) {
    return jsonResponse({
      ok: false,
      code: "PLUGIN_DISABLED",
      pluginId: ownedPlugin.id,
      message: "此功能所屬插件目前已停用。請由 Developer / Root 到插件中心啟用。"
    }, 503);
  }

  const operationsResponse = await handleOpsPortalApi(request, env, url, path, body, authed);
  if (operationsResponse) return operationsResponse;

  const memberResponse = await handlePortalMemberApi(request, env, url, path, body, authed);
  if (memberResponse) return memberResponse;

  if (request.method === "GET" && path === "/me") {
    return jsonResponse({
      ok: true,
      session: authed,
      quota: groupId ? await getUserQuota(env, groupId, authed.qq) : "未选择群组",
      modelPreference: groupId ? (await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto") : "auto",
      privateAccess: await getPrivateAccessMode(env, authed.qq),
      flags: {
        privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
        privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
        privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    }, 200, { "Set-Cookie": portalSessionCookie(token, session.persistent ? DEFAULTS.portalSessionCookieSeconds : null) });
  }


  if (request.method === "GET" && path === "/appeals/eligible-groups") {
    if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉功能暂时关闭。" }, 503);
    const groups = await getAppealEligibleGroupsForUser(env, session.qq);
    return jsonResponse({ ok: true, groups, formerMemberDays: Number(DEFAULTS.appealFormerMemberDays || 30) });
  }



  if (request.method === "GET" && path === "/violations/mine") {
    const eligibleGroups = await getAppealEligibleGroupsForUser(env, session.qq);
    const allowed = new Map(eligibleGroups.map(group => [String(group.groupId), group]));
    const requestedGroupId = String(url.searchParams.has("groupId") ? (url.searchParams.get("groupId") || "") : (groupId || "")).replace(/\D/g, "");
    const groupIds = requestedGroupId ? [requestedGroupId] : [...allowed.keys()];
    if (requestedGroupId && !allowed.has(requestedGroupId)) return jsonResponse({ ok: false, message: "你目前没有查看该群违规记录的资格。" }, 403);
    const records = [];
    for (const targetGroupId of groupIds.slice(0, 100)) {
      if (!allowed.has(targetGroupId)) continue;
      const ids = await readJson(env, `ruleviolation:index:${targetGroupId}`, []);
      for (const id of ids.slice(-5000).reverse()) {
        const item = await readJson(env, `ruleviolation:${id}`, null);
        if (!item || String(item.userId) !== String(session.qq)) continue;
        records.push({
          id: item.id,
          groupId: item.groupId,
          groupName: allowed.get(targetGroupId)?.groupName || targetGroupId,
          content: item.content,
          violationType: item.violationType,
          reason: item.reason,
          confidence: item.confidence,
          severity: item.severity || "moderate",
          actionTaken: item.actionTaken,
          actionResult: item.actionResult,
          humanVerdict: item.humanVerdict || "",
          humanFeedbackNote: item.humanFeedbackNote || "",
          reversalResult: item.reversalResult || "",
          createdAt: item.createdAt,
          appealedByUser: Boolean(item.userAppealId),
          userAppealId: item.userAppealId || ""
        });
        if (records.length >= Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 500)))) break;
      }
    }
    records.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return jsonResponse({ ok: true, records, groups: eligibleGroups, selectedGroupId: requestedGroupId || "" });
  }

  if (request.method === "POST" && path === "/violations/appeal") {
    if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉功能暂时关闭。" }, 503);
    const ids = [...new Set((Array.isArray(body.violationIds) ? body.violationIds : [body.violationId]).map(value => String(value || "").trim()).filter(Boolean))].slice(0, 20);
    if (!ids.length) return jsonResponse({ ok: false, message: "请至少选择一条违规记录。" }, 400);
    const note = String(body.note || "").trim().slice(0, 3000);
    if (note.length < 2) return jsonResponse({ ok: false, message: "请简单说明为什么需要复核。" }, 400);
    const eligibleGroups = await getAppealEligibleGroupsForUser(env, session.qq);
    const allowedGroups = new Set(eligibleGroups.map(group => String(group.groupId)));
    const records = [];
    for (const id of ids) {
      const item = await readJson(env, `ruleviolation:${id}`, null);
      if (!item || String(item.userId) !== String(session.qq)) return jsonResponse({ ok: false, message: `找不到属于你的违规记录：${id}` }, 404);
      if (!allowedGroups.has(String(item.groupId))) return jsonResponse({ ok: false, message: "你已超过该群的申诉期限。" }, 403);
      records.push(item);
    }
    const groupIds = [...new Set(records.map(item => String(item.groupId)))];
    if (groupIds.length !== 1) return jsonResponse({ ok: false, message: "一次申诉只能选择同一个群的违规记录。" }, 400);
    const targetGroupId = groupIds[0];
    const appealId = `app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    const summary = records.map((item, index) => `${index + 1}. ${item.violationType || "其他"}｜${String(item.content || "").slice(0, 180)}｜处理：${item.actionResult || item.actionTaken || "仅记录"}`).join("\n");
    const appeal = {
      id: appealId,
      anonymousLabel: `匿名申诉-${appealId.slice(-6)}`,
      applicantId: String(session.qq),
      groupId: targetGroupId,
      type: "违规记录申诉",
      content: `申诉说明：${note}

所选违规记录：
${summary}`.slice(0, 4000),
      evidenceMessageId: "",
      violationIds: records.map(item => item.id),
      applicantMembership: eligibleGroups.find(group => String(group.groupId) === targetGroupId)?.former ? "former" : "current",
      status: "pending_owner",
      createdAt: new Date().toISOString(),
      reviewerIds: [],
      votes: {},
      approvalRule: "single",
      result: "",
      againstAdmin: false,
      recommendedReviewerRole: "developer_choice"
    };
    await dbPut(env, `appeal:${appealId}`, JSON.stringify(appeal));
    await appendIndex(env, "appeal:index", appealId, 5000);
    await appendIndex(env, `appeal:user:${session.qq}`, appealId, 200);
    for (const item of records) await updateRuleViolationRecord(env, item, { userAppealId: appealId, userAppealedAt: Date.now() });
    await writeSystemAudit(env, { type: "violation_appeal_submitted", groupId: targetGroupId, actorId: session.qq, targetId: appealId, action: "submit", violationIds: records.map(item => item.id) });
    await notifyDeveloper(env, `【收到违规记录申诉】
案件编号：${appealId}
群号：${targetGroupId}
申诉人QQ：${session.qq}
违规记录：${records.map(item => item.id).join("、")}
说明：${note}
请在 Control Center → 申诉处理 中审核。`);
    return jsonResponse({ ok: true, message: `已提交 ${records.length} 条违规记录的申诉，案件编号：${appealId}`, appealId });
  }

  if (request.method === "GET" && path === "/appeals/mine") {
    if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉功能暂时关闭。" }, 503);
    const ids = await readJson(env, `appeal:user:${session.qq}`, []); const appeals = [];
    for (const id of ids.slice(-100).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item) appeals.push({ id:item.id, groupId:item.groupId, type:item.type, content:item.content, evidenceMessageId:item.evidenceMessageId||"", violationIds:Array.isArray(item.violationIds)?item.violationIds:[], status:item.status, result:item.result||"", createdAt:item.createdAt }); }
    return jsonResponse({ ok:true, appeals });
  }
  if (request.method === "POST" && path === "/appeals/submit") {
    if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok:false, message:"申诉功能暂时关闭。" },503);
    const targetGroupId=String(body.groupId||session.groupId||"").replace(/\D/g,""); const groups=await getAppealEligibleGroupsForUser(env,session.qq);
    const eligibility=groups.find(g=>g.groupId===targetGroupId);
    if(!eligibility) return jsonResponse({ok:false,message:`请选择你当前所在的群，或退出后 ${DEFAULTS.appealFormerMemberDays} 天内仍可申诉的群。`},403);
    const type=String(body.type||"其他").trim().slice(0,40), content=String(body.content||"").trim().slice(0,4000);
    if(content.length<5) return jsonResponse({ok:false,message:"申诉内容至少需要 5 个字符。"},400);
    const id=`app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`; const appeal={id,anonymousLabel:`匿名申诉-${id.slice(-6)}`,applicantId:String(session.qq),groupId:targetGroupId,type,content,evidenceMessageId:String(body.evidenceMessageId||"").trim().slice(0,80),applicantMembership:eligibility.former?"former":"current",eligibilitySnapshot:eligibility,status:"pending_owner",createdAt:new Date().toISOString(),reviewerIds:[],votes:{},approvalRule:"single",result:"",againstAdmin:/管理|群主|开发者|開發者/i.test(type+content),recommendedReviewerRole:/管理|群主|开发者|開發者/i.test(type+content)?"owner":"developer_choice"};
    await dbPut(env,`appeal:${id}`,JSON.stringify(appeal)); await appendIndex(env,"appeal:index",id,5000); await appendIndex(env,`appeal:user:${session.qq}`,id,200);
    await notifyDeveloper(env,`【收到匿名申诉】\n编号：${id}\n群号：${targetGroupId}\n申诉人QQ：${session.qq}\n类型：${type}\n内容：${content}\n请在 Control Center 处理或指派审核人。`);
    return jsonResponse({ok:true,message:`匿名申诉已提交，案件编号：${id}`,appeal:{id,groupId:targetGroupId,type,status:appeal.status,createdAt:appeal.createdAt}});
  }


  if (request.method === "GET" && path === "/appeals/review") {
    const canReview = Boolean(permissions.appealReviewer || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canReview) return jsonResponse({ ok: false, message: "没有申诉处理权限。" }, 403);
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择需要处理申诉的群组。" }, 400);
    const statusFilter = String(url.searchParams.get("status") || "").trim();
    const ids = await readJson(env, "appeal:index", []);
    const appeals = [];
    const currentOwner = await isVerifiedGroupOwner(env, groupId, authed.qq);
    for (const id of ids.slice(-1000).reverse()) {
      const item = await readJson(env, `appeal:${id}`, null);
      if (!item || String(item.groupId) !== groupId) continue;
      if (statusFilter && String(item.status || "") !== statusFilter) continue;
      const safe = sanitizeAppealForReviewer(item, portalIsDeveloper);
      safe.canRevealIdentity = portalIsDeveloper;
      safe.canDecide = !item.againstAdmin || portalIsDeveloper || currentOwner;
      safe.identityText = portalIsDeveloper ? `QQ ${item.applicantId}` : "匿名申诉人";
      appeals.push(safe);
      if (appeals.length >= 500) break;
    }
    return jsonResponse({ ok: true, appeals, viewerIsDeveloper: portalIsDeveloper, viewerIsOwner: currentOwner });
  }
  if (request.method === "POST" && path === "/appeals/review") {
    const canReview = Boolean(permissions.appealReviewer || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canReview) return jsonResponse({ ok: false, message: "没有申诉处理权限。" }, 403);
    const item = await readJson(env, `appeal:${String(body.id || "")}`, null);
    if (!item || String(item.groupId) !== groupId) return jsonResponse({ ok: false, message: "找不到当前群的申诉案件。" }, 404);
    if (item.againstAdmin && !portalIsDeveloper && !(await isVerifiedGroupOwner(env, groupId, authed.qq))) return jsonResponse({ ok: false, message: "该申诉涉及管理层，只能由当前群主或开发者处理。" }, 403);
    if (["approved", "rejected"].includes(String(item.status || ""))) return jsonResponse({ ok: false, message: "该申诉已经处理完成，不能重复决定。" }, 409);
    const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : "";
    if (!decision) return jsonResponse({ ok: false, message: "请选择通过或驳回。" }, 400);
    const note = String(body.note || "").trim().slice(0, 2000);
    item.status = decision === "approve" ? "approved" : "rejected";
    item.result = note || (decision === "approve" ? "申诉通过" : "申诉驳回");
    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = String(authed.qq);
    item.reviewHistory = Array.isArray(item.reviewHistory) ? item.reviewHistory : [];
    item.reviewHistory.push({ reviewerId: String(authed.qq), decision, note: item.result, at: item.reviewedAt });
    const violationResolutionResults = [];
    if (Array.isArray(item.violationIds) && item.violationIds.length) {
      for (const violationId of item.violationIds.slice(0, 20)) {
        const violation = await readJson(env, `ruleviolation:${violationId}`, null);
        if (!violation || String(violation.groupId) !== String(groupId) || String(violation.userId) !== String(item.applicantId)) continue;
        if (decision === "approve") {
          try {
            const reversalResult = violation.humanVerdict === "not_violation" && violation.reversalResult
              ? violation.reversalResult
              : await reverseRuleViolationAction(env, violation, authed.qq);
            await updateRuleViolationRecord(env, violation, {
              humanVerdict: "not_violation",
              humanFeedbackBy: String(authed.qq),
              humanFeedbackAt: Date.now(),
              humanFeedbackNote: `申诉 ${item.id} 已通过：${item.result}`.slice(0, 1000),
              reversalResult,
              userAppealStatus: "approved"
            });
            violationResolutionResults.push({ violationId, ok: true, result: reversalResult || "已标记为误判" });
          } catch (error) {
            violationResolutionResults.push({ violationId, ok: false, result: String(error?.message || error) });
          }
        } else {
          await updateRuleViolationRecord(env, violation, { userAppealStatus: "rejected", userAppealReviewedAt: Date.now() });
          violationResolutionResults.push({ violationId, ok: true, result: "申诉未通过，原记录保留" });
        }
      }
    }
    item.violationResolutionResults = violationResolutionResults;
    await dbPut(env, `appeal:${item.id}`, JSON.stringify(item));
    await writeSystemAudit(env, { type: "appeal_review", groupId, actorId: authed.qq, targetId: item.id, action: decision, result: item.result, violationIds: Array.isArray(item.violationIds) ? item.violationIds : [], violationResolutionResults });
    await sendPortalVerificationMessage(env, item.applicantId, `【匿名申诉处理结果】
案件编号：${item.id}
群号：${item.groupId}
结果：${item.status === "approved" ? "申诉通过" : "申诉驳回"}
说明：${item.result}`).catch(() => null);
    return jsonResponse({ ok: true, message: item.status === "approved" ? "申诉已通过。" : "申诉已驳回。", appeal: sanitizeAppealForReviewer(item, portalIsDeveloper) });
  }

  if (request.method === "GET" && path === "/capabilities") {
    const botState = groupId ? await getBotGroupRole(env, groupId) : { role: "unknown" };
    const botRole = String(botState?.role || "unknown");
    return jsonResponse({
      ok: true,
      bot_role: botRole,
      bot_is_owner: botRole === "owner",
      can_native_admin_change: botRole === "owner",
      viewer_can_group_ops: Boolean(permissions.groupOps || permissions.nativeAdmin || permissions.developer),
      viewer_can_change_rule_monitor: role === "owner",
      viewer_can_view_owner_controls: Boolean(role === "owner" || permissions.developer)
    });
  }


  if(request.method==='GET'&&path==='/platform/features'){
    if(!portalIsDeveloper)return jsonResponse({ok:false,message:'功能权限中心仅开发者本人可见。'},403);
    const features=await listPlatformFeatures(env,{groupId,role:'developer',query:url.searchParams.get('q')||'',includeHidden:true});
    return jsonResponse({ok:true,total:PLATFORM_FEATURE_COUNT,visible:features.length,features,deploymentMode:'single_worker',paidCloudflareServices:false});
  }
  if(request.method==='POST'&&path==='/platform/features'){
    if(!portalIsDeveloper)return jsonResponse({ok:false,message:'功能权限中心仅开发者本人可修改。'},403);
    const feature=platformFeatureById(body.id);if(!feature)return jsonResponse({ok:false,message:'找不到功能 ID。'},404);
    if(/(?:群規持續監控|AI 踢出群主授權|AI 拒絕入群群主授權)/.test(feature.name)&&!(await isVerifiedGroupOwner(env,groupId,authed.qq)))return jsonResponse({ok:false,message:'這項高風險設定只能由 NapCat 即時確認的真實群主修改。'},403);
    const result=await setPlatformFeature(env,{feature,groupId,enabled:Boolean(body.enabled),actorId:authed.qq,actorRole:portalIsDeveloper?'developer':role,auditMode:portalIsDeveloper&&body.auditMode==='silent'?'silent':'log'});return jsonResponse(result,result.ok?200:403);
  }
  if(request.method==='GET'&&path==='/platform/traces'){
    if(!(permissions.aiAdmin||permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少 Trace 查看權限。'},403);
    return jsonResponse({ok:true,traces:await listPlatformTraces(env,{groupId:portalIsDeveloper&&url.searchParams.get('all')==='1'?'':groupId,query:url.searchParams.get('q')||'',limit:Number(url.searchParams.get('limit')||200)})});
  }
  if(request.method==='GET'&&path==='/platform/jobs'){
    if(!(permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少任務中心權限。'},403);
    return jsonResponse({ok:true,jobs:await listPlatformJobs(env,{groupId:portalIsDeveloper&&url.searchParams.get('all')==='1'?'':groupId,status:url.searchParams.get('status')||'',limit:Number(url.searchParams.get('limit')||200)})});
  }
  if(request.method==='POST'&&path==='/platform/jobs'){
    if(!(permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少建立任務權限。'},403);
    const job=await enqueuePlatformJob(env,{type:String(body.type||'audit'),groupId,actorId:authed.qq,message:String(body.message||'').slice(0,4000),action:String(body.action||'manual'),nextRunAt:Number(body.nextRunAt||Date.now()),maxAttempts:Number(body.maxAttempts||3)});await appendPlatformTrace(env,{type:'job_created',groupId,actorId:authed.qq,jobId:job.id});return jsonResponse({ok:true,message:'任務已加入 D1 任務列。',job});
  }

  if (request.method === "GET" && path === "/settings-center") {
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const requestedTargetQq = String(url.searchParams.get("targetQq") || authed.qq).replace(/\D/g, "");
    if (!requestedTargetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    if (!portalIsDeveloper && requestedTargetQq !== String(authed.qq)) return jsonResponse({ ok: false, message: "非开发者只能修改自己的个人设置与当前权限允许的群设置。" }, 403);
    const targetQq = portalIsDeveloper ? requestedTargetQq : String(authed.qq);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const effectiveViewerRole = portalIsDeveloper
      ? "developer"
      : role === "owner"
        ? "owner"
        : (permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin")
          ? "admin"
          : "member";
    const visibleRank = portalRoleRank(effectiveViewerRole);
    const settings = [];
    for (const definition of PORTAL_SETTING_DEFINITIONS) {
      if (portalRoleRank(definition.minRole) > visibleRank) continue;
      const visibleDefinition = definition.key === "model_preference"
        ? {
            ...definition,
            options: portalIsDeveloper ? definition.options : definition.options.filter(value => !String(value).startsWith("deepseek")),
            optionLabels: { auto: "自动", gemma_26b: "Gemma 26B", gemma_31b: "Gemma 31B", gemini: "Gemini", deepseek: "DeepSeek", deepseek_high: "DeepSeek High", deepseek_max: "DeepSeek Max" }
          }
        : definition;
      settings.push({ ...visibleDefinition, value: await readPortalSettingValue(env, definition, groupId, targetQq) });
    }
    return jsonResponse({ ok: true, targetQq, targetRole, viewerRole: effectiveViewerRole, settings, canEditTargetQq: portalIsDeveloper, canDisableAuditLog: portalIsDeveloper });
  }
  if (request.method === "POST" && path === "/settings-center") {
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const requestedTargetQq = String(body.targetQq || authed.qq).replace(/\D/g, "");
    if (!requestedTargetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    if (!portalIsDeveloper && requestedTargetQq !== String(authed.qq)) return jsonResponse({ ok: false, message: "非开发者只能修改自己的个人设置与当前权限允许的群设置。" }, 403);
    const targetQq = portalIsDeveloper ? requestedTargetQq : String(authed.qq);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const effectiveActorRole = portalIsDeveloper
      ? "developer"
      : role === "owner"
        ? "owner"
        : (permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin")
          ? "admin"
          : "member";
    const actorRank = portalRoleRank(effectiveActorRole);
    const requested = Array.isArray(body.settings)
      ? body.settings
      : [{ key: String(body.key || ""), value: body.value }];
    if (!requested.length) return jsonResponse({ ok: false, message: "没有需要保存的设置。" }, 400);
    const definitions = [];
    for (const update of requested) {
      const definition = PORTAL_SETTING_DEFINITIONS.find(item => item.key === String(update?.key || ""));
      if (!definition) return jsonResponse({ ok: false, message: `未知设置项目：${String(update?.key || "")}` }, 400);
      if (portalRoleRank(definition.minRole) > actorRank) return jsonResponse({ ok: false, message: `你的权限等级无法修改“${definition.label}”。` }, 403);
      const currentValue = await readPortalSettingValue(env, definition, groupId, targetQq);
      const normalizedIncoming = definition.type === "boolean" ? Boolean(update.value) : String(update.value ?? "");
      const normalizedCurrent = definition.type === "boolean" ? Boolean(currentValue) : String(currentValue ?? "");
      if (normalizedIncoming === normalizedCurrent) continue;
      const normalizedProxyMode = definition.key === "rule_proxy_mode" ? normalizeRuleProxyMode(update.value) : "";
      if (["rule_monitor_enabled", "rule_proxy_kick_authorized", "join_reject_authorized"].includes(definition.key) && !(await isVerifiedGroupOwner(env, groupId, authed.qq))) {
        return jsonResponse({ ok: false, message: `“${definition.label}”只能由 NapCat 即时确认的当前群主修改。` }, 403);
      }
      if (definition.key === "rule_proxy_mode" && normalizedProxyMode === "auto" && !(await isVerifiedGroupOwner(env, groupId, authed.qq))) {
        return jsonResponse({ ok: false, message: "AI 群规代理的 auto 模式只能由当前真实群主启用；管理员可使用 record、warn 或 mute。" }, 403);
      }
      if (definition.key === "model_preference") {
        const requestedPref = normalizeModelPreference(update.value);
        if (!requestedPref) return jsonResponse({ ok: false, message: "未知模型偏好。" }, 400);
        if (!portalIsDeveloper && String(requestedPref).startsWith("deepseek")) return jsonResponse({ ok: false, message: "DeepSeek 暂不对普通成员开放；免费模型连续失败时系统会临时开放并记录时段。" }, 403);
      }
      definitions.push({ definition, value: update.value });
    }
    if (!definitions.length) return jsonResponse({ ok: true, message: "没有检测到设置变化。", targetRole });
    for (const entry of definitions) await writePortalSettingValue(env, entry.definition, groupId, targetQq, entry.value);
    const auditMode = portalIsDeveloper && body.auditMode === "silent" ? "silent" : "log";
    if (auditMode === "log") await writeSystemAudit(env, {
      type: "settings_center", groupId, actorId: authed.qq, targetId: targetQq, targetRole,
      action: "bulk_update", keys: definitions.map(entry => entry.definition.key)
    });
    return jsonResponse({ ok: true, message: auditMode === "silent" ? `已保存 ${definitions.length} 项设置（未记录操作日志）。` : `已保存 ${definitions.length} 项设置并记录操作日志。`, targetRole });
  }

  if (request.method === "GET" && path === "/integrations/bilibili") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少 B站监控管理权限。" }, 403);
    const connectors = await listBilibiliConnectors(env, groupId);
    return jsonResponse({
      ok: true,
      connectors: connectors.map(item => { const { webhookSecret, ...safe } = item; return { ...safe, mode: item.mode === "generic_webhook" ? "official_webhook" : "automatic_polling", webhookUrl: item.webhookSecret ? `${url.origin}/api/integrations/bilibili/webhook/${item.webhookSecret}` : "" }; }),
      note: "推荐使用哔哩哔哩开放平台 Webhook 或经过合法授权的中继。412／429 属于平台风控，系统不会伪造身份、代理轮换或提高频率绕过；兼容轮询最低 30 分钟一次并自动退避。"
    });
  }
  if (request.method === "POST" && path === "/integrations/bilibili") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少 B站监控管理权限。" }, 403);
    const action = String(body.action || "save");
    if (action === "delete") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.webhookSecret) await dbDel(env, `bili:webhook_secret:${item.webhookSecret}`);
      await dbDel(env, `bili:connector:${item.id}`);
      const ids = await readJson(env, `bili:connector:index:${groupId}`, []);
      await dbPut(env, `bili:connector:index:${groupId}`, JSON.stringify(ids.filter(id => id !== item.id)));
      await removeFromIndex(env, "bili:connector:index:all", item.id);
      return jsonResponse({ ok: true, message: "B站自动监控已删除。" });
    }

    if (action === "rotate_webhook") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode !== "generic_webhook") return jsonResponse({ ok: false, message: "当前不是 Webhook 模式。" }, 400);
      if (item.webhookSecret) await dbDel(env, `bili:webhook_secret:${item.webhookSecret}`);
      item.webhookSecret = crypto.randomUUID().replaceAll("-", "");
      item.updatedAt = Date.now();
      await dbPut(env, `bili:webhook_secret:${item.webhookSecret}`, item.id);
      await dbPut(env, `bili:connector:${item.id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: "rotate_webhook", connectorId: item.id, creatorId: item.creatorId });
      return jsonResponse({ ok: true, message: "Webhook 回调密钥已重新生成；旧地址立即失效。", webhookUrl: `${url.origin}/api/integrations/bilibili/webhook/${item.webhookSecret}` });
    }
    if (action === "switch_mode") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      const nextMode = body.mode === "official_webhook" ? "generic_webhook" : "automatic_polling";
      if (item.webhookSecret && nextMode !== "generic_webhook") {
        await dbDel(env, `bili:webhook_secret:${item.webhookSecret}`);
        delete item.webhookSecret;
      }
      let webhookUrl = "";
      if (nextMode === "generic_webhook") {
        item.webhookSecret = item.webhookSecret || crypto.randomUUID().replaceAll("-", "");
        await dbPut(env, `bili:webhook_secret:${item.webhookSecret}`, item.id);
        webhookUrl = `${url.origin}/api/integrations/bilibili/webhook/${item.webhookSecret}`;
        item.pollIntervalSeconds = 0;
        item.nextPollAt = 0;
      } else {
        item.pollIntervalSeconds = bilibiliPollIntervalSeconds(body.pollIntervalSeconds || BILIBILI_POLL_DEFAULT_SECONDS);
        item.nextPollAt = Date.now();
      }
      item.mode = nextMode;
      item.updatedAt = Date.now();
      await dbPut(env, `bili:connector:${item.id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: "switch_mode", connectorId: item.id, creatorId: item.creatorId, mode: nextMode });
      return jsonResponse({
        ok: true,
        message: nextMode === "generic_webhook"
          ? "已切换为 Webhook：现在只等待外部事件，不会主动检查 B站。"
          : "已切换为兼容轮询：可以使用检查频率与立即检查。",
        webhookUrl
      });
    }
    if (action === "webhook_self_test") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode !== "generic_webhook" || !item.webhookSecret) return jsonResponse({ ok: false, message: "请先切换为 Webhook 模式。" }, 400);
      const mapped = await dbGet(env, `bili:webhook_secret:${item.webhookSecret}`);
      if (String(mapped || "") !== String(item.id)) return jsonResponse({ ok: false, message: "Webhook 密钥映射异常，请重新生成回调地址。" }, 409);
      const testEvent = { type: "video_publish", creatorId: item.creatorId, creatorName: item.creatorName, title: "Webhook 接收自检事件", url: `https://space.bilibili.com/${item.creatorId}`, eventId: `webhook-self-test:${Date.now()}` };
      const result = await sendBilibiliConnectorNotification(env, item, testEvent);
      item.lastWebhookTestAt = Date.now();
      item.lastWebhookTestOk = Boolean(result.ok);
      item.lastWebhookTestError = result.ok ? "" : String(result.error || "发送失败").slice(0, 500);
      await dbPut(env, `bili:connector:${item.id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: "webhook_self_test", connectorId: item.id, ok: result.ok, error: item.lastWebhookTestError });
      return jsonResponse({ ok: result.ok, message: result.ok ? "Webhook 端点、密钥映射与 QQ 通知发送均通过自检。外部平台仍需实际 POST 事件才能自动通知。" : `Webhook 密钥有效，但 QQ 通知发送失败：${item.lastWebhookTestError}` }, result.ok ? 200 : 502);
    }
    if (action === "test") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      const eventType = body.eventType === "video_publish" ? "video_publish" : "live_start";
      const result = await sendBilibiliConnectorNotification(env, item, { type: eventType, creatorId: item.creatorId, creatorName: item.creatorName, title: eventType === "live_start" ? "测试直播通知" : "测试新视频通知", url: `https://space.bilibili.com/${item.creatorId}`, eventId: `test:${Date.now()}` });
      return jsonResponse({ ok: result.ok, message: result.ok ? "测试通知已处理。" : result.error }, result.ok ? 200 : 502);
    }
    if (action === "check_now") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode === "generic_webhook") return jsonResponse({ ok: false, message: "Webhook 模式不执行主动抓取；请从开放平台或授权中继发送测试事件。" }, 400);
      const result = await pollOneAutomaticBilibiliConnector(env, item, Date.now(), { force: true });
      const { webhookSecret, ...safeConnector } = result.connector || item;
      return jsonResponse({ ok: result.ok, message: result.ok ? (result.baseline ? "检查成功，已建立当前状态基准。" : `检查成功，发现 ${result.events?.length || 0} 个新事件。`) : `检查失败：${result.message}`, connector: safeConnector }, result.ok ? 200 : 502);
    }
    if (action === "update_interval") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode === "generic_webhook") return jsonResponse({ ok: false, message: "Webhook 模式没有轮询频率。" }, 400);
      item.pollIntervalSeconds = bilibiliPollIntervalSeconds(body.pollIntervalSeconds || item.pollIntervalSeconds);
      item.nextPollAt = Date.now() + item.pollIntervalSeconds * 1000;
      item.updatedAt = Date.now();
      await dbPut(env, `bili:connector:${item.id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: "update_interval", connectorId: item.id, creatorId: item.creatorId, pollIntervalSeconds: item.pollIntervalSeconds });
      return jsonResponse({ ok: true, message: `检查频率已改为每 ${Math.round(item.pollIntervalSeconds / 60)} 分钟。`, connector: item });
    }
    const id = String(body.id || `bili_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
    const existing = await readJson(env, `bili:connector:${id}`, null);
    const requestedMode = body.mode === "official_webhook" ? "generic_webhook" : "automatic_polling";
    const creatorId = normalizeBilibiliUid(body.creatorId || existing?.creatorId || "");
    if (!creatorId) return jsonResponse({ ok: false, message: "请填写 B站用户的数字 UID，用于核对事件来源。" }, 400);
    const item = {
      ...existing,
      id, groupId,
      creatorId,
      creatorName: String(body.creatorName || existing?.creatorName || "").trim().slice(0, 120),
      mode: requestedMode,
      enabled: body.enabled !== false,
      pollIntervalSeconds: requestedMode === "automatic_polling" ? bilibiliPollIntervalSeconds(body.pollIntervalSeconds || existing?.pollIntervalSeconds) : 0,
      liveNotify: Boolean(body.liveNotify), liveAtAll: Boolean(body.liveAtAll),
      videoNotify: Boolean(body.videoNotify), videoAtAll: Boolean(body.videoAtAll),
      createdBy: existing?.createdBy || authed.qq,
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      nextPollAt: 0
    };
    if (existing?.webhookSecret && requestedMode !== "generic_webhook") await dbDel(env, `bili:webhook_secret:${existing.webhookSecret}`);
    let webhookUrl = "";
    if (requestedMode === "generic_webhook") {
      item.webhookSecret = existing?.webhookSecret || crypto.randomUUID().replaceAll("-", "");
      await dbPut(env, `bili:webhook_secret:${item.webhookSecret}`, id);
      webhookUrl = `${url.origin}/api/integrations/bilibili/webhook/${item.webhookSecret}`;
    } else {
      delete item.webhookSecret;
    }
    await dbPut(env, `bili:connector:${id}`, JSON.stringify(item));
    await appendIndex(env, `bili:connector:index:${groupId}`, id, 500);
    await appendIndex(env, "bili:connector:index:all", id, 5000);
    await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: existing ? "update" : "create", connectorId: id, creatorId, mode: requestedMode, pollIntervalSeconds: item.pollIntervalSeconds });
    const { webhookSecret, ...safeItem } = item;
    return jsonResponse({
      ok: true,
      message: requestedMode === "generic_webhook"
        ? "Webhook 监控已保存。请把回调地址配置到哔哩哔哩开放平台，或合法授权的事件中继。"
        : "兼容轮询已保存；首次检查只建立基准。建议优先改用 Webhook。",
      connector: safeItem,
      webhookUrl
    });
  }

  if (request.method === "GET" && path === "/health/model-candidates") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, message: "单一 API 模型检查仅开发者可用。" }, 403);
    return jsonResponse({ ok: true, candidates: apiModelHealthCandidates(env), limits: {
      imageMiB: AI_MEDIA_LIMITS.imageBytes / 1024 / 1024,
      audioMiB: AI_MEDIA_LIMITS.audioBytes / 1024 / 1024,
      videoMiB: AI_MEDIA_LIMITS.videoBytes / 1024 / 1024,
      forwardBundles: AI_MEDIA_LIMITS.forwardBundles,
      forwardNodes: AI_MEDIA_LIMITS.forwardNodes,
      forwardTextChars: AI_MEDIA_LIMITS.forwardTextChars,
      documentMode: "仅记录名称、大小与资源标识；不解析 PDF、Office 或压缩包正文"
    } });
  }
  if (request.method === "POST" && path === "/health/model-check") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, message: "单一 API 模型检查仅开发者可用，因为可能消耗模型额度。" }, 403);
    try {
      const result = await runSingleApiModelHealthCheck(env, { provider: body.provider, model: body.model, keyPool: body.keyPool });
      await writeSystemAudit(env, { type: "single_model_health_check", groupId, actorId: authed.qq, action: `${result.provider}:${result.model}`, latencyMs: result.latencyMs });
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ ok: false, message: String(error?.message || error), attempts: Array.isArray(error?.attempts) ? error.attempts : [], checkedAt: new Date().toISOString() }, 502);
    }
  }

  if (request.method === "GET" && path === "/health") {
    const mode = url.searchParams.get("mode") === "full" ? "full" : "quick";
    if (mode === "full" && !portalIsDeveloper) return jsonResponse({ ok: false, message: "完整健康检查仅开发者可执行，因为会发送最小模型请求。" }, 403);
    return jsonResponse(await runHealthChecks(env, { mode }));
  }

  if (request.method === "GET" && path === "/models") {
    const health = await readJson(env, "health:last:quick", null);
    const lastByName = Object.fromEntries((health?.checks || []).map(item => [item.name, item]));
    const visionConfigured = imageInspectionEnabled(env);
    const pools = partitionGoogleApiKeys(env);
    const registryMap = new Map();
    const addModelRole = (id, { provider, family, billing, capabilityCodes = [], status = "unknown", priority = 0 }) => {
      const modelId = String(id || "").trim();
      if (!modelId) return;
      const current = registryMap.get(modelId) || { id: modelId, provider, family, billing, capabilityCodes: [], priority, status };
      current.provider = provider || current.provider;
      current.family = family || current.family;
      current.billing = billing || current.billing;
      current.priority = Math.min(Number(current.priority || priority || 9999), Number(priority || 9999));
      current.capabilityCodes = [...new Set([...(current.capabilityCodes || []), ...capabilityCodes])];
      if (modelHealthStatusRank(status) > modelHealthStatusRank(current.status)) current.status = status;
      registryMap.set(modelId, current);
    };
    const geminiHealth = lastByName["Gemini API 连通性"]?.status || "unknown";
    const gemma26Health = lastByName["Gemma 4 26B 模型"]?.status || "unknown";
    const gemma31Health = lastByName["Gemma 4 31B 模型"]?.status || "unknown";
    const chatModels = await effectiveRuntimeModels(env, "chat");
    const decisionModels = await effectiveRuntimeModels(env, "decision");
    const fallbackModels = await effectiveRuntimeModels(env, "last_resort");
    chatModels.forEach((id, index) => {
      const gemma = /^gemma-/i.test(id);
      addModelRole(id, {
        provider: "Google",
        family: gemma ? "Gemma" : "Gemini",
        billing: "Google 免费层额度",
        capabilityCodes: gemma ? ["text", "chat"] : ["text", "chat", ...(visionConfigured ? ["vision"] : [])],
        priority: index + 1,
        status: gemma ? (id.includes("31b") ? gemma31Health : gemma26Health) : geminiHealth
      });
    });
    decisionModels.forEach((id, index) => addModelRole(id, {
      provider: "Google", family: /^gemma-/i.test(id) ? "Gemma" : "Gemini", billing: "Google 免费层额度", capabilityCodes: ["text", "decision", "routing"], priority: index + 1, status: /^gemma-/i.test(id) ? (id.includes("31b") ? gemma31Health : gemma26Health) : geminiHealth
    }));
    fallbackModels.forEach((id, index) => addModelRole(id, {
      provider: "Google", family: /^gemma-/i.test(id) ? "Gemma" : "Gemini", billing: "Google 免费层额度", capabilityCodes: ["text", "chat", "routing"], priority: index + 1, status: /^gemma-/i.test(id) ? (id.includes("31b") ? gemma31Health : gemma26Health) : geminiHealth
    }));
    const deepseekModel = env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel;
    addModelRole(deepseekModel, {
      provider: "DeepSeek", family: "DeepSeek Flash", billing: "付费余额／受每日预算限制", capabilityCodes: ["text", "context_summary", "code", "emergency_chat"], priority: 1, status: lastByName["DeepSeek API 连通性"]?.status || (deepSeekApiKeys(env).length ? "unknown" : "unconfigured")
    });
    const registry = [...registryMap.values()].map(item => ({
      ...item,
      statusLabel: modelHealthStatusLabel(item.status),
      capabilities: item.capabilityCodes.map(modelCapabilityLabel)
    }));
    const deepseekDailyBudgetCny = await getQuotaNumber(env, "quota:deepseek:global_daily_cny", Number(env.DEEPSEEK_DAILY_BUDGET_CNY || 0.35));
    const emergencyWindows = portalIsDeveloper ? await listDeepSeekEmergencyWindows(env, 100) : [];
    return jsonResponse({
      ok: true,
      models: registry,
      routing: {
        decision: `Gemma 审查优先（${pools.gemmaDecision.length} 把 Key），失败后 Gemini 审查（${pools.geminiDecision.length} 把 Key）`,
        chat: `Gemini 聊天优先（${pools.geminiChat.length} 把 Key），Gemma 聊天备用（${pools.gemmaChat.length} 把 Key）`,
        vision: visionConfigured ? `Gemini 独立图片 Key 池（${geminiVisionApiKeys(env).length} 把）` : "未配置，自动关闭",
        search: geminiSearchApiKeys(env).length ? `Gemini 独立搜索 Key 池（${geminiSearchApiKeys(env).length} 把）` : "未配置独立搜索 Key",
        contextSummary: "DeepSeek 优先整理聊天上下文、会议纪要与吃瓜总结；失败时回退 Google 免费模型",
        deepseekChat: portalIsDeveloper ? "开发者可手动使用；普通成员仅在 Google 免费模型连续失败后临时开放" : "普通成员不可手动选择；仅连续失败后临时开放"
      },
      keyPools: portalIsDeveloper ? {
        totalGoogleKeys: baseGoogleApiKeys(env).length,
        gemmaDecision: pools.gemmaDecision.length,
        gemmaChat: pools.gemmaChat.length,
        geminiDecision: pools.geminiDecision.length,
        geminiChat: pools.geminiChat.length
      } : undefined,
      deepseekPolicy: {
        normalMemberManualAccess: false,
        developerManualAccess: true,
        failureThreshold: Number(DEFAULTS.deepseekEmergencyFailureThreshold || 3),
        failureWindowMinutes: Math.round(Number(DEFAULTS.deepseekEmergencyFailureWindowMs || 900000) / 60000),
        accessWindowMinutes: Math.round(Number(DEFAULTS.deepseekEmergencyAccessWindowMs || 600000) / 60000),
        recordsNeverAutoDeleted: true
      },
      deepseekEmergencyWindows: emergencyWindows,
      costPolicy: { mode: String(env.MODEL_COST_POLICY || DEFAULTS.modelCostPolicy), geminiBilling: "free_tier", deepseekBilling: "paid_limited", deepseekDailyBudgetCny, emergencyFallback: envFlag(env.DEEPSEEK_EMERGENCY_FALLBACK, DEFAULTS.deepseekEmergencyFallback), paidContextSummary: true }
    });
  }

  if (request.method === "GET" && path === "/tasks") {
    if (!portalIsDeveloper && !groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const status = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json().catch(() => ({}));
    const queues = Array.isArray(status.queues) ? status.queues : [];
    const visible = portalIsDeveloper ? queues : queues.filter(item => String(item.groupId || "") === String(groupId));
    return jsonResponse({ ok: true, inFlightQuestions: visible.filter(item => item.startedAt).length, queuedQuestions: visible.reduce((sum, item) => sum + (item.queued?.length || 0), 0), queues: visible });
  }

  if (request.method === "POST" && path === "/tasks/cancel") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少任务管理权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    const targetUser = String(body.userId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能管理当前群的任务。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup, userId: targetUser, messageId: String(body.messageId || "") }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "任务取消失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/tasks/clear") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少清空等待列权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能清空当前群等待列。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "等待列清空失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/simulator") {
    const text = String(body.text || "").trim();
    const requestedSenderRole = String(body.senderRole || body.role || body.sender_role || "member");
    const senderRole = ["owner", "admin", "member"].includes(requestedSenderRole) ? requestedSenderRole : "member";
    const mentionsBot = Boolean(body.mentionsBot);
    const hasImage = Boolean(body.hasImage);
    const currentlyBusy = Boolean(body.currentlyBusy);
    const isCommand = /^[!！]/.test(text);
    const localManagement = ["owner", "admin"].includes(senderRole) ? localModerationIntent(text) : { action: "none", confidence: 0 };
    const managementCandidate = localManagement.action !== "none" && !isCommand;
    const explicitQuestion = mentionsBot && Boolean(text || hasImage) && !isCommand && !managementCandidate;
    const interjectRate = groupId ? Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate))) : DEFAULTS.interjectRate;
    let final = "静默";
    if (isCommand) final = "执行指令；指令回复不写入聊天记忆";
    else if (managementCandidate) final = `建立「${moderationActionLabel(localManagement.action)}」提案，等待二次确认；不直接执行`;
    else if (explicitQuestion && currentlyBusy) final = "加入该群友的个人等待列";
    else if (explicitQuestion) final = "立即进入 AI 回答流程";
    else if (interjectRate > 0) final = "可进入随机插话候选；仍需 Gemma 判断与概率检查";
    return jsonResponse({ ok: true, parsed: { text, senderRole, mentionsBot, hasImage, isCommand, managementCandidate, managementAction: localManagement.action, explicitQuestion, currentlyBusy, interjectRate }, decisions: { queue: explicitQuestion && currentlyBusy, thinking: explicitQuestion && !currentlyBusy, recordReply: explicitQuestion && !isCommand, commandOrSystemRecordedAsChat: false, final }, steps: ["解析 OneBot 事件", `发送者角色：${senderRole}`, mentionsBot ? "检测到 @机器人" : "未检测到 @机器人", managementCandidate ? `检测到待确认操作：${moderationActionLabel(localManagement.action)}` : "未检测到明确待确认操作", final] });
  }

  if (request.method === "GET" && path === "/group-bindings") {
    const groups = await enrichPortalGroupsWithBindings(env, await getWhitelistedGroupsForUser(env, session.qq));
    const family = groupId ? await getGroupFamilyForGroup(env, groupId) : null;
    let canEdit = false;
    if (family?.headGroupId) {
      const headRole = await resolvePortalRole(env, session.qq, family.headGroupId);
      canEdit = portalIsDeveloper || ["owner", "admin"].includes(headRole);
    } else if (groupId) {
      canEdit = portalIsDeveloper || ["owner", "admin"].includes(role);
    }
    return jsonResponse({
      ok: true,
      groups,
      family,
      canEdit,
      generatedJoinUrl: family?.headGroupId ? `${url.origin}/join/${family.headGroupId}` : "",
      defaultGroupId: String(await dbGet(env, `private_default_group:${session.qq}`) || "")
    });
  }

  if (request.method === "POST" && path === "/group-bindings") {
    const customJoinUrlRaw = String(body.customJoinUrl || "").trim();
    if (customJoinUrlRaw && !normalizeJoinUrl(customJoinUrlRaw)) return jsonResponse({ ok: false, message: "自订加入链接格式无效，只接受 http、https 或 mqqapi 链接。" }, 400);
    const headGroupId = String(body.headGroupId || groupId || "").replace(/\D/g, "");
    const available = await getWhitelistedGroupsForUser(env, session.qq);
    const availableIds = new Set(available.map(item => String(item.groupId)));
    if (!availableIds.has(headGroupId) && !portalIsDeveloper) return jsonResponse({ ok: false, message: "总群必须是你已加入且启用 QQAI 的群。" }, 403);
    const headRole = await resolvePortalRole(env, session.qq, headGroupId);
    if (!(portalIsDeveloper || ["owner", "admin"].includes(headRole))) return jsonResponse({ ok: false, message: "只有总群的 QQ 管理员、群主或开发者可以建立多群绑定。" }, 403);
    const branches = (Array.isArray(body.branches) ? body.branches : []).filter(item => portalIsDeveloper || availableIds.has(String(item?.groupId || "")));
    const family = await saveGroupFamily(env, { ...body, headGroupId, branches, updatedBy: session.qq });
    await writeSystemAudit(env, { type: "group_family_binding", groupId: headGroupId, actorId: session.qq, action: "save", branchGroupIds: family.branches.map(item => item.groupId) });
    return jsonResponse({ ok: true, family, generatedJoinUrl: `${url.origin}/join/${family.headGroupId}`, message: "多群绑定与总群引导已保存。" });
  }

  if (request.method === "POST" && path === "/group-bindings/default") {
    const targetGroupId = String(body.groupId || "").replace(/\D/g, "");
    const available = await getWhitelistedGroupsForUser(env, session.qq);
    if (!available.some(item => String(item.groupId) === targetGroupId)) return jsonResponse({ ok: false, message: "默认群必须是你已加入且启用 QQAI 的群。" }, 403);
    await dbPut(env, `private_default_group:${session.qq}`, targetGroupId);
    await writeSystemAudit(env, { type: "group_family_default", groupId: targetGroupId, actorId: session.qq, action: "set_private_default_group" });
    return jsonResponse({ ok: true, defaultGroupId: targetGroupId, message: "默认群已保存；私聊建立排程时会使用此群。" });
  }

  if (request.method === "POST" && path === "/group-bindings/guide") {
    const branchGroupId = String(body.branchGroupId || groupId || "").replace(/\D/g, "");
    const family = await getGroupFamilyForGroup(env, branchGroupId);
    if (!family) return jsonResponse({ ok: false, message: "该群尚未绑定总群。" }, 404);
    const headRole = await resolvePortalRole(env, session.qq, family.headGroupId);
    if (!(portalIsDeveloper || ["owner", "admin"].includes(headRole))) return jsonResponse({ ok: false, message: "只有总群管理层可以提醒分群成员加入总群。" }, 403);
    const generatedJoinUrl = `${url.origin}/join/${family.headGroupId}`;
    const requestedJoinUrlRaw = String(body.joinUrl || "").trim();
    const requestedJoinUrl = normalizeJoinUrl(requestedJoinUrlRaw);
    if (requestedJoinUrlRaw && !requestedJoinUrl) return jsonResponse({ ok: false, message: "自订加入链接格式无效，只接受 http、https 或 mqqapi 链接。" }, 400);
    const selectedJoinUrl = requestedJoinUrl || normalizeJoinUrl(family.customJoinUrl) || generatedJoinUrl;
    const customText = String(body.text || "").trim();
    const message = `${customText || family.guideText || "请加入总群，以便接收完整公告、群规与活动通知。"}\n总群：${family.headAlias || family.headGroupId}\n加入入口：${selectedJoinUrl}`;
    try {
      const result = await sendMissingHeadGroupGuide(env, { family, branchGroupId, text: message });
      await writeSystemAudit(env, { type: "group_family_guide", groupId: branchGroupId, actorId: session.qq, action: "mention_missing", targetId: family.headGroupId, recipients: result.recipients });
      return jsonResponse({ ok: true, result, message: result.recipients ? `已提醒 ${result.recipients} 名尚未加入总群的分群成员。` : result.message });
    } catch (error) {
      return jsonResponse({ ok: false, message: `提醒失败：${String(error?.message || error)}` }, 502);
    }
  }

  if (!groupId && !path.startsWith("/root/")) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (groupId && !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群已不在白名单。" }, 403);


  if (request.method === "GET" && path === "/group-work") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群务查看权限。" }, 403);
    const ids = await readJson(env, `groupwork:index:${groupId}`, []); const items = [];
    for (const id of ids.slice(-200).reverse()) { const item = await readJson(env, `groupwork:${id}`, null); if (item) items.push(item); }
    return jsonResponse({ ok: true, items });
  }
  if (request.method === "POST" && path === "/group-work/decision") {
    const result = await handleGroupWorkDecision(env, { groupId, actorId: authed.qq, id: String(body.id || ""), decision: body.decision === "cancel" ? "cancel" : "confirm" });
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "GET" && path === "/group-members") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return jsonResponse({ ok: false, message: "缺少群成员查看权限。" }, 403);
    try {
      const members = await getLiveGroupMemberList(env, groupId);
      return jsonResponse({ ok: true, members });
    } catch (error) {
      return jsonResponse({ ok: false, message: `群成员读取失败：${String(error?.message || error)}` }, 502);
    }
  }

  if (request.method === "GET" && path === "/conversations") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return jsonResponse({ ok: false, message: "缺少对话记录管理权限。" }, 403);
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const ids = await readJson(env, `conversation:index:${groupId}`, []);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const violationOnly = url.searchParams.get("violation") === "1";
    const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));
    const requestedPageSize = Math.floor(Number(url.searchParams.get("pageSize") || url.searchParams.get("limit") || 20) || 20);
    const pageSize = Math.max(1, Math.min(100, requestedPageSize));
    const orderedIds = ids.slice(-5000).reverse();
    const botRuleState = await getBotGroupRole(env, groupId);
    const recordViolationAvailable = botCanRunRuleMonitor(botRuleState);

    const readConversation = async id => {
      const item = await readJson(env, `conversation:${groupId}:${id}`, null);
      return item && item.source === "group_member" ? item : null;
    };
    const enrichConversation = async item => {
      if (!item) return null;
      const violation = item.violationId ? await readJson(env, `ruleviolation:${item.violationId}`, null) : null;
      return { ...item, violation: violation ? { id: violation.id, type: violation.violationType, reason: violation.reason, actionTaken: violation.actionTaken, actionResult: violation.actionResult, humanVerdict: violation.humanVerdict } : null };
    };

    let total = 0;
    let page = requestedPage;
    let items = [];
    if (!q && !violationOnly) {
      total = orderedIds.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, totalPages);
      const pageIds = orderedIds.slice((page - 1) * pageSize, page * pageSize);
      const rows = await Promise.all(pageIds.map(readConversation));
      items = (await Promise.all(rows.filter(Boolean).map(enrichConversation))).filter(Boolean);
    } else {
      const matches = [];
      for (let offset = 0; offset < orderedIds.length; offset += 50) {
        const batchIds = orderedIds.slice(offset, offset + 50);
        const rows = await Promise.all(batchIds.map(readConversation));
        for (const item of rows) {
          if (!item) continue;
          if (q && !`${item.senderName || ""} ${item.userId || ""} ${item.text || ""} ${JSON.stringify(item.forwardSnapshots || [])}`.toLowerCase().includes(q)) continue;
          if (violationOnly && !item.violationActive) continue;
          matches.push(item);
        }
      }
      total = matches.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, totalPages);
      const selected = matches.slice((page - 1) * pageSize, page * pageSize);
      items = (await Promise.all(selected.map(enrichConversation))).filter(Boolean);
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return jsonResponse({ ok: true, items, pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    }, capabilities: {
      reply: true,
      setEssence: true,
      deleteEssence: true,
      atAll: true,
      atOwner: true,
      atAdmins: true,
      atMembers: true,
      atSelected: true,
      recall: true,
      groupTodo: true,
      completeGroupTodo: true,
      cancelGroupTodo: true,
      groupNotice: true,
      recordViolation: recordViolationAvailable,
      cancelViolation: true,
      refreshForward: true
    } });
  }

  if (request.method === "GET" && path === "/conversations/detail") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return jsonResponse({ ok: false, message: "缺少对话记录查看权限。" }, 403);
    const messageId = String(url.searchParams.get("id") || "");
    const item = await readJson(env, `conversation:${groupId}:${messageId}`, null);
    if (!item) return jsonResponse({ ok: false, message: "找不到对话记录。" }, 404);
    const violation = item.violationId ? await readJson(env, `ruleviolation:${item.violationId}`, null) : null;
    return jsonResponse({ ok: true, item, violation });
  }


  if (request.method === "GET" && path === "/conversations/attachment") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return new Response("缺少对话记录查看权限。", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const messageId = String(url.searchParams.get("id") || "").trim();
    const source = url.searchParams.get("source") === "files" ? "files" : "media";
    const index = Math.max(0, Math.floor(Number(url.searchParams.get("index") || 0)));
    const download = url.searchParams.get("download") === "1";
    const item = await readJson(env, `conversation:${groupId}:${messageId}`, null);
    if (!item || String(item.groupId) !== groupId) return new Response("找不到当前群的附件记录。", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return fetchConversationAttachmentResponse(env, item, source, index, download);
  }

  if (request.method === "POST" && path === "/conversations/action") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return jsonResponse({ ok: false, message: "缺少对话记录管理权限。" }, 403);
    const messageId = String(body.messageId || "").trim();
    const item = await readJson(env, `conversation:${groupId}:${messageId}`, null);
    if (!item || String(item.groupId) !== groupId) return jsonResponse({ ok: false, message: "找不到当前群的对话记录。" }, 404);
    const action = String(body.action || "").trim();
    const inputText = String(body.text || "").trim().slice(0, 2000);
    try {
      let result = null;
      if (action === "reply") {
        if (!inputText) return jsonResponse({ ok: false, message: "请输入回复内容。" }, 400);
        result = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: [{ type: "reply", data: { id: messageId } }, { type: "text", data: { text: inputText } }], auto_escape: false } }, 20000);
      } else if (action === "set_essence") {
        result = await callOneBotAction(env, { action: "set_essence_msg", params: { message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { essence: true });
      } else if (action === "delete_essence") {
        result = await callOneBotAction(env, { action: "delete_essence_msg", params: { message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { essence: false });
      } else if (action === "recall") {
        result = await callOneBotAction(env, { action: "delete_msg", params: { message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { recalledAt: Date.now(), recalledBy: authed.qq });
      } else if (action === "todo") {
        result = await callOneBotAction(env, { action: "set_group_todo", params: { group_id: String(groupId), message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { groupTodo: true, groupTodoCompleted: false });
      } else if (action === "complete_todo") {
        result = await callOneBotAction(env, { action: "complete_group_todo", params: { group_id: String(groupId), message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { groupTodo: true, groupTodoCompleted: true });
      } else if (action === "cancel_todo") {
        result = await callOneBotAction(env, { action: "cancel_group_todo", params: { group_id: String(groupId), message_id: messageId } }, 20000);
        await updatePortalConversationRecord(env, groupId, messageId, { groupTodo: false, groupTodoCompleted: false });
      } else if (action === "announcement") {
        const content = inputText || `群公告引用消息：${item.senderName || item.userId}：${item.text || "[无文字内容]"}`;
        result = await callOneBotAction(env, { action: "_send_group_notice", params: { group_id: String(groupId), content: content.slice(0, 4000) } }, 20000);
      } else if (action === "at_all") {
        if (!inputText) return jsonResponse({ ok: false, message: "请输入通知内容。" }, 400);
        let remain = null;
        try { remain = await callOneBotAction(env, { action: "get_group_at_all_remain", params: { group_id: String(groupId) } }, 10000); } catch {}
        result = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: [{ type: "reply", data: { id: messageId } }, { type: "at", data: { qq: "all" } }, { type: "text", data: { text: ` ${inputText}` } }], auto_escape: false } }, 20000);
        result = { sent: result, remain };
      } else if (action === "at_owner") {
        result = await sendGroupRoleMentions(env, { groupId, roles: ["owner"], text: inputText || "请查看这条群消息。", replyId: messageId, actionKey: "owner" });
      } else if (action === "at_admins") {
        result = await sendGroupRoleMentions(env, { groupId, roles: ["admin"], text: inputText || "请查看这条群消息。", replyId: messageId, actionKey: "admins" });
      } else if (action === "at_members") {
        result = await sendGroupRoleMentions(env, { groupId, roles: ["member"], text: inputText || "请查看这条群消息。", replyId: messageId, actionKey: "members" });
      } else if (action === "mention_selected") {
        result = await sendGroupSelectedMentions(env, { groupId, qqs: Array.isArray(body.qqs) ? body.qqs : [], text: inputText || "请查看这条群消息。", replyId: messageId, actionKey: "selected" });
      } else if (action === "refresh_forward") {
        const snapshots = [];
        for (const id of (item.forwardIds || []).slice(0, AI_MEDIA_LIMITS.forwardBundles)) {
          await dbDel(env, `forward_snapshot:${id}`);
          snapshots.push(await getForwardMessageSnapshot(env, id));
        }
        result = await updatePortalConversationRecord(env, groupId, messageId, { forwardSnapshots: snapshots });
      } else if (action === "mark_violation") {
        const botRuleState = await getBotGroupRole(env, groupId);
        if (!botCanRunRuleMonitor(botRuleState)) return jsonResponse({ ok: false, message: "机器人在当前群不是群主或管理员，或无法即时确认管理身份；群规记录功能完全停用，不会建立记录。" }, 403);
        if (item.violationActive && item.violationId) return jsonResponse({ ok: false, message: "这条消息已经标记为违规。" }, 409);
        const violationType = String(body.violationType || "管理员记录").trim().slice(0, 120);
        const reason = String(body.reason || inputText || "由管理员从对话记录手动标记").trim().slice(0, 1000);
        const severity = normalizeRuleSeverity(body.severity || "moderate");
        let violation = await appendRuleViolationRecord(env, { groupId, userId: item.userId, senderName: item.senderName, content: item.text || "[媒体或转发消息]", violationType, rule: violationType, reason, confidence: 1, recommendedAction: "manual", actionTaken: "none", actionResult: "", messageId, strictness: "manual", severity, intentional: body.intentional !== false, urlInspections: [], testContext: false });
        violation = await performRuleProxyAction(env, violation, { severity, intentional: body.intentional !== false, muteSeconds: body.muteSeconds });
        await updatePortalConversationRecord(env, groupId, messageId, { violationId: violation.id, violationActive: true, violationMarkedAt: Date.now(), violationMarkedBy: authed.qq });
        result = violation;
      } else if (action === "cancel_violation") {
        if (!item.violationId) return jsonResponse({ ok: false, message: "这条消息没有违规记录。" }, 404);
        const violation = await readJson(env, `ruleviolation:${item.violationId}`, null);
        if (!violation) return jsonResponse({ ok: false, message: "找不到对应违规记录。" }, 404);
        result = await recordRuleViolationFeedback(env, violation, authed.qq, "not_violation", String(body.note || inputText || "管理员从对话记录取消违规").slice(0, 1000));
        await updatePortalConversationRecord(env, groupId, messageId, { violationActive: false, violationCancelledAt: Date.now(), violationCancelledBy: authed.qq });
      } else {
        return jsonResponse({ ok: false, message: "不支持的对话操作。" }, 400);
      }
      await writeSystemAudit(env, { type: "conversation_action", groupId, actorId: authed.qq, targetId: messageId, action, result: "success" });
      return jsonResponse({ ok: true, message: "操作已完成。", result });
    } catch (error) {
      await writeSystemAudit(env, { type: "conversation_action_failed", groupId, actorId: authed.qq, targetId: messageId, action, error: String(error?.message || error) });
      return jsonResponse({ ok: false, message: `操作失败：${String(error?.message || error)}` }, 502);
    }
  }

  if (request.method === "GET" && path === "/rule-violations") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群规记录查看权限。" }, 403);
    const ids = await readJson(env, `ruleviolation:index:${groupId}`, []);
    const member = String(url.searchParams.get("member") || "").trim().toLowerCase();
    const content = String(url.searchParams.get("content") || "").trim().toLowerCase();
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const items = [];
    for (const id of ids.slice(-5000).reverse()) {
      const item = await readJson(env, `ruleviolation:${id}`, null);
      if (!item) continue;
      const memberText = `${item.senderName || ""} ${item.userId || ""}`.toLowerCase();
      if (member && !memberText.includes(member)) continue;
      if (content && !String(item.content || "").toLowerCase().includes(content)) continue;
      if (type && !String(item.violationType || item.rule || "").toLowerCase().includes(type)) continue;
      items.push(item);
      if (items.length >= Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 300)))) break;
    }
    const categoryPolicies = await getRuleCategoryPolicies(env, groupId);
    const violationTypes = [...new Set([...categoryPolicies.map(item => item.name), ...items.map(item => String(item.violationType || "")).filter(Boolean)])];
    const botRuleState = await getBotGroupRole(env, groupId);
    const ruleMonitorAvailable = botCanRunRuleMonitor(botRuleState);
    return jsonResponse({ ok: true, items, violationTypes, settings: {
      monitorEnabled: ruleMonitorAvailable && await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false",
      monitorAvailable: ruleMonitorAvailable,
      proxyMode: normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode),
      strictness: normalizeRuleStrictness(await dbGet(env, `rule_strictness:${groupId}`) || DEFAULTS.ruleStrictness),
      muteSeconds: parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds),
      kickAuthorized: await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true",
      categoryPolicies,
      progressivePolicy: await getRuleProgressivePolicy(env, groupId),
      canOwnerControls: await isVerifiedGroupOwner(env, groupId, authed.qq)
    } });
  }
  if (request.method === "POST" && path === "/rule-violations/settings") {
    if (!(permissions.aiAdmin || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper)) return jsonResponse({ ok: false, message: "需要 QQ 管理员或以上权限。" }, 403);
    const isCurrentOwner = await isVerifiedGroupOwner(env, groupId, authed.qq);
    if (Object.prototype.hasOwnProperty.call(body, "monitorEnabled")) {
      if (!isCurrentOwner) return jsonResponse({ ok: false, message: "只有当前真实群主可以开关群规持续监控。" }, 403);
      if (body.monitorEnabled && !botCanRunRuleMonitor(await getBotGroupRole(env, groupId))) return jsonResponse({ ok: false, message: "机器人在当前群不是群主或管理员，无法开启群规监控；系统不会降级记录。" }, 403);
      await dbPut(env, `rule_monitor_enabled:${groupId}`, body.monitorEnabled ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(body, "proxyMode")) {
      const nextMode = normalizeRuleProxyMode(body.proxyMode);
      const currentMode = normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode);
      if (nextMode !== currentMode) {
        if (nextMode === "auto" && !isCurrentOwner) return jsonResponse({ ok: false, message: "auto 模式只能由当前真实群主启用；管理员可使用 record、warn 或 mute。" }, 403);
        await dbPut(env, `rule_proxy_mode:${groupId}`, nextMode);
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "strictness")) await dbPut(env, `rule_strictness:${groupId}`, normalizeRuleStrictness(body.strictness));
    if (Object.prototype.hasOwnProperty.call(body, "categoryPolicies")) await dbPut(env, `rule_category_policies:${groupId}`, JSON.stringify(normalizeRuleCategoryPolicies(body.categoryPolicies, defaultRuleCategoryPolicies(groupId))));
    if (Object.prototype.hasOwnProperty.call(body, "progressivePolicy")) await dbPut(env, `rule_progressive_policy:${groupId}`, JSON.stringify(normalizeRuleProgressivePolicy(body.progressivePolicy, groupId)));
    if (Object.prototype.hasOwnProperty.call(body, "muteSeconds")) await dbPut(env, `rule_proxy_mute_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.muteSeconds, DEFAULTS.ruleProxyMuteSeconds)));
    if (Object.prototype.hasOwnProperty.call(body, "kickAuthorized")) {
      if (!isCurrentOwner) return jsonResponse({ ok: false, message: "只有当前真实群主可以修改 AI 踢出授权。" }, 403);
      body.kickAuthorized ? await dbPut(env, `rule_proxy_kick_authorized:${groupId}`, "true") : await dbDel(env, `rule_proxy_kick_authorized:${groupId}`);
    }
    await writeSystemAudit(env, { type: "rule_proxy_portal_settings", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "AI 群规代理设置已保存。" });
  }

  if (request.method === "POST" && path === "/rule-violations/feedback") {
    if (!(permissions.aiAdmin || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper)) return jsonResponse({ ok: false, message: "需要 QQ 管理员或以上权限。" }, 403);
    const item = await readJson(env, `ruleviolation:${String(body.id || "")}`, null);
    if (!item || String(item.groupId) !== groupId) return jsonResponse({ ok: false, message: "找不到当前群的群规记录。" }, 404);
    const verdict = body.verdict === "not_violation" ? "not_violation" : body.verdict === "violation_additional" ? "violation_additional" : "violation";
    const feedbackNote = String(body.note || "").trim();
    if ((verdict === "not_violation" || verdict === "violation_additional") && !feedbackNote) return jsonResponse({ ok: false, message: verdict === "not_violation" ? "标记为误判时必须填写复核说明。" : "追加处分时必须填写原因。" }, 400);
    const requestedActions = verdict === "violation_additional" ? normalizeRulePolicyActions(body.actions, "manual", body.muteSeconds) : [];
    if (verdict === "violation_additional" && !requestedActions.some(action => !["record", "manual"].includes(action.action))) return jsonResponse({ ok: false, message: "请至少选择一个可执行的追加处分动作。" }, 400);
    const canKick = portalIsDeveloper || await isVerifiedGroupOwner(env, groupId, authed.qq);
    if (verdict === "violation_additional" && requestedActions.some(action => action.action === "kick") && !canKick) return jsonResponse({ ok: false, message: "追加踢出只能由当前真实群主或开发者确认。" }, 403);
    const updated = await recordRuleViolationFeedback(env, item, authed.qq, verdict, feedbackNote, { actions: requestedActions, allowKick: canKick, defaultMuteSeconds: body.muteSeconds });
    const message = verdict === "not_violation"
      ? `已标记为误判，复核说明已写入该分类备注供 AI 优先遵守。${updated.reversalResult ? ` ${updated.reversalResult}` : ""}`
      : verdict === "violation_additional"
        ? `已确认违规并处理追加处分：${(updated.actionResults || []).slice(-8).join("；") || "没有动作成功执行"}`
        : "已确认存在违规，结果会作为后续判断参考。";
    return jsonResponse({ ok: true, message, item: updated });
  }

  if (request.method === "GET" && path === "/moderation/proposals") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群待确认操作查看权限。" }, 403);
    const items = await listModerationProposals(env, groupId, { limit: Number(url.searchParams.get("limit") || 100) });
    return jsonResponse({ ok: true, proposals: items });
  }

  if (request.method === "POST" && path === "/moderation/confirm") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少确认群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, hasGroupOpsPermission: permissions.groupOps, confirmation: { type: "confirm", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

  if (request.method === "POST" && path === "/moderation/cancel") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少取消群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, hasGroupOpsPermission: permissions.groupOps, confirmation: { type: "cancel", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

  if (request.method === "GET" && path === "/memories") {
    const privateKey = `user_memo:${groupId}:${authed.qq}`;
    const publicKey = `group_public_memos:${groupId}`;
    const privateMemos = await migratePortalMemories(env, privateKey, await readJson(env, privateKey, []), authed.qq);
    const publicMemos = await migratePortalMemories(env, publicKey, await readJson(env, publicKey, []), "group");
    return jsonResponse({ ok: true, private: privateMemos, public: publicMemos, memory_banned: await isMemoryBanned(env, authed.qq) });
  }

  if (["POST", "PUT", "DELETE"].includes(request.method) && path === "/memories") {
    if (await isMemoryBanned(env, authed.qq)) return jsonResponse({ ok: false, message: "你的记忆编辑权限已被冻结。" }, 403);
    const scope = body.scope === "public" ? "public" : "private";
    const key = scope === "public" ? `group_public_memos:${groupId}` : `user_memo:${groupId}:${authed.qq}`;
    const list = await migratePortalMemories(env, key, await readJson(env, key, []), scope === "public" ? "group" : authed.qq);
    if (request.method === "POST") {
      const text = String(body.text || "").trim();
      if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      let item = { id: crypto.randomUUID(), text, scope, owner: authed.qq, subjectQq: String(body.subjectQq || authed.qq), at: new Date().toISOString() };
      item = await upsertMemoryVector(env, item, groupId).catch(error => { console.warn(error); return item; });
      list.push(item); await dbPut(env, key, JSON.stringify(list));
      await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页新增记忆", before: null, after: JSON.stringify(item) });
      return jsonResponse({ ok: true, item });
    }
    const id = String(body.id || "");
    if (!id) return jsonResponse({ ok: false, message: "无效记忆不会显示操作按钮，请刷新页面。" }, 400);
    const idx = list.findIndex(x => String(x.id) === id);
    if (idx < 0) return jsonResponse({ ok: false, message: "该记忆已删除或已被更新，请刷新列表。" }, 404);
    const canEdit = scope === "private" || list[idx].owner === authed.qq || permissions.aiAdmin || permissions.developer;
    if (!canEdit) return jsonResponse({ ok: false, message: "权限不足。" }, 403);
    if (request.method === "PUT") {
      const text = String(body.text || "").trim(); if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      const before = JSON.stringify(list[idx]);
      list[idx] = { ...list[idx], text, updatedAt: new Date().toISOString() };
      list[idx] = await upsertMemoryVector(env, list[idx], groupId).catch(error => { console.warn(error); return list[idx]; });
      await dbPut(env, key, JSON.stringify(list));
      await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页修改记忆", before, after: JSON.stringify(list[idx]) });
      return jsonResponse({ ok: true, item: list[idx] });
    }
    const removed = list.splice(idx, 1)[0];
    const vectorizeDeleted = await deleteMemoryVector(env, removed);
    await dbPut(env, key, JSON.stringify(list));
    await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页删除记忆与向量", before: JSON.stringify(removed), after: null });
    return jsonResponse({ ok: true, message: "记忆已删除。", vectorizeDeleted });
  }

  if (request.method === "GET" && path === "/vector-search") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) return jsonResponse({ ok: true, results: [] });
    try {
      const results = await searchPortalVectors(env, { groupId, userId: authed.qq, permissions, query, limit: Number(url.searchParams.get("limit") || 20) });
      return jsonResponse({ ok: true, query, results });
    } catch (error) {
      return jsonResponse({ ok: false, message: `向量搜索失败：${error?.message || error}` }, 502);
    }
  }

  if (request.method === "GET" && path === "/settings") {
    return jsonResponse({
      ok: true,
      dnd: await dbGet(env, `dnd:${groupId}:${authed.qq}`) === "true",
      style: await dbGet(env, `custom_style:${groupId}:${authed.qq}`) || "",
      modelPreference: await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto",
      quota: await getUserQuota(env, groupId, authed.qq)
    });
  }

  if (request.method === "POST" && path === "/settings") {
    if (typeof body.dnd === "boolean") body.dnd ? await dbPut(env, `dnd:${groupId}:${authed.qq}`, "true") : await dbDel(env, `dnd:${groupId}:${authed.qq}`);
    if (Object.prototype.hasOwnProperty.call(body, "style")) await dbPut(env, `custom_style:${groupId}:${authed.qq}`, String(body.style || ""));
    if (Object.prototype.hasOwnProperty.call(body, "modelPreference")) {
      const pref = normalizeModelPreference(body.modelPreference); if (!pref) return jsonResponse({ ok: false, message: "未知模型偏好。" }, 400);
      if (!permissions.developer && String(pref).startsWith("deepseek")) return jsonResponse({ ok: false, message: "DeepSeek 暂不对普通成员开放；免费模型连续失败时系统会临时开放。" }, 403);
      await dbPut(env, `model_pref:${groupId}:${authed.qq}`, pref);
    }
    return jsonResponse({ ok: true, message: "个人设置已保存。" });
  }

  if (request.method === "GET" && path === "/schedules") {
    const lastCron = Number(await dbGet(env, "system:last_cron") || 0);
    return jsonResponse({
      ok: true,
      schedules: await listUserSchedules(env, authed.qq, groupId),
      cron: {
        lastRunAt: lastCron || null,
        recent: Boolean(lastCron && Date.now() - lastCron < 5 * 60 * 1000),
        message: lastCron ? "Cron 最近一次执行时间已记录。" : "尚未记录 Cron 执行；请确认 Cloudflare Cron Trigger 已绑定。"
      },
      permissions: {
        canReview: Boolean(permissions.scheduleReviewer || permissions.nativeAdmin || permissions.developer),
        developer: Boolean(permissions.developer)
      }
    });
  }
  if (request.method === "POST" && path === "/schedules") {
    const parsed = parseScheduleRequest(String(body.schedule || ""));
    if (!parsed.ok) return jsonResponse(parsed, 400);
    if (DEFAULTS.scheduleMaxActivePerUser > 0 && await countActiveSchedulesForUser(env, authed.qq) >= DEFAULTS.scheduleMaxActivePerUser && !permissions.developer) return jsonResponse({ ok: false, message: `有效排程数量已达上限。` }, 429);
    const review = await reviewScheduleWithGemma(env, JSON.stringify(parsed));
    if (review.decision === "reject") return jsonResponse({ ok: false, message: `排程已拒绝：${review.reason}` }, 400);
    const managementAction = parseManagementScheduleAction(parsed.content);
    const directManagement = Boolean(managementAction && (permissions.nativeAdmin || permissions.groupOps || permissions.developer));
    const status = managementAction ? (directManagement ? "active" : "pending_owner") : (review.decision === "allow" ? "active" : "pending_owner");
    const item = await createScheduleRecord(env, { ...parsed, creatorId: authed.qq, groupId, status, enabled: status === "active", managementAction, review, scheduleSpec: String(body.schedule || "").trim(), mentionIds: extractScheduleMentionIds(parsed.content) });
    if (status === "pending_owner") await notifyDeveloper(env, `【排程待处理】\n编号：${item.id}\n群号：${groupId}\n申请人：${authed.qq}\n内容：${item.content}\n请在 Portal 指派审核人或自行处理。`);
    return jsonResponse({ ok: true, schedule: item, message: status === "active" ? "排程已建立。" : "排程已送交开发者处理。" });
  }
  if (request.method === "POST" && path === "/schedules/edit") {
    const result = await reviseScheduleRecord(env, {
      id: String(body.id || ""), actorId: authed.qq,
      canManage: permissions.aiAdmin || permissions.developer,
      canDirectManage: permissions.nativeAdmin || permissions.groupOps || permissions.developer,
      scheduleText: String(body.schedule || ""), scopeGroupId: groupId, allowCrossGroup: permissions.developer
    });
    if (result.ok && result.schedule?.status === "pending_owner") await notifyDeveloper(env, `【排程修改待处理】\n编号：${result.schedule.id}\n群号：${groupId}\n申请人：${authed.qq}\n内容：${result.schedule.content}`);
    return jsonResponse(result, result.ok ? 200 : 400);
  }
  if (request.method === "POST" && path === "/schedules/skip-once") {
    const result = await skipScheduleOnce(env, String(body.id || ""), authed.qq, permissions.aiAdmin || permissions.developer, groupId, permissions.developer);
    return jsonResponse(result, result.ok ? 200 : 400);
  }
  if (request.method === "DELETE" && path === "/schedules") {
    const result = await cancelSchedule(env, String(body.id || ""), authed.qq, permissions.aiAdmin || permissions.developer, groupId, permissions.developer);
    return jsonResponse(result, result.ok ? 200 : 403);
  }
if (request.method === "POST" && path === "/schedules/delete") {
    const id = String(body.id || "");
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item) return jsonResponse({ ok: false, message: "找不到该排程。" }, 404);
    const canDelete = permissions.developer || (String(item.creatorId || "") === String(authed.qq) && String(item.groupId || "") === String(groupId || ""));
    if (!canDelete) return jsonResponse({ ok: false, message: "你没有删除该排程的权限。" }, 403);
    if (!permissions.developer && !["completed", "cancelled", "rejected", "paused"].includes(String(item.status || ""))) {
      return jsonResponse({ ok: false, message: "执行中的排程请先取消，再永久删除。" }, 400);
    }
    await deleteScheduleRecord(env, id);
    await writeSystemAudit(env, { type: "schedule_deleted", groupId: item.groupId, actorId: authed.qq, action: "permanent_delete", scheduleId: id, previousStatus: item.status });
    return jsonResponse({ ok: true, message: `排程 ${id} 已永久删除。` });
  }


  if (path.startsWith("/admin/") && !(permissions.aiAdmin || permissions.developer)) return jsonResponse({ ok: false, message: "Error 403：缺少 AI 管理权限。" }, 403);
  if (request.method === "GET" && path === "/admin/state") {
    const botRuleState = await getBotGroupRole(env, groupId);
    const botRuleRole = String(botRuleState?.role || "unknown");
    const botCanMonitorRules = botCanRunRuleMonitor(botRuleState);
    const activeSpeakingEnabled = await getFeatureFlag(env, `active_speaking:${groupId}`, false);
    const activeSpeakingConfig = await readJson(env, `active_speaking:config:${groupId}`, { quietMinutes: 60, startHour: 9, endHour: 23, maxDaily: 3 });
    const activeSpeakingLast = await readJson(env, `active_speaking:state:${groupId}`, null);
    const activeSpeakingGroups = await readJson(env, "active_speaking:groups", []);
    const activeSpeakingTodayCount = Number(await dbGet(env, `active_speaking:count:${groupId}:${taipeiDateKey(new Date())}`) || 0);
    return jsonResponse({
      ok: true,
      ai_on: await dbGet(env, `ai_off:${groupId}`) !== "true",
      memory_on: await dbGet(env, `memo:${groupId}`) !== "false",
      persona: await dbGet(env, `group_persona:${groupId}`) || "",
      interject_rate: Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate),
      commands_enabled: await dbGet(env, `web_command_off:${groupId}`) !== "true",
      active_speaking: activeSpeakingEnabled,
      active_speaking_status: {
        enabled: activeSpeakingEnabled,
        tracked: activeSpeakingGroups.map(String).includes(String(groupId)),
        config: activeSpeakingConfig,
        todayCount: activeSpeakingTodayCount,
        lastSpeakAt: Number(await dbGet(env, `active_speaking:last:${groupId}`) || 0) || null,
        lastResult: activeSpeakingLast,
        canTest: Boolean(permissions.developer)
      },
      keywords: await readJson(env, `keyword_filter:${groupId}`, []),
      blacklist: await readJson(env, `blacklist_group:${groupId}`, []),
      audit_logs: await readJson(env, `audit:system:group:${groupId}`, []),
      auto_checkin_enabled: await dbGet(env, `auto_checkin_enabled:${groupId}`) === "true",
      auto_checkin_time: await dbGet(env, `auto_checkin_time:${groupId}`) || DEFAULTS.autoCheckinTime,
      welcome_enabled: await dbGet(env, `welcome_enabled:${groupId}`) === "true",
      welcome_text: await dbGet(env, `welcome_text:${groupId}`) || DEFAULTS.welcomeText,
      moderation_target_cooldown_seconds: Number(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`) || DEFAULTS.moderationTargetCooldownSeconds),
      newcomer_observation_days: Number(await dbGet(env, `newcomer_observation_days:${groupId}`) || DEFAULTS.newcomerObservationDays),
      join_assist_enabled: await dbGet(env, `join_assist_enabled:${groupId}`) !== "false",
      join_ai_approve_enabled: await dbGet(env, `join_ai_approve_enabled:${groupId}`) !== "false",
      rule_monitor_enabled: botCanMonitorRules && await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false",
      rule_proxy_mode: normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode),
      rule_proxy_mute_seconds: parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds),
      rule_spam_window_seconds: Math.max(5, Math.min(3600, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_window_seconds:${groupId}`), DEFAULTS.ruleSpamWindowSeconds))),
      rule_spam_threshold: Math.max(2, Math.min(50, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_threshold:${groupId}`), DEFAULTS.ruleSpamThreshold))),
      rule_spam_keep_count: Math.max(0, Math.min(49, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_keep_count:${groupId}`), DEFAULTS.ruleSpamKeepCount))),
      rule_mute_guard_enabled: await dbGet(env, `rule_mute_guard_enabled:${groupId}`) !== "false",
      rule_proxy_kick_authorized: await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true",
      bot_is_owner: botRuleRole === "owner",
      bot_rule_role: botRuleRole,
      rule_monitor_available: botCanMonitorRules,
      can_manage_rule_monitor: botCanMonitorRules && Boolean(permissions.developer || permissions.nativeAdmin || role === "owner" || role === "admin")
    });
  }
if (request.method === "POST" && path === "/admin/active-speaking-test") {
    if (!permissions.developer) return jsonResponse({ ok: false, message: "只有开发者可以测试主动发话。" }, 403);
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const enabled = await getFeatureFlag(env, `active_speaking:${groupId}`, false);
    if (!enabled) return jsonResponse({ ok: false, message: "主动发话尚未开启；请先勾选并保存。" }, 400);
    const now = Date.now();
    const text = `【主动发话测试】功能已开启，测试时间：${getTaipeiTimeContext().display}`;
    try {
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: text, auto_escape: false } }, 12000);
      const messageId = String(sent?.message_id || sent?.data?.message_id || "");
      const state = { ok: true, at: now, source: "manual_test", messageId, preview: text };
      await dbPut(env, `active_speaking:state:${groupId}`, JSON.stringify(state));
      await writeSystemAudit(env, { type: "active_speaking", groupId, actorId: authed.qq, action: "manual_test_sent", messageId });
      return jsonResponse({ ok: true, message: "主动发话测试已发送到当前群。", state });
    } catch (error) {
      const message = String(error?.message || error).slice(0, 500);
      const state = { ok: false, at: now, source: "manual_test", error: message };
      await dbPut(env, `active_speaking:state:${groupId}`, JSON.stringify(state));
      await writeSystemAudit(env, { type: "active_speaking", groupId, actorId: authed.qq, action: "manual_test_failed", error: message }).catch(() => {});
      return jsonResponse({ ok: false, message: `测试发送失败：${message}`, state }, 502);
    }
  }
  if (request.method === "POST" && path === "/admin/state") {
    if (typeof body.ai_on === "boolean") body.ai_on ? await dbDel(env, `ai_off:${groupId}`) : await dbPut(env, `ai_off:${groupId}`, "true");
    if (typeof body.memory_on === "boolean") await dbPut(env, `memo:${groupId}`, body.memory_on ? "true" : "false");
    if (Object.prototype.hasOwnProperty.call(body, "persona")) await dbPut(env, `group_persona:${groupId}`, String(body.persona || ""));
    if (Object.prototype.hasOwnProperty.call(body, "interject_rate")) await dbPut(env, `interject_rate:${groupId}`, String(Math.max(0, Math.min(100, Number(body.interject_rate || 0)))));
    if (Object.prototype.hasOwnProperty.call(body, "commands_enabled")) body.commands_enabled ? await dbDel(env, `web_command_off:${groupId}`) : await dbPut(env, `web_command_off:${groupId}`, "true");
    if (Object.prototype.hasOwnProperty.call(body, "keywords")) await dbPut(env, `keyword_filter:${groupId}`, JSON.stringify(String(body.keywords || "").split(/\n|,/).map(s => s.trim()).filter(Boolean)));
    if (["welcome_enabled", "welcome_text", "moderation_target_cooldown_seconds", "newcomer_observation_days", "rule_mute_guard_enabled"].some(key => Object.prototype.hasOwnProperty.call(body, key))) {
      if (!(role === "owner" || permissions.developer)) return jsonResponse({ ok: false, message: "这些群级设置仅群主或开发者可修改。" }, 403);
      if (Object.prototype.hasOwnProperty.call(body, "welcome_enabled")) await dbPut(env, `welcome_enabled:${groupId}`, body.welcome_enabled ? "true" : "false");
      if (Object.prototype.hasOwnProperty.call(body, "welcome_text")) await dbPut(env, `welcome_text:${groupId}`, String(body.welcome_text || DEFAULTS.welcomeText).slice(0, 500));
      if (Object.prototype.hasOwnProperty.call(body, "moderation_target_cooldown_seconds")) await dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.moderation_target_cooldown_seconds, 0)));
      if (Object.prototype.hasOwnProperty.call(body, "newcomer_observation_days")) await dbPut(env, `newcomer_observation_days:${groupId}`, String(Math.max(0, Math.min(30, Number(body.newcomer_observation_days || 0)))));
      if (Object.prototype.hasOwnProperty.call(body, "rule_mute_guard_enabled")) await dbPut(env, `rule_mute_guard_enabled:${groupId}`, body.rule_mute_guard_enabled ? "true" : "false");
    }
    if (["rule_spam_window_seconds", "rule_spam_threshold", "rule_spam_keep_count"].some(key => Object.prototype.hasOwnProperty.call(body, key))) {
      if (!(permissions.aiAdmin || permissions.developer || permissions.nativeAdmin)) return jsonResponse({ ok: false, message: "缺少 AI 管理权限，无法设置刷屏判定。" }, 403);
      if (Object.prototype.hasOwnProperty.call(body, "rule_spam_window_seconds")) await dbPut(env, `rule_spam_window_seconds:${groupId}`, String(Math.max(5, Math.min(3600, parseUnlimitedNonNegativeInteger(body.rule_spam_window_seconds, DEFAULTS.ruleSpamWindowSeconds)))));
      if (Object.prototype.hasOwnProperty.call(body, "rule_spam_threshold")) await dbPut(env, `rule_spam_threshold:${groupId}`, String(Math.max(2, Math.min(50, parseUnlimitedNonNegativeInteger(body.rule_spam_threshold, DEFAULTS.ruleSpamThreshold)))));
      if (Object.prototype.hasOwnProperty.call(body, "rule_spam_keep_count")) await dbPut(env, `rule_spam_keep_count:${groupId}`, String(Math.max(0, Math.min(49, parseUnlimitedNonNegativeInteger(body.rule_spam_keep_count, DEFAULTS.ruleSpamKeepCount)))));
    }
    if (Object.prototype.hasOwnProperty.call(body, "join_assist_enabled") || Object.prototype.hasOwnProperty.call(body, "join_ai_approve_enabled")) {
      if (!(permissions.aiAdmin || permissions.developer || permissions.nativeAdmin)) return jsonResponse({ ok: false, message: "缺少 AI 管理权限，无法设置入群辅助。" }, 403);
      if (Object.prototype.hasOwnProperty.call(body, "join_assist_enabled")) await dbPut(env, `join_assist_enabled:${groupId}`, body.join_assist_enabled ? "true" : "false");
      if (Object.prototype.hasOwnProperty.call(body, "join_ai_approve_enabled")) await dbPut(env, `join_ai_approve_enabled:${groupId}`, body.join_ai_approve_enabled ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(body, "rule_monitor_enabled")) {
      const botRuleState = await getBotGroupRole(env, groupId);
      if (!botCanRunRuleMonitor(botRuleState)) return jsonResponse({ ok: false, message: "机器人在当前群不是群主或管理员，或无法即时确认管理身份；群规监控已完全停用且不会记录。" }, 403);
      if (!(permissions.developer || permissions.nativeAdmin || role === "owner" || role === "admin")) return jsonResponse({ ok: false, message: "你在当前群不是 QQ 管理员或群主，暂不开放群规持续监控。" }, 403);
      await dbPut(env, `rule_monitor_enabled:${groupId}`, body.rule_monitor_enabled ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(body, "active_speaking")) {
      if (!permissions.developer) return jsonResponse({ ok: false, message: "只有开发者可以开关主动发话。" }, 403);
      const enabled = Boolean(body.active_speaking);
      await setFeatureFlag(env, `active_speaking:${groupId}`, enabled);
      let groups = (await readJson(env, "active_speaking:groups", [])).map(String);
      groups = enabled ? [...new Set([...groups, String(groupId)])] : groups.filter(id => id !== String(groupId));
      await dbPut(env, "active_speaking:groups", JSON.stringify(groups));
    }
    await writeSystemAudit(env, { type: "portal_ai_settings", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "群务设置已保存。" });
  }
  if (request.method === "GET" && path === "/ai-decisions") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少 AI 回覆纪录查看权限。" }, 403);
    const requestedGroupId = portalIsDeveloper && url.searchParams.get("all") === "1" ? "" : groupId;
    const logs = await listAiDecisionLogs(env, {
      groupId: requestedGroupId,
      query: url.searchParams.get("q") || "",
      decision: url.searchParams.get("decision") || "",
      triggerType: url.searchParams.get("triggerType") || "",
      limit: Number(url.searchParams.get("limit") || 300)
    });
    return jsonResponse({ ok: true, logs });
  }

  if (request.method === "GET" && path === "/admin/logs") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const actor = String(url.searchParams.get("actor") || "").trim();
    const logs = await readJson(env, `audit:system:group:${groupId}`, []);
    const filtered = logs.filter(item => {
      const haystack = JSON.stringify(item).toLowerCase();
      return (!query || haystack.includes(query)) && (!type || String(item.type || "").toLowerCase().includes(type)) && (!actor || String(item.actorId || "") === actor);
    });
    const selected = filtered.slice(-500).reverse();
    const enriched = await enrichAuditLogsForPortal(env, selected);
    return jsonResponse({ ok: true, logs: enriched });
  }

  if (request.method === "POST" && path === "/admin/blacklist") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.block) await dbPut(env, `blacklist:${groupId}:${target}`, "true"); else await dbDel(env, `blacklist:${groupId}:${target}`);
    const list = await readJson(env, `blacklist_group:${groupId}`, []); const next = body.block ? [...new Set([...list, target])] : list.filter(x => x !== target);
    await dbPut(env, `blacklist_group:${groupId}`, JSON.stringify(next)); return jsonResponse({ ok: true, blacklist: next });
  }

  const isDev = permissions.developer || isDeveloperId(env, authed.qq);
  if (path.startsWith("/root/") && !isDev) return jsonResponse({ ok: false, message: "Error 403：仅开发者可用。" }, 403);

  if (request.method === "GET" && path === "/root/state") {
    const keyCount = parseList(env.GEMINI_API_KEYS).length + parseList(env.VECTORIZE_GEMINI_KEYS).length;
    return jsonResponse({
      ok: true,
      key_pool: { gemini_keys: parseList(env.GEMINI_API_KEYS).length, vectorize_gemini_keys: parseList(env.VECTORIZE_GEMINI_KEYS).length, total: keyCount, deepseek_keys: deepSeekApiKeys(env).length, deepseek: deepSeekApiKeys(env).length > 0 },
      stats: { total_calls: await dbGet(env, "STAT_TOTAL_CALLS") || "0", last_model: await dbGet(env, "STAT_LAST_MODEL") || "无记录" },
      errors: await readJson(env, "system_error_logs", []),
      groups: await getWhitelistedGroupsForUser(env, authed.qq),
      health: await buildHealthState(env),
      flags: {
        private_chat_enabled: await getFeatureFlag(env, "private_chat_enabled", false),
        private_schedule_enabled: await getFeatureFlag(env, "private_schedule_enabled", false),
        private_appeal_enabled: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    });
  }

  if (request.method === "GET" && path === "/root/program-permissions") {
    return jsonResponse({ ok: true, records: await listExplicitProgramPermissions(env, groupId) });
  }

  if (request.method === "GET" && path === "/root/members") {
    const members = await readJson(env, `group_members:${groupId}`, []); const output = [];
    for (const member of members) output.push({ ...member, permissions: await getEffectivePermissions(env, groupId, String(member.qq), member.role, false), privateAccess: await getPrivateAccessMode(env, String(member.qq)), quota: await getUserQuota(env, groupId, String(member.qq)) });
    return jsonResponse({ ok: true, members: output });
  }

  if (request.method === "POST" && path === "/root/member") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.permission) { const perm = normalizePermissionName(body.permission); if (!perm) return jsonResponse({ ok: false, message: "未知权限。" }, 400); await setExplicitPermission(env, groupId, target, perm, Boolean(body.enabled)); }
    if (Object.prototype.hasOwnProperty.call(body, "privateAccess")) await dbPut(env, `private_access:${target}`, ["none", "commands", "full"].includes(body.privateAccess) ? body.privateAccess : "none");
    if (Object.prototype.hasOwnProperty.call(body, "memory_banned")) body.memory_banned ? await dbPut(env, `memory_banned:${target}`, "true") : await dbDel(env, `memory_banned:${target}`);
    if (Object.prototype.hasOwnProperty.call(body, "quota")) { const quota = String(body.quota || "").trim(); if (!quota || quota === "无限" || quota.toLowerCase() === "unlimited") { await dbDel(env, `quota:${groupId}:${target}`); await dbDel(env, `quota:deepseek:user:${target}`); } else { const n = Number(quota); if (!Number.isFinite(n) || n < 0) return jsonResponse({ ok: false, message: "额度必须是非负数或无限。" }, 400); await dbPut(env, `quota:${groupId}:${target}`, String(n)); await dbPut(env, `quota:deepseek:user:${target}`, String(n)); } }
    return jsonResponse({ ok: true, message: "成员权限已更新。" });
  }

  if (request.method === "GET" && path === "/root/whitelist") {
    return jsonResponse({ ok: true, groupIds: await readJson(env, "group_whitelist:index", []), privateUsers: await readJson(env, "private_access:index", []) });
  }
  if (request.method === "POST" && path === "/root/whitelist") {
    const targetGroup = String(body.groupId || "").replace(/\D/g, "");
    if (targetGroup) { body.enabled ? await dbPut(env, `group_whitelist:${targetGroup}`, "true") : await dbDel(env, `group_whitelist:${targetGroup}`); const list = await readJson(env, "group_whitelist:index", []); const next = body.enabled ? [...new Set([...list, targetGroup])] : list.filter(x => x !== targetGroup); await dbPut(env, "group_whitelist:index", JSON.stringify(next)); }
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST" && path === "/root/flags") {
    for (const key of ["private_chat_enabled", "private_schedule_enabled", "private_appeal_enabled", "deepseek_enabled"]) if (Object.prototype.hasOwnProperty.call(body, key)) await setFeatureFlag(env, key, Boolean(body[key]));
    return jsonResponse({ ok: true, message: "功能开关已保存。" });
  }

  if (request.method === "GET" && path === "/root/quotas") {
    return jsonResponse({ ok: true, globalDailyCny: await dbGet(env, "quota:deepseek:global_daily_cny") || "", groupDailyCny: groupId ? await dbGet(env, `quota:deepseek:group:${groupId}`) || "" : "" });
  }
  if (request.method === "POST" && path === "/root/quotas") {
    const setQuota = async (key, value) => { const text = String(value ?? "").trim(); if (!text || text === "无限") return dbDel(env, key); const n = Number(text); if (!Number.isFinite(n) || n < 0) throw new Error("额度必须是非负数或无限"); return dbPut(env, key, String(n)); };
    try { if (Object.prototype.hasOwnProperty.call(body, "globalDailyCny")) await setQuota("quota:deepseek:global_daily_cny", body.globalDailyCny); if (groupId && Object.prototype.hasOwnProperty.call(body, "groupDailyCny")) await setQuota(`quota:deepseek:group:${groupId}`, body.groupDailyCny); } catch (error) { return jsonResponse({ ok: false, message: error.message }, 400); }
    await writeSystemAudit(env, { type: "quota", groupId, actorId: authed.qq, action: "update_deepseek_quota" });
    return jsonResponse({ ok: true, message: "DeepSeek 额度已保存。" });
  }

  if (request.method === "GET" && path === "/root/rate-limit") {
    return jsonResponse({ ok: true, globalSeconds: await getRuntimeRateLimitSeconds(env, ""), groupSeconds: groupId ? await getRuntimeRateLimitSeconds(env, groupId) : null, explicitGroup: groupId ? await dbGet(env, `runtime_rate_limit_seconds:group:${groupId}`) : null });
  }
  if (request.method === "POST" && path === "/root/rate-limit") {
    if (Object.prototype.hasOwnProperty.call(body, "globalSeconds")) await dbPut(env, "runtime_rate_limit_seconds:global", String(parseUnlimitedNonNegativeInteger(body.globalSeconds, DEFAULTS.runtimeRateLimitSeconds)));
    if (groupId && Object.prototype.hasOwnProperty.call(body, "groupSeconds")) {
      if (body.groupSeconds === "" || body.groupSeconds === null) await dbDel(env, `runtime_rate_limit_seconds:group:${groupId}`);
      else await dbPut(env, `runtime_rate_limit_seconds:group:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.groupSeconds, DEFAULTS.runtimeRateLimitSeconds)));
    }
    await writeSystemAudit(env, { type: "rate_limit_portal", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "速率限制已保存。" });
  }

  if (request.method === "GET" && path === "/root/model-registry") {
    return jsonResponse({ ok: true, categories: await runtimeModelRegistryState(env), note: "环境变量中的默认模型为锁定后备，后台修改只写入 D1，不修改公开代码或变量。" });
  }
  if (request.method === "POST" && path === "/root/model-registry") {
    const kind = normalizeRuntimeModelKind(body.kind);
    const action = String(body.action || "").toLowerCase();
    let items = await readCustomRuntimeModels(env, kind);
    if (action === "add") {
      const id = String(body.id || "").trim();
      if (!validRuntimeModelId(id)) return jsonResponse({ ok: false, message: "模型 ID 格式无效。" }, 400);
      if (immutableRuntimeModelDefaults(env, kind).includes(id)) return jsonResponse({ ok: false, message: "该模型来自锁定默认变量，不能在后台修改；可新增其他模型并调整优先级。" }, 400);
      if (items.some(item => item.id === id)) return jsonResponse({ ok: false, message: "该自定义模型已存在。" }, 409);
      items.push({ id, enabled: true, order: items.length, createdAt: new Date().toISOString() });
    } else if (action === "delete") {
      const id = String(body.id || "");
      items = items.filter(item => item.id !== id);
    } else if (action === "toggle") {
      const target = items.find(item => item.id === String(body.id || ""));
      if (!target) return jsonResponse({ ok: false, message: "找不到该自定义模型。" }, 404);
      target.enabled = body.enabled !== false;
      target.updatedAt = new Date().toISOString();
    } else if (action === "move") {
      const index = items.findIndex(item => item.id === String(body.id || ""));
      if (index < 0) return jsonResponse({ ok: false, message: "找不到该自定义模型。" }, 404);
      const targetIndex = Math.max(0, Math.min(items.length - 1, index + (body.direction === "down" ? 1 : -1)));
      const [item] = items.splice(index, 1); items.splice(targetIndex, 0, item);
    } else if (action === "reorder" && Array.isArray(body.ids)) {
      const order = body.ids.map(String);
      items.sort((a, b) => {
        const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
        return (ai < 0 ? 999999 : ai) - (bi < 0 ? 999999 : bi);
      });
    } else {
      return jsonResponse({ ok: false, message: "不支持的模型管理动作。" }, 400);
    }
    items = await writeCustomRuntimeModels(env, kind, items);
    await writeSystemAudit(env, { type: "runtime_model_registry", groupId, actorId: authed.qq, action: `${action}:${kind}`, targetId: String(body.id || "") });
    return jsonResponse({ ok: true, items, categories: await runtimeModelRegistryState(env), message: "运行时模型列表已保存到 D1；默认变量与源代码没有被修改。" });
  }

  if (request.method === "GET" && path === "/root/schedules") {
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
if (request.method === "POST" && path === "/root/schedule-action") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, message: "只有开发者可以管理全部排程。" }, 403);
    const id = String(body.id || "");
    const action = String(body.action || "");
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item) return jsonResponse({ ok: false, message: "找不到排程。" }, 404);
    if (action === "delete") {
      await deleteScheduleRecord(env, id);
      await writeSystemAudit(env, { type: "schedule_root_action", groupId: item.groupId, actorId: authed.qq, action: "delete", scheduleId: id, previousStatus: item.status });
      return jsonResponse({ ok: true, message: `排程 ${id} 已永久删除。` });
    }
    if (action === "edit") {
      const result = await reviseScheduleRecord(env, {
        id,
        actorId: authed.qq,
        canManage: true,
        canDirectManage: true,
        scheduleText: String(body.schedule || ""),
        scopeGroupId: "",
        allowCrossGroup: true
      });
      if (result.ok) await writeSystemAudit(env, { type: "schedule_root_action", groupId: result.schedule.groupId, actorId: authed.qq, action: "edit", scheduleId: id, status: result.schedule.status });
      return jsonResponse(result, result.ok ? 200 : 400);
    }
    if (action === "skip_once") {
      const result = await skipScheduleOnce(env, id, authed.qq, true, "", true);
      if (result.ok) await writeSystemAudit(env, { type: "schedule_root_action", groupId: item.groupId, actorId: authed.qq, action: "skip_once", scheduleId: id });
      return jsonResponse(result, result.ok ? 200 : 400);
    }
    if (action === "rereview") {
      const review = await reviewScheduleWithGemma(env, JSON.stringify({
        scheduleSpec: scheduleSpecFromRecord(item),
        content: item.content,
        groupId: item.groupId,
        type: item.type,
        managementAction: item.managementAction || null
      }));
      item.review = review;
      item.reviewedAgainAt = Date.now();
      item.reviewedAgainBy = authed.qq;
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "schedule_root_action", groupId: item.groupId, actorId: authed.qq, action: "rereview", scheduleId: id, decision: review.decision, provider: review.provider, model: review.model });
      return jsonResponse({ ok: true, message: `已重新审查：${review.decision}｜${review.reason || "无说明"}`, schedule: item, review });
    }
    if (action === "approve") {
      if (!Number(item.nextRunAt || 0)) return jsonResponse({ ok: false, message: "此排程没有下次执行时间；请先使用“编辑并更新”设置新时间。" }, 400);
      item.status = "active";
      item.enabled = true;
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = authed.qq;
      item.failureCount = 0;
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "schedule_root_action", groupId: item.groupId, actorId: authed.qq, action: "approve", scheduleId: id });
      return jsonResponse({ ok: true, message: `排程 ${id} 已由开发者确认启用。`, schedule: item });
    }
    if (action === "reject") {
      item.status = "rejected";
      item.enabled = false;
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = authed.qq;
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "schedule_root_action", groupId: item.groupId, actorId: authed.qq, action: "reject", scheduleId: id });
      return jsonResponse({ ok: true, message: `排程 ${id} 已由开发者拒绝并停用。`, schedule: item });
    }
    return jsonResponse({ ok: false, message: "不支持的排程管理动作。" }, 400);
  }
  if (request.method === "POST" && path === "/root/schedule-assign") {
    const item = await readJson(env, `schedule:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到排程。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "schedule");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有排程审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有排程审核权限的人。" }, 400);
    if (body.developerDecision === "approve") { item.status = "active"; item.enabled = true; item.reviewedAt = new Date().toISOString(); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.enabled = false; item.reviewedAt = new Date().toISOString(); }
    else { item.status = "pending_review"; item.enabled = false; }
    await dbPut(env, `schedule:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【排程审核】\n编号：${item.id}\n群号：${item.groupId}\n内容：${item.content}\n请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, schedule: item });
  }
  if (request.method === "GET" && path === "/review/schedules") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
  if (request.method === "POST" && path === "/review/schedule") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const result = await voteSchedule(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve");
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "GET" && path === "/root/appeals") {
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item) { const safe = sanitizeAppealForReviewer(item, true); if (item.againstAdmin) safe.suggestedOwnerId = await getGroupOwnerId(env, item.groupId); appeals.push(safe); } }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/root/appeal-assign") {
    const item = await readJson(env, `appeal:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到申诉。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "appeal");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有申诉审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有申诉审核权限的人。" }, 400);
    const ownerId = item.againstAdmin ? await getGroupOwnerId(env, item.groupId) : "";
    if (item.againstAdmin) {
      if (!ownerId) return jsonResponse({ ok: false, message: "申诉对象涉及管理层，但目前无法确认群主身份，请先让群主在群内发言或刷新成员资料。" }, 400);
      if (body.developerDecision && String(authed.qq) !== String(ownerId)) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，必须由群主 QQ:${ownerId} 参与审核；你仍可查看并加入共同审核。` }, 400);
      if (!body.developerDecision && !item.reviewerIds.includes(String(ownerId))) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，请将群主 QQ:${ownerId} 加入审核人。` }, 400);
    }
    if (body.developerDecision === "approve") { item.status = "approved"; item.result = String(body.note || "申诉通过"); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.result = String(body.note || "申诉驳回"); }
    else item.status = "pending_review";
    await dbPut(env, `appeal:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【匿名申诉审核】\n编号：${item.id}\n群号：${item.groupId}\n类型：${item.type}\n内容：${item.content}\n申诉人身份已隐藏，请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, appeal: item });
  }
  if (request.method === "GET" && path === "/review/appeals") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) appeals.push(sanitizeAppealForReviewer(item, isDev)); }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/review/appeal") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const result = await voteAppeal(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve", String(body.note || ""));
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "POST" && path === "/root/broadcast") {
    const message = String(body.message || "").trim(); if (!message) return jsonResponse({ ok: false, message: "广播内容不能为空。" }, 400);
    const targets = String(body.groups || groupId).split(/\n|,/).map(s => extractGroupId(s)).filter(Boolean); let sentCount = 0;
    for (const targetGroupId of targets) if (await sendOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(targetGroupId), message, auto_escape: false } })) sentCount++;
    return jsonResponse({ ok: sentCount > 0, message: `广播已发送到 ${sentCount}/${targets.length} 个群。`, sentCount, total: targets.length }, sentCount > 0 ? 200 : 503);
  }
  if (request.method === "POST" && path === "/root/restart") {
    if (groupId) { await clearChatSessionHistory(env, `chat:group:${groupId}`); await dbDel(env, `last_interject:${groupId}`); }
    await dbPut(env, "system_last_restart", new Date().toISOString()); return jsonResponse({ ok: true, message: "系统暂存已重置。" });
  }
  if (request.method === "GET" && path === "/root/backup") {
    return jsonResponse({ ok: true, backup: { groupId, exportedAt: new Date().toISOString(), public_memos: groupId ? await readJson(env, `group_public_memos:${groupId}`, []) : [], audit_logs: groupId ? await readJson(env, `audit:system:group:${groupId}`, []) : [], members: groupId ? await readJson(env, `group_members:${groupId}`, []) : [], recent_logs: groupId ? await readJson(env, `recent_logs:${groupId}`, []) : [] } });
  }

  if (request.method === "GET" && path === "/matrix") {
    const logs = await readJson(env, `recent_logs:${groupId}`, []); const q = String(url.searchParams.get("q") || "").trim(); const filtered = q ? logs.filter(line => line.includes(q)) : logs;
    return jsonResponse({ ok: true, mode: isDev ? "root" : "group", query: q, particles: filtered.slice(-160).map((text, i) => ({ id: i, text: isDev ? text : text.replace(/QQ:\d+/g, "QQ:*"), raw: isDev ? Array.from({ length: 12 }, (_, n) => Number(Math.sin((i + 1) * (n + 1)).toFixed(6))) : undefined, cluster: i % 5, score: Number((1 - i / 180).toFixed(3)) })) });
  }

  return jsonResponse({ ok: false, message: "未知 API。" }, 404);
}



async function handleGeminiLiveUpgrade(request, env) {
  const keys = roundRobinKeys(googleApiKeysFor(env, "gemini_chat"), "gemini_chat");
  if (!keys.length) return new Response("未配置 Gemini API 金钥", { status: 500 });
  const key = keys[Math.floor(Math.random() * keys.length)];
  const model = env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  const upstream = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`);
  const queue = [];
  let upstreamReady = false;
  let closed = false;
  const closeBoth = (code = 1000, reason = "closed") => {
    if (closed) return; closed = true;
    try { if (server.readyState === WebSocket.OPEN) server.close(code, reason); } catch {}
    try { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(code, reason); } catch {}
  };
  upstream.addEventListener("open", () => {
    upstreamReady = true;
    while (queue.length && upstream.readyState === WebSocket.OPEN) upstream.send(queue.shift());
  });
  upstream.addEventListener("message", event => { if (server.readyState === WebSocket.OPEN) server.send(event.data); });
  upstream.addEventListener("error", () => { if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify({ error: { message: "Gemini Live 上游连接错误" } })); });
  upstream.addEventListener("close", event => closeBoth(event.code || 1011, "Gemini Live closed"));
  server.addEventListener("message", event => {
    const data = event.data;
    if (typeof data === "string" && data.length > 2_000_000) return closeBoth(1009, "message too large");
    if (queue.length > 300) return closeBoth(1013, "queue overflow");
    if (upstreamReady && upstream.readyState === WebSocket.OPEN) upstream.send(data); else queue.push(data);
  });
  server.addEventListener("close", event => closeBoth(event.code || 1000, "client closed"));
  server.addEventListener("error", () => closeBoth(1011, "client error"));
  server.send(JSON.stringify({ qqai: { version: VERSION, model, status: "connecting" } }));
  return new Response(null, { status: 101, webSocket: client });
}



function getLiveHtmlPage(host) {
  return toSimplifiedChinese(`<!doctype html>
<html lang="zh-Hans-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAI Live</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(circle at 50% 20%,#183c61,#07101e 42%,#03050a);color:#eef7ff;display:grid;place-items:center;padding:20px}.card{width:min(760px,100%);border:1px solid #ffffff24;background:#07101ed9;backdrop-filter:blur(18px);border-radius:18px;padding:24px;box-shadow:0 30px 80px #0008}h1{margin:0 0 8px}.muted{color:#a8b8ca;line-height:1.65}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}button{border:0;border-radius:10px;height:44px;padding:0 18px;font-weight:800;cursor:pointer;background:#65dcff;color:#02101a}button.stop{background:#ff7474;color:#1a0505}button:disabled{opacity:.45;cursor:not-allowed}.meter{height:10px;background:#ffffff12;border-radius:99px;overflow:hidden;margin-top:16px}.bar{height:100%;width:0;background:linear-gradient(90deg,#60dcff,#86ffbd);transition:width .08s}.log{margin-top:16px;background:#02060d;border:1px solid #ffffff18;border-radius:12px;padding:12px;min-height:150px;max-height:320px;overflow:auto;white-space:pre-wrap;line-height:1.55}.status{font-weight:800;color:#8ff0c0}.warn{color:#ffd58a}@media(max-width:520px){button{width:100%}}
</style></head><body><main class="card"><h1>QQAI Live</h1><div class="muted">即時麥克風對話。瀏覽器會傳送 16 kHz PCM 音訊，回傳語音會在本機播放。請勿在對話中提供密碼或敏感資料。</div><div class="row"><button id="start">開始通話</button><button id="mute" disabled>靜音</button><button id="stop" class="stop" disabled>結束</button></div><div class="meter"><div class="bar" id="bar"></div></div><div class="log"><div class="status" id="status">尚未连接</div><div id="transcript"></div></div></main>
<script>
const startBtn=document.getElementById('start'),stopBtn=document.getElementById('stop'),muteBtn=document.getElementById('mute'),statusEl=document.getElementById('status'),transcript=document.getElementById('transcript'),bar=document.getElementById('bar');
let ws,stream,inputCtx,processor,source,muted=false,ready=false,playCtx,playAt=0;
const modelParam=new URLSearchParams(location.search).get('model')||'gemini-3.1-flash-live-preview';const MODEL='models/'+modelParam;
function log(t){transcript.textContent+=(transcript.textContent?'\\n':'')+t;transcript.parentElement.scrollTop=transcript.parentElement.scrollHeight}
function b64FromBytes(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function bytesFromB64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function f32ToPcm16(input){const out=new Uint8Array(input.length*2),view=new DataView(out.buffer);let peak=0;for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));peak=Math.max(peak,Math.abs(v));view.setInt16(i*2,v<0?v*32768:v*32767,true)}bar.style.width=Math.min(100,peak*180)+'%';return out}
function playPcm(base64,rate=24000){playCtx||=new AudioContext({sampleRate:rate});const bytes=bytesFromB64(base64),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),f=new Float32Array(bytes.byteLength/2);for(let i=0;i<f.length;i++)f[i]=view.getInt16(i*2,true)/32768;const buf=playCtx.createBuffer(1,f.length,rate);buf.copyToChannel(f,0);const src=playCtx.createBufferSource();src.buffer=buf;src.connect(playCtx.destination);playAt=Math.max(playCtx.currentTime+.03,playAt);src.start(playAt);playAt+=buf.duration}
function handleMessage(obj){if(obj.setupComplete){ready=true;statusEl.textContent='已连接，可以說話';return}if(obj.error){statusEl.textContent='錯誤：'+(obj.error.message||JSON.stringify(obj.error));return}const sc=obj.serverContent;if(!sc)return;if(sc.inputTranscription?.text)log('你：'+sc.inputTranscription.text);if(sc.outputTranscription?.text)log('助手：'+sc.outputTranscription.text);for(const part of sc.modelTurn?.parts||[]){const d=part.inlineData?.data;if(d)playPcm(d,Number((part.inlineData.mimeType||'').match(/rate=(\\d+)/)?.[1]||24000));if(part.text)log('助手：'+part.text)}if(sc.interrupted&&playCtx){playAt=playCtx.currentTime}}
async function start(){startBtn.disabled=true;statusEl.textContent='取得麥克風權限…';try{stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/live');ws.onopen=()=>{statusEl.textContent='正在初始化 Gemini Live…';ws.send(JSON.stringify({setup:{model:MODEL,generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Aoede'}}}},systemInstruction:{parts:[{text:'你是QQ群里的自然简体中文语音助手。回答简洁、口语化；不要讨论、承认或否认模型、AI、机器人或系统身份，直接回到话题。'}]},inputAudioTranscription:{},outputAudioTranscription:{}}}))};ws.onmessage=e=>{try{handleMessage(JSON.parse(e.data))}catch(err){console.warn(err)}};ws.onerror=()=>statusEl.textContent='WebSocket 連線錯誤';ws.onclose=()=>{statusEl.textContent='連線已結束';cleanup(false)};
inputCtx=new AudioContext({sampleRate:16000});source=inputCtx.createMediaStreamSource(stream);processor=inputCtx.createScriptProcessor(4096,1,1);processor.onaudioprocess=e=>{if(!ready||muted||!ws||ws.readyState!==1)return;const pcm=f32ToPcm16(e.inputBuffer.getChannelData(0));ws.send(JSON.stringify({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:b64FromBytes(pcm)}}}))};source.connect(processor);processor.connect(inputCtx.destination);stopBtn.disabled=false;muteBtn.disabled=false}catch(e){statusEl.textContent='無法啟動：'+e.message;cleanup(false)}}
function cleanup(close=true){ready=false;if(close&&ws&&ws.readyState<2)ws.close();try{processor?.disconnect();source?.disconnect();inputCtx?.close();stream?.getTracks().forEach(t=>t.stop())}catch{}ws=null;stream=null;processor=null;source=null;inputCtx=null;startBtn.disabled=false;stopBtn.disabled=true;muteBtn.disabled=true;bar.style.width='0'}
startBtn.onclick=start;stopBtn.onclick=()=>cleanup(true);muteBtn.onclick=()=>{muted=!muted;muteBtn.textContent=muted?'取消靜音':'靜音'};
</script></body></html>`);
}



async function handleAppealApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const path = url.pathname.replace("/api/appeal", "");
  if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉入口暂时关闭。" }, 503);
  if (request.method === "POST" && path === "/request-code") {
    const qq = String(body.qq || "").replace(/\D/g, ""); if (!qq) return jsonResponse({ ok: false, message: "请输入 QQ 号。" }, 400);
    const code = generateSixDigitCode(); await dbPut(env, `appeal_auth_code:${qq}`, JSON.stringify({ code, expiresAt: Date.now()+300000, attempts:0 }));
    const sent = await sendOneBotAction(env, { action:"send_private_msg", params:{ user_id:numericId(qq), message:`【匿名申诉验证码】\n验证码：${code}\n有效期：5分钟。`, auto_escape:false } });
    return jsonResponse({ ok: sent, message: sent ? "验证码已发送至 QQ 私讯。" : "NapCat 当前未连接。" }, sent ? 200 : 503);
  }
  if (request.method === "POST" && path === "/verify-code") {
    const qq=String(body.qq||"").replace(/\D/g,""),code=String(body.code||"").replace(/\D/g,""); const raw=await dbGet(env,`appeal_auth_code:${qq}`); if(!raw)return jsonResponse({ok:false,message:"验证码不存在或已过期。"},400);
    let item;try{item=JSON.parse(raw)}catch{} if(!item||Date.now()>item.expiresAt){await dbDel(env,`appeal_auth_code:${qq}`);return jsonResponse({ok:false,message:"验证码已过期。"},400)}
    if(item.code!==code){item.attempts=(item.attempts||0)+1;item.attempts>=5?await dbDel(env,`appeal_auth_code:${qq}`):await dbPut(env,`appeal_auth_code:${qq}`,JSON.stringify(item));return jsonResponse({ok:false,message:"验证码错误。"},400)}
    await dbDel(env,`appeal_auth_code:${qq}`);const token=crypto.randomUUID()+crypto.randomUUID();await dbPut(env,`appeal_session:${token}`,JSON.stringify({qq,expiresAt:Date.now()+3600000}));return jsonResponse({ok:true,token,message:"验证成功。"});
  }
  const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||body.token||url.searchParams.get("token")||"";const sess=await readJson(env,`appeal_session:${token}`,null);if(!sess||Date.now()>Number(sess.expiresAt||0))return jsonResponse({ok:false,message:"申诉验证已过期。"},401);
  if(request.method==="GET"&&path==="/groups")return jsonResponse({ok:true,groups:await getWhitelistedGroupsForUser(env,sess.qq)});
  if(request.method==="POST"&&path==="/submit"){
    const groupId=String(body.groupId||"").replace(/\D/g,"");if(!groupId||!(await isGroupWhitelisted(env,groupId))||!(await verifyGroupMembership(env,groupId,sess.qq)))return jsonResponse({ok:false,message:"无法确认你属于该 AI 白名单群。"},403);
    const type=String(body.type||"其他").trim(),content=String(body.content||"").trim();if(content.length<5)return jsonResponse({ok:false,message:"请填写较完整的申诉内容。"},400);
    const id=`app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`;const appeal={id,anonymousLabel:`匿名申诉-${id.slice(-6)}`,applicantId:String(sess.qq),groupId,type,content,evidenceMessageId:String(body.evidenceMessageId||""),status:"pending_owner",createdAt:new Date().toISOString(),reviewerIds:[],votes:{},approvalRule:"single",result:"",againstAdmin:/管理|群主|开发者|開發者/i.test(type+content),recommendedReviewerRole:/管理|群主|开发者|開發者/i.test(type+content)?"owner":"developer_choice"};
    await dbPut(env,`appeal:${id}`,JSON.stringify(appeal));await appendIndex(env,"appeal:index",id,5000);await appendIndex(env,`appeal:user:${sess.qq}`,id,200);
    await notifyDeveloper(env,`【收到匿名申诉】\n编号：${id}\n群号：${groupId}\n申诉人QQ：${sess.qq}\n类型：${type}\n内容：${content}\n只通知了你，请在 Portal 自行处理或指派审核人。`);
    return jsonResponse({ok:true,id,message:"申诉已匿名提交，仅开发者可查看你的 QQ。"});
  }
  if(request.method==="GET"&&path==="/mine"){
    const ids=await readJson(env,`appeal:user:${sess.qq}`,[]),appeals=[];for(const id of ids.slice(-100).reverse()){const a=await readJson(env,`appeal:${id}`,null);if(a)appeals.push({id:a.id,groupId:a.groupId,type:a.type,content:a.content,status:a.status,result:a.result,createdAt:a.createdAt})}return jsonResponse({ok:true,appeals});
  }
  return jsonResponse({ok:false,message:"未知申诉 API。"},404);
}



function getAppealPage(host) {
  return toSimplifiedChinese(`<!doctype html><html lang="zh-Hans-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQAI 匿名申訴</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui;background:radial-gradient(circle at 30% 10%,#173b60,#060d18 45%,#020409);color:#edf7ff;padding:22px}.wrap{max-width:760px;margin:auto}.card{background:#07101ee8;border:1px solid #ffffff22;border-radius:16px;padding:20px;margin:14px 0}h1{margin-bottom:6px}.muted{color:#a9bacd;line-height:1.6}label{display:block;margin-top:12px;color:#b8c7d9}input,select,textarea{width:100%;border:1px solid #ffffff24;background:#081525;color:#fff;border-radius:9px;padding:11px;margin-top:6px}textarea{min-height:150px}button{margin-top:14px;border:0;border-radius:9px;background:#67ddff;color:#03111a;font-weight:800;padding:11px 16px;cursor:pointer}.hidden{display:none}.msg{white-space:pre-wrap;color:#8ff0c0;margin-top:12px}.item{border-top:1px solid #ffffff17;padding:10px 0}</style></head><body><div class="wrap"><h1>匿名申訴</h1><div class="muted">審核人看不到申訴人的 QQ；只有開發者可查看真實身分。系統會先确认你屬於可使用 AI 的白名單群。</div><section class="card" id="login"><label>QQ 号</label><input id="qq" inputmode="numeric"><button id="send">發送驗證碼</button><label>驗證碼</label><input id="code" maxlength="6" inputmode="numeric"><button id="verify">驗證</button><div class="msg" id="loginMsg"></div></section><section class="card hidden" id="form"><label>所屬白名單群</label><select id="group"></select><label>申訴類型</label><select id="type"><option>禁言</option><option>踢出</option><option>AI黑名单</option><option>管理操作</option><option>排程</option><option>其他</option></select><label>相關訊息 ID（選填）</label><input id="evidence"><label>申訴內容</label><textarea id="content"></textarea><button id="submit">匿名提交</button><button id="refresh">查看我的案件</button><div class="msg" id="formMsg"></div><div id="cases"></div></section></div><script>let token='';const post=async(p,d)=>{const r=await fetch('/api/appeal'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(d||{})});return r.json()},get=async p=>(await fetch('/api/appeal'+p,{headers:token?{Authorization:'Bearer '+token}:{}})).json();send.onclick=async()=>loginMsg.textContent=(await post('/request-code',{qq:qq.value})).message;verify.onclick=async()=>{const r=await post('/verify-code',{qq:qq.value,code:code.value});loginMsg.textContent=r.message;if(r.ok){token=r.token;const g=await get('/groups');group.innerHTML=(g.groups||[]).map(x=>'<option value="'+x.groupId+'">'+x.groupName+'（'+x.groupId+'）</option>').join('');login.classList.add('hidden');form.classList.remove('hidden')}};submit.onclick=async()=>{const r=await post('/submit',{groupId:group.value,type:type.value,content:content.value,evidenceMessageId:evidence.value});formMsg.textContent=r.message;if(r.ok){content.value='';load()}};async function load(){const r=await get('/mine');cases.innerHTML=(r.appeals||[]).map(a=>'<div class="item"><b>'+a.id+'</b>｜'+a.status+'<br>'+a.type+'｜'+a.content+(a.result?'<br>結果：'+a.result:'')+'</div>').join('')||'<div class="muted">暂无案件</div>'}refresh.onclick=load;</script></body></html>`);
}




function publicAuthPageStyles() {
  return "\n:root{\n  color-scheme:dark;\n  --bg:#020714;--bg2:#061126;--surface:rgba(8,20,42,.76);--surface-strong:rgba(10,25,51,.94);\n  --surface-soft:rgba(19,37,70,.58);--line:rgba(107,164,255,.20);--line-strong:rgba(91,211,255,.48);\n  --text:#f3f8ff;--muted:#8fa8c8;--faint:#5d7292;--cyan:#24e4ff;--blue:#3f7cff;--violet:#8a5cff;\n  --purple:#c05dff;--green:#39e0af;--amber:#ffc268;--red:#ff6b86;--shadow:0 28px 90px rgba(0,0,0,.42);\n  --glow:0 0 0 1px rgba(57,198,255,.08),0 18px 60px rgba(10,113,255,.14);\n  font-family:Inter,\"Noto Sans TC\",\"Microsoft JhengHei\",system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif\n}\n*{box-sizing:border-box}\nhtml{scroll-behavior:smooth;background:var(--bg)}\nbody{margin:0;min-height:100dvh;color:var(--text);background:\nradial-gradient(circle at 15% 10%,rgba(43,104,255,.22),transparent 30rem),\nradial-gradient(circle at 82% 14%,rgba(145,67,255,.16),transparent 28rem),\nradial-gradient(circle at 50% 90%,rgba(0,225,255,.08),transparent 34rem),\nlinear-gradient(180deg,#020713 0%,#040a18 45%,#020610 100%);overflow-x:hidden}\nbody:before{content:\"\";position:fixed;inset:0;pointer-events:none;opacity:.34;background-image:\nlinear-gradient(rgba(80,142,255,.07) 1px,transparent 1px),\nlinear-gradient(90deg,rgba(80,142,255,.07) 1px,transparent 1px);background-size:42px 42px;\nmask-image:linear-gradient(to bottom,rgba(0,0,0,.85),transparent 92%);z-index:-2}\nbody:after{content:\"\";position:fixed;inset:auto -15vw -40vh -15vw;height:70vh;pointer-events:none;\nbackground:repeating-radial-gradient(ellipse at center,rgba(36,228,255,.10) 0 1px,transparent 1px 36px);\ntransform:perspective(420px) rotateX(68deg);opacity:.28;z-index:-1}\na{color:inherit}\nbutton,input,select,textarea{font:inherit}\nbutton,a{outline-color:var(--cyan)}\n::selection{background:rgba(36,228,255,.28);color:#fff}\n.shell{width:min(1540px,calc(100% - 56px));margin:0 auto}\n.top{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(92,158,255,.13);position:relative;z-index:10}\n.top:after{content:\"\";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(36,228,255,.55),rgba(138,92,255,.4),transparent);opacity:.6}\n.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:900;letter-spacing:-.02em}\n.brand-copy{display:grid;gap:2px}.brand-copy b{font-size:18px}.brand-copy small{font-size:10px;letter-spacing:.16em;color:#6f8eb8;font-weight:800;text-transform:uppercase}\n.brand-mark{position:relative;width:42px;height:42px;display:inline-block;filter:drop-shadow(0 0 18px rgba(36,228,255,.28));flex:0 0 42px}\n.brand-mark:before,.brand-mark:after,.brand-mark i{content:\"\";position:absolute;border-radius:5px;transform-origin:center}\n.brand-mark:before{width:13px;height:36px;left:10px;top:3px;transform:skew(-23deg);background:linear-gradient(180deg,#24e4ff,#3e7dff 48%,#9a5cff)}\n.brand-mark:after{width:13px;height:27px;right:8px;bottom:3px;transform:skew(22deg);background:linear-gradient(180deg,#6d8bff,#9a5cff 58%,#d35cff)}\n.brand-mark i:first-child{width:25px;height:8px;left:9px;bottom:8px;transform:skew(-16deg);background:linear-gradient(90deg,#1ee7ff,#7f72ff)}\n.brand-mark i:last-child{width:8px;height:8px;right:2px;top:2px;background:#33e7ff;box-shadow:0 0 18px #33e7ff}\n.nav{display:flex;align-items:center;justify-content:flex-end;gap:4px}.nav a{font-size:13px;font-weight:750;color:#9eb1cc;text-decoration:none;padding:10px 13px;border-radius:10px;transition:.18s ease}\n.nav a:hover,.nav a.active{color:#fff;background:rgba(75,128,255,.10);box-shadow:inset 0 0 0 1px rgba(74,176,255,.16)}\n.nav .nav-cta{margin-left:9px;color:#fff;background:linear-gradient(115deg,#0bbde9,#4567ff 55%,#8b50ff);box-shadow:0 0 26px rgba(46,142,255,.26),inset 0 0 0 1px rgba(255,255,255,.15);padding-inline:18px}\n.btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid rgba(98,155,255,.22);border-radius:12px;padding:11px 16px;font-weight:820;text-decoration:none;cursor:pointer;color:#dfeaff;background:linear-gradient(180deg,rgba(21,40,75,.78),rgba(9,20,43,.82));box-shadow:inset 0 1px rgba(255,255,255,.04);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}\n.btn:hover{transform:translateY(-1px);border-color:rgba(57,212,255,.55);box-shadow:0 10px 30px rgba(8,88,184,.16),inset 0 1px rgba(255,255,255,.06)}\n.btn.primary{border-color:rgba(80,225,255,.64);color:#fff;background:linear-gradient(110deg,#00bcd9,#356eff 52%,#8755ff);box-shadow:0 0 30px rgba(38,142,255,.28),inset 0 1px rgba(255,255,255,.28)}\n.btn.ghost{background:rgba(8,20,45,.56);backdrop-filter:blur(12px)}\n.btn:disabled{opacity:.55;cursor:not-allowed;transform:none}\n.hero{padding:72px 0 50px;display:grid;grid-template-columns:minmax(0,.92fr) minmax(560px,1.08fr);gap:54px;align-items:center;position:relative}\n.hero:before{content:\"AI-NATIVE AUTOMATION PLATFORM\";position:absolute;left:0;top:34px;font-size:10px;letter-spacing:.30em;color:#44c9ff;font-weight:900}\n.hero-copy h1{font-size:clamp(48px,5.8vw,88px);line-height:1.03;letter-spacing:-.06em;margin:0 0 22px;max-width:760px;text-wrap:balance}\n.hero-copy h1 .gradient{background:linear-gradient(90deg,#28e7ff 5%,#69a3ff 48%,#cf67ff 95%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(56,173,255,.18))}\n.hero-copy>p{font-size:17px;line-height:1.85;color:#9db0cb;margin:0 0 28px;max-width:690px}\n.hero-actions{display:flex;gap:13px;flex-wrap:wrap}.hero-actions .btn{min-width:200px;min-height:54px;font-size:15px}\n.trust-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:28px}.trust{display:grid;grid-template-columns:38px 1fr;gap:11px;align-items:center;padding:12px;border:1px solid rgba(80,145,255,.13);border-radius:14px;background:rgba(5,17,37,.44)}.trust-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;border:1px solid rgba(65,210,255,.32);color:#55e6ff;background:linear-gradient(145deg,rgba(30,203,255,.12),rgba(80,81,255,.12));font-weight:900}.trust b{display:block;font-size:12px}.trust small{display:block;font-size:10px;color:#6f86a6;margin-top:3px}\n.console-preview{position:relative;min-height:520px;border:1px solid rgba(55,180,255,.46);border-radius:26px;background:linear-gradient(145deg,rgba(7,22,49,.92),rgba(4,12,29,.96));box-shadow:0 0 0 1px rgba(88,100,255,.12),0 30px 90px rgba(0,0,0,.42),0 0 55px rgba(32,129,255,.13);overflow:hidden;isolation:isolate}\n.console-preview:before{content:\"\";position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.8%,rgba(65,166,255,.05) 50%,transparent 50.2%),linear-gradient(transparent 49.8%,rgba(65,166,255,.05) 50%,transparent 50.2%);background-size:46px 46px;opacity:.45;z-index:-1}\n.console-preview:after{content:\"\";position:absolute;right:-60px;top:-90px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle at 38% 36%,rgba(255,255,255,.9) 0 1%,#44d9ff 4%,#407bff 13%,#754eff 27%,rgba(80,42,200,.55) 44%,rgba(10,25,62,.2) 65%,transparent 70%);filter:blur(.2px);box-shadow:0 0 46px rgba(49,168,255,.55),0 0 100px rgba(98,63,255,.34);opacity:.72}\n.preview-top{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(91,156,255,.14);background:rgba(5,14,32,.68);backdrop-filter:blur(18px)}.preview-brand{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900}.preview-brand .brand-mark{transform:scale(.54);transform-origin:left center;width:24px;margin-right:-12px}.preview-status{display:flex;align-items:center;gap:7px;font-size:10px;color:#7e95b6}.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green)}\n.preview-shell{display:grid;grid-template-columns:150px minmax(0,1fr);min-height:462px}.preview-nav{border-right:1px solid rgba(91,156,255,.12);padding:15px 11px;background:rgba(4,12,30,.52)}.preview-nav span{display:flex;align-items:center;gap:9px;color:#6983aa;font-size:10px;padding:9px 10px;border-radius:9px;margin:2px 0}.preview-nav span:before{content:\"\";width:7px;height:7px;border-radius:2px;border:1px solid currentColor}.preview-nav span.active{color:#e8f5ff;background:linear-gradient(90deg,rgba(38,104,255,.34),rgba(85,54,255,.13));box-shadow:inset 2px 0 #2fe2ff}\n.preview-main{padding:22px;position:relative;z-index:1}.preview-kicker{font-size:10px;letter-spacing:.16em;color:#45d4ff;font-weight:850}.preview-main h3{font-size:23px;margin:7px 0 4px}.preview-main>p{margin:0;color:#7d94b6;font-size:11px}\n.preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:24px}.preview-card{min-height:92px;padding:13px;border-radius:12px;border:1px solid rgba(83,149,255,.17);background:linear-gradient(180deg,rgba(13,31,64,.82),rgba(6,17,39,.82));box-shadow:inset 0 1px rgba(255,255,255,.025)}.preview-card small{display:block;color:#6f86a6;font-size:9px;margin-bottom:7px}.preview-card b{font-size:15px}.preview-card em{font-style:normal;font-size:9px;color:#39d8b0;display:block;margin-top:8px}\n.flow{margin-top:12px;border:1px solid rgba(83,149,255,.16);border-radius:14px;padding:14px;background:rgba(4,14,33,.66)}.flow-head{display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:850}.flow-head span{color:#47dab8}.flow-nodes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:17px;margin-top:14px}.flow-node{position:relative;padding:11px 6px;text-align:center;border-radius:10px;border:1px solid rgba(75,187,255,.24);background:linear-gradient(150deg,rgba(62,78,255,.20),rgba(10,27,56,.72));font-size:9px}.flow-node:not(:last-child):after{content:\"→\";position:absolute;right:-14px;top:50%;transform:translateY(-50%);color:#31dcff;font-weight:900}.flow-node b{display:block;font-size:10px;margin-bottom:4px}.flow-node:nth-child(2){border-color:rgba(150,92,255,.42)}.flow-node:nth-child(3){border-color:rgba(36,228,255,.42)}.flow-node:nth-child(4){border-color:rgba(65,226,176,.36)}\n.resource-strip{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}.resource-chip{font-size:8px;color:#8fa7c8;border:1px solid rgba(90,154,255,.17);border-radius:999px;padding:5px 8px;background:rgba(10,24,51,.72)}.resource-chip b{color:#dcecff}.resource-chip i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#566d92;margin-right:5px}.resource-chip.ready i{background:var(--green);box-shadow:0 0 8px var(--green)}\n.section{padding:30px 0 74px}.section-headline{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:18px}.section-kicker{font-size:10px;letter-spacing:.18em;color:#45d5ff;font-weight:900}.section-headline h2{font-size:29px;margin:6px 0 0;letter-spacing:-.035em}.section-headline p{margin:0;color:#6680a4;font-size:12px;max-width:420px;text-align:right}\n.feature-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.feature{min-height:180px;border:1px solid rgba(82,150,255,.18);border-radius:16px;padding:18px;background:linear-gradient(155deg,rgba(14,34,70,.68),rgba(5,17,39,.77));position:relative;overflow:hidden;transition:.2s ease}.feature:before{content:\"\";position:absolute;inset:auto -30px -55px auto;width:110px;height:110px;border-radius:50%;background:var(--accent,#277dff);filter:blur(60px);opacity:.22}.feature:hover{transform:translateY(-3px);border-color:rgba(69,219,255,.42);box-shadow:0 20px 55px rgba(0,0,0,.23)}.feature-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;border:1px solid color-mix(in srgb,var(--accent,#32ccff) 55%,transparent);background:color-mix(in srgb,var(--accent,#32ccff) 13%,transparent);color:var(--accent,#32ccff);font-weight:900}.feature h3{font-size:14px;margin:16px 0 8px}.feature p{font-size:11px;line-height:1.7;color:#7e94b4;margin:0}.feature-foot{position:absolute;left:18px;right:18px;bottom:15px;font-size:9px;color:#577298}.role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.role{border:1px solid rgba(83,151,255,.17);border-radius:15px;padding:17px;background:rgba(7,20,45,.63)}.role-top{display:flex;align-items:center;gap:10px}.role-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(53,127,255,.2),rgba(123,67,255,.16));border:1px solid rgba(96,160,255,.24);color:#78dfff;font-weight:900}.role h3{font-size:13px;margin:0}.role p{color:#718bad;font-size:10px;line-height:1.7;margin:11px 0 0}\n.cta-band{margin-bottom:68px;padding:28px;border:1px solid rgba(72,193,255,.27);border-radius:20px;background:linear-gradient(100deg,rgba(10,45,88,.72),rgba(42,29,92,.68));display:flex;align-items:center;justify-content:space-between;gap:22px;box-shadow:0 20px 70px rgba(0,0,0,.18)}.cta-band h2{margin:0 0 6px;font-size:24px}.cta-band p{margin:0;color:#809abb;font-size:12px}.footer{padding:22px 0 38px;border-top:1px solid rgba(92,158,255,.12);display:flex;align-items:center;justify-content:space-between;color:#556f93;font-size:10px;letter-spacing:.05em}\n.auth-wrap{min-height:calc(100dvh - 77px);display:grid;place-items:center;padding:42px 0 62px}.auth-stage{width:min(1100px,100%);display:grid;grid-template-columns:minmax(0,.95fr) minmax(430px,.78fr);gap:20px;align-items:stretch}.auth-visual,.auth-card{border:1px solid rgba(75,161,255,.23);border-radius:24px;background:linear-gradient(155deg,rgba(9,25,54,.88),rgba(3,12,29,.94));box-shadow:var(--shadow);position:relative;overflow:hidden}.auth-visual{padding:34px;min-height:600px;display:flex;flex-direction:column;justify-content:space-between}.auth-visual:before{content:\"\";position:absolute;width:420px;height:420px;border-radius:50%;right:-130px;top:-130px;background:radial-gradient(circle at 35% 35%,#d9fbff 0 1%,#31dfff 5%,#4778ff 18%,#7b52ff 33%,rgba(74,44,160,.35) 54%,transparent 68%);box-shadow:0 0 70px rgba(55,158,255,.42);opacity:.7}.auth-visual:after{content:\"\";position:absolute;inset:0;background-image:linear-gradient(rgba(77,142,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(77,142,255,.05) 1px,transparent 1px);background-size:36px 36px;mask-image:linear-gradient(135deg,#000,transparent 75%);pointer-events:none}.auth-copy{position:relative;z-index:1;max-width:520px}.auth-copy .eyebrow,.eyebrow{font-size:10px;letter-spacing:.20em;color:#45d8ff;font-weight:900;text-transform:uppercase}.auth-copy h1{font-size:42px;line-height:1.08;letter-spacing:-.05em;margin:10px 0 14px}.auth-copy p{color:#89a2c2;line-height:1.8;font-size:13px}.auth-points{position:relative;z-index:1;display:grid;gap:9px}.auth-point{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(84,151,255,.14);background:rgba(6,19,43,.55);font-size:11px;color:#9ab1ce}.auth-point i{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:rgba(36,228,255,.1);color:#3fe5ff;font-style:normal;font-weight:900}\n.auth-card{padding:30px 32px;align-self:center}.auth-card h2{font-size:25px;margin:6px 0 7px;letter-spacing:-.035em}.auth-card>p{margin:0 0 20px;color:#7e96b6;font-size:12px;line-height:1.7}.field{display:grid;gap:7px;margin:13px 0}.field label{font-size:11px;font-weight:800;color:#aebed4}.field input,.field select,.field textarea{width:100%;border:1px solid rgba(91,151,230,.22);border-radius:11px;background:rgba(4,14,32,.88);color:#edf6ff;padding:12px 13px;outline:none;box-shadow:inset 0 1px rgba(255,255,255,.02)}.field input::placeholder,.field textarea::placeholder{color:#48617f}.field input:focus,.field select:focus,.field textarea:focus{border-color:#2bd8ff;box-shadow:0 0 0 3px rgba(36,228,255,.08),0 0 24px rgba(28,141,255,.09)}.notice{margin-top:13px;padding:11px 13px;border:1px solid rgba(79,144,229,.15);border-radius:11px;background:rgba(8,22,48,.76);color:#7893b5;font-size:11px;line-height:1.6}.notice.error,.error{color:#ff8ca0;border-color:rgba(255,107,134,.25)}.notice.success,.success{color:#55deb7;border-color:rgba(57,224,175,.25)}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1}.small,.muted{color:#6b84a7;font-size:10px}.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(83,151,255,.2),transparent);margin:20px 0}.hidden{display:none!important}details{margin-top:16px;border:1px solid rgba(82,149,231,.17);border-radius:12px;padding:12px 13px;background:rgba(5,16,38,.66)}summary{cursor:pointer;font-size:11px;font-weight:850;color:#b8c9dc}.step-list{display:grid;gap:10px;position:relative;z-index:1}.step{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start}.step-num{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:900;border:1px solid rgba(55,215,255,.25);background:rgba(40,146,255,.12);color:#5ee7ff}.step b{display:block;font-size:11px}.step small{display:block;color:#6f88aa;font-size:9px;margin-top:3px;line-height:1.5}\n@media(max-width:1200px){.feature-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.hero{grid-template-columns:1fr 1fr;gap:30px}.console-preview{min-height:500px}}\n@media(max-width:940px){.shell{width:min(100% - 30px,1540px)}.hero{grid-template-columns:1fr;padding-top:64px}.console-preview{max-width:760px;width:100%;margin:auto}.auth-stage{grid-template-columns:1fr;max-width:720px}.auth-visual{min-height:390px}.feature-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-headline{align-items:start;flex-direction:column}.section-headline p{text-align:left}.nav a.hide-tablet{display:none}}\n@media(max-width:620px){.shell{width:min(100% - 20px,1540px)}.top{min-height:66px}.brand-copy small{display:none}.nav a:not(.nav-cta){display:none}.nav .nav-cta{margin:0;padding:10px 13px}.hero{padding-top:58px}.hero:before{top:28px;font-size:8px}.hero-copy h1{font-size:44px}.hero-copy>p{font-size:14px}.hero-actions{display:grid;grid-template-columns:1fr}.hero-actions .btn{min-width:0}.trust-row{grid-template-columns:1fr}.console-preview{min-height:430px;border-radius:18px}.preview-shell{grid-template-columns:1fr}.preview-nav{display:none}.preview-main{padding:18px}.preview-grid{grid-template-columns:1fr 1fr}.preview-card:last-child{grid-column:1/-1}.flow-nodes{grid-template-columns:1fr 1fr;gap:9px}.flow-node:not(:last-child):after{display:none}.feature-grid,.role-grid{grid-template-columns:1fr}.section{padding-bottom:50px}.section-headline h2{font-size:24px}.cta-band{align-items:flex-start;flex-direction:column}.auth-wrap{padding-top:24px}.auth-visual{display:none}.auth-card{padding:24px 20px;border-radius:18px}.footer{flex-direction:column;gap:8px;text-align:center}}\n@media(prefers-reduced-motion:no-preference){.console-preview:after{animation:orbFloat 7s ease-in-out infinite}.brand-mark{animation:brandPulse 6s ease-in-out infinite}}@keyframes orbFloat{50%{transform:translate3d(-12px,14px,0) scale(1.04)}}@keyframes brandPulse{50%{filter:drop-shadow(0 0 26px rgba(36,228,255,.42))}}\n" + String.raw`
/* v3 visual-fidelity layer: approved generated mockup */
.public-home{position:relative;isolation:isolate}
.public-home .shell{width:min(1710px,calc(100% - 34px))}
.public-home .top{min-height:70px}
.public-home .nav{gap:7px}
.public-home .nav a{font-size:12px;padding:10px 14px}
.public-home .nav .nav-cta{padding-inline:22px}
.cyber-skyline{position:absolute;z-index:-1;pointer-events:none;left:0;right:0;top:70px;height:610px;overflow:hidden;opacity:.92}
.cyber-skyline:before{content:"";position:absolute;left:-2%;right:-2%;bottom:52px;height:330px;background:
linear-gradient(180deg,transparent 0 24%,rgba(0,42,86,.06) 25% 100%),
repeating-linear-gradient(90deg,transparent 0 28px,rgba(27,157,255,.11) 29px 31px,transparent 32px 57px),
linear-gradient(90deg,rgba(14,93,160,.09),rgba(25,64,154,.22) 34%,rgba(86,53,186,.16) 66%,rgba(16,80,141,.08));
clip-path:polygon(0 73%,2% 73%,2% 52%,4% 52%,4% 68%,6% 68%,6% 39%,8% 39%,8% 75%,11% 75%,11% 58%,13% 58%,13% 24%,15% 24%,15% 71%,18% 71%,18% 45%,20% 45%,20% 82%,23% 82%,23% 55%,25% 55%,25% 31%,27% 31%,27% 72%,30% 72%,30% 49%,33% 49%,33% 20%,35% 20%,35% 69%,38% 69%,38% 35%,41% 35%,41% 76%,44% 76%,44% 51%,47% 51%,47% 26%,50% 26%,50% 73%,53% 73%,53% 47%,56% 47%,56% 16%,59% 16%,59% 70%,62% 70%,62% 37%,65% 37%,65% 79%,68% 79%,68% 43%,71% 43%,71% 25%,74% 25%,74% 74%,77% 74%,77% 50%,80% 50%,80% 18%,83% 18%,83% 67%,86% 67%,86% 33%,89% 33%,89% 76%,92% 76%,92% 45%,95% 45%,95% 64%,98% 64%,98% 72%,100% 72%,100% 100%,0 100%);filter:drop-shadow(0 -8px 18px rgba(0,128,255,.10))}
.cyber-skyline:after{content:"";position:absolute;left:-10%;right:-10%;bottom:-195px;height:360px;background:
repeating-linear-gradient(90deg,rgba(35,205,255,.20) 0 1px,transparent 1px 54px),
repeating-linear-gradient(0deg,rgba(35,205,255,.18) 0 1px,transparent 1px 38px);
transform:perspective(480px) rotateX(68deg);transform-origin:center top;mask-image:linear-gradient(180deg,#000,transparent 86%);opacity:.54}
.edge-motto{position:absolute;right:28px;top:86px;z-index:3;font-size:9px;line-height:1.55;letter-spacing:.20em;color:#668dff;text-align:left;font-weight:900;text-transform:uppercase}
.public-home .hero{padding:51px 0 25px;grid-template-columns:minmax(410px,.77fr) minmax(700px,1.23fr);gap:34px;min-height:530px;align-items:center}
.public-home .hero:before{top:30px;font-size:9px;letter-spacing:.28em}
.public-home .hero-copy{padding-bottom:10px}
.public-home .hero-copy h1{font-size:clamp(45px,4.15vw,68px);line-height:1.04;margin-bottom:18px;max-width:690px}
.public-home .hero-copy>p{font-size:15px;line-height:1.72;max-width:610px;margin-bottom:22px}
.public-home .hero-actions .btn{min-width:205px;min-height:52px}
.public-home .trust-row{margin-top:22px;gap:8px}
.public-home .trust{padding:9px 10px;grid-template-columns:34px 1fr;border-color:rgba(68,168,255,.18);background:rgba(4,19,43,.62)}
.public-home .trust-icon{width:34px;height:34px}
.public-home .console-preview{min-height:500px;border-radius:22px;border-color:rgba(46,200,255,.65);box-shadow:0 0 0 1px rgba(101,78,255,.20),0 28px 95px rgba(0,0,0,.50),0 0 72px rgba(18,127,255,.24)}
.public-home .console-preview:after{right:52px;top:-58px;width:265px;height:265px;opacity:.90;box-shadow:0 0 60px rgba(49,183,255,.68),0 0 115px rgba(94,57,255,.38)}
.public-home .preview-top{height:54px;display:grid;grid-template-columns:158px minmax(180px,1fr) auto;gap:12px;padding:0 14px}
.preview-search{height:30px;display:flex;align-items:center;padding:0 11px;border:1px solid rgba(88,154,255,.18);border-radius:7px;background:rgba(8,23,50,.70);color:#5f789a;font-size:9px;max-width:290px}
.preview-search:before{content:"⌕";margin-right:7px;color:#6bbfff;font-size:13px}
.preview-tools{display:flex;gap:8px;align-items:center;color:#6e8aab;font-size:10px}.preview-tool,.preview-avatar{width:26px;height:26px;display:grid;place-items:center;border:1px solid rgba(73,157,248,.19);border-radius:50%;background:rgba(9,28,58,.75)}.preview-avatar{color:#8fdfff;border-color:rgba(80,205,255,.36);box-shadow:0 0 15px rgba(45,176,255,.12);font-weight:900}
.public-home .preview-shell{grid-template-columns:142px minmax(0,1fr);min-height:446px}
.public-home .preview-nav{padding:12px 9px}
.public-home .preview-nav span{padding:8px 9px;font-size:9px}
.public-home .preview-main{padding:16px 16px 14px}
.preview-welcome{padding:2px 6px 12px}.preview-welcome h3{font-size:20px;margin:4px 0 2px}.preview-welcome h3 strong{color:#61dfff}.preview-welcome p{margin:0;font-size:9px;color:#6b83a5}
.preview-main-grid{display:grid;grid-template-columns:minmax(0,1fr) 175px;gap:10px}
.preview-core{min-width:0}
.preview-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:9px}
.preview-stat{min-height:76px;border:1px solid rgba(78,151,240,.18);border-radius:10px;padding:10px;background:linear-gradient(160deg,rgba(14,35,72,.86),rgba(5,18,42,.82));position:relative;overflow:hidden}.preview-stat:after{content:"";position:absolute;width:74px;height:74px;right:-38px;bottom:-42px;border-radius:50%;background:var(--stat-accent,#328cff);filter:blur(38px);opacity:.18}.preview-stat small{display:block;color:#667f9f;font-size:8px;margin-bottom:6px}.preview-stat b{display:block;font-size:12px;color:#eef8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-stat em{display:block;font-style:normal;color:#45dfb4;font-size:7px;margin-top:7px}
.public-home .flow{margin-top:0;padding:11px 12px;border-radius:11px}
.public-home .flow-nodes{gap:12px;margin-top:10px}
.public-home .flow-node{padding:9px 4px;font-size:8px}.public-home .flow-node b{font-size:9px}
.preview-resource-rail{border:1px solid rgba(78,151,240,.18);border-radius:11px;background:linear-gradient(160deg,rgba(12,31,64,.86),rgba(5,17,39,.86));padding:11px}.preview-resource-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:9px;font-weight:850;margin-bottom:7px}.preview-resource-head span{color:#6782a6;font-size:7px;font-weight:700}.resource-row{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:7px;min-height:42px;border-top:1px solid rgba(85,150,229,.10);font-size:8px}.resource-row:first-of-type{border-top:0}.resource-logo{width:23px;height:23px;border-radius:7px;display:grid;place-items:center;border:1px solid rgba(69,184,255,.21);background:rgba(20,67,125,.20);color:#67dfff;font-size:8px;font-weight:900}.resource-row b{font-size:8px}.resource-state{display:flex;align-items:center;gap:4px;font-size:7px;color:#7790b0}.resource-state:before{content:"";width:5px;height:5px;border-radius:50%;background:#657793}.resource-state.core:before,.resource-state.ready:before{background:#3de0b0;box-shadow:0 0 7px #3de0b0}.resource-state.optional:before{background:#54b9ff}.resource-state.planned:before{background:#8a67ff}
.preview-disclaimer{margin-top:7px;font-size:7px;color:#4f698d;line-height:1.45}
.public-home .section{padding:16px 0 28px}
.public-home .section-headline{margin-bottom:12px;align-items:center}
.public-home .section-headline h2{font-size:25px}
.public-home .section-headline p{font-size:10px}
.public-home .feature-grid{gap:9px}
.public-home .feature{min-height:142px;padding:15px;border-radius:13px;background:linear-gradient(150deg,color-mix(in srgb,var(--accent,#277dff) 10%,rgba(9,25,54,.86)),rgba(5,17,38,.88));border-color:color-mix(in srgb,var(--accent,#277dff) 35%,transparent);box-shadow:inset 0 1px rgba(255,255,255,.025),0 12px 34px rgba(0,0,0,.12)}
.public-home .feature-icon{width:35px;height:35px}
.public-home .feature h3{margin:12px 0 6px}.public-home .feature p{font-size:10px;line-height:1.6}.public-home .feature-foot{bottom:12px;font-size:8px}
.roles-layout{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:12px;align-items:stretch}
.public-home .role-grid{gap:9px}
.public-home .role{padding:14px;min-height:96px;background:linear-gradient(150deg,rgba(13,33,68,.76),rgba(5,17,40,.80));border-color:rgba(74,155,244,.20)}
.public-home .role p{font-size:9px;line-height:1.55;margin-top:8px}
.role-quote{position:relative;overflow:hidden;border:1px solid rgba(105,91,255,.20);border-radius:14px;padding:17px;background:linear-gradient(145deg,rgba(37,36,91,.54),rgba(6,21,48,.72));display:flex;flex-direction:column;justify-content:flex-end}.role-quote:before{content:"“";position:absolute;right:15px;top:-16px;font-size:88px;color:rgba(78,150,255,.18);font-family:Georgia,serif}.role-quote p{position:relative;margin:0 0 9px;color:#a7b8d0;font-size:11px;line-height:1.65}.role-quote b{font-size:9px;color:#6690ff;letter-spacing:.08em}
.public-home .cta-band{margin-bottom:30px;padding:18px 22px;border-radius:15px}
.public-home .cta-band h2{font-size:20px}.public-home .cta-band p{font-size:10px}
.public-home .footer{padding:15px 0 23px}
@media(max-width:1280px){.edge-motto{display:none}.public-home .hero{grid-template-columns:minmax(390px,.86fr) minmax(600px,1.14fr);gap:24px}.preview-main-grid{grid-template-columns:minmax(0,1fr) 160px}.public-home .hero-copy h1{font-size:clamp(43px,4vw,60px)}}
@media(max-width:1060px){.public-home .hero{grid-template-columns:1fr}.public-home .console-preview{max-width:none}.roles-layout{grid-template-columns:1fr}.role-quote{min-height:120px}}
@media(max-width:720px){.cyber-skyline{display:none}.public-home .shell{width:min(100% - 20px,1710px)}.public-home .hero{padding-top:58px}.public-home .hero-copy h1{font-size:42px}.public-home .preview-top{grid-template-columns:1fr auto}.preview-search{display:none}.public-home .preview-shell{grid-template-columns:1fr}.public-home .preview-nav{display:none}.preview-main-grid{grid-template-columns:1fr}.preview-resource-rail{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.preview-resource-head,.preview-disclaimer{grid-column:1/-1}.preview-stat-grid{grid-template-columns:1fr 1fr}.roles-layout{grid-template-columns:1fr}}
`;
}

function publicI18nClientScript() {
  const payload = JSON.stringify(portalI18nPayload()).replace(/</g, "\\u003c");
  return '<script id="qqai-public-i18n">(function(){var P='+payload+',L="zh-TW";function n(v){var r=String(v||"").toLowerCase();if(!r)return"zh-TW";if(r==="zh"||r.indexOf("zh-tw")===0||r.indexOf("zh-hk")===0||r.indexOf("zh-hant")===0)return"zh-TW";if(r.indexOf("zh-cn")===0||r.indexOf("zh-sg")===0||r.indexOf("zh-hans")===0)return"zh-CN";if(r.indexOf("pt")===0)return"pt-BR";var x=(P.locales||[]).find(function(a){return String(a.id).toLowerCase()===r});if(x)return x.id;var b=r.split("-")[0],y=(P.locales||[]).find(function(a){return String(a.id).toLowerCase().split("-")[0]===b});return y?y.id:"en"}function t(k){var m=(P.messages||{})[L]||(P.messages||{}).en||{},f=(P.messages||{})["zh-TW"]||{};return m[k]||f[k]||k}function a(){document.documentElement.lang=L;document.querySelectorAll("[data-i18n]").forEach(function(e){e.textContent=t(e.dataset.i18n)});var q=document.getElementById("publicLocale");if(q){q.innerHTML=(P.locales||[]).map(function(x){return "<option value=\\\""+x.id+"\\\">"+x.label+"</option>"}).join("");q.value=L;q.onchange=function(){L=n(this.value);try{localStorage.setItem("qqai_locale",L)}catch(e){}a()}}}try{L=n(localStorage.getItem("qqai_locale")||(navigator.languages&&navigator.languages[0])||navigator.language)}catch(e){L=n(navigator.language)}a()})();<\/script>';
}

function decoratePublicPageI18n(html, page) {
  let source = String(html || "");
  source = source.replace('<nav class="nav">', '<nav class="nav"><select id="publicLocale" class="public-locale" aria-label="Language"></select>');
  const replacements = [
    ['<a class="active hide-tablet" href="/">首頁</a>', '<a class="active hide-tablet" href="/" data-i18n="public.nav.home">首頁</a>'],
    ['<a class="hide-tablet" href="/">首頁</a>', '<a class="hide-tablet" href="/" data-i18n="public.nav.home">首頁</a>'],
    ['<a class="hide-tablet" href="/login">登入</a>', '<a class="hide-tablet" href="/login" data-i18n="public.nav.login">登入</a>'],
    ['<a class="hide-tablet" href="/register">首次啟用</a>', '<a class="hide-tablet" href="/register" data-i18n="public.nav.activate">首次啟用</a>'],
    ['<a class="hide-tablet" href="#features">插件中心</a>', '<a class="hide-tablet" href="#features" data-i18n="public.nav.plugins">插件中心</a>'],
    ['<a href="/register">首次啟用</a>', '<a href="/register" data-i18n="public.nav.activate">首次啟用</a>'],
    ['<a class="active" href="/register">首次啟用</a>', '<a class="active" href="/register" data-i18n="public.nav.activate">首次啟用</a>'],
    ['<a class="nav-cta" href="/login">登入</a>', '<a class="nav-cta" href="/login" data-i18n="public.nav.login">登入</a>'],
    ['<a class="nav-cta" href="/login">已有帳號？登入</a>', '<a class="nav-cta" href="/login" data-i18n="public.nav.login">登入</a>'],
    ['<a class="nav-cta" href="/login">立即開始&nbsp; →</a>', '<a class="nav-cta" href="/login" data-i18n="public.hero.start">登入控制中心</a>']
  ];
  for (const [from, to] of replacements) source = source.replace(from, to);
  if (page === "landing") {
    source = source
      .replace('<h1>把 AI、插件與自己的資源<br>放在<span class="gradient">同一個控制中心</span></h1>', '<h1 data-i18n="public.hero.title">把核心保持簡單，把需要的能力裝成插件。</h1>')
      .replace('<p>使用帳號密碼登入；開發者第一次使用時直接把保留帳號 admin 綁定到 Developer QQID 並設定密碼，不需要 QQ 驗證碼或部署管理金鑰。透過插件生態與 BYOR，把 Cloudflare 與外部 API 接入，打造屬於你的 AI 自動化平台。</p>', '<p data-i18n="public.hero.summary">安全帳密、權限與插件執行留在核心；其他能力按需啟用。</p>')
      .replace('<div class="hero-actions"><a class="btn primary" href="/login">登入控制中心 <span>→</span></a><a class="btn ghost" href="/register">第一次使用？建立帳號</a></div>', '<div class="hero-actions"><a class="btn primary" href="/login" data-i18n="public.hero.start">登入控制中心</a><a class="btn ghost" href="/register" data-i18n="public.hero.activate">首次啟用</a></div>');
  } else if (page === "login") {
    source = source
      .replace('<h1>回到你的<br><span style="color:#52ddff">AI 控制中心</span></h1>', '<h1 data-i18n="login.title">登入你的 AI Control Center</h1>')
      .replace('<p>所有人都使用帳號與密碼登入。角色與資源權限由後端身份決定，不會因為前端入口而改變。</p>', '<p data-i18n="login.summary">日常登入只需要帳號與密碼；只有你啟用 2FA 時才追加第二因素。</p>')
      .replace('<h2>登入你的帳號</h2>', '<h2 data-i18n="login.title">登入你的 AI Control Center</h2>')
      .replace('<button id="loginBtn" type="button" class="btn primary" style="width:100%">登入控制中心&nbsp; →</button>', '<button id="loginBtn" type="button" class="btn primary" style="width:100%" data-i18n="login.button">登入控制中心</button>');
  } else if (page === "register") {
    source = source
      .replace('<h2>第一次使用：設定登入</h2>', '<h2 data-i18n="register.title">第一次使用：設定登入</h2>')
      .replace('<p>開發者使用保留帳號 admin；一般使用者才需要自行建立帳號名稱與完成 QQ 身份啟用。</p>', '<p data-i18n="register.summary">Developer / Root 固定使用 admin；一般使用者依原本身份流程啟用。</p>')
      .replace('<button id="activate" type="button" class="btn primary" style="width:100%">設定密碼並登入&nbsp; →</button>', '<button id="activate" type="button" class="btn primary" style="width:100%" data-i18n="register.button">設定密碼並登入</button>');
  }
  source = source.replace(/<footer class="footer">[\s\S]*?<\/footer>/, '<footer class="footer"><span data-i18n="footer.rights">© 2026 ray20123315. All rights reserved.</span><span>AI Control Center</span></footer>');
  return source.replace("</body>", publicI18nClientScript() + "</body>");
}

function getPublicLandingPage() {\n  const i18nJson = JSON.stringify(portalI18nPayload()).replace(/</g, "\\\\u003c");\n  const pluginJson = JSON.stringify(portalPluginCatalog()).replace(/</g, "\\\\u003c");\n  return "<!doctype html><html lang=\"zh-Hant-TW\" data-theme=\"light\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#f6f8fc\"><title>AI Control Center</title><style>\n:root{color-scheme:light;--bg:#f6f8fc;--surface:#fff;--surface2:#f0f3f8;--text:#111827;--muted:#68758a;--line:#dfe5ee;--brand:#3568f4;--brand2:#7e57f6;--soft:#eaf0ff;--shadow:0 20px 65px rgba(29,42,72,.10)}:root[data-theme=\"dark\"]{color-scheme:dark;--bg:#090d14;--surface:#111722;--surface2:#18212f;--text:#eef3fb;--muted:#99a7ba;--line:#2a3547;--brand:#7b9bff;--brand2:#aa83ff;--soft:#1a2a55;--shadow:0 24px 70px rgba(0,0,0,.34)}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,\"Noto Sans TC\",\"Noto Sans SC\",system-ui,-apple-system,\"Segoe UI\",sans-serif}body{overflow-x:hidden}a{color:inherit;text-decoration:none}button,select{font:inherit}body:before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 78% -10%,color-mix(in srgb,var(--brand) 16%,transparent),transparent 32rem),radial-gradient(circle at 12% 108%,color-mix(in srgb,var(--brand2) 10%,transparent),transparent 34rem)}.wrap{width:min(1220px,calc(100% - 32px));margin:auto}.top{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:11px;min-width:0}.logo{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,var(--brand),var(--brand2));box-shadow:0 10px 28px color-mix(in srgb,var(--brand) 24%,transparent);flex:0 0 auto}.logo img{width:100%;height:100%;object-fit:contain;background:var(--surface);display:none}.logo span{color:#fff;font-size:14px;font-weight:950}.brand-copy b,.brand-copy small{display:block}.brand-copy b{font-size:14px}.brand-copy small{margin-top:3px;color:var(--muted);font-size:10px}.nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.nav a,.nav select,.btn{min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);padding:9px 13px}.nav a{display:inline-flex;align-items:center}.nav .primary,.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:800}.nav select{min-width:145px}.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:48px;align-items:center;padding:72px 0 58px}.eyebrow{color:var(--brand);font-size:10px;letter-spacing:.17em;font-weight:900}.hero h1{font-size:clamp(44px,6vw,78px);line-height:.98;letter-spacing:-.062em;margin:14px 0 18px;max-width:840px}.hero p{font-size:17px;line-height:1.8;color:var(--muted);max-width:740px;margin:0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}.btn{display:inline-flex;align-items:center;justify-content:center;font-weight:760}.btn.ghost{background:transparent}.principles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:30px}.principle{padding:14px 15px;border:1px solid var(--line);border-radius:13px;background:color-mix(in srgb,var(--surface) 86%,transparent)}.principle b{display:block;font-size:12px}.principle span{display:block;margin-top:5px;color:var(--muted);font-size:10px;line-height:1.5}.preview{border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:var(--shadow);padding:18px}.preview-head{display:flex;justify-content:space-between;align-items:center;padding:4px 4px 16px;border-bottom:1px solid var(--line)}.preview-head b{font-size:13px}.preview-head span{font-size:9px;color:var(--muted)}.preview-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:15px 0}.preview-nav div{padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--surface2);font-size:11px;font-weight:800}.preview-nav div:first-child{background:var(--soft);color:var(--brand)}.preview-card{padding:18px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--soft) 40%,var(--surface)))}.preview-card h3{margin:0 0 7px;font-size:24px}.preview-card p{font-size:11px;line-height:1.6}.status{display:flex;justify-content:space-between;margin-top:10px;padding:10px 0;border-top:1px solid var(--line);font-size:10px}.status span{color:var(--muted)}.section{padding:48px 0}.section-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:20px}.section-head h2{margin:6px 0 0;font-size:34px;letter-spacing:-.035em}.section-head p{margin:0;color:var(--muted);max-width:600px;line-height:1.7}.plugin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.plugin{border:1px solid var(--line);border-radius:15px;background:var(--surface);padding:18px}.plugin-icon{width:44px;height:44px;border-radius:12px;background:var(--soft);color:var(--brand);display:grid;place-items:center;font-weight:900}.plugin h3{margin:14px 0 7px;font-size:15px}.plugin p{margin:0;color:var(--muted);font-size:11px;line-height:1.6}.plugin small{display:block;margin-top:14px;color:var(--muted);font-size:9px}.core{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.core article{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:19px}.core b{display:block;font-size:14px}.core p{margin:7px 0 0;color:var(--muted);font-size:11px;line-height:1.65}.cta{margin:36px 0 54px;padding:28px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--soft) 55%,var(--surface)));display:flex;justify-content:space-between;align-items:center;gap:20px}.cta h2{margin:0 0 5px;font-size:26px}.cta p{margin:0;color:var(--muted)}.footer{border-top:1px solid var(--line);padding:22px 0 30px;display:flex;justify-content:space-between;gap:16px;color:var(--muted);font-size:10px}@media(max-width:900px){.hero{grid-template-columns:1fr;padding-top:44px}.principles,.core{grid-template-columns:1fr}.section-head,.cta{align-items:flex-start;flex-direction:column}.nav a:not(.primary){display:none}}@media(max-width:560px){.wrap{width:min(100% - 20px,1220px)}.top{height:auto;padding:12px 0}.brand-copy small{display:none}.hero{gap:28px;padding:36px 0}.hero h1{font-size:46px}.actions .btn{width:100%}.nav select{width:120px;min-width:0}.footer{flex-direction:column}}\n</style><script>window.__QQAI_PUBLIC_I18N__=__I18N__;window.__QQAI_PUBLIC_PLUGINS__=__PLUGINS__;</script></head><body><div class=\"wrap\"><header class=\"top\"><a class=\"brand\" href=\"/\"><span class=\"logo\"><img id=\"publicLogo\" alt=\"\"><span id=\"publicLogoFallback\">AI</span></span><span class=\"brand-copy\"><b id=\"publicBrandName\">AI Control Center</b><small id=\"publicBrandTagline\">AI · Plugins · Your Resources</small></span></a><nav class=\"nav\"><select id=\"locale\"></select><a href=\"/register\" data-i18n=\"public.nav.activate\">首次啟用</a><a href=\"/login\" class=\"primary\" data-i18n=\"public.hero.start\">登入控制中心</a></nav></header><main><section class=\"hero\"><div><div class=\"eyebrow\">PLUGIN-FIRST · MINIMAL CORE</div><h1 data-i18n=\"public.hero.title\">把核心保持簡單，把需要的能力裝成插件。</h1><p data-i18n=\"public.hero.summary\">安全帳密、權限與插件執行留在核心；其餘能力按需啟用。</p><div class=\"actions\"><a class=\"btn primary\" href=\"/login\" data-i18n=\"public.hero.start\">登入控制中心</a><a class=\"btn ghost\" href=\"/register\" data-i18n=\"public.hero.activate\">首次啟用</a></div><div class=\"principles\"><div class=\"principle\"><b>Minimal Core</b><span>Authentication, authorization, account security.</span></div><div class=\"principle\"><b>Plugin Ownership</b><span>Product APIs stay unavailable until their plugin is enabled.</span></div><div class=\"principle\"><b>Your Resources</b><span>Dashboard variables survive deploys; secrets remain separate.</span></div></div></div><aside class=\"preview\"><div class=\"preview-head\"><b>AI Control Center</b><span>V4</span></div><div class=\"preview-nav\"><div>Overview</div><div>Plugins</div><div>Account</div></div><div class=\"preview-card\"><div class=\"eyebrow\">NO FAKE METRICS</div><h3>Three core surfaces.</h3><p>Everything else is plugin-owned and disabled by default until you enable it.</p><div class=\"status\"><span>Canonical host</span><b>aibot.ray2025.com</b></div><div class=\"status\"><span>Product plugins</span><b>Disabled by default</b></div></div></aside></section><section class=\"section\"><div class=\"section-head\"><div><div class=\"eyebrow\">CORE</div><h2>Only what the platform must own.</h2></div><p>登入、權限、帳號安全與插件狀態屬於核心。社群、審核、自動化、模型與外部整合都不是核心。</p></div><div class=\"core\"><article><b>Secure account</b><p>帳號密碼、選用 2FA、server-side authority。</p></article><article><b>Plugin control</b><p>產品功能預設停用，啟用狀態持久化於 D1。</p></article><article><b>Persistent branding</b><p>品牌名稱與 Logo 存在 D1，不會因重新部署被清掉。</p></article></div></section><section class=\"section\"><div class=\"section-head\"><div><div class=\"eyebrow\">PLUGIN CATALOG</div><h2 data-i18n=\"plugins.title\">插件中心</h2></div><p>以下是可選能力，不代表已啟用；登入後由 Developer / Root 決定。</p></div><div id=\"publicPlugins\" class=\"plugin-grid\"></div></section><section class=\"cta\"><div><h2>Your AI. Your plugins. Your resources.</h2><p>先把核心保持乾淨，再只開你真正要用的能力。</p></div><a class=\"btn primary\" href=\"/login\" data-i18n=\"public.hero.start\">登入控制中心</a></section></main><footer class=\"footer\"><span data-i18n=\"footer.rights\">© 2026 ray20123315. All rights reserved.</span><span>AI Control Center · aibot.ray2025.com</span></footer></div>\n<script>(function(){\"use strict\";var P=window.__QQAI_PUBLIC_I18N__||{locales:[],messages:{}},plugins=window.__QQAI_PUBLIC_PLUGINS__||[],locale=\"zh-TW\",branding={};function esc(v){return String(v==null?\"\":v).replace(/[&<>\"']/g,function(c){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"}[c]})}function norm(v){var r=String(v||\"\").toLowerCase();if(!r)return\"zh-TW\";if(r===\"zh\"||r.indexOf(\"zh-tw\")===0||r.indexOf(\"zh-hk\")===0||r.indexOf(\"zh-hant\")===0)return\"zh-TW\";if(r.indexOf(\"zh-cn\")===0||r.indexOf(\"zh-sg\")===0||r.indexOf(\"zh-hans\")===0)return\"zh-CN\";if(r.indexOf(\"pt\")===0)return\"pt-BR\";var x=(P.locales||[]).find(function(a){return String(a.id).toLowerCase()===r});if(x)return x.id;var b=r.split(\"-\")[0],y=(P.locales||[]).find(function(a){return String(a.id).toLowerCase().split(\"-\")[0]===b});return y?y.id:\"en\"}function tr(k){var m=(P.messages||{})[locale]||(P.messages||{}).en||{},f=(P.messages||{})[\"zh-TW\"]||{};return m[k]||f[k]||k}function ptxt(p){var rows=p.i18n||{},r=rows[locale]||rows.en||rows[\"zh-TW\"]||{};return{name:r.name||p.name||p.id,description:r.description||p.description||\"\"}}function render(){document.documentElement.lang=locale;document.querySelectorAll(\"[data-i18n]\").forEach(function(n){n.textContent=tr(n.dataset.i18n)});var s=document.getElementById(\"locale\");s.innerHTML=(P.locales||[]).map(function(x){return'<option value=\"'+esc(x.id)+'\">'+esc(x.label)+'</option>'}).join(\"\");s.value=locale;s.onchange=function(){locale=norm(this.value);try{localStorage.setItem(\"qqai_locale\",locale)}catch(e){}render()};document.getElementById(\"publicPlugins\").innerHTML=plugins.map(function(p){var x=ptxt(p),meta=p.portal||{};return'<article class=\"plugin\"><div class=\"plugin-icon\">'+esc(meta.icon||\"◇\")+'</div><h3>'+esc(x.name)+'</h3><p>'+esc(x.description)+'</p><small>Optional · disabled by default</small></article>'}).join(\"\")}function brand(){var b=branding||{},name=b.brandName||\"AI Control Center\",tag=b.tagline||\"AI · Plugins · Your Resources\";document.getElementById(\"publicBrandName\").textContent=name;document.getElementById(\"publicBrandTagline\").textContent=tag;var img=document.getElementById(\"publicLogo\"),fb=document.getElementById(\"publicLogoFallback\");if(b.logoDataUrl){img.src=b.logoDataUrl;img.alt=b.logoAlt||name;img.style.display=\"block\";fb.style.display=\"none\"}else{img.style.display=\"none\";fb.style.display=\"block\"}}try{locale=norm(localStorage.getItem(\"qqai_locale\")||(navigator.languages&&navigator.languages[0])||navigator.language);if(localStorage.getItem(\"qqai_theme\")===\"dark\")document.documentElement.dataset.theme=\"dark\"}catch(e){}render();fetch(\"/api/public/branding\",{credentials:\"same-origin\"}).then(function(r){return r.json()}).then(function(r){branding=r.branding||r;brand()}).catch(function(){brand()})})();</script></body></html>".replace("__I18N__", i18nJson).replace("__PLUGINS__", pluginJson);\n}\n\nfunction getPortalLoginPage() {
  const css = publicAuthPageStyles();
  let html = "<!doctype html><html lang=\"zh-Hant-TW\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#020714\"><title>登入 · AI Control Center</title><style>" + css + "</style></head><body>\n<div class=\"shell\">\n<header class=\"top\"><a class=\"brand\" href=\"/\"><span class=\"brand-mark\" aria-hidden=\"true\"><i></i><i></i></span><span class=\"brand-copy\"><b>AI Control Center</b><small>AI · Automation · BYOR</small></span></a><nav class=\"nav\"><a class=\"hide-tablet\" href=\"/\">首頁</a><a href=\"/register\">首次啟用</a><a class=\"nav-cta\" href=\"/login\">登入</a></nav></header>\n<main class=\"auth-wrap\"><div class=\"auth-stage\">\n<section class=\"auth-visual\"><div class=\"auth-copy\"><div class=\"eyebrow\">SECURE ACCOUNT ACCESS</div><h1>回到你的<br><span style=\"color:#52ddff\">AI 控制中心</span></h1><p>日常登入只需要帳號與密碼；只有你啟用 2FA 時才追加第二因素。</p></div><div class=\"auth-points\"><div class=\"auth-point\"><i>01</i><span>帳號密碼是日常登入入口</span></div><div class=\"auth-point\"><i>02</i><span>必要時追加 TOTP、備用碼或訊息驗證碼</span></div><div class=\"auth-point\"><i>03</i><span>登入後只顯示你真正被授權的 AI、插件與管理功能</span></div></div></section>\n<section class=\"auth-card\"><div class=\"eyebrow\">ACCOUNT LOGIN</div><h2>登入你的 AI Control Center</h2><p>第一次使用請先完成「首次啟用」。已有帳號就不需要再輸入身份 ID。</p>\n<div class=\"field\"><label for=\"username\">帳號</label><input id=\"username\" autocomplete=\"username\" maxlength=\"32\" placeholder=\"輸入你的帳號\"></div>\n<div class=\"field\"><label for=\"password\">密碼</label><input id=\"password\" type=\"password\" autocomplete=\"current-password\" maxlength=\"128\" placeholder=\"輸入密碼\"></div>\n<div id=\"factorBox\" class=\"hidden\"><div class=\"field\"><label for=\"factorType\">第二因素</label><select id=\"factorType\"><option value=\"totp\">驗證器動態碼</option><option value=\"backup\">單次備用碼</option><option value=\"qq_code\">訊息驗證碼</option></select></div><div class=\"field\"><label for=\"factorCode\">驗證碼／備用碼</label><input id=\"factorCode\" autocomplete=\"one-time-code\" placeholder=\"輸入第二因素\"></div><button id=\"sendFactor\" type=\"button\" class=\"btn ghost\" style=\"width:100%\">傳送訊息驗證碼</button></div>\n<label class=\"row small\" style=\"margin:14px 0\"><input id=\"remember\" type=\"checkbox\" checked>在這台裝置保持登入</label>\n<button id=\"loginBtn\" type=\"button\" class=\"btn primary\" style=\"width:100%\">登入控制中心&nbsp; →</button>\n<div id=\"message\" class=\"notice\">首次啟用後，日常登入只需要帳號與密碼。</div>\n<div class=\"divider\"></div><div class=\"row\"><a class=\"btn ghost grow\" href=\"/register\">第一次使用／帳號復原</a><a class=\"btn ghost\" href=\"/\">首頁</a></div>\n</section></div></main>\n<footer class=\"footer\"><span>AI Control Center · Secure access</span><span>權限以伺服器判定為準</span></footer>\n</div>\n<script>\nconst $=id=>document.getElementById(id);\nasync function post(path,body){try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});return await r.json()}catch(e){return{ok:false,message:'連線失敗，請稍後再試。'}}}\nfunction nextPath(){const n=new URLSearchParams(location.search).get('next')||'/portal';return n.startsWith('/portal')?n:'/portal'}\nasync function login(){const username=$('username').value.trim(),password=$('password').value;const factorVisible=!$('factorBox').classList.contains('hidden');$('loginBtn').disabled=true;$('message').textContent='正在驗證安全憑證…';const r=await post('/api/auth/login-password',{username,password,remember:$('remember').checked,factorType:factorVisible?$('factorType').value:'',factorCode:factorVisible?$('factorCode').value:''});$('loginBtn').disabled=false;if(r.requiresTwoFactor||r.code==='TWO_FACTOR_REQUIRED'){$('factorBox').classList.remove('hidden');$('factorCode').focus();$('message').textContent=r.message||'請完成第二因素驗證。';return}if(!r.ok){$('message').textContent=r.message||'登入失敗。';$('message').className='notice error';return}$('message').textContent='登入成功，正在載入控制中心…';$('message').className='notice success';location.assign(nextPath())}\nasync function sendFactor(){const username=$('username').value.trim(),password=$('password').value;if(!username||!password){$('message').textContent='請先輸入帳號與密碼。';return}const r=await post('/api/auth/request-login-factor',{username,password});$('message').textContent=r.message||'傳送失敗。';$('message').className='notice '+(r.ok?'success':'error')}\n$('loginBtn').addEventListener('click',login);$('sendFactor').addEventListener('click',sendFactor);['username','password','factorCode'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')login()}));if(new URLSearchParams(location.search).get('activated')==='1'){$('message').textContent='帳號與密碼已建立。請在這裡登入以進入控制中心。';$('message').className='notice success'}\n</script></body></html>";
  return decoratePublicPageI18n(html, "login");
}

function getPortalRegisterPage() {
  const css = publicAuthPageStyles();
  let html = "<!doctype html><html lang=\"zh-Hant-TW\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#020714\"><title>首次啟用 · AI Control Center</title><style>" + css + "</style></head><body>\n<div class=\"shell\">\n<header class=\"top\"><a class=\"brand\" href=\"/\"><span class=\"brand-mark\" aria-hidden=\"true\"><i></i><i></i></span><span class=\"brand-copy\"><b>AI Control Center</b><small>AI · Automation · BYOR</small></span></a><nav class=\"nav\"><a class=\"hide-tablet\" href=\"/\">首頁</a><a class=\"active\" href=\"/register\">首次啟用</a><a class=\"nav-cta\" href=\"/login\">已有帳號？登入</a></nav></header>\n<main class=\"auth-wrap\"><div class=\"auth-stage\">\n<section class=\"auth-visual\"><div class=\"auth-copy\"><div class=\"eyebrow\">ADMIN PASSWORD SETUP</div><h1>開發者固定使用<span style=\"color:#58e3ff\">admin</span></h1><p>admin 是保留的 Developer / Root 系統帳號。第一次只要輸入 DEVELOPER_IDS／ROOT_QQ_IDS 中的 QQID，直接設定 admin 密碼；不需要 QQ 六位碼，也不需要 Portal 或 OneBot Secret。</p></div><div class=\"step-list\"><div class=\"step\"><span class=\"step-num\">01</span><span><b>輸入開發者 QQID</b><small>QQID 只用來綁定伺服器已設定的 Developer / Root 身份。</small></span></div><div class=\"step\"><span class=\"step-num\">02</span><span><b>設定 admin 密碼</b><small>沒有預設密碼；你現在輸入的密碼就是之後登入 admin 的密碼，只保存 PBKDF2 hash。</small></span></div><div class=\"step\"><span class=\"step-num\">03</span><span><b>之後直接登入</b><small>登入帳號固定是 admin；平時只要 admin + 密碼，只有你自行啟用 2FA 時才追加第二因素。</small></span></div></div></section>\n<section class=\"auth-card\"><div class=\"eyebrow\">ACCOUNT ACTIVATION</div><h2>第一次使用：設定登入</h2><p>開發者使用保留帳號 admin；一般使用者才需要自行建立帳號名稱與完成 QQ 身份啟用。</p>\n<div class=\"field\"><label for=\"activationMode\">啟用方式</label><select id=\"activationMode\"><option value=\"developer\">開發者 / Root：設定 admin 密碼</option><option value=\"member\">一般使用者 QQ 身份啟用</option></select></div>\n<div class=\"field\"><label for=\"qqid\">QQID</label><input id=\"qqid\" inputmode=\"numeric\" autocomplete=\"off\" maxlength=\"12\" placeholder=\"輸入你的 QQID\"></div>\n<div id=\"developerAdminBox\"><div class=\"field\"><label for=\"developerUsername\">開發者登入帳號</label><input id=\"developerUsername\" value=\"admin\" readonly aria-readonly=\"true\"></div><div class=\"notice\">admin 為系統保留帳號，沒有預設密碼。你下方設定的密碼就是 admin 的登入密碼。</div></div>\n<div id=\"memberVerificationBox\" class=\"hidden\"><button id=\"sendCode\" type=\"button\" class=\"btn ghost\" style=\"width:100%\">傳送一般使用者啟用驗證碼</button><div class=\"field\"><label for=\"code\">六位驗證碼</label><input id=\"code\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\" placeholder=\"一般使用者才需要\"></div><div class=\"field\"><label for=\"username\">建立登入帳號</label><input id=\"username\" autocomplete=\"username\" maxlength=\"32\" placeholder=\"4–32 字元，英數與 . _ -\"></div></div>\n<div class=\"field\"><label for=\"password\">設定密碼</label><input id=\"password\" type=\"password\" autocomplete=\"new-password\" maxlength=\"128\" placeholder=\"至少 10 個字元\"></div>\n<div class=\"field\"><label for=\"confirm\">確認密碼</label><input id=\"confirm\" type=\"password\" autocomplete=\"new-password\" maxlength=\"128\" placeholder=\"再輸入一次密碼\"></div>\n<label class=\"row small\" style=\"margin:14px 0\"><input id=\"remember\" type=\"checkbox\" checked>完成後在這台裝置保持登入</label>\n<button id=\"activate\" type=\"button\" class=\"btn primary\" style=\"width:100%\">設定密碼並登入&nbsp; →</button>\n<div id=\"message\" class=\"notice\">開發者：帳號固定 admin，不用驗證碼、不用部署管理金鑰；QQID 必須存在於伺服器 DEVELOPER_IDS／ROOT_QQ_IDS。</div>\n<details id=\"recover\"><summary>已有帳號但忘記密碼</summary><div class=\"small\" style=\"margin:10px 0\">帳號復原仍保留原本的 QQ 身份驗證；這是忘記密碼時的獨立復原流程，不是一般登入步驟。</div><div class=\"field\"><label for=\"recoverQq\">QQID</label><input id=\"recoverQq\" inputmode=\"numeric\" maxlength=\"12\"></div><button id=\"recoverSend\" type=\"button\" class=\"btn ghost\" style=\"width:100%\">傳送復原驗證碼</button><div class=\"field\"><label for=\"recoverCode\">六位驗證碼</label><input id=\"recoverCode\" inputmode=\"numeric\" maxlength=\"6\"></div><div class=\"field\"><label for=\"recoverPassword\">新密碼</label><input id=\"recoverPassword\" type=\"password\" autocomplete=\"new-password\" maxlength=\"128\"></div><div class=\"field\"><label for=\"recoverConfirm\">確認新密碼</label><input id=\"recoverConfirm\" type=\"password\" autocomplete=\"new-password\" maxlength=\"128\"></div><button id=\"recoverBtn\" type=\"button\" class=\"btn\" style=\"width:100%\">重設密碼</button><div id=\"recoverMessage\" class=\"notice hidden\"></div></details>\n<div class=\"divider\"></div><div class=\"row\"><a class=\"btn ghost grow\" href=\"/login\">已有帳號？登入</a><a class=\"btn ghost\" href=\"/\">首頁</a></div>\n</section></div></main>\n<footer class=\"footer\"><span>AI Control Center · admin password setup</span><span>Developer login: admin + password</span></footer>\n</div>\n<script>\nconst $=id=>document.getElementById(id);async function post(path,body){try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});return await r.json()}catch(e){return{ok:false,message:'連線失敗，請稍後再試。'}}}\nfunction syncMode(){const dev=$('activationMode').value==='developer';$('developerAdminBox').classList.toggle('hidden',!dev);$('memberVerificationBox').classList.toggle('hidden',dev);$('message').textContent=dev?'開發者：登入帳號固定 admin；直接設定密碼，不用驗證碼或部署管理金鑰。':'一般使用者首次啟用仍使用 QQ 身份驗證碼並自行建立帳號名稱。'}\nasync function send(target,msg){const qq=$(target).value.replace(/\\D/g,'');if(!/^\\d{5,12}$/.test(qq)){$(msg).textContent='請輸入有效的 QQID。';return}const r=await post('/api/auth/register/request-code',{qq});$(msg).textContent=r.message||'傳送失敗。';$(msg).className='notice '+(r.ok?'success':'error')}\nasync function activate(){const qq=$('qqid').value.replace(/\\D/g,''),password=$('password').value,confirm=$('confirm').value,dev=$('activationMode').value==='developer',username=dev?'admin':$('username').value.trim();if(password!==confirm){$('message').textContent='兩次輸入的密碼不一致。';$('message').className='notice error';return}$('activate').disabled=true;$('message').textContent=dev?'正在設定 admin 密碼…':'正在建立帳號…';const r=await post('/api/auth/register',{accountType:dev?'developer':'member',qq,code:dev?'':$('code').value.replace(/\\D/g,''),username,password,remember:$('remember').checked});$('activate').disabled=false;if(!r.ok){$('message').textContent=(r.message||'首次啟用失敗。')+(r.failureId?'\nFailure ID：'+r.failureId:'');$('message').className='notice error';return}$('message').textContent=r.message||(dev?'admin 密碼已設定，正在載入控制中心…':'帳號建立完成，正在載入控制中心…');$('message').className='notice success';location.assign(r.redirect||'/portal')}\nasync function recover(){const qq=$('recoverQq').value.replace(/\\D/g,''),code=$('recoverCode').value.replace(/\\D/g,''),password=$('recoverPassword').value,confirm=$('recoverConfirm').value;$('recoverMessage').classList.remove('hidden');if(password!==confirm){$('recoverMessage').textContent='兩次輸入的新密碼不一致。';return}const r=await post('/api/auth/reset-password',{qq,code,newPassword:password});$('recoverMessage').textContent=r.message||'復原失敗。';$('recoverMessage').className='notice '+(r.ok?'success':'error')}\n$('activationMode').addEventListener('change',syncMode);$('sendCode').addEventListener('click',()=>send('qqid','message'));$('activate').addEventListener('click',activate);$('recoverSend').addEventListener('click',()=>send('recoverQq','recoverMessage'));$('recoverBtn').addEventListener('click',recover);if(location.hash==='#recover')$('recover').open=true;syncMode();\n</script></body></html>";
  return decoratePublicPageI18n(html, "register");
}

function getPortalHomePage(host) {\n  const i18nJson = JSON.stringify(portalI18nPayload()).replace(/</g, "\\\\u003c");\n  const pluginJson = JSON.stringify(portalPluginCatalog()).replace(/</g, "\\\\u003c");\n  const safeHost = String(host || "aibot.ray2025.com");\n  return "<!doctype html><html lang=\"zh-Hant-TW\" data-theme=\"light\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#f5f7fb\"><title>AI Control Center</title><style>\n:root{color-scheme:light;--bg:#f5f7fb;--surface:#fff;--surface2:#f0f3f8;--text:#121a29;--muted:#69758a;--line:#dfe5ee;--brand:#3568f4;--brand2:#7c55f6;--soft:#eaf0ff;--ok:#0d8664;--bad:#c43d55;--shadow:0 18px 50px rgba(31,45,74,.09);--sidebar:252px}:root[data-theme=\"dark\"]{color-scheme:dark;--bg:#090d14;--surface:#111722;--surface2:#18212f;--text:#eef3fb;--muted:#98a6ba;--line:#2a3547;--brand:#7b9bff;--brand2:#aa83ff;--soft:#1a2a55;--ok:#52caa5;--bad:#ff7b8e;--shadow:0 18px 50px rgba(0,0,0,.3)}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,\"Noto Sans TC\",\"Noto Sans SC\",system-ui,-apple-system,\"Segoe UI\",sans-serif}body{overflow-x:hidden}button,input,select{font:inherit}.hidden{display:none!important}button{cursor:pointer}body:before{content:\"\";position:fixed;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(circle at 84% -8%,color-mix(in srgb,var(--brand) 15%,transparent),transparent 30rem),radial-gradient(circle at 18% 110%,color-mix(in srgb,var(--brand2) 9%,transparent),transparent 36rem)}.sidebar{position:fixed;inset:0 auto 0 0;width:var(--sidebar);padding:18px 14px;background:color-mix(in srgb,var(--surface) 95%,transparent);backdrop-filter:blur(18px);border-right:1px solid var(--line);display:flex;flex-direction:column;z-index:30}.brand{display:flex;align-items:center;gap:11px;color:var(--text);text-decoration:none;padding:5px 6px 18px;border-bottom:1px solid var(--line)}.logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,var(--brand),var(--brand2));flex:0 0 auto}.logo img{display:none;width:100%;height:100%;object-fit:contain;background:var(--surface)}.logo span{color:#fff;font-size:14px;font-weight:950}.brand-copy{min-width:0}.brand-copy b,.brand-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand-copy b{font-size:14px}.brand-copy small{margin-top:3px;color:var(--muted);font-size:10px}.nav{display:grid;gap:6px;padding:18px 2px}.nav button{min-height:43px;border:1px solid transparent;border-radius:11px;background:transparent;color:var(--muted);text-align:left;padding:10px 12px;font-weight:780}.nav button:hover{background:var(--surface2);color:var(--text)}.nav button.active{background:var(--soft);color:var(--brand);border-color:color-mix(in srgb,var(--brand) 24%,var(--line))}.sidebar-bottom{margin-top:auto;border-top:1px solid var(--line);padding:14px 4px 0}.identity{border:1px solid var(--line);border-radius:12px;background:var(--surface2);padding:11px 12px}.identity b,.identity span{display:block}.identity b{font-size:13px}.identity span{margin-top:3px;color:var(--muted);font-size:10px}.rights{margin:10px 3px;color:var(--muted);font-size:9px;line-height:1.45}.main{margin-left:var(--sidebar);min-height:100dvh}.topbar{position:sticky;top:0;z-index:20;min-height:72px;padding:12px clamp(18px,2.4vw,36px);display:flex;align-items:center;justify-content:space-between;gap:18px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(20px);border-bottom:1px solid var(--line)}.top-left{display:flex;align-items:center;gap:10px}.kicker{color:var(--brand);font-size:9px;letter-spacing:.16em;font-weight:900}.page-title{margin:3px 0 0;font-size:20px}.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.control,.btn{min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);padding:9px 12px}.control{min-width:150px}.btn{font-weight:760}.btn:hover{background:var(--surface2)}.btn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}.btn.danger{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 28%,var(--line))}.menu{display:none}.content{max-width:1480px;margin:auto;padding:30px clamp(18px,2.8vw,44px) 64px}.view{display:none}.view.active{display:block}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:26px;padding:36px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--soft) 44%,var(--surface)));box-shadow:var(--shadow)}.hero h1{margin:10px 0 12px;font-size:clamp(34px,4.5vw,60px);line-height:1.03;letter-spacing:-.055em}.hero p{margin:0;color:var(--muted);font-size:15px;line-height:1.8}.hero-side{align-self:end;border:1px solid var(--line);border-radius:17px;background:color-mix(in srgb,var(--surface) 84%,transparent);padding:17px}.line{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--line)}.line:last-child{border-bottom:0}.line span{color:var(--muted);font-size:11px}.line b{font-size:12px;text-align:right}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.metric,.card{border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:var(--shadow)}.metric{padding:17px}.metric span{display:block;color:var(--muted);font-size:10px}.metric b{display:block;margin-top:8px;font-size:22px}.metric small{display:block;margin-top:5px;color:var(--muted);font-size:10px}.card{padding:19px}.card h2,.card h3{margin:0}.card p{color:var(--muted);line-height:1.65}.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.78fr);gap:16px}.head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:17px}.head p{margin:4px 0 0;font-size:12px}.empty{border:1px dashed var(--line);border-radius:12px;padding:24px;text-align:center;color:var(--muted)}.plugin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.plugin{display:grid;grid-template-columns:48px minmax(0,1fr);gap:13px;border:1px solid var(--line);border-radius:15px;background:var(--surface);padding:16px}.plugin.off{opacity:.7}.plugin-icon{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:var(--soft);color:var(--brand);font-weight:900}.plugin h3{margin:0;font-size:14px}.plugin p{margin:6px 0 10px;color:var(--muted);font-size:11px}.plugin-actions{grid-column:1/-1;border-top:1px solid var(--line);padding-top:12px;display:flex;justify-content:flex-end}.badge{display:inline-flex;padding:3px 7px;border:1px solid var(--line);border-radius:999px;background:var(--surface2);color:var(--muted);font-size:8px;font-weight:800}.badge.on{color:var(--ok)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:10px;color:var(--muted);font-weight:750}.field input,.field select{width:100%;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);padding:9px 11px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.notice{margin-top:12px;border:1px solid var(--line);border-radius:11px;padding:11px 12px;background:var(--surface2);color:var(--muted);font-size:11px;white-space:pre-wrap}.notice.good{color:var(--ok)}.notice.bad{color:var(--bad)}.security-row{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid var(--line)}.security-row:last-child{border-bottom:0}.security-row span{color:var(--muted);font-size:11px}.security-row b{font-size:12px}.logo-preview{display:flex;align-items:center;gap:13px;margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2)}.logo-preview .logo{width:64px;height:64px}.dialog{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(5,8,15,.52);backdrop-filter:blur(8px)}.dialog-card{width:min(620px,100%);max-height:85dvh;overflow:auto;border:1px solid var(--line);border-radius:18px;background:var(--surface);padding:22px;box-shadow:var(--shadow)}.code{white-space:pre-wrap;word-break:break-all;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface2);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.toast{position:fixed;right:18px;bottom:18px;z-index:120;max-width:min(440px,calc(100vw - 36px));border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:12px 14px;box-shadow:var(--shadow)}.backdrop{display:none}@media(max-width:1050px){.hero,.grid2{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.topbar{align-items:flex-start;flex-direction:column}.top-actions{width:100%}.control{flex:1}}@media(max-width:840px){.sidebar{transform:translateX(-105%);transition:transform .2s ease}.sidebar.open{transform:none}.backdrop.open{display:block;position:fixed;inset:0;background:rgba(5,8,14,.45);z-index:25}.main{margin-left:0}.menu{display:inline-flex}.content{padding:20px 14px 48px}.topbar{padding:11px 14px}.hero{padding:24px}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}}@media(max-width:560px){.top-actions{display:grid;grid-template-columns:1fr 1fr}.top-actions .control:first-of-type{grid-column:1/-1}.btn,.control{width:100%}.hero h1{font-size:36px}.plugin-grid{grid-template-columns:1fr}.content{padding-left:10px;padding-right:10px}}\n</style><script>window.__QQAI_V4_I18N__=__I18N__;window.__QQAI_V4_PLUGINS__=__PLUGINS__;</script></head><body><aside id=\"sidebar\" class=\"sidebar\"><a class=\"brand\" href=\"/portal\"><span class=\"logo\"><img id=\"brandLogo\" alt=\"\"><span id=\"brandFallback\">AI</span></span><span class=\"brand-copy\"><b id=\"brandName\">AI Control Center</b><small id=\"brandTagline\">AI · Plugins · Your Resources</small></span></a><nav class=\"nav\"><button data-view=\"overview\" class=\"active\"><span data-i18n=\"nav.home\">首頁</span></button><button data-view=\"plugins\"><span data-i18n=\"nav.plugins\">插件</span></button><button data-view=\"account\"><span data-i18n=\"nav.account\">帳號與設定</span></button></nav><div class=\"sidebar-bottom\"><div class=\"identity\"><b id=\"identityName\">—</b><span id=\"identityRole\">—</span></div><div class=\"rights\" data-i18n=\"footer.rights\">© 2026 ray20123315. All rights reserved.</div><button id=\"logoutBtn\" class=\"btn\" style=\"width:100%\" data-i18n=\"top.logout\">登出</button></div></aside><div id=\"backdrop\" class=\"backdrop\"></div><main class=\"main\"><header class=\"topbar\"><div class=\"top-left\"><button id=\"menuBtn\" class=\"btn menu\">☰</button><div><div class=\"kicker\">AI CONTROL CENTER</div><h2 id=\"pageTitle\" class=\"page-title\" data-i18n=\"nav.home\">首頁</h2></div></div><div class=\"top-actions\"><select id=\"groupSelect\" class=\"control\"><option value=\"\">No group context</option></select><select id=\"localeSelect\" class=\"control\"></select><button id=\"themeBtn\" class=\"btn\" data-i18n=\"top.dark\">深色</button><button id=\"refreshBtn\" class=\"btn\" data-i18n=\"top.refresh\">更新</button></div></header><div class=\"content\">\n<section id=\"view-overview\" class=\"view active\"><div class=\"hero\"><div><div class=\"kicker\" data-i18n=\"home.kicker\">AI CONTROL CENTER</div><h1 data-i18n=\"home.title\">保持核心簡單，把能力交給插件。</h1><p data-i18n=\"home.summary\">登入、權限、安全與插件執行留在核心；其他能力由插件提供。</p></div><div class=\"hero-side\"><div class=\"line\"><span>Session</span><b id=\"sessionStatus\">—</b></div><div class=\"line\"><span>Identity</span><b id=\"sessionIdentity\">—</b></div><div class=\"line\"><span>Context</span><b id=\"sessionContext\">—</b></div></div></div><div class=\"metrics\"><article class=\"metric\"><span>Plugins</span><b id=\"metricPlugins\">0</b><small id=\"metricPluginsSub\">—</small></article><article class=\"metric\"><span>Security</span><b id=\"metricSecurity\">—</b><small id=\"metricSecuritySub\">—</small></article><article class=\"metric\"><span>Core</span><b>3</b><small>Overview · Plugins · Account</small></article></div><div class=\"grid2\"><article class=\"card\"><div class=\"head\"><div><h2 data-i18n=\"home.pluginTitle\">已安裝功能插件</h2><p data-i18n=\"home.pluginHelp\">只啟用真正需要的能力。</p></div><button class=\"btn\" data-open=\"plugins\" data-i18n=\"nav.plugins\">插件</button></div><div id=\"overviewPlugins\" class=\"plugin-grid\"></div></article><article class=\"card\"><h3>Minimal core</h3><p>Authentication, authorization, account security and plugin state only.</p><div class=\"security-row\"><span>Product features in core</span><b>0</b></div><div class=\"security-row\"><span>Product plugins default</span><b>Disabled</b></div><div class=\"security-row\"><span>Canonical host</span><b>__HOST__</b></div></article></div></section>\n<section id=\"view-plugins\" class=\"view\"><div class=\"head\"><div><div class=\"kicker\">PLUGIN-FIRST</div><h2 data-i18n=\"plugins.title\">插件中心</h2><p data-i18n=\"plugins.subtitle\">產品能力不再佔據核心導覽；只有啟用的插件才參與功能 API。</p></div></div><div id=\"pluginGrid\" class=\"plugin-grid\"></div></section>\n<section id=\"view-account\" class=\"view\"><div class=\"head\"><div><div class=\"kicker\">ACCOUNT</div><h2 data-i18n=\"account.title\">帳號與設定</h2><p data-i18n=\"account.subtitle\">帳號安全、語言、外觀與品牌。</p></div></div><div class=\"grid2\"><article class=\"card\"><h3 data-i18n=\"account.identity\">目前身份</h3><div class=\"security-row\"><span>Username</span><b id=\"accountUsername\">—</b></div><div class=\"security-row\"><span>Role</span><b id=\"accountRole\">—</b></div><div class=\"security-row\"><span>Group</span><b id=\"accountGroup\">—</b></div><div class=\"security-row\"><span>2FA</span><b id=\"account2fa\">—</b></div></article><article class=\"card\"><h3 data-i18n=\"account.preferences\">介面偏好</h3><div class=\"form-grid\" style=\"margin-top:12px\"><div class=\"field\"><label data-i18n=\"top.language\">語言</label><select id=\"accountLocale\"></select></div><div class=\"field\"><label>Theme</label><button id=\"accountTheme\" class=\"btn\">—</button></div></div></article></div><div class=\"grid2\" style=\"margin-top:16px\"><article class=\"card\"><div class=\"head\"><div><h3 data-i18n=\"account.security\">帳號安全</h3><p>Password and optional TOTP 2FA.</p></div><span id=\"securityState\" class=\"badge\">—</span></div><div class=\"form-grid\"><div class=\"field\"><label>Current password</label><input id=\"currentPassword\" type=\"password\" autocomplete=\"current-password\"></div><div class=\"field\"><label>New password</label><input id=\"newPassword\" type=\"password\" autocomplete=\"new-password\"></div><div class=\"field full\"><button id=\"changePasswordBtn\" class=\"btn primary\">Update password</button></div></div><div class=\"actions\"><button id=\"setup2faBtn\" class=\"btn\">Set up 2FA</button><button id=\"backup2faBtn\" class=\"btn\">Regenerate backup codes</button><button id=\"disable2faBtn\" class=\"btn danger\">Disable 2FA</button></div><div id=\"securityNotice\" class=\"notice\">—</div></article><article id=\"brandingCard\" class=\"card hidden\"><div class=\"head\"><div><h3>Branding</h3><p>Logo is saved in D1, not deployment variables.</p></div><span class=\"badge\">Developer</span></div><div class=\"logo-preview\"><div class=\"logo\"><img id=\"brandPreviewImg\" alt=\"\"><span id=\"brandPreviewFallback\">AI</span></div><div><b id=\"brandPreviewName\">AI Control Center</b><p id=\"brandPreviewTagline\">AI · Plugins · Your Resources</p></div></div><div class=\"form-grid\"><div class=\"field\"><label>Brand name</label><input id=\"brandNameInput\" maxlength=\"48\"></div><div class=\"field\"><label>Tagline</label><input id=\"brandTaglineInput\" maxlength=\"96\"></div><div class=\"field full\"><label>Logo (PNG/JPEG/WebP, ≤ 256 KB)</label><input id=\"brandLogoInput\" type=\"file\" accept=\"image/png,image/jpeg,image/webp\"></div></div><div class=\"actions\"><button id=\"saveBrandBtn\" class=\"btn primary\">Save branding</button><button id=\"removeBrandLogoBtn\" class=\"btn\">Remove logo</button></div><div id=\"brandNotice\" class=\"notice\">Upload the real logo here. The fallback mark is not treated as your logo.</div></article></div></section></div></main><div id=\"dialog\" class=\"dialog hidden\"><div class=\"dialog-card\"><h3 id=\"dialogTitle\">—</h3><div id=\"dialogBody\"></div><div class=\"actions\"><button id=\"dialogClose\" class=\"btn\">Close</button></div></div></div><div id=\"toast\" class=\"toast hidden\"></div>\n<script>(function(){\"use strict\";var STATIC=window.__QQAI_V4_PLUGINS__||[],I=window.__QQAI_V4_I18N__||{locales:[],messages:{}},S={me:null,plugins:[],auth:null,branding:null,locale:\"zh-TW\",theme:\"light\",manage:false,logoDraft:null},$=function(id){return document.getElementById(id)},esc=function(v){return String(v==null?\"\":v).replace(/[&<>\"']/g,function(c){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"}[c]})};function dev(){return!!(S.me&&((S.me.permissions||{}).developer||S.me.role===\"developer\"))}function norm(v){var r=String(v||\"\").toLowerCase();if(!r)return\"zh-TW\";if(r===\"zh\"||r.indexOf(\"zh-tw\")===0||r.indexOf(\"zh-hk\")===0||r.indexOf(\"zh-hant\")===0)return\"zh-TW\";if(r.indexOf(\"zh-cn\")===0||r.indexOf(\"zh-sg\")===0||r.indexOf(\"zh-hans\")===0)return\"zh-CN\";if(r.indexOf(\"pt\")===0)return\"pt-BR\";var x=(I.locales||[]).find(function(a){return String(a.id).toLowerCase()===r});if(x)return x.id;var b=r.split(\"-\")[0],y=(I.locales||[]).find(function(a){return String(a.id).toLowerCase().split(\"-\")[0]===b});return y?y.id:\"en\"}function tr(k){var m=(I.messages||{})[S.locale]||(I.messages||{}).en||{},f=(I.messages||{})[\"zh-TW\"]||{};return m[k]||f[k]||k}function pt(p){var rows=p.i18n||{},r=rows[S.locale]||rows.en||rows[\"zh-TW\"]||{};return{name:r.name||p.name||p.id,description:r.description||p.description||\"\"}}function locales(){[\"localeSelect\",\"accountLocale\"].forEach(function(id){var n=$(id);n.innerHTML=(I.locales||[]).map(function(x){return'<option value=\"'+esc(x.id)+'\">'+esc(x.label)+'</option>'}).join(\"\");n.value=S.locale})}function theme(v){S.theme=v===\"dark\"?\"dark\":\"light\";document.documentElement.dataset.theme=S.theme;try{localStorage.setItem(\"qqai_theme\",S.theme)}catch(e){}var label=S.theme===\"dark\"?tr(\"top.light\"):tr(\"top.dark\");$(\"themeBtn\").textContent=label;$(\"accountTheme\").textContent=label}function lang(){document.documentElement.lang=S.locale;document.querySelectorAll(\"[data-i18n]\").forEach(function(n){n.textContent=tr(n.dataset.i18n)});locales();theme(S.theme);renderPlugins()}function setLang(v){S.locale=norm(v);try{localStorage.setItem(\"qqai_locale\",S.locale)}catch(e){}lang()}async function api(path,opt){opt=opt||{};var r=await fetch(path,Object.assign({credentials:\"same-origin\",headers:Object.assign({\"Content-Type\":\"application/json\"},opt.headers||{})},opt)),b={};try{b=await r.json()}catch(e){}if(r.status===401){location.replace(\"/login?next=\"+encodeURIComponent(\"/portal\"));throw Error(\"SESSION_INVALID\")}if(!r.ok||b.ok===false){var x=Error(b.message||(\"HTTP \"+r.status));x.code=b.code||\"\";throw x}return b}function toast(m,bad){var n=$(\"toast\");n.textContent=String(m||\"\");n.classList.remove(\"hidden\");n.style.borderColor=bad?\"var(--bad)\":\"var(--line)\";clearTimeout(toast.t);toast.t=setTimeout(function(){n.classList.add(\"hidden\")},4200)}function show(v){document.querySelectorAll(\".view\").forEach(function(x){x.classList.toggle(\"active\",x.id===\"view-\"+v)});document.querySelectorAll(\".nav button\").forEach(function(x){x.classList.toggle(\"active\",x.dataset.view===v)});$(\"pageTitle\").textContent=tr(v===\"overview\"?\"nav.home\":v===\"plugins\"?\"nav.plugins\":\"nav.account\");history.replaceState(null,\"\",\"#\"+v);$(\"sidebar\").classList.remove(\"open\");$(\"backdrop\").classList.remove(\"open\")}function applyBrand(){var b=S.branding||{},name=b.brandName||\"AI Control Center\",tag=b.tagline||\"AI · Plugins · Your Resources\";$(\"brandName\").textContent=name;$(\"brandTagline\").textContent=tag;$(\"brandPreviewName\").textContent=name;$(\"brandPreviewTagline\").textContent=tag;$(\"brandNameInput\").value=name;$(\"brandTaglineInput\").value=tag;[[$(\"brandLogo\"),$(\"brandFallback\")],[$(\"brandPreviewImg\"),$(\"brandPreviewFallback\")]].forEach(function(pair){var img=pair[0],fb=pair[1];if(b.logoDataUrl){img.src=b.logoDataUrl;img.alt=b.logoAlt||name;img.style.display=\"block\";fb.style.display=\"none\"}else{img.style.display=\"none\";fb.style.display=\"block\"}})}async function brand(){try{var r=await api(\"/api/public/branding\");S.branding=r.branding||r}catch(e){S.branding={}}applyBrand()}function identity(){var q=S.me||{},name=q.username||\"—\",role=q.role||\"member\";$(\"identityName\").textContent=name;$(\"identityRole\").textContent=role;$(\"sessionIdentity\").textContent=name+\" · \"+role;$(\"sessionContext\").textContent=q.group||q.groupId||\"No group\";$(\"accountUsername\").textContent=name;$(\"accountRole\").textContent=role;$(\"accountGroup\").textContent=q.group||q.groupId||\"—\";$(\"brandingCard\").classList.toggle(\"hidden\",!dev())}async function groups(){try{var r=await api(\"/api/portal/groups\"),sel=$(\"groupSelect\"),rows=Array.isArray(r.groups)?r.groups:[];sel.innerHTML='<option value=\"\">No group context</option>'+rows.map(function(g){return'<option value=\"'+esc(g.groupId||g.id||\"\")+'\">'+esc(g.groupName||g.name||g.groupId||g.id||\"Group\")+'</option>'}).join(\"\");sel.value=r.selectedGroupId||S.me&&S.me.groupId||\"\"}catch(e){$(\"groupSelect\").innerHTML='<option value=\"\">No group context</option>'}}async function selectGroup(id){if(!id)return;try{var r=await api(\"/api/portal/select-group\",{method:\"POST\",body:JSON.stringify({groupId:id})});S.me=r.session||S.me;identity();await plugins();toast(r.message||\"Context updated\")}catch(e){toast(e.message,true);await groups()}}async function plugins(){try{var r=await api(\"/api/portal/plugins\");S.plugins=Array.isArray(r.plugins)?r.plugins:[];S.manage=!!r.canManage;renderPlugins();metrics()}catch(e){S.plugins=[];renderPlugins();toast(e.message,true)}}function card(p,mini){var x=pt(p),on=!!p.enabled;return'<article class=\"plugin '+(on?\"\":\"off\")+'\"><div class=\"plugin-icon\">'+esc((p.portal||{}).icon||\"◇\")+'</div><div><div style=\"display:flex;gap:7px;align-items:center\"><h3>'+esc(x.name)+'</h3><span class=\"badge '+(on?\"on\":\"\")+'\">'+esc(on?tr(\"plugins.enabled\"):tr(\"plugins.disabled\"))+'</span></div><p>'+esc(x.description)+'</p></div>'+(mini?\"\":'<div class=\"plugin-actions\">'+(S.manage?'<button class=\"btn '+(on?\"\":\"primary\")+'\" data-toggle=\"'+esc(p.id)+'\" data-next=\"'+(!on)+'\">'+esc(on?tr(\"plugins.disable\"):tr(\"plugins.enable\"))+'</button>':'')+'</div>')+'</article>'}function renderPlugins(){var rows=S.plugins.length?S.plugins:STATIC.filter(function(p){return!(p.portal||{}).developerOnly||dev()});$(\"pluginGrid\").innerHTML=rows.length?rows.map(function(p){return card(p,false)}).join(\"\"):'<div class=\"empty\">'+esc(tr(\"common.unavailable\"))+'</div>';$(\"overviewPlugins\").innerHTML=rows.slice(0,4).map(function(p){return card(p,true)}).join(\"\")||'<div class=\"empty\">'+esc(tr(\"common.unavailable\"))+'</div>';document.querySelectorAll(\"[data-toggle]\").forEach(function(b){b.onclick=function(){toggle(b.dataset.toggle,b.dataset.next===\"true\")}})}async function toggle(id,on){try{var r=await api(\"/api/portal/plugins/\"+encodeURIComponent(id),{method:\"POST\",body:JSON.stringify({enabled:on})});toast(r.message||\"Saved\");await plugins()}catch(e){toast(e.message,true)}}function metrics(){var n=S.plugins.filter(function(p){return p.enabled}).length;$(\"metricPlugins\").textContent=String(n);$(\"metricPluginsSub\").textContent=n+\" / \"+S.plugins.length+\" enabled\";if(S.auth){$(\"metricSecurity\").textContent=S.auth.twoFactorEnabled?\"2FA\":\"Password\";$(\"metricSecuritySub\").textContent=S.auth.twoFactorEnabled?\"Second factor enabled\":\"2FA optional\"}}async function auth(){try{var r=await api(\"/api/portal/security/auth-state\");S.auth=r;$(\"account2fa\").textContent=r.twoFactorEnabled?\"Enabled\":\"Disabled\";$(\"securityState\").textContent=r.twoFactorEnabled?\"2FA enabled\":\"Password only\";$(\"securityState\").className=\"badge \"+(r.twoFactorEnabled?\"on\":\"\");$(\"securityNotice\").textContent=r.encryptionReady?\"Security storage ready\":\"2FA encryption secret is not ready\";metrics()}catch(e){$(\"securityNotice\").textContent=e.message;$(\"securityNotice\").className=\"notice bad\"}}async function changePassword(){try{var r=await api(\"/api/portal/security/password\",{method:\"POST\",body:JSON.stringify({currentPassword:$(\"currentPassword\").value,newPassword:$(\"newPassword\").value})});$(\"securityNotice\").textContent=r.message;$(\"securityNotice\").className=\"notice good\";$(\"currentPassword\").value=\"\";$(\"newPassword\").value=\"\";await auth()}catch(e){$(\"securityNotice\").textContent=e.message;$(\"securityNotice\").className=\"notice bad\"}}function dialog(title,html){$(\"dialogTitle\").textContent=title;$(\"dialogBody\").innerHTML=html;$(\"dialog\").classList.remove(\"hidden\")}async function setup2fa(){try{var r=await api(\"/api/portal/security/2fa/setup\",{method:\"POST\",body:JSON.stringify({currentPassword:$(\"currentPassword\").value})});dialog(\"Set up 2FA\",'<p>Add this secret to your authenticator.</p><div class=\"code\">'+r.secret+'</div><div class=\"field\"><label>6-digit code</label><input id=\"dialogCode\" maxlength=\"6\"></div><div class=\"actions\"><button id=\"enable2fa\" class=\"btn primary\">Enable 2FA</button></div>');$(\"enable2fa\").onclick=async function(){try{var x=await api(\"/api/portal/security/2fa/enable\",{method:\"POST\",body:JSON.stringify({code:$(\"dialogCode\").value})});dialog(\"Backup codes\",'<div class=\"code\">'+(x.backupCodes||[]).join(\"\\\\n\")+'</div>');await auth()}catch(e){toast(e.message,true)}}}catch(e){toast(e.message,true)}}async function backup(){var code=prompt(\"Authenticator code\");if(!code)return;try{var r=await api(\"/api/portal/security/2fa/backup-codes\",{method:\"POST\",body:JSON.stringify({code:code})});dialog(\"Backup codes\",'<div class=\"code\">'+(r.backupCodes||[]).join(\"\\\\n\")+'</div>')}catch(e){toast(e.message,true)}}async function disable2fa(){var code=prompt(\"Authenticator code\");if(!code)return;try{var r=await api(\"/api/portal/security/2fa/disable\",{method:\"POST\",body:JSON.stringify({currentPassword:$(\"currentPassword\").value,code:code})});toast(r.message);await auth()}catch(e){toast(e.message,true)}}async function readLogo(file){if(!file)return null;if(file.size>256*1024)throw Error(\"Logo must be 256 KB or smaller.\");if([\"image/png\",\"image/jpeg\",\"image/webp\"].indexOf(file.type)<0)throw Error(\"Logo must be PNG, JPEG or WebP.\");return await new Promise(function(ok,no){var r=new FileReader();r.onload=function(){ok(String(r.result||\"\"))};r.onerror=function(){no(Error(\"Logo read failed\"))};r.readAsDataURL(file)})}async function saveBrand(remove){try{var logo=remove?\"\":(S.logoDraft!=null?S.logoDraft:S.branding&&S.branding.logoDataUrl||\"\"),r=await api(\"/api/portal/branding\",{method:\"POST\",body:JSON.stringify({brandName:$(\"brandNameInput\").value,tagline:$(\"brandTaglineInput\").value,logoDataUrl:logo,logoAlt:$(\"brandNameInput\").value})});S.branding=r.branding;S.logoDraft=null;applyBrand();$(\"brandNotice\").textContent=r.message||\"Branding saved\";$(\"brandNotice\").className=\"notice good\"}catch(e){$(\"brandNotice\").textContent=e.message;$(\"brandNotice\").className=\"notice bad\"}}async function refresh(){try{var m=await api(\"/api/portal/me\");S.me=m.session;$(\"sessionStatus\").textContent=\"Authenticated\";identity();await Promise.all([groups(),plugins(),auth(),brand()]);lang()}catch(e){toast(e.message,true)}}async function logout(){try{await api(\"/api/auth/logout\",{method:\"POST\",body:\"{}\"})}catch(e){}location.replace(\"/login\")}document.querySelectorAll(\".nav button[data-view]\").forEach(function(b){b.onclick=function(){show(b.dataset.view)}});document.querySelectorAll(\"[data-open]\").forEach(function(b){b.onclick=function(){show(b.dataset.open)}});$(\"menuBtn\").onclick=function(){$(\"sidebar\").classList.add(\"open\");$(\"backdrop\").classList.add(\"open\")};$(\"backdrop\").onclick=function(){$(\"sidebar\").classList.remove(\"open\");$(\"backdrop\").classList.remove(\"open\")};$(\"themeBtn\").onclick=function(){theme(S.theme===\"dark\"?\"light\":\"dark\")};$(\"accountTheme\").onclick=$(\"themeBtn\").onclick;$(\"refreshBtn\").onclick=refresh;$(\"logoutBtn\").onclick=logout;$(\"groupSelect\").onchange=function(e){selectGroup(e.target.value)};$(\"localeSelect\").onchange=function(e){setLang(e.target.value)};$(\"accountLocale\").onchange=function(e){setLang(e.target.value)};$(\"changePasswordBtn\").onclick=changePassword;$(\"setup2faBtn\").onclick=setup2fa;$(\"backup2faBtn\").onclick=backup;$(\"disable2faBtn\").onclick=disable2fa;$(\"dialogClose\").onclick=function(){$(\"dialog\").classList.add(\"hidden\")};$(\"brandLogoInput\").onchange=async function(e){try{S.logoDraft=await readLogo(e.target.files&&e.target.files[0]);$(\"brandPreviewImg\").src=S.logoDraft;$(\"brandPreviewImg\").style.display=\"block\";$(\"brandPreviewFallback\").style.display=\"none\";$(\"brandNotice\").textContent=\"Logo ready to save.\"}catch(x){S.logoDraft=null;$(\"brandNotice\").textContent=x.message;$(\"brandNotice\").className=\"notice bad\"}};$(\"saveBrandBtn\").onclick=function(){saveBrand(false)};$(\"removeBrandLogoBtn\").onclick=function(){saveBrand(true)};try{S.theme=localStorage.getItem(\"qqai_theme\")===\"dark\"?\"dark\":\"light\";S.locale=norm(localStorage.getItem(\"qqai_locale\")||(navigator.languages&&navigator.languages[0])||navigator.language)}catch(e){}theme(S.theme);lang();show([\"overview\",\"plugins\",\"account\"].indexOf(location.hash.slice(1))>=0?location.hash.slice(1):\"overview\");refresh();setInterval(function(){api(\"/api/portal/heartbeat\",{method:\"POST\",body:\"{}\"}).catch(function(){})},60000)})();</script></body></html>".replace("__I18N__", i18nJson).replace("__PLUGINS__", pluginJson).replace("__HOST__", safeHost);\n}

export { getAppealPage, getLiveHtmlPage, getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage, handleAppealApi, handleGeminiLiveUpgrade, handleOpsPortalApi, handlePortalApi };
