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
import { BILIBILI_POLL_DEFAULT_SECONDS, bilibiliPollIntervalSeconds, listBilibiliConnectors, normalizeBilibiliUid, pollOneAutomaticBilibiliConnector, sendBilibiliConnectorNotification } from "../integrations/bilibili.js";
import { appendRuleViolationRecord, createModerationProposal, defaultRuleCategoryPolicies, getGroupMemberSafe, getRuleCategoryPolicies, getRuleProgressivePolicy, handleGroupWorkDecision, handleModerationConfirmation, listModerationProposals, localModerationIntent, moderationActionLabel, moderationActionNeedsTarget, normalizeRuleCategoryPolicies, normalizeRulePolicyActions, normalizeRuleProgressivePolicy, normalizeRuleProxyMode, normalizeRuleSeverity, normalizeRuleStrictness, parseUnlimitedNonNegativeInteger, performRuleProxyAction, recordRuleViolationFeedback, reverseRuleViolationAction, updateRuleViolationRecord } from "../moderation/runtime.js";
import { fetchConversationAttachmentResponse, getForwardMessageSnapshot, getTaipeiTimeContext, parseDurationSeconds, sendGroupRoleMentions, updatePortalConversationRecord } from "../onebot/messages.js";
import { OPS_CAPABILITIES, OPS_RECORD_TYPES, opsActiveRuleRecords, opsActivityParticipants, opsActivitySummary, opsAnalytics, opsAnnounceActivity, opsCapabilityDef, opsCleanupThinking, opsConsumeQuota, opsCreateScheduleFromSpec, opsDeleteRecord, opsDependencyCheck, opsEffectiveCapability, opsExecuteHandoff, opsFuseState, opsGetRecord, opsGetSettings, opsImpactPreview, opsInviteActivityParticipant, opsJoinActivity, opsLeaveActivity, opsListRecords, opsMemberSummary, opsModelMetrics, opsParticipantsKey, opsPermissionKey, opsPollVotesKey, opsPreviewMessage, opsPublishAnnouncement, opsPurgeRemovedRecordTypes, opsRecordKey, opsRecordQualityFeedback, opsRemovedType, opsRequire, opsResetFuse, opsRestoreSnapshot, opsRetentionCleanup, opsRoleRank, opsRuleConflictCheck, opsRuleSandbox, opsSaveRecord, opsSaveSettings, opsSchedulePreview, opsSendDailyDigest, opsSendDraftNow, opsSnapshotConfig, opsTaipeiDateKey, opsTaskAction, opsTaskCenter, opsTypeDef, opsVersionKey, opsVotePoll, opsWelcomePreview } from "../operations/runtime.js";
import { appendPlatformTrace, enqueuePlatformJob, listPlatformFeatures, listPlatformJobs, listPlatformTraces, platformFeatureById, setPlatformFeature } from "../platform/runtime.js";
import { PORTAL_SETTING_DEFINITIONS, authDbDelStrict, authDbPutStrict, base32Encode, createPortalPasswordRecord, decryptPortalAuthSecret, deleteMemoryVector, encryptPortalAuthSecret, extractGroupId, generateBackupCodes, generateSixDigitCode, getOneBotHub, getPortalSession, getUserQuota, hashBackupCode, isMemoryBanned, jsonResponse, migratePortalMemories, portalAuthEncryptionMaterial, portalRoleRank, portalSessionCookie, randomBytes, readCookie, readJson, readPortalAuthJson, readPortalSettingValue, resolvePortalRole, searchPortalVectors, sendOneBotAction, sendPortalVerificationMessage, sha256Hex, upsertMemoryVector, validatePortalPassword, verifyPortalPassword, verifyPortalVerificationCode, verifyTotpCode, writeMemoryAudit, writePortalSettingValue } from "./auth.js";
import { handlePortalMemberApi } from "./members.js";
import { handleWerewolfPortalApi } from "../games/werewolf.js";
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

  const operationsResponse = await handleOpsPortalApi(request, env, url, path, body, authed);
  if (operationsResponse) return operationsResponse;

  const werewolfPortalResponse = await handleWerewolfPortalApi(request, env, url, path, body, authed);
  if (werewolfPortalResponse) return werewolfPortalResponse;
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



function getPortalHomePage(host) {
  return toSimplifiedChinese(String.raw`<!doctype html>
<html lang="zh-Hans-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAIbot 控制台</title>
<script>(function(){try{var t=localStorage.getItem('qqai_theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();</script>
<style>
:root{color-scheme:light;--bg:#f5f7fb;--panel:#fff;--panel2:#f8fafc;--text:#172033;--muted:#68748a;--line:#e3e8f0;--primary:#5b5bd6;--primary2:#7777e8;--ok:#17845f;--warn:#b26a00;--bad:#c53d4d;--shadow:0 18px 48px rgba(31,42,68,.08);--login-panel:rgba(255,255,255,.92);--topbar-bg:rgba(245,247,251,.88);font-family:Inter,"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
:root[data-theme="dark"]{color-scheme:dark;--bg:#070a11;--panel:#101521;--panel2:#151c2a;--text:#eef2f8;--muted:#9ca8bb;--line:#293247;--primary:#8585ff;--primary2:#a091ff;--ok:#48cfa0;--warn:#e5a94f;--bad:#ff7687;--shadow:0 18px 48px rgba(0,0,0,.38);--login-panel:rgba(16,21,34,.94);--topbar-bg:rgba(7,10,17,.9)}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;min-width:0;min-height:100dvh;background:var(--bg);color:var(--text)}body.sidebar-open{overflow:hidden}img,video,canvas,svg{max-width:100%}button,input,select,textarea{font:inherit;min-width:0}.hidden{display:none!important}.muted{color:var(--muted)}
.login{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 10%,rgba(91,91,214,.15),transparent 38%),radial-gradient(circle at 90% 90%,rgba(23,132,95,.11),transparent 40%),var(--bg)}
.login-card{width:min(450px,100%);background:var(--login-panel);border:1px solid var(--line);border-radius:26px;padding:30px;box-shadow:var(--shadow);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),#8a69e8);color:#fff;font-weight:800}.brand h1{font-size:22px;margin:0}.brand p{margin:4px 0 0;color:var(--muted);font-size:14px}
.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;font-weight:700}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);padding:11px 12px;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(91,91,214,.12)}.field textarea{min-height:100px;resize:vertical}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1;min-width:160px}
.btn{border:0;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer;background:var(--panel2);color:var(--text)}.btn:hover{filter:brightness(.98)}.btn.primary{background:var(--primary);color:#fff}.btn.danger{background:#fde9ec;color:var(--bad)}.btn.ghost{background:transparent;border:1px solid var(--line)}.btn:disabled{opacity:.55;cursor:not-allowed}.notice{margin-top:14px;padding:11px 13px;border-radius:11px;background:var(--panel2);color:var(--muted);font-size:14px;line-height:1.55}.login-methods{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}.login-methods .btn.active{background:var(--primary);color:#fff}.backup-codes{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;line-height:1.8}.security-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.security-grid>.card{box-shadow:none}@media(max-width:720px){.security-grid{grid-template-columns:1fr}}
.app{min-height:100dvh;display:block}.sidebar{position:fixed;inset:0 auto 0 0;width:250px;height:100dvh;min-height:100svh;background:#171b2b;color:#e9ecf4;padding:18px 14px;display:flex;flex-direction:column;overflow:hidden;z-index:30}.side-brand{display:flex;align-items:center;gap:10px;padding:8px 8px 18px;flex:0 0 auto}.side-brand .logo{width:38px;height:38px;border-radius:12px}.side-brand b{display:block}.side-brand small{color:#98a2b7}.nav{display:grid;gap:8px;overflow:auto;overscroll-behavior:contain;flex:1 1 auto;min-height:0;padding-right:3px}.nav-group{display:grid;gap:4px;border-radius:12px}.nav-heading{width:100%;border:0;background:transparent;color:#77839a;padding:7px 10px;border-radius:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer;font-size:11px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.nav-heading:hover,.nav-heading:focus-visible{background:rgba(255,255,255,.07);color:#cbd3e2;outline:none}.nav-heading-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nav-chevron{font-size:14px;line-height:1;transition:transform .18s ease;color:#8f9ab0}.nav-items{display:grid;gap:4px}.nav-group.collapsed .nav-items{display:none}.nav-group.collapsed .nav-chevron{transform:rotate(-90deg)}.nav-group.has-active .nav-heading{color:#dfe5f2}.nav button:not(.nav-heading){border:0;background:transparent;color:#aeb7c9;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-weight:650}.nav button:not(.nav-heading):hover,.nav button:not(.nav-heading).active{background:rgba(255,255,255,.1);color:#fff}.side-bottom{margin-top:0;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.1);flex:0 0 auto;background:inherit;position:relative;z-index:2}
.main{min-width:0;min-height:100dvh;margin-left:250px}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 24px;border-bottom:1px solid var(--line);background:var(--topbar-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:5}.topbar h2{margin:0;font-size:20px}.top-actions{display:flex;align-items:center;gap:10px}.top-actions select{max-width:320px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:var(--panel);color:var(--text);color-scheme:light dark}select option{background:var(--panel);color:var(--text)}.content{padding:24px;max-width:1500px;margin:auto}.view{display:none}.view.active{display:block}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.section-head h2{margin:0 0 5px;font-size:25px}.section-head p{margin:0;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 8px 28px rgba(38,49,76,.045);min-width:0}.span-3{grid-column:span 3}.span-4{grid-column:span 4}.span-5{grid-column:span 5}.span-6{grid-column:span 6}.span-7{grid-column:span 7}.span-8{grid-column:span 8}.span-12{grid-column:1/-1}.metric-label{font-size:13px;color:var(--muted);margin-bottom:8px}.metric-value{font-size:27px;font-weight:800;letter-spacing:-.03em}.metric-sub{font-size:12px;color:var(--muted);margin-top:7px}.card h3{margin:0 0 13px;font-size:16px}.status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:#edf1f7}.status:before{content:"";width:7px;height:7px;border-radius:50%;background:#8390a5}.status.ok{background:#e5f5ee;color:var(--ok)}.status.ok:before{background:var(--ok)}.status.warning{background:#fff2d9;color:var(--warn)}.status.warning:before{background:var(--warn)}.status.error{background:#fde9ec;color:var(--bad)}.status.error:before{background:var(--bad)}
.list{display:grid;gap:10px}.item{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel)}.item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.item-title{font-weight:800;word-break:break-word}.item-meta{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.55}.item-body{margin-top:9px;line-height:1.55;word-break:break-word}.empty{padding:28px 12px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:13px}.health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:13px}.health-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel)}.health-card .latency{font-size:12px;color:var(--muted);margin-top:8px}.health-card .detail{font-size:12px;color:var(--muted);margin-top:8px;word-break:break-word;white-space:pre-wrap}
.timeline{display:grid;gap:8px}.step{display:flex;gap:10px;align-items:flex-start}.step i{width:9px;height:9px;border-radius:50%;background:var(--primary);margin-top:6px;flex:0 0 auto}.step span{line-height:1.5}.pill{display:inline-block;border-radius:999px;padding:4px 8px;background:#eef0ff;color:#5050bd;font-size:12px;font-weight:700;margin:2px 4px 2px 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.switch{display:flex;align-items:center;gap:9px;margin:10px 0}.switch input{width:18px;height:18px}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#151a29;color:#e9ecf4;border-radius:12px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px}
.log-toolbar{margin-bottom:14px}.log-summary{margin:0 0 12px}.log-card{padding:15px 16px}.log-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.log-card-title{font-size:16px;font-weight:850;line-height:1.35}.log-card-time{font-size:12px;color:var(--muted);margin-top:5px}.log-badge{flex:0 0 auto;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:var(--panel2);color:var(--muted)}.log-badge.ok{background:#e5f5ee;color:var(--ok)}.log-badge.warn{background:#fff2d9;color:var(--warn)}.log-badge.error{background:#fde9ec;color:var(--bad)}.log-badge.info{background:#eef0ff;color:#5050bd}.log-human{margin-top:11px;line-height:1.65}.log-facts{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.log-fact{border:1px solid var(--line);background:var(--panel2);border-radius:9px;padding:6px 9px;font-size:12px}.log-details{margin-top:11px;border-top:1px solid var(--line);padding-top:10px}.log-details summary{cursor:pointer;color:var(--muted);font-size:12px;font-weight:700}.log-details pre{margin:9px 0 0;padding:11px;border-radius:10px;background:#151a29;color:#e9ecf4;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.5}.qqai-modal{position:fixed;inset:0;z-index:9999;background:rgba(5,8,15,.68);display:grid;place-items:center;padding:18px;backdrop-filter:blur(6px)}.qqai-modal-card{width:min(560px,100%);background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 26px 80px rgba(0,0,0,.34)}.qqai-modal-card h3{margin:0}.qqai-modal-text{white-space:pre-wrap;line-height:1.65;margin:12px 0;color:var(--muted)}.qqai-modal-input{width:100%;min-height:120px;resize:vertical;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:12px;padding:11px;margin:8px 0 14px}.qqai-modal-actions{display:flex;justify-content:flex-end;gap:10px}.toast{position:fixed;right:22px;bottom:22px;max-width:420px;padding:12px 15px;border-radius:12px;background:#1c2233;color:#fff;box-shadow:var(--shadow);z-index:60}.mobile-menu{display:none}.sidebar-backdrop{display:none}

.health-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin:0 0 16px}.model-check-result{min-height:90px;white-space:pre-wrap;word-break:break-word}.settings-fold{margin-top:16px;border:1px solid var(--line);border-radius:17px;background:var(--panel);box-shadow:0 8px 28px rgba(38,49,76,.045);overflow:hidden}.settings-fold>summary{cursor:pointer;list-style:none;padding:17px 18px;font-weight:850;display:flex;align-items:center;justify-content:space-between;gap:12px}.settings-fold>summary::-webkit-details-marker{display:none}.settings-fold>summary:after{content:"展开";font-size:12px;color:var(--muted);font-weight:700}.settings-fold[open]>summary:after{content:"收起"}.settings-fold-body{border-top:1px solid var(--line);padding:18px}.progressive-step{display:block;border:1px solid var(--line);border-radius:13px;padding:12px;background:var(--panel2);margin-top:10px}.progressive-step .field{margin:0}.progressive-step-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.progressive-step-title{font-weight:850}.progressive-step-actions{display:grid;gap:8px;margin-top:10px}.progressive-action-row{display:grid;grid-template-columns:minmax(70px,.35fr) minmax(150px,1fr) minmax(140px,.75fr) auto;gap:10px;align-items:end;border-top:1px dashed var(--line);padding-top:9px}.progressive-action-row:first-child{border-top:0;padding-top:0}.progressive-action-row .field{margin:0}.conversation-card{position:relative}.violation-badge{position:absolute;right:12px;top:12px;border-radius:999px;background:var(--bad);color:#fff;padding:5px 9px;font-size:12px;font-weight:850;box-shadow:0 4px 14px rgba(197,61,77,.28)}.conversation-text{white-space:pre-wrap;word-break:break-word;line-height:1.65;padding-right:92px}.conversation-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.conversation-actions .btn{font-size:12px;padding:8px 10px}.conversation-detail{margin-top:12px}.conversation-detail summary{cursor:pointer;color:var(--primary);font-weight:750}.conversation-detail pre{max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#151a29;color:#e9ecf4;border-radius:10px;padding:12px}.conversation-toolbar{margin-bottom:16px}.media-limit-list{display:grid;gap:8px}.media-limit-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:8px 0}.media-limit-row:last-child{border-bottom:0}.member-picker-search{margin:12px 0 10px}.member-picker-list{display:grid;gap:8px;max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--panel2)}.conversation-attachments{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.attachment-link{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--panel2);color:var(--primary);border-radius:9px;padding:6px 9px;text-decoration:none;font-size:12px;font-weight:750}.attachment-link:hover{border-color:var(--primary)}.attachment-preview-body{margin-top:14px;display:grid;place-items:center;min-height:120px;max-height:70dvh;overflow:auto;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px}.attachment-preview-body img,.attachment-preview-body video{display:block;max-width:100%;max-height:64dvh;border-radius:10px}.attachment-preview-body audio{width:min(520px,100%)}.attachment-modal-card{width:min(760px,100%)}.attachment-error{text-align:center;max-width:520px;line-height:1.6}.attachment-error p{color:var(--muted)}.bili-webhook-box code{display:block;max-width:100%;overflow:auto;white-space:nowrap;margin-top:7px}.bili-webhook-box input[readonly]{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}.member-picker-row{display:grid;grid-template-columns:auto minmax(120px,1fr) minmax(140px,1fr);gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:8px}.member-picker-row:last-child{border-bottom:0}.group-binding-list{display:grid;gap:8px}.group-binding-row{display:grid;grid-template-columns:auto minmax(140px,1fr) minmax(160px,1fr);gap:10px;align-items:center;border:1px solid var(--line);border-radius:11px;padding:9px;background:var(--panel2)}:root[data-theme="dark"] select,:root[data-theme="dark"] .top-actions select{background:#101521!important;color:#eef2f8!important;border-color:#293247!important}
:root[data-theme="dark"] .sidebar{background:#090d17}:root[data-theme="dark"] .btn.danger{background:#351820}:root[data-theme="dark"] .status{background:#20283a}:root[data-theme="dark"] .status.ok{background:#13372d}:root[data-theme="dark"] .status.warning{background:#3a2b13}:root[data-theme="dark"] .status.error{background:#3a1820}:root[data-theme="dark"] .pill{background:#292750;color:#c8c7ff}
.theme-toggle{white-space:nowrap}
@media(max-width:1050px){.health-tools{grid-template-columns:1fr}.span-3{grid-column:span 6}.span-4,.span-5,.span-6,.span-7{grid-column:span 6}.span-8{grid-column:span 12}}
@media(max-width:1024px){.progressive-action-row{grid-template-columns:1fr}.conversation-text{padding-right:0;padding-top:30px}.app{display:block;min-height:100dvh}.main{margin-left:0;min-height:100dvh}.sidebar{position:fixed;inset:0 auto 0 0;width:min(86vw,300px);height:100dvh;min-height:100svh;z-index:40;transform:translateX(-102%);transition:transform .2s ease;padding:calc(14px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))}.sidebar.open{transform:none}.sidebar-backdrop{position:fixed;inset:0;z-index:35;background:rgba(3,6,12,.66);backdrop-filter:blur(2px)}.sidebar-backdrop.open{display:block}.mobile-menu{display:inline-flex}.topbar{height:auto;min-height:64px;flex-wrap:wrap;padding:calc(10px + env(safe-area-inset-top)) 12px 10px}.topbar h2{font-size:17px}.top-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px}.top-actions select{width:100%;max-width:none}.content{width:100%;padding:14px 12px calc(22px + env(safe-area-inset-bottom))}.span-3,.span-4,.span-5,.span-6,.span-7,.span-8{grid-column:1/-1}.split{grid-template-columns:1fr}.section-head{display:block}.section-head .row,.section-head>.btn{margin-top:12px}.row>input,.row>select,.row>textarea{flex:1 1 150px;max-width:100%}.btn{min-height:44px}.card{padding:14px;border-radius:14px;overflow:hidden}.item-head,.log-card-head{flex-wrap:wrap}.grid{gap:12px}.code,.log-details pre{overflow:auto}}
@media(max-width:480px){.top-actions{grid-template-columns:1fr 1fr}.top-actions select{grid-column:1/-1}.row>.btn{flex:1 1 auto}.login{padding:14px}.login-card{padding:20px;border-radius:18px}.toast{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:none}}

/* v1.3.7：登入后改为任务导向首页，普通使用者不再面对开发者后台。 */
:root{--sidebar:#101828;--sidebar2:#172033;--soft-primary:#f0f1ff;--soft-green:#eaf8f2}
:root[data-theme="dark"]{--sidebar:#080d16;--sidebar2:#111827;--soft-primary:#20233f;--soft-green:#15332a}
.sidebar{width:232px;background:linear-gradient(180deg,var(--sidebar),var(--sidebar2));padding:16px 12px}.main{margin-left:232px}.side-brand{padding:6px 8px 8px}.side-intro{margin:0 8px 15px;color:#8995aa;font-size:12px;line-height:1.55}.identity-card{padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.06);font-size:13px;line-height:1.55}.side-advanced,.side-logout{width:100%;margin-top:8px;color:#fff}.side-advanced{background:rgba(255,255,255,.08)}.side-logout{border:1px solid rgba(255,255,255,.15)}
.nav{gap:10px}.nav-group{gap:5px}.nav-heading{cursor:default;padding:7px 10px 4px;color:#79869b}.nav-heading .nav-chevron{display:none}.nav-group[data-collapsible="1"] .nav-heading{cursor:pointer}.nav-group[data-collapsible="1"] .nav-chevron{display:block}.nav button:not(.nav-heading){display:flex;align-items:center;gap:10px;padding:10px 11px;font-size:14px;font-weight:720}.nav button:not(.nav-heading)::before{content:attr(data-icon);width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.07);font-size:12px;font-weight:900;flex:0 0 auto}.nav button:not(.nav-heading).active{background:#fff;color:#172033}.nav button:not(.nav-heading).active::before{background:var(--soft-primary);color:var(--primary)}:root[data-theme="dark"] .nav button:not(.nav-heading).active{background:#eef2f8;color:#111827}
.topbar{height:68px}.top-kicker{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}.content{max-width:1280px;padding:22px}.section-head.compact{margin-bottom:14px;align-items:center}.section-head.compact h3{margin-bottom:4px}.section-head.compact p{font-size:13px}
.overview-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;border:1px solid var(--line);border-radius:22px;padding:24px;background:linear-gradient(135deg,var(--panel),var(--soft-primary));box-shadow:var(--shadow);margin-bottom:14px}.overview-hero h1{font-size:29px;line-height:1.15;margin:5px 0 9px}.overview-hero p{margin:0;color:var(--muted);line-height:1.6}.eyebrow{font-size:12px;font-weight:850;letter-spacing:.08em;color:var(--primary);text-transform:uppercase}.overview-hero-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
.status-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}.status-card{display:flex;gap:12px;align-items:center;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.status-card-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--soft-primary);color:var(--primary);font-weight:900;flex:0 0 auto}.status-card-label{font-size:12px;color:var(--muted);font-weight:750}.status-card-value{font-size:19px;font-weight:850;margin-top:3px}.status-card-help{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4}.overview-grid{align-items:start}.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.action-card{border:1px solid var(--line);border-radius:13px;background:var(--panel2);color:var(--text);padding:11px;text-align:left;display:flex;align-items:center;gap:10px;cursor:pointer;min-height:68px}.action-card:hover{border-color:var(--primary);transform:translateY(-1px)}.action-card[hidden]{display:none}.action-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--soft-primary);color:var(--primary);font-weight:900;flex:0 0 auto}.action-card b{display:block;font-size:14px}.action-card small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:3px}.advanced-panel{border:1px solid var(--line);border-radius:15px;background:var(--panel);margin-top:16px}.advanced-panel>summary{cursor:pointer;padding:15px 17px;font-weight:800}.advanced-panel>.advanced-panel-body{padding:0 17px 17px}.technical-only{display:none}.developer-mode .technical-only{display:block}.ops-integrated-block{margin-top:16px}.ops-integrated-block>.section-head{margin-top:6px}
@media(max-width:1024px){.status-strip{grid-template-columns:1fr}.overview-hero{align-items:flex-start}.action-grid{grid-template-columns:1fr}.topbar{position:sticky;top:0;z-index:24}.main{width:100%;min-width:0}.content{max-width:none}.view{min-width:0}.grid{grid-template-columns:minmax(0,1fr)}.sidebar{box-shadow:24px 0 70px rgba(0,0,0,.35)}.sidebar:not(.open){pointer-events:none}.sidebar.open{pointer-events:auto}}
@media(max-width:1024px){.sidebar{width:min(88vw,320px)}.main{margin-left:0}.overview-hero{display:block;padding:18px}.overview-hero h1{font-size:24px}.overview-hero-actions{justify-content:flex-start;margin-top:16px}.content{padding:13px 12px calc(22px + env(safe-area-inset-bottom))}.status-card{padding:14px}.top-kicker{display:none}}
@media(max-width:480px){.overview-hero-actions .btn{width:100%}.action-grid{grid-template-columns:1fr}.topbar{padding-left:10px;padding-right:10px}.content{padding-left:10px;padding-right:10px}.sidebar{width:min(92vw,320px)}.section-head h2{font-size:21px}.row{align-items:stretch}.row>.btn,.row>select,.row>input{width:100%;flex:1 1 100%}}
/* v1.4.3：最后声明移动端顶栏尺寸，覆盖前面的桌面 height:68px，避免选择器与页面标题重叠。 */
@media(max-width:1024px){.topbar{height:auto;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;align-content:start;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;overflow:visible}.topbar>.row{width:100%;min-width:0;flex-wrap:nowrap;align-items:center}.topbar>.row>div{min-width:0}.topbar h2{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.top-actions{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:stretch}.top-actions select,.top-actions .btn{height:44px;max-width:100%;margin:0}.content{position:relative;z-index:0}}
@media(max-width:520px){.topbar{gap:8px;padding-left:10px;padding-right:10px}.top-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.top-actions select{grid-column:1/-1}.top-actions .btn{width:100%;padding-left:8px;padding-right:8px}.mobile-menu{width:48px;flex:0 0 48px}.topbar h2{font-size:18px}}
.permission-list-head{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.permission-record-actions{margin-top:12px}.permission-editor>*{min-height:44px}
/* v1.4.4：手机端不再使用 sticky 顶栏，避免浏览器字体缩放和通用 .row 规则造成内容覆盖。 */
@media(max-width:1024px){.topbar{position:relative!important;top:auto!important;z-index:20!important;height:auto!important;min-height:0!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:10px!important;padding:12px!important;overflow:visible!important}.topbar>.row{display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;width:100%!important;min-width:0!important;flex-wrap:nowrap!important}.topbar>.row>.mobile-menu{width:48px!important;min-width:48px!important;max-width:48px!important;flex:0 0 48px!important;padding-left:0!important;padding-right:0!important}.topbar>.row>div{min-width:0!important}.topbar h2{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.top-actions{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(112px,.36fr) minmax(112px,.36fr)!important;gap:8px!important;width:100%!important;min-width:0!important}.top-actions select,.top-actions>.btn{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;height:44px!important;margin:0!important}.main{overflow:visible!important}.content{position:relative!important;z-index:0!important;padding-top:14px!important}.permission-editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto auto;align-items:stretch}.permission-record .item-head{align-items:center}}
@media(max-width:640px){.top-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}.top-actions select{grid-column:1/-1!important}.permission-editor{grid-template-columns:minmax(0,1fr)!important}.permission-editor>*{width:100%!important}.permission-list-head{display:block}.permission-list-head>.btn{margin-top:10px;width:100%}.permission-record-actions>.btn{width:100%;flex:1 1 100%}}
@media(max-width:380px){.top-actions{grid-template-columns:minmax(0,1fr)!important}.top-actions select,.top-actions>.btn{grid-column:1!important}.topbar{padding-left:9px!important;padding-right:9px!important}}
</style>
</head>
<body>
<section id="login" class="login">
  <div class="login-card">
    <div class="brand"><div class="logo">AI</div><div><h1>QQAIbot 控制台</h1><p>可使用 QQ 验证码或已设置的密码登录。</p></div></div>
    <div class="row"><button id="loginThemeToggle" type="button" class="btn ghost theme-toggle">切换黑色模式</button></div>
    <div class="field"><label for="loginQq">QQ 号</label><input id="loginQq" inputmode="numeric" autocomplete="username" placeholder="输入你的 QQ 号"></div>
    <div class="login-methods"><button id="loginMethodCode" type="button" class="btn active">QQ 验证码</button><button id="loginMethodPassword" type="button" class="btn">密码登录</button></div>
    <div id="loginCodePane">
      <div class="row"><button id="sendCode" type="button" class="btn ghost grow">发送验证码</button></div>
      <div class="field"><label for="loginCode">六位验证码</label><input id="loginCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="验证码"></div>
      <button id="verifyCode" type="button" class="btn primary" style="width:100%">使用验证码登录</button>
    </div>
    <div id="loginPasswordPane" class="hidden">
      <div class="field"><label for="loginPassword">密码</label><input id="loginPassword" type="password" maxlength="128" autocomplete="current-password" placeholder="输入密码"></div>
      <div id="loginFactorWrap" class="hidden">
        <div class="field"><label for="loginFactorType">第二因素</label><select id="loginFactorType"><option value="totp">验证器动态码</option><option value="backup">单次备用码</option><option value="qq_code">QQ 私信验证码</option></select></div>
        <div class="field"><label for="loginFactorCode">动态码／备用码／QQ 验证码</label><input id="loginFactorCode" autocomplete="one-time-code" placeholder="输入第二因素"></div>
        <button id="passwordSendFactorCode" type="button" class="btn ghost" style="width:100%">发送 QQ 验证码作为第二因素</button>
      </div>
      <button id="verifyPassword" type="button" class="btn primary" style="width:100%;margin-top:12px">使用密码登录</button>
    </div>
    <label class="switch"><input id="rememberLogin" type="checkbox" checked>在这台设备保持登录（最长 180 天）</label>
    <div id="loginNotice" class="notice">QQ 验证码由 NapCat 私信发送。密码和备用码只保存加盐杂凑；持久登录使用安全的 HttpOnly Cookie。</div>
  </div>
</section>
<div id="app" class="app hidden">
  <aside id="sidebar" class="sidebar">
    <div class="side-brand"><div class="logo">AI</div><div><b>QQAIbot</b><small>群组控制台</small></div></div><div class="side-intro">先看首页，有需要再进入设置。</div>
    <nav class="nav" id="nav">
      <button data-view="overview" class="active">總覽</button>
      <button data-view="health">健康檢查</button>
      <button data-view="tasks">任务与等待队列</button>
      <button data-view="moderation">待确认操作</button>
      <button data-view="simulator">事件模拟器</button>
      <button data-view="models">模型中心</button>
      <button data-view="quota">额度与限制</button>
      <button data-view="groups">群组设置</button>
      <button data-view="memory">记忆管理</button>
      <button data-view="logs">操作日志</button>
    </nav>
    <div class="side-bottom"><div id="identity" class="identity-card"></div><button id="advancedToggle" class="btn side-advanced hidden" type="button">显示开发者工具</button><button id="logout" class="btn ghost side-logout">登出</button></div>
  </aside>
  <div id="sidebarBackdrop" class="sidebar-backdrop"></div>
  <main class="main">
    <header class="topbar"><div class="row"><button id="menu" class="btn ghost mobile-menu" aria-label="打开菜单">☰</button><div><div class="top-kicker">QQAIbot</div><h2 id="pageTitle">首页</h2></div></div><div class="top-actions"><select id="groupSelect" aria-label="选择群组"><option value="">选择群组</option></select><button id="themeToggle" type="button" class="btn ghost theme-toggle">黑色模式</button><button id="refresh" class="btn ghost">更新资料</button></div></header>
    <div class="content">
      <section id="v-overview" class="view active">
        <div class="overview-hero">
          <div class="overview-hero-copy"><div class="eyebrow">现在的状态</div><h1 id="overviewGreeting">欢迎回来</h1><p id="overviewSummary">正在读取群组与机器人状态。</p></div>
          <div class="overview-hero-actions"><button class="btn primary" data-open-view="groups">设置本群</button><button class="btn" data-open-view="collaboration">建立活动</button></div>
        </div>
        <div class="status-strip">
          <div class="status-card"><div class="status-card-icon">连</div><div><div class="status-card-label">机器人连接</div><div id="mNapcat" class="status-card-value">检查中</div><div id="mNapcatSub" class="status-card-help">正在读取 NapCat 状态</div></div></div>
          <div class="status-card"><div class="status-card-icon">答</div><div><div class="status-card-label">AI 回答</div><div class="status-card-value"><span id="mActive">0</span> 个处理中</div><div class="status-card-help"><span id="mQueued">0</span> 个正在等待</div></div></div>
          <div class="status-card"><div class="status-card-icon">审</div><div><div class="status-card-label">需要确认</div><div class="status-card-value"><span id="mProposals">0</span> 项</div><div class="status-card-help">禁言、踢出等操作不会自动执行</div></div></div>
        </div>
        <div class="grid overview-grid">
          <div class="card span-7"><div class="section-head compact"><div><h3>需要你处理</h3><p>没有问题时，这里会保持清爽。</p></div><span id="overallStatus" class="status">检查中</span></div><div id="overviewIssues" class="list"><div class="empty">正在检查，目前不用操作。</div></div></div>
          <div class="card span-5"><div class="section-head compact"><div><h3>常用功能</h3><p>从这里开始，不需要理解后台术语。</p></div></div><div class="action-grid">
            <button class="action-card" data-open-view="collaboration"><span class="action-icon">活</span><span><b>活动与投票</b><small>报名、候补、投票与公告</small></span></button>
            <button class="action-card" data-open-view="schedules"><span class="action-icon">时</span><span><b>排程提醒</b><small>建立、查看或取消提醒</small></span></button>
            <button class="action-card" data-open-view="memory"><span class="action-icon">记</span><span><b>AI 记忆</b><small>查看或补充群组知识</small></span></button>
            <button class="action-card" data-open-view="groups"><span class="action-icon">群</span><span><b>群组设置</b><small>AI 开关、人格与安全设置</small></span></button>
            <button class="action-card" data-open-view="members"><span class="action-icon">友</span><span><b>群友列表</b><small>历史消息、禁言与防解除</small></span></button>
            <button class="action-card" data-open-view="appeals"><span class="action-icon">诉</span><span><b>我的申诉</b><small>提交申诉与查看处理结果</small></span></button>
            <button class="action-card" data-open-view="settingscenter"><span class="action-icon">设</span><span><b>更多设置</b><small>只显示当前账号可以修改的项目</small></span></button>
          </div></div>
        </div>
      </section>
      <section id="v-health" class="view">
        <div class="section-head"><div><h2>完整健康检查</h2><p>快速检查验证绑定与连接；完整检查会发送最小模型请求，并唤醒持久化等待队列；它不会重启 NapCat，也不会清空状态。开发者还可单独测试指定 API 模型。</p></div><div class="row"><button id="quickHealth" class="btn">快速检查</button><button id="fullHealth" class="btn primary">完整检查</button></div></div>
        <div id="singleModelHealth" class="health-tools hidden">
          <div class="card"><h3>单一 API 模型检查</h3><div class="field"><label>提供者</label><select id="modelCheckProvider"><option value="gemini">Gemini／Gemma</option><option value="deepseek">DeepSeek</option><option value="workers_ai">Workers AI</option></select></div><div class="field"><label>模型 ID</label><input id="modelCheckModel" list="modelCheckCandidates" placeholder="例如 gemini-2.5-flash"><datalist id="modelCheckCandidates"></datalist></div><div class="field"><label>API Key 池</label><select id="modelCheckKeyPool"><option value="chat">聊天 Key</option><option value="vision">图片检查 Key</option><option value="search">搜索 Key</option></select></div><button id="runModelCheck" class="btn primary">检查此模型</button><div id="modelCheckResult" class="notice model-check-result">选择模型后执行检查。</div></div>
          <div class="card"><h3>AI 媒体与转发处理限制</h3><div id="mediaLimitList" class="media-limit-list"><div class="empty">正在读取限制</div></div><div class="notice">这里显示的是本 Worker 主动采用的 AI 处理上限，不等同 QQ／NapCat 的传输上限。</div></div>
        </div>
        <div id="healthSummary" class="grid" style="margin-bottom:16px"></div><div id="healthList" class="health-grid"><div class="empty">尚未执行</div></div>
      </section>
      <section id="v-tasks" class="view">
        <div class="section-head"><div><h2>任务与等待队列</h2><p>同一群的明确提问会串行排队；不同群采用全局公平并发槽，避免某个活跃群占满模型请求。</p></div><div class="row"><button id="clearQueue" class="btn danger">清空目前群等待列</button><button id="reloadTasks" class="btn">重新加载</button></div></div>
        <div id="taskStats" class="grid" style="margin-bottom:16px"></div><div id="taskList" class="list"><div class="empty">暂无任務</div></div>
      </section>
      <section id="v-moderation" class="view">
        <div class="section-head"><div><h2>群待确认操作</h2><p>自然語言和 Portal 操作都只建立待确认操作，确认後才會呼叫 OneBot。</p></div><button id="reloadProposals" class="btn">重新加载</button></div>
        <div class="grid">
          <div class="card span-4"><h3>手動建立待确认操作</h3><div class="field"><label>動作</label><select id="opAction"><option value="mute">禁言</option><option value="unmute">解除禁言</option><option value="kick">踢出群聊</option><option value="whole_mute">全員禁言</option><option value="whole_unmute">解除全員禁言</option><option value="set_admin">設為管理員</option><option value="unset_admin">取消管理員</option></select></div><div class="field"><label>目標 QQ（全員操作可留空）</label><input id="opQq" inputmode="numeric"></div><div class="field"><label>禁言時長</label><input id="opDuration" value="10分"></div><div class="field"><label>原因（可留空）</label><textarea id="opReason" placeholder="例如：持续骚扰群友；留空也可以建立待确认操作"></textarea></div><label class="switch"><input id="opProtect" type="checkbox">防解除</label><label class="switch"><input id="opOwnerUnlock" type="checkbox" disabled>群主可解除</label><label class="switch"><input id="opSkipConfirm" type="checkbox">跳过执行前的网页确认视窗</label><button id="createProposal" class="btn primary">建立待确认操作，不直接執行</button><div id="opMessage" class="notice">高風險操作需要二次确认；設為／取消 QQ 群管理員只允許目前群主提出及确认。</div></div>
          <div class="card span-8"><h3>提案紀錄</h3><div id="proposalList" class="list"><div class="empty">暂无提案</div></div></div>
        </div>
      </section>
      <section id="v-simulator" class="view">
        <div class="section-head"><div><h2>事件模拟器</h2><p>部署前先檢查觸發、排隊、思考提示與記憶行為。</p></div><button id="runSimulator" class="btn primary">執行模擬</button></div>
        <div class="split"><div class="card"><div class="field"><label>模擬訊息</label><textarea id="simText" placeholder="例如：把 @某人 殺了"></textarea></div><div class="field"><label>發送者角色</label><select id="simRole"><option value="member">群友</option><option value="admin">管理員</option><option value="owner">群主</option></select></div><label class="switch"><input id="simMention" type="checkbox" checked>有 @ 機器人</label><label class="switch"><input id="simImage" type="checkbox">含圖片</label><label class="switch"><input id="simBusy" type="checkbox">此群友已有問題執行中</label></div><div class="card"><h3>模擬結果</h3><div id="simDecision" class="notice">尚未執行</div><div id="simSteps" class="timeline" style="margin-top:14px"></div></div></div>
      </section>
      <section id="v-models" class="view">
        <div class="section-head"><div><h2>模型中心</h2><p>聊天默认使用 Gemini，Gemma 作为免费备用；DeepSeek 主要负责上下文、会议纪要与聊天总结。普通成员不可手动选择 DeepSeek，连续失败时才临时开放。</p></div><button id="reloadModels" class="btn">重新加载</button></div><div id="modelRoutingSummary" class="card" style="margin-bottom:16px"><div class="empty">尚未加载模型路由</div></div><div id="modelList" class="grid"><div class="empty span-12">尚未加载</div></div>
      </section>
      <section id="v-quota" class="view">
        <div class="section-head"><div><h2>DeepSeek 额度与限制</h2><p>留空代表不限制；填 0 代表完全禁止；正數代表每日人民幣上限。</p></div><button id="saveQuota" class="btn primary">儲存額度</button></div>
        <div class="grid"><div class="card span-6"><h3>全站每日 CNY</h3><div class="field"><label>所有群組合計上限</label><input id="globalQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div class="notice">0＝完全停用 DeepSeek；空白＝不設每日上限。</div></div><div class="card span-6"><h3>目前群每日 CNY</h3><div class="field"><label>目前选择群组上限</label><input id="groupQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div id="quotaStatus" class="notice">僅開發者可以修改。</div></div></div>
      </section>
      <section id="v-groups" class="view">
        <div class="section-head"><div><h2>群组设置</h2><p>修改目前選擇群的 AI、記憶、插話率與人格。</p></div><button id="saveGroup" class="btn primary">儲存設定</button></div>
        <div class="grid"><div class="card span-6"><h3>功能開關</h3><label class="switch"><input id="groupAi" type="checkbox">啟用 AI</label><label class="switch"><input id="groupMemory" type="checkbox">啟用聊天記憶</label><label class="switch"><input id="activeSpeaking" type="checkbox">允许主动发话（开发者）</label><div id="activeSpeakingStatus" class="notice">尚未读取主动发话状态。</div><button id="activeSpeakingTest" class="btn hidden" type="button">发送主动发话测试</button><div class="field"><label>随机插话率（0–100%）</label><input id="interjectRate" type="number" min="0" max="100"></div></div><div class="card span-6"><h3>人格與關鍵字</h3><div class="field"><label>群組人格</label><textarea id="groupPersona"></textarea></div><div class="field"><label>過濾關鍵字（逗號或換行）</label><textarea id="groupKeywords"></textarea></div></div></div>
      </section>
      <section id="v-memory" class="view">
        <div class="section-head"><div><h2>记忆管理</h2><p>指令、白名單提示與系統訊息不會進入聊天記憶。</p></div><button id="reloadMemory" class="btn">重新加载</button></div>
        <div class="grid"><div class="card span-4"><h3>新增記憶</h3><div class="field"><label>範圍</label><select id="memoryScope"><option value="private">個人</option><option value="public">群組公開</option></select></div><div class="field"><label>內容</label><textarea id="memoryText"></textarea></div><button id="addMemory" class="btn primary">新增</button></div><div class="card span-8"><h3>目前記憶</h3><div id="memoryList" class="list"><div class="empty">暂无記憶</div></div></div></div>
      </section>
      <section id="v-logs" class="view">
        <div class="section-head"><div><h2>操作日志</h2><p>用简单中文显示谁在什么时间做了什么；技术资料默认收起，也不会作为 AI 聊天内容。</p></div><button id="reloadLogs" class="btn">重新加载</button></div><div id="logList" class="list"><div class="empty">暂无操作日志</div></div>
      </section>
    </div>
  </main>
</div>
<div id="toast" class="toast hidden"></div>
<script>
(function(){
'use strict';
var token='';var currentGroup='';var session=null;var conversationCapabilities={recordViolation:true};var conversationPage=1,conversationPageSize=20,conversationTotalPages=1,conversationRequestSerial=0;var PORTAL_SIDEBAR_COLLAPSIBLE='v1';
var $=function(id){return document.getElementById(id)};
function activeTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light'}
function updateThemeButtons(){var dark=activeTheme()==='dark';if($('loginThemeToggle'))$('loginThemeToggle').textContent=dark?'切换白色模式':'切换黑色模式';if($('themeToggle'))$('themeToggle').textContent=dark?'白色模式':'黑色模式'}
function setTheme(theme){var next=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem('qqai_theme',next)}catch(e){}updateThemeButtons()}
function toggleTheme(){setTheme(activeTheme()==='dark'?'light':'dark')}
function migratePortalMaintenanceV140(){try{if(localStorage.getItem('qqai_portal_maintenance_v140')!=='1'){localStorage.setItem('qqai_portal_advanced_v1','1');localStorage.setItem('qqai_portal_maintenance_v140','1')}}catch(e){}}
function portalAdvancedEnabled(){try{var value=localStorage.getItem('qqai_portal_advanced_v1');return value===null?true:value==='1'}catch(e){return true}}
function setPortalAdvanced(enabled){try{localStorage.setItem('qqai_portal_advanced_v1',enabled?'1':'0')}catch(e){}updatePortalAdvancedUi()}
function updatePortalAdvancedUi(){var dev=!!(session&&session.permissions&&session.permissions.developer),enabled=dev&&portalAdvancedEnabled(),group=document.querySelector('#nav .nav-group[data-tier="advanced"]'),button=$('advancedToggle');document.documentElement.classList.toggle('developer-mode',enabled);if(button){button.classList.toggle('hidden',!dev);button.textContent=enabled?'收起系统维护':'展开系统维护'}if(group)group.style.display=enabled?'':'none';if(!enabled){var active=document.querySelector('#nav .nav-group[data-tier="advanced"] button.active');if(active&&$('v-overview'))showView('overview')}}
function syncDashboardActions(){document.querySelectorAll('[data-open-view]').forEach(function(el){var view=el.dataset.openView,nav=document.querySelector('#nav button[data-view="'+view+'"]'),available=!!(nav&&!nav.hidden&&nav.style.display!=='none');el.hidden=!available})}
function bindDashboardActions(){document.querySelectorAll('[data-open-view]').forEach(function(el){if(el.dataset.bound==='1')return;el.dataset.bound='1';el.addEventListener('click',function(){var view=this.dataset.openView,nav=document.querySelector('#nav button[data-view="'+view+'"]');if(!nav||nav.hidden||nav.style.display==='none'){toast('你的账号没有这个功能的权限。');return}showView(view)})})}
var titles={overview:'首页',health:'系统诊断',tasks:'任务队列',schedules:'排程提醒',moderation:'待确认操作',members:'群友列表',simulator:'事件模拟器',models:'AI 模型',quota:'额度管理',groups:'群组设置',memory:'AI 记忆',logs:'操作日志',aidecisions:'AI 回复记录',appeals:'我的申诉',appealreview:'申诉处理',violationhistory:'违规记录',conversations:'对话记录',platform:'功能权限',collaboration:'活动与投票',settingscenter:'更多设置',ruleviolations:'群规与复核',bilibili:'B站监控'};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(msg){$('toast').textContent=String(msg||'');$('toast').classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(function(){$('toast').classList.add('hidden')},3200)}
async function raw(path,method,data){try{var opt={method:method||'GET',headers:{},credentials:'include',cache:'no-store'};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch(path,opt);var j=await r.json().catch(function(){return{ok:false,message:'无法解析服务器响应'}});if(!r.ok&&!j.message)j.message='HTTP '+r.status;return j}catch(e){return{ok:false,message:'网络请求失败：'+String(e&&e.message||e)}}}
async function api(path,method,data){var opt={method:method||'GET',headers:{},credentials:'include'};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch('/api/portal'+path,opt);var j=await r.json().catch(function(){return{ok:false,message:'无法解析服务器响应'}});if(r.status===401){showLogin()}return j}
function statusClass(s){return s==='ok'?'ok':s==='warning'?'warning':s==='error'?'error':''}
function ensureModal(){if($('qqaiModal'))return;var d=document.createElement('div');d.id='qqaiModal';d.className='qqai-modal hidden';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.innerHTML='<div class="qqai-modal-card"><h3 id="qqaiModalTitle">确认操作</h3><div id="qqaiModalText" class="qqai-modal-text"></div><textarea id="qqaiModalInput" class="qqai-modal-input hidden"></textarea><div class="qqai-modal-actions"><button id="qqaiModalCancel" class="btn">取消</button><button id="qqaiModalOk" class="btn primary">确认</button></div></div>';document.body.appendChild(d)}
function customDialog(message,options){ensureModal();options=options||{};return new Promise(function(resolve){var d=$('qqaiModal'),input=$('qqaiModalInput'),ok=$('qqaiModalOk'),cancel=$('qqaiModalCancel');$('qqaiModalTitle').textContent=options.title||'确认操作';$('qqaiModalText').textContent=String(message||'');input.classList.toggle('hidden',!options.input);input.value=options.value||'';input.placeholder=options.placeholder||'';ok.textContent=options.okText||'确认';cancel.textContent=options.cancelText||'取消';ok.className='btn '+(options.danger?'danger':'primary');d.classList.remove('hidden');if(options.input)setTimeout(function(){input.focus()},0);var done=function(value){d.classList.add('hidden');ok.onclick=null;cancel.onclick=null;d.onclick=null;document.removeEventListener('keydown',onKey);resolve(value)};var onKey=function(e){if(e.key==='Escape')done(options.input?null:false);if(e.key==='Enter'&&!options.input){e.preventDefault();done(true)}};document.addEventListener('keydown',onKey);ok.onclick=function(){var value=options.input?input.value:true;if(options.required&&options.input&&!String(value).trim()){toast(options.requiredMessage||'请填写内容');input.focus();return}done(value)};cancel.onclick=function(){done(options.input?null:false)};d.onclick=function(e){if(e.target===d)done(options.input?null:false)}})}
function confirmModal(message,title,options){return customDialog(message,Object.assign({title:title||'确认操作'},options||{}))}
function textModal(message,value,title,options){return customDialog(message,Object.assign({title:title||'编辑内容',input:true,value:value||''},options||{}))}
function portalRoleLabel(role){return({developer:'开发者',owner:'群主',admin:'QQ 管理员',member:'群成员'})[String(role||'member')]||String(role||'群成员')}
function applyRoleVisibility(){if(!session)return;var p=session.permissions||{},role=session.role||'member',dev=!!p.developer,management=!!(p.aiAdmin||p.groupOps||p.nativeAdmin||dev||['admin','owner'].includes(role));var memberViews=['overview','collaboration','schedules','memory','appeals','violationhistory','settingscenter','models'];var advancedViews=['maintenance','health','tasks','simulator','quota','platform','logs'];document.querySelectorAll('#nav button[data-view]').forEach(function(b){var v=b.dataset.view,show=true;if(role==='member'&&!memberViews.includes(v))show=false;if(['groups','moderation','members','ruleviolations','bilibili','aidecisions','conversations'].includes(v)&&!management)show=false;if(v==='appealreview'&&!(p.appealReviewer||p.nativeAdmin||dev||['admin','owner'].includes(role)))show=false;if(advancedViews.includes(v)&&!dev)show=false;b.style.display=show?'':'none';b.hidden=!show});updatePortalAdvancedUi();syncDashboardActions();refreshSidebarGroupVisibility()}

var opsBootstrap=null;var opsWorkspaces={};var opsLoading=null;
function opsAppendCard(viewId,html){var view=$(viewId);if(!view)return null;var wrap=document.createElement('div');wrap.className='ops-integrated-block';wrap.innerHTML=html;view.appendChild(wrap);return wrap}
function opsWorkspaceOptions(types){var defs=(opsBootstrap&&opsBootstrap.recordTypes)||{};return (types||[]).filter(function(k){return defs[k]}).map(function(k){return '<option value="'+esc(k)+'">'+esc(defs[k].name)+'</option>'}).join('')}
function opsWorkspaceHtml(prefix,title,description,types,advanced){advanced=advanced||{};return '<div class="section-head"><div><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div><button id="'+prefix+'Reload" class="btn">重新加载</button></div><div class="grid"><div class="card span-5"><h3>建立记录</h3><div class="field"><label>类型</label><select id="'+prefix+'Type"></select></div><div class="field"><label>标题</label><input id="'+prefix+'Title"></div><div class="field"><label>说明／内容</label><textarea id="'+prefix+'Description"></textarea></div>'+(advanced.activity?'<div id="'+prefix+'ActivityFields" class="workspace-conditional"><div class="field"><label>统整哪些群的报名（逗号分隔）</label><input id="'+prefix+'GroupIds" placeholder="留空＝只使用当前群"></div><div class="field"><label>报名后邀请加入的活动群（选填）</label><input id="'+prefix+'ActivityGroup" inputmode="numeric"></div><div class="field"><label>人数上限（0＝不限）</label><input id="'+prefix+'Capacity" type="number" min="0" value="0"></div><label class="switch"><input id="'+prefix+'AnnounceOnCreate" type="checkbox">建立后立即发送报名通知</label><div class="field"><label>报名通知方式</label><select id="'+prefix+'AnnounceMode"><option value="none">发送但不 @全体</option><option value="all">发送并 @全体（需要额外权限）</option></select></div></div><div id="'+prefix+'PollFields" class="workspace-conditional hidden"><div class="field"><label>投票选项（一行一个）</label><textarea id="'+prefix+'Options" placeholder="选项一&#10;选项二"></textarea></div></div>':'')+'<button id="'+prefix+'Create" class="btn primary" style="width:100%">建立</button></div><div class="card span-7"><div class="row"><h3 class="grow">记录列表</h3><select id="'+prefix+'ListType"></select></div><div id="'+prefix+'RecordList" class="list"><div class="empty">尚未加载</div></div></div></div>'}
function opsUpdateWorkspaceFields(prefix){var type=$(prefix+'Type')?$(prefix+'Type').value:'',activity=$(prefix+'ActivityFields'),poll=$(prefix+'PollFields');if(activity)activity.classList.toggle('hidden',type!=='activity');if(poll)poll.classList.toggle('hidden',type!=='poll')}
function opsRegisterWorkspace(prefix,viewId,title,description,types,advanced){if(opsWorkspaces[prefix])return;var holder=opsAppendCard(viewId,opsWorkspaceHtml(prefix,title,description,types,advanced));if(!holder)return;opsWorkspaces[prefix]={prefix:prefix,types:types,advanced:advanced||{}};$(prefix+'Reload').onclick=function(){opsLoadWorkspace(prefix)};$(prefix+'Create').onclick=function(){opsCreateRecordFrom(prefix)};$(prefix+'ListType').onchange=function(){opsLoadWorkspace(prefix)};if($(prefix+'Type'))$(prefix+'Type').onchange=function(){opsUpdateWorkspaceFields(prefix)};opsUpdateWorkspaceFields(prefix)}
function ensureOperationsViews(){
  if($('opsIntegratedMarker'))return;
  var marker=document.createElement('span');marker.id='opsIntegratedMarker';marker.hidden=true;document.body.appendChild(marker);
  opsRegisterWorkspace('opsCollab','v-collaboration','活动与投票','网页可建立活动、报名／候补与群内投票；同一功能也支持固定指令和自然语言意图判断。',['activity','poll'],{activity:true});
  opsRegisterWorkspace('opsKnowledge','v-memory','FAQ、知识卡片与回答修正','经人工确认的群内资料与 AI 回答修正版集中在记忆管理。',['faq','knowledge','correction']);
  opsRegisterWorkspace('opsRules','v-maintenance','群规版本与测试资料','维护群规版本、临时规则、例外规则与测试案例。',['rule_version','temp_rule','exception_rule','test_case']);
  opsRegisterWorkspace('opsAppeal','v-maintenance','申诉对话串','维护申诉补充、管理回复与裁定记录。',['appeal_thread']);

  var schedule=opsAppendCard('v-schedules','<details class="advanced-panel"><summary>进阶排程设置</summary><div class="advanced-panel-body"><div class="grid"><div class="card span-6"><h3>消息与排程预览</h3><div class="field"><label>文字</label><textarea id="opsPreviewText"></textarea></div><div class="field"><label>真正 @ 的 QQ（逗号分隔）</label><input id="opsPreviewMentions"></div><button id="opsPreviewBtn" class="btn">检查消息</button><div class="field"><label>排程格式</label><textarea id="opsScheduleSpec" placeholder="例如：每天 18:00 @907474476 记得更新"></textarea></div><button id="opsSchedulePreviewBtn" class="btn">预览未来 5 次与冲突</button><pre id="opsPreviewResult" style="white-space:pre-wrap;max-height:360px;overflow:auto"></pre></div><div class="card span-6"><h3>安静时段、补发与摘要</h3><label class="switch"><input id="opsQuietEnabled" type="checkbox">启用安静时段</label><div class="row"><input id="opsQuietStart" value="23:00"><input id="opsQuietEnd" value="08:00"><select id="opsQuietPolicy"><option value="defer">延后发送</option><option value="skip">略过</option><option value="admin_only">只通知管理</option><option value="send">照常发送</option></select></div><label class="switch"><input id="opsScheduleRetry" type="checkbox">排程失败自动补发</label><div class="row"><div class="field grow"><label>最多重试</label><input id="opsScheduleRetryMax" type="number" min="0" max="10"></div><div class="field grow"><label>最晚补发（分钟）</label><input id="opsScheduleGrace" type="number" min="1" max="1440"></div></div><label class="switch"><input id="opsDigestEnabled" type="checkbox">每日待处理摘要</label><div class="row"><input id="opsDigestTime" value="09:00"><input id="opsDigestRecipients" placeholder="接收者 QQ，逗号分隔"></div><div class="row"><button id="opsSaveScheduleSettings" class="btn primary">保存排程设置</button><button id="opsDigestRun" class="btn">立即发送摘要</button></div></div></div></div></details>');
  if(schedule){$('opsPreviewBtn').onclick=opsPreviewMessage;$('opsSchedulePreviewBtn').onclick=opsSchedulePreviewUi;$('opsSaveScheduleSettings').onclick=opsSaveSettings;$('opsDigestRun').onclick=function(){opsUtilityPost('/ops/digest/run',{})}}

  var rules=opsAppendCard('v-ruleviolations','<div class="grid"><div class="card span-6"><h3>群规沙盒与冲突检查</h3><div class="field"><label>模拟消息</label><textarea id="opsSandboxText"></textarea></div><div class="row"><button id="opsSandbox" class="btn">测试群规（不处罚）</button><button id="opsRuleConflicts" class="btn">检查规则冲突</button></div><pre id="opsRuleResult" style="white-space:pre-wrap;max-height:420px;overflow:auto"></pre></div><div class="card span-6"><h3>资料保留与抽样复核</h3><div class="field"><label>资料保留天数</label><input id="opsRetention" type="number" min="1" max="3650"></div><div class="field"><label>无违规抽样复核％</label><input id="opsSamplePercent" type="number" min="0" max="100"></div><div class="row"><button id="opsSaveRuleSettings" class="btn primary">保存群规营运设置</button><button id="opsRetentionRun" class="btn danger">立即清理过期资料</button></div></div></div>');if(rules){$('opsSandbox').onclick=opsRunSandbox;$('opsRuleConflicts').onclick=function(){opsDiagnostic('/ops/rule-conflicts','opsRuleResult')};$('opsSaveRuleSettings').onclick=opsSaveSettings;$('opsRetentionRun').onclick=function(){opsUtilityPost('/ops/retention/run',{},false,'opsRuleResult')}}

  var settings=opsAppendCard('v-settingscenter','<details id="opsManagementSettings" class="advanced-panel"><summary>管理与安全高级设置</summary><div class="advanced-panel-body"><div class="grid"><div class="card span-6"><h3>维护、紧急锁定与保险丝</h3><label class="switch"><input id="opsMaintenance" type="checkbox">维护模式</label><label class="switch"><input id="opsEmergency" type="checkbox">群主紧急锁定</label><label class="switch"><input id="opsFuse" type="checkbox">自动化保险丝</label><label class="switch"><input id="opsAnomaly" type="checkbox">大量异常侦测</label><button id="opsSaveSafetySettings" class="btn primary">保存安全设置</button></div><div class="card span-6"><h3>细分权限</h3><div class="row"><input id="opsPermQq" inputmode="numeric" placeholder="目标 QQ"><button id="opsPermLoad" class="btn">读取权限</button></div><div id="opsPermList" class="list"><div class="empty">群主或获授权者可管理。</div></div></div><div class="card span-12"><h3>Portal／QQ 管理交接</h3><div class="row"><select id="opsHandoffMode"><option value="portal">Portal 权限交接</option><option value="qq_admin">QQ 管理员交接（Bot 必须为群主）</option></select><input id="opsHandoffQq" inputmode="numeric" placeholder="目标 QQ"></div><div class="field"><label>交接原因（必填）</label><input id="opsHandoffReason"></div><div class="field"><label>Portal 权限 ID（逗号分隔）</label><input id="opsHandoffCaps" placeholder="例如：activity.manage,todo.manage"></div><div class="row"><button id="opsHandoffGrant" class="btn primary">执行交接／新增管理</button><button id="opsHandoffRevoke" class="btn danger">撤销 QQ 管理员</button></div></div></div></div></details>');if(settings){$('opsSaveSafetySettings').onclick=opsSaveSettings;$('opsPermLoad').onclick=opsLoadPermissions;$('opsHandoffGrant').onclick=function(){opsHandoffUi(true)};$('opsHandoffRevoke').onclick=function(){opsHandoffUi(false)}}

  var health=opsAppendCard('v-health','<div class="card"><div class="section-head"><div><h3>诊断、时间线与部署检查</h3><p>系统诊断留在健康检查，不再占用活动页面。</p></div><button id="opsHealthReload" class="btn">重新加载营运状态</button></div><div id="opsSummary" class="grid" style="margin-bottom:12px"></div><div class="row"><button id="opsDeps" class="btn">依赖检查</button><button id="opsAnalytics" class="btn">统计</button><button id="opsTimeline" class="btn">事件时间线</button><button id="opsModelMetrics" class="btn">模型用量</button><button id="opsFuses" class="btn">保险丝状态</button><button id="opsThinking" class="btn danger">清理思考残留</button><button id="opsSnapshotBtn" class="btn">建立设置快照</button></div><pre id="opsDiagnostics" style="white-space:pre-wrap;max-height:520px;overflow:auto"></pre></div>');if(health){$('opsHealthReload').onclick=loadOperations;$('opsDeps').onclick=function(){opsDiagnostic('/ops/dependencies')};$('opsAnalytics').onclick=function(){opsDiagnostic('/ops/analytics')};$('opsTimeline').onclick=function(){opsDiagnostic('/ops/timeline')};$('opsModelMetrics').onclick=function(){opsDiagnostic('/ops/model-metrics')};$('opsFuses').onclick=function(){opsDiagnostic('/ops/fuses')};$('opsThinking').onclick=opsCleanupThinking;$('opsSnapshotBtn').onclick=opsSnapshotUi}
}
function opsGetWorkspace(prefix){return opsWorkspaces[prefix]||null}
function opsTypeOptionsFor(types){var defs=(opsBootstrap&&opsBootstrap.recordTypes)||{};return (types||[]).filter(function(k){return defs[k]}).map(function(k){return '<option value="'+esc(k)+'">'+esc(defs[k].name)+'（'+esc(k)+'）</option>'}).join('')}
function opsHas(cap){var row=((opsBootstrap&&opsBootstrap.capabilities)||[]).find(function(x){return x.id===cap});return !!(row&&row.allowed)}
function opsSetChecked(id,value){if($(id))$(id).checked=!!value}
function opsSetValue(id,value){if($(id))$(id).value=value==null?'':value}
async function loadOperations(){
  if(!currentGroup){return null}
  if(opsLoading)return opsLoading;
  opsLoading=api('/ops/bootstrap').then(function(r){if(!r.ok){toast(r.message||'营运资料加载失败');return r}opsBootstrap=r;var s=r.settings||{};opsSetChecked('opsQuietEnabled',s.quietHoursEnabled);opsSetValue('opsQuietStart',s.quietStart||'23:00');opsSetValue('opsQuietEnd',s.quietEnd||'08:00');opsSetValue('opsQuietPolicy',s.quietPolicy||'defer');opsSetChecked('opsMaintenance',s.maintenanceMode);opsSetChecked('opsEmergency',s.emergencyLock);opsSetChecked('opsFuse',s.fuseEnabled!==false);opsSetChecked('opsAnomaly',s.anomalyDetectionEnabled!==false);opsSetChecked('opsScheduleRetry',s.scheduleRetryEnabled!==false);opsSetValue('opsScheduleRetryMax',Number(s.scheduleRetryMax||3));opsSetValue('opsScheduleGrace',Number(s.scheduleRetryGraceMinutes||30));opsSetChecked('opsDigestEnabled',s.dailyDigestEnabled);opsSetValue('opsDigestTime',s.dailyDigestTime||'09:00');opsSetValue('opsDigestRecipients',(s.dailyDigestRecipientIds||[]).join(','));opsSetValue('opsRetention',s.retentionDays||90);opsSetValue('opsSamplePercent',Number(s.ruleSampleReviewPercent||0));Object.keys(opsWorkspaces).forEach(function(prefix){var ws=opsWorkspaces[prefix],opts=opsTypeOptionsFor(ws.types),type=$(prefix+'Type'),list=$(prefix+'ListType');if(type){var old=type.value;type.innerHTML=opts;if(old&&ws.types.includes(old))type.value=old}if(list){var oldList=list.value;list.innerHTML=opts;if(oldList&&ws.types.includes(oldList))list.value=oldList}opsUpdateWorkspaceFields(prefix)});var caps=(r.capabilities||[]),allowed=caps.filter(function(x){return x.allowed}).length,total=caps.length,records=Object.values(r.summaries||{}).reduce(function(a,b){return a+Number(b||0)},0);if($('opsSummary'))$('opsSummary').innerHTML='<div class="card span-4"><div class="metric-label">可用权限</div><div class="metric-value">'+allowed+'/'+total+'</div></div><div class="card span-4"><div class="metric-label">营运记录</div><div class="metric-value">'+records+'</div></div><div class="card span-4"><div class="metric-label">版本</div><div class="metric-value">'+esc(r.version)+'</div></div>';return r}).finally(function(){opsLoading=null});return opsLoading
}
async function opsLoadWorkspace(prefix){var ws=opsGetWorkspace(prefix),box=$(prefix+'RecordList');if(!ws||!box)return;if(!currentGroup){box.innerHTML='<div class="empty">请先选择群组。</div>';return}var boot=await loadOperations();if(!boot||!boot.ok){box.innerHTML='<div class="empty">无法加载营运资料。</div>';return}var type=$(prefix+'ListType').value||ws.types[0];var r=await api('/ops/records?type='+encodeURIComponent(type));if(!r.ok){box.innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}box.innerHTML=(r.records||[]).map(function(x){return opsRecordCard(x,type)}).join('')||'<div class="empty">没有记录</div>';opsBindRecordActions(box,type,prefix)}
async function opsCreateRecordFrom(prefix){var ws=opsGetWorkspace(prefix);if(!ws)return;await loadOperations();var type=$(prefix+'Type').value,title=$(prefix+'Title').value.trim(),description=$(prefix+'Description').value.trim();if(!title)return toast('请填写标题');if(type==='activity'&&!opsHas('activity.manage'))return toast('你没有建立活动的权限');var data={type:type,title:title,description:description};if(ws.advanced.activity){data.groupIds=($(prefix+'GroupIds').value||'').split(/[,，\s]+/).filter(Boolean);data.activityGroupId=$(prefix+'ActivityGroup').value;data.capacity=Number($(prefix+'Capacity').value||0);data.options=($(prefix+'Options').value||'').split(/\n/).map(function(x){return x.trim()}).filter(Boolean);data.waitlistEnabled=true;data.inviteMode=data.activityGroupId?'approve_pending':'none';data.announceOnCreate=!!($(prefix+'AnnounceOnCreate')&&$(prefix+'AnnounceOnCreate').checked);data.announceMode=$(prefix+'AnnounceMode')?$(prefix+'AnnounceMode').value:'none';if(data.announceOnCreate&&!opsHas('activity.announce'))return toast('你没有发送活动通知的权限');if(data.announceMode==='all'&&!opsHas('activity.mention_all'))return toast('你没有活动通知 @全体权限')}var r=await api('/ops/records','POST',data);toast(r.message||'完成');if(r.ok){$(prefix+'Title').value='';$(prefix+'Description').value='';if($(prefix+'Options'))$(prefix+'Options').value='';$(prefix+'ListType').value=type;opsLoadWorkspace(prefix)}}
function opsRecordCard(x,type){var meta=(x.id||'')+'｜'+(x.status||'')+'｜'+new Date(Number(x.updatedAt||x.createdAt||0)).toLocaleString();if(type==='activity')meta+='｜正式 '+Number(x.confirmedCount||0)+(x.capacity?'/'+x.capacity:'')+'｜候补 '+Number(x.waitlistCount||0)+'｜统整群 '+(x.groupIds||[]).join(',')+(x.activityGroupId?'｜活动群 '+x.activityGroupId:'');if(type==='poll')meta+='｜投票人数 '+Number(x.voterCount||0);if(x.publicCode)meta+='｜'+x.publicCode;var extra='',buttons=['<button class="btn" data-ops-versions="'+esc(x.id)+'">版本</button>','<button class="btn danger" data-ops-delete="'+esc(x.id)+'">删除</button>'];if(type==='activity'){if(opsHas('activity.join'))buttons.unshift('<button class="btn primary" data-ops-join="'+esc(x.id)+'">报名</button>','<button class="btn" data-ops-leave="'+esc(x.id)+'">取消报名</button>');if(opsHas('activity.announce'))buttons.unshift('<button class="btn" data-ops-announce-none="'+esc(x.id)+'">发送通知（不 @全体）</button>');if(opsHas('activity.mention_all'))buttons.unshift('<button class="btn" data-ops-announce-all="'+esc(x.id)+'">发送通知（@全体）</button>');if(x.activityGroupId&&opsHas('activity.invite'))buttons.unshift('<button class="btn" data-ops-invite-all="'+esc(x.id)+'">邀请全部正式报名者</button>');extra='<div class="list" style="margin-top:10px">'+(x.participants||[]).map(function(p){return '<div class="item"><div class="row"><div class="grow"><b>'+esc(p.userName||p.userId)+'</b><div class="item-meta">'+esc(p.userId)+'｜'+esc(p.status)+'｜来源群 '+esc(p.sourceGroupId||'')+'｜邀请 '+esc(p.inviteStatus||'未发送')+'</div></div>'+(opsHas('activity.invite')?'<button class="btn" data-ops-invite="'+esc(x.id)+'" data-user="'+esc(p.userId)+'">邀请活动群</button>':'')+'</div></div>'}).join('')+'</div>'}if(type==='poll'){extra='<div class="row" style="margin-top:10px">'+(x.options||[]).map(function(o,i){var c=(x.voteCounts||[])[i]||0;return '<button class="btn" data-ops-vote="'+esc(x.id)+'" data-option="'+i+'">'+esc(o)+'（'+c+'）</button>'}).join('')+'</div>';buttons.unshift('<button class="btn" data-ops-poll-close="'+esc(x.id)+'">结束投票</button>')}if(type==='announcement_version')buttons.unshift('<button class="btn primary" data-ops-announcement="'+esc(x.id)+'">建立公告确认单</button>','<button class="btn" data-ops-todo="'+esc(x.id)+'">建立群待办确认单</button>');return '<div class="item"><div class="item-title">'+esc(x.title||x.id)+'</div><div class="item-meta">'+esc(meta)+'</div><div class="item-body" style="white-space:pre-wrap">'+esc(x.description||x.text||'')+'</div>'+extra+'<details><summary>技术资料</summary><pre>'+esc(JSON.stringify(x,null,2))+'</pre></details><div class="row" style="margin-top:10px">'+buttons.join('')+'</div></div>'}
function opsBindRecordActions(box,type,prefix){box.querySelectorAll('[data-ops-delete]').forEach(function(b){b.onclick=function(){opsDeleteRecord(type,this.dataset.opsDelete,prefix)}});box.querySelectorAll('[data-ops-join]').forEach(function(b){b.onclick=function(){opsActivityAction('/ops/activity/join',this.dataset.opsJoin,prefix)}});box.querySelectorAll('[data-ops-leave]').forEach(function(b){b.onclick=function(){opsActivityAction('/ops/activity/leave',this.dataset.opsLeave,prefix)}});box.querySelectorAll('[data-ops-announce-none]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/activity/announce',{id:this.dataset.opsAnnounceNone,mode:'none'},true,null,prefix)}});box.querySelectorAll('[data-ops-announce-all]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/activity/announce',{id:this.dataset.opsAnnounceAll,mode:'all'},true,null,prefix)}});box.querySelectorAll('[data-ops-invite]').forEach(function(b){b.onclick=function(){opsInviteParticipant(this.dataset.opsInvite,this.dataset.user,prefix)}});box.querySelectorAll('[data-ops-invite-all]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/activity/invite-all',{id:this.dataset.opsInviteAll},true,null,prefix)}});box.querySelectorAll('[data-ops-vote]').forEach(function(b){b.onclick=function(){opsVote(this.dataset.opsVote,Number(this.dataset.option),prefix)}});box.querySelectorAll('[data-ops-poll-close]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/poll/close',{id:this.dataset.opsPollClose},true,null,prefix)}});box.querySelectorAll('[data-ops-announcement]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/announcement/publish',{id:this.dataset.opsAnnouncement,asTodo:false},true,null,prefix)}});box.querySelectorAll('[data-ops-todo]').forEach(function(b){b.onclick=function(){opsUtilityPost('/ops/announcement/publish',{id:this.dataset.opsTodo,asTodo:true},true,null,prefix)}});box.querySelectorAll('[data-ops-versions]').forEach(function(b){b.onclick=function(){opsVersionsUi(type,this.dataset.opsVersions,prefix)}})}
async function opsDeleteRecord(type,id,prefix){if(!(await confirmModal('删除后不会再显示，但审计记录仍保留。','删除记录',{danger:true})))return;var r=await api('/ops/records','DELETE',{type:type,id:id});toast(r.message||'完成');if(r.ok)opsLoadWorkspace(prefix)}
async function opsActivityAction(path,id,prefix){var r=await api(path,'POST',{id:id});toast(r.message||'完成');if(r.ok)opsLoadWorkspace(prefix)}
async function opsInviteParticipant(id,userId,prefix){var r=await api('/ops/activity/invite','POST',{id:id,userId:userId});toast(r.message||'邀请失败');if(r.ok)opsLoadWorkspace(prefix)}
async function opsVote(id,index,prefix){var r=await api('/ops/poll/vote','POST',{id:id,optionIndexes:[index]});toast(r.message||'投票失败');if(r.ok)opsLoadWorkspace(prefix)}
async function opsSaveSettings(){var s=(opsBootstrap&&opsBootstrap.settings)||{};var val=function(id,fallback){return $(id)?$(id).value:fallback},checked=function(id,fallback){return $(id)?$(id).checked:fallback};var r=await api('/ops/settings','POST',{quietHoursEnabled:checked('opsQuietEnabled',s.quietHoursEnabled),quietStart:val('opsQuietStart',s.quietStart),quietEnd:val('opsQuietEnd',s.quietEnd),quietPolicy:val('opsQuietPolicy',s.quietPolicy),maintenanceMode:checked('opsMaintenance',s.maintenanceMode),emergencyLock:checked('opsEmergency',s.emergencyLock),fuseEnabled:checked('opsFuse',s.fuseEnabled),anomalyDetectionEnabled:checked('opsAnomaly',s.anomalyDetectionEnabled),scheduleRetryEnabled:checked('opsScheduleRetry',s.scheduleRetryEnabled),scheduleRetryMax:Number(val('opsScheduleRetryMax',s.scheduleRetryMax||0)),scheduleRetryGraceMinutes:Number(val('opsScheduleGrace',s.scheduleRetryGraceMinutes||30)),dailyDigestEnabled:checked('opsDigestEnabled',s.dailyDigestEnabled),dailyDigestTime:val('opsDigestTime',s.dailyDigestTime),dailyDigestRecipientIds:String(val('opsDigestRecipients',(s.dailyDigestRecipientIds||[]).join(','))).split(/[,，\s]+/).filter(Boolean),retentionDays:Number(val('opsRetention',s.retentionDays||90)),ruleSampleReviewPercent:Number(val('opsSamplePercent',s.ruleSampleReviewPercent||0))});toast(r.message||'保存失败');if(r.ok){opsBootstrap=null;await loadOperations()}}
async function opsUtilityPost(path,data,reload,resultId,prefix){var r=await api(path,'POST',data||{});toast(r.message||(r.ok?'完成':'失败'));var target=$(resultId||'opsDiagnostics');if(target)target.textContent=JSON.stringify(r,null,2);if(r.ok&&reload&&prefix)opsLoadWorkspace(prefix);return r}
async function opsSchedulePreviewUi(){var r=await api('/ops/schedule-preview','POST',{scheduleSpec:$('opsScheduleSpec').value});$('opsPreviewResult').textContent=JSON.stringify(r,null,2);if(!r.ok)toast(r.message||'预览失败')}
async function opsLoadTasks(){var r=await api('/ops/tasks?limit=300');if(!$('opsTaskList'))return;if(!r.ok){$('opsTaskList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('opsTaskList').innerHTML=(r.tasks||[]).map(function(x){return '<div class="item"><div class="item-title">'+esc(x.kind)+'｜'+esc(x.title||x.id)+'</div><div class="item-meta">'+esc(x.id)+'｜'+esc(x.status)+'</div><div class="row">'+(x.retryable?'<button class="btn" data-task-action="retry" data-kind="'+esc(x.kind)+'" data-id="'+esc(x.id)+'">重试</button>':'')+(x.cancellable?'<button class="btn danger" data-task-action="cancel" data-kind="'+esc(x.kind)+'" data-id="'+esc(x.id)+'">取消</button>':'')+'</div></div>'}).join('')||'<div class="empty">没有待处理任务</div>';$('opsTaskList').querySelectorAll('[data-task-action]').forEach(function(b){b.onclick=async function(){var r=await api('/ops/tasks/action','POST',{kind:this.dataset.kind,id:this.dataset.id,action:this.dataset.taskAction});toast(r.message||'操作失败');if(r.ok)opsLoadTasks()}})}
async function opsMemberSummaryUi(){var qq=$('opsMemberQq').value.replace(/\D/g,'');if(!qq)return toast('请输入成员 QQ');var r=await api('/ops/member-summary?qq='+encodeURIComponent(qq));if($('opsMemberResult'))$('opsMemberResult').textContent=JSON.stringify(r,null,2);if(!r.ok)toast(r.message||'读取失败')}
async function opsHandoffUi(enable){var mode=$('opsHandoffMode').value,qq=$('opsHandoffQq').value.replace(/\D/g,''),reason=$('opsHandoffReason').value.trim(),caps=$('opsHandoffCaps').value.split(/[,，\s]+/).filter(Boolean);if(!qq||!reason)return toast('目标 QQ 与原因都必须填写');var r=await api('/ops/handoff','POST',{mode:mode,targetQq:qq,reason:reason,capabilities:caps,enable:enable});toast(r.message||'交接失败');if($('opsDiagnostics'))$('opsDiagnostics').textContent=JSON.stringify(r,null,2)}
async function opsVersionsUi(type,id,prefix){var r=await api('/ops/versions?type='+encodeURIComponent(type)+'&id='+encodeURIComponent(id));if($('opsDiagnostics'))$('opsDiagnostics').textContent=JSON.stringify(r,null,2);if(!r.ok)return toast(r.message||'读取失败');if(!(r.versions||[]).length)return toast('没有旧版本');if(await confirmModal('恢复到最近一个旧版本？','版本恢复',{danger:true})){var x=await api('/ops/versions/restore','POST',{type:type,id:id,versionIndex:(r.versions||[]).length-1});toast(x.message||'恢复失败');if(x.ok)opsLoadWorkspace(prefix)}}
async function opsPreviewMessage(){var r=await api('/ops/message-preview','POST',{text:$('opsPreviewText').value,mentionIds:$('opsPreviewMentions').value.split(/[,，\s]+/).filter(Boolean)});$('opsPreviewResult').textContent=JSON.stringify(r,null,2)}
async function opsLoadPermissions(){var qq=$('opsPermQq').value.trim();var r=await api('/ops/permissions?qq='+encodeURIComponent(qq));if(!r.ok){$('opsPermList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('opsPermList').innerHTML=(r.capabilities||[]).map(function(x){return '<div class="item"><div class="row"><div class="grow"><b>'+esc(x.name)+'</b><div class="item-meta">'+esc(x.id)+'｜'+(x.allowed?'允许':'拒绝')+'｜来源 '+esc(x.source||'')+'</div></div><button class="btn '+(x.allowed?'danger':'primary')+'" data-cap="'+esc(x.id)+'" data-next="'+(!x.allowed)+'">'+(x.allowed?'拒绝':'允许')+'</button></div></div>'}).join('');$('opsPermList').querySelectorAll('[data-cap]').forEach(function(b){b.onclick=function(){opsSetPermission(qq,this.dataset.cap,this.dataset.next==='true')}})}
async function opsSetPermission(qq,cap,allowed){var reason=await textModal('填写授权或拒绝原因（可留空）。','',allowed?'允许功能':'拒绝功能');if(reason===null)return;var r=await api('/ops/permissions','POST',{qq:qq,capability:cap,allowed:allowed,reason:reason});toast(r.message||'完成');if(r.ok)opsLoadPermissions()}
async function opsDiagnostic(path,resultId){var r=await api(path);var target=$(resultId||'opsDiagnostics');if(target)target.textContent=JSON.stringify(r,null,2)}
async function opsCleanupThinking(){if(!(await confirmModal('将重试撤回目前群已记录的思考提示残留。','清理残留',{danger:true})))return;var r=await api('/ops/thinking-cleanup','POST',{});if($('opsDiagnostics'))$('opsDiagnostics').textContent=JSON.stringify(r,null,2)}
async function opsRunSandbox(){var r=await api('/ops/rule-sandbox','POST',{text:$('opsSandboxText').value,role:'member',context:[]});if($('opsRuleResult'))$('opsRuleResult').textContent=JSON.stringify(r,null,2)}

function ensureGroupSettingsExtras(){if($('welcomeEnabled')||!$('v-groups'))return;var grid=$('v-groups').querySelector('.grid');if(!grid)return;var card=document.createElement('div');card.className='span-12';card.innerHTML='<details class="settings-fold"><summary><span>自动化与安全</span><span class="muted">需要时再展开</span></summary><div class="settings-fold-body"><div class="grid"><div class="card span-6"><div class="notice">自动 QQ 群打卡会在台北时间 23:59 预热群列表，并于 00:00:00～00:01:59 快速重试；成功后立即停止，不受 AI 开关与白名单影响。</div><label class="switch"><input id="welcomeEnabled" type="checkbox">自动欢迎新人</label><label class="switch"><input id="joinAssistEnabled" type="checkbox">入群申请辅助</label><label class="switch"><input id="joinAiApproveEnabled" type="checkbox">Gemma 高置信度审查后自动同意入群</label><label class="switch"><input id="ruleMonitorEnabled" type="checkbox">持续检查群成员是否违反群规</label><div id="ruleMonitorHint" class="notice">机器人不是群主或管理员时，群规监控完全停用且不建立记录。</div><div class="field"><label>欢迎词（支持 {at}、{qq} 与表情符号）</label><textarea id="welcomeText"></textarea></div></div><div class="card span-6"><div class="field"><label>同一对象处置冷却（秒，默认 0＝关闭）</label><input id="moderationCooldown" type="number" min="0"></div><div class="field"><label>新人观察期（天，0＝关闭）</label><input id="newcomerDays" type="number" min="0" max="30"></div><label class="switch"><input id="ruleMuteGuardEnabled" type="checkbox">违规禁言被管理提前解除时，按剩余时间重新禁言</label><div class="notice">此开关默认开启，只有群主或开发者可修改。误判时可在 Portal 复核，或发送「!无违规 @成员 补充说明」。目标和补充均必填。</div></div><div class="card span-12"><h3>刷屏判定（按群独立设置）</h3><div class="grid"><div class="field span-4"><label>时间窗（秒）</label><input id="ruleSpamWindow" type="number" min="5" max="3600"></div><div class="field span-4"><label>重复消息门槛（条）</label><input id="ruleSpamThreshold" type="number" min="2" max="50"></div><div class="field span-4"><label>撤回后保留条数</label><input id="ruleSpamKeep" type="number" min="0" max="49"></div></div><div class="notice">默认是 60 秒内第 4 条触发，执行撤回时保留最早 3 条，只撤回超出的部分。群规模型仍会结合实际上下文判断变体刷屏。</div></div></div></div></details>';grid.appendChild(card);ensureGroupBindingPanel();ensureDeveloperPermissionPanel()}

function ensureGroupBindingPanel(){if($('groupBindingPanel')||!$('v-groups'))return;var grid=$('v-groups').querySelector('.grid');if(!grid)return;var card=document.createElement('div');card.id='groupBindingPanel';card.className='span-12';card.innerHTML='<details class="settings-fold"><summary><span>多群绑定与总群引导</span><span class="muted">多群使用者再展开</span></summary><div class="settings-fold-body"><div class="section-head"><div><h3>总群与分群</h3><p>设置总群、分群别名与私聊排程默认群。</p></div><button id="reloadGroupBinding" class="btn">重新加载</button></div><div class="grid"><div class="card span-5"><div class="field"><label>总群</label><select id="familyHeadGroup"></select></div><div class="field"><label>总群显示名称</label><input id="familyHeadAlias" placeholder="例如：小南大魔头总部"></div><div class="field"><label>实际发送的总群加入链接（可自订）</label><input id="familyJoinUrl" placeholder="QQ 邀请链接、网页链接或 mqqapi；留空时使用系统引导页"></div><div class="field"><label>引导文字</label><textarea id="familyGuideText"></textarea></div><button id="saveGroupBinding" class="btn primary">保存多群绑定</button><div id="familyJoinPreview" class="notice">保存后会生成总群引导链接。</div><div class="field"><label>我的私聊排程默认群</label><select id="familyDefaultGroup"></select></div><button id="saveFamilyDefaultGroup" class="btn">保存默认群</button></div><div class="card span-7"><h3>选择要绑定的分群并设置名称与用途</h3><div id="familyGroupChoices" class="group-binding-list"></div><div class="field"><label>提醒哪个分群中尚未加入总群的成员</label><select id="familyGuideBranch"></select></div><button id="familyGuideMissing" class="btn">@ 未加入总群的群员</button><div id="familyBindingMessage" class="notice">分群备注仅供后台辨识，不会自动公开发送。</div></div></div></div></details>';grid.appendChild(card);$('reloadGroupBinding').onclick=loadGroupBindings;$('saveGroupBinding').onclick=saveGroupBindings;$('familyGuideMissing').onclick=guideMissingHeadMembers;$('saveFamilyDefaultGroup').onclick=saveFamilyDefaultGroup}

function ensureR3Views(){
  var nav=$('nav');var container=document.querySelector('main .content')||document.querySelector('main')||$('app');if(!nav||!container)return;
  function addView(name,label){if(!$('v-'+name)){var b=document.createElement('button');b.dataset.view=name;b.textContent=label;b.onclick=function(){showView(name)};nav.appendChild(b);var section=document.createElement('section');section.id='v-'+name;section.className='view';container.appendChild(section)}titles[name]=label}
  addView('collaboration','活动与投票');addView('schedules','排程提醒');addView('maintenance','系统维护');addView('conversations','对话记录');addView('ruleviolations','群规监控');addView('settingscenter','设置中心');addView('bilibili','B站串接');addView('aidecisions','AI 回复记录');addView('appeals','匿名申诉');addView('violationhistory','历史违规记录');addView('appealreview','申诉处理');

  if(!$('v-maintenance').dataset.ready){$('v-maintenance').dataset.ready='1';$('v-maintenance').innerHTML='<div class="section-head"><div><h2>系统维护</h2><p>开发者专用维护入口，只保留诊断、队列、模型、权限、日志、群规与申诉资料。</p></div><button id="maintenanceReload" class="btn">重新加载</button></div>';$('maintenanceReload').onclick=function(){loadOperations();Object.keys(opsWorkspaces).filter(function(x){return /^ops(?:Rules|Appeal)$/.test(x)}).forEach(opsLoadWorkspace)}}
  if(!$('v-schedules').dataset.ready){$('v-schedules').dataset.ready='1';$('v-schedules').innerHTML='<div class="section-head"><div><h2>排程提醒</h2><p>直接用自然语言建立提醒，例如「每天 18:00 提醒填日报」。</p></div><button id="scheduleReload" class="btn">重新加载</button></div><div class="grid"><div class="card span-5"><h3>建立排程</h3><div class="field"><label>排程内容</label><textarea id="scheduleText" placeholder="例如：每天 18:00 记得填写日报&#10;每周一 09:00 本周会议开始&#10;2026-07-30 20:00 活动开始&#10;每隔 2小时 请查看群公告"></textarea></div><button id="scheduleCreate" class="btn primary" style="width:100%">建立排程</button><div id="scheduleCronState" class="notice" style="margin-top:12px">尚未读取 Cron 状态。</div></div><div class="card span-7"><h3>我的排程</h3><div id="scheduleMine" class="list"><div class="empty">尚未加载</div></div></div><div id="scheduleReviewCard" class="card span-6 hidden"><h3>分配给我的审核</h3><div id="scheduleReviewList" class="list"><div class="empty">没有待审核排程</div></div></div><div id="scheduleRootCard" class="card span-6 hidden"><h3>开发者排程总览</h3><div id="scheduleRootList" class="list"><div class="empty">尚未加载</div></div></div></div>';$('scheduleReload').onclick=loadSchedules;$('scheduleCreate').onclick=createScheduleFromPortal}
  if(!$('v-ruleviolations').dataset.ready){$('v-ruleviolations').dataset.ready='1';$('v-ruleviolations').innerHTML='<div class="section-head"><div><h2>群规监控记录</h2><p>AI 会结合聊天上下文、链接内容、分类备注、严重程度与人工复核结果判断。</p></div><button id="rvReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="rvMember" placeholder="群友名称或 QQ"><input id="rvContent" placeholder="消息内容"><select id="rvType"><option value="">全部违规项目</option></select><button id="rvSearch" class="btn primary">搜索</button></div><div class="row" style="margin-top:12px"><select id="rvStrictness" title="群规判断严格度"><option value="smart">智慧（自动校准）</option><option value="loose">宽松</option><option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option><option value="strict">严格</option></select><select id="rvProxyMode"><option value="record">仅记录</option><option value="warn">警告代理（7 天累计，只警告）</option><option value="mute">禁言代理（累计并处罚，不踢人）</option><option value="auto">完全代理（可踢出）</option></select><input id="rvMuteSeconds" type="number" min="0" placeholder="默认禁言秒数"><label class="switch"><input id="rvKickAuth" type="checkbox">授权 AI 踢出</label><button id="rvSave" class="btn primary">保存群规设置</button></div><div class="notice" style="margin-top:12px">警告代理默认发送警告，但分类明确设为“撤回违规消息”时会执行撤回；禁言代理默认按次数处罚，也会遵守分类撤回，但绝不踢人；完全代理才可能按规则踢出。</div></div><details class="settings-fold" id="rvRulesFold"><summary><span>累进处罚与分类规则</span><span class="muted">关闭时不占用内容空间</span></summary><div class="settings-fold-body"><div class="grid"><div class="card span-4"><h3>本群累进处罚规则</h3><p class="muted">这是当前群独立规则；次数和每次执行的动作都可自由增加。</p><div class="field"><label>累计有效期（天）</label><input id="rvProgressiveWindow" type="number" min="1" max="365"></div><div class="field"><label>轻微或无明显恶意</label><select id="rvMinorAction"><option value="remind">友善提醒，不累计</option><option value="warn">正式警告，不累计</option><option value="manual">交管理复核</option></select></div><button id="rvAddStep" class="btn">增加处罚次数</button></div><div class="card span-8"><h3>次数与动作</h3><div id="rvProgressiveSteps"></div><div class="notice">每个次数可依序执行多个动作；最后一个步骤会套用于更高次数。例如只设 3 步时，第 4 次以后继续使用第 3 步。</div></div></div><div class="card" style="margin-top:16px"><div class="section-head"><div><h3>群规分类与处罚</h3><p>管理以上可调整分类、处罚和备注；选择“使用本群累进规则”才会依次数处理。</p></div><button id="rvAddPolicy" class="btn">新增分类</button></div><div id="rvPolicyList" class="list"></div></div></div></details><div id="rvList" class="list" style="margin-top:16px"></div>';$('rvReload').onclick=loadRuleViolations;$('rvSearch').onclick=loadRuleViolations;$('rvSave').onclick=saveRuleViolationSettings;$('rvAddPolicy').onclick=addRulePolicyRow;$('rvAddStep').onclick=addProgressiveStep}
  if(!$('v-conversations').dataset.ready){$('v-conversations').dataset.ready='1';$('v-conversations').innerHTML='<div class="section-head"><div><h2>群友对话记录</h2><p>只记录群友原始消息，不记录 AI 回复或系统消息。管理员可直接处理精华、撤回、群待办、公告、提醒与违规流程。</p></div><button id="convReload" class="btn">重新加载</button></div><div class="card conversation-toolbar"><div class="row"><input id="convSearch" class="grow" placeholder="搜索群友、QQ、消息或转发内容"><label class="switch"><input id="convViolationOnly" type="checkbox">只看违规消息</label><button id="convSearchBtn" class="btn primary">搜索</button></div></div><div id="conversationList" class="list"><div class="empty">尚未加载</div></div>';$('convReload').onclick=loadConversations;$('convSearchBtn').onclick=loadConversations;$('convViolationOnly').onchange=loadConversations;$('convSearch').onkeydown=function(e){if(e.key==='Enter')loadConversations()}}
  if(!$('v-settingscenter').dataset.ready){$('v-settingscenter').dataset.ready='1';$('v-settingscenter').innerHTML='<div class="section-head"><div><h2>更多设置</h2><p>这里只显示当前账号可以修改的项目；没有权限的设置不会出现。</p></div><div class="row"><button id="scReload" class="btn">重新加载</button><button id="scSaveAll" class="btn primary">保存全部设置</button></div></div><div id="scDeveloper" class="card hidden"><div class="row"><input id="scTargetQq" placeholder="目标 QQ（输入后自动识别权限）"><span id="scResolvedRole" class="status">尚未识别</span><label class="switch"><input id="scAuditLog" type="checkbox" checked>记录操作日志（可选）</label></div></div><div id="scMessage" class="notice">尚未加载设置。</div><div id="scList" class="list" style="margin-top:16px"></div>';$('scReload').onclick=loadSettingsCenter;$('scSaveAll').onclick=saveAllSettings;$('scTargetQq').onchange=loadSettingsCenter;$('scTargetQq').onkeydown=function(e){if(e.key==='Enter')loadSettingsCenter()}}
  if(!$('v-aidecisions').dataset.ready){$('v-aidecisions').dataset.ready='1';$('v-aidecisions').innerHTML='<div class="section-head"><div><h2>AI 回复与未回复记录</h2><p>每則群聊觸發判斷、主動插話來源、模型、智能 @ 規劃、獨立搜索內容與實際發送結果都獨立保存。</p></div><button id="aiLogReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="aiLogSearch" class="grow" placeholder="搜索 QQ、訊息、原因、模型"><select id="aiLogDecision"><option value="">全部決策</option><option value="reply_generated">已產生回覆</option><option value="skipped">未回覆</option><option value="blocked">遭阻擋</option><option value="error">錯誤</option></select><select id="aiLogTrigger"><option value="">全部觸發</option><option value="mention">@機器人</option><option value="reply_to_ai">回覆機器人</option><option value="auto_interject">主動插話</option><option value="private">私聊</option><option value="none">未觸發</option></select><button id="aiLogSearchBtn" class="btn primary">搜索</button></div></div><div id="aiDecisionList" class="list" style="margin-top:16px"><div class="empty">尚未加载</div></div>';$('aiLogReload').onclick=loadAiDecisions;$('aiLogSearchBtn').onclick=loadAiDecisions;$('aiLogSearch').onkeydown=function(e){if(e.key==='Enter')loadAiDecisions()}}
  if(!$('v-appeals').dataset.ready){$('v-appeals').dataset.ready='1';$('v-appeals').innerHTML='<div class="section-head"><div><h2>匿名申诉</h2><p>审核者看不到你的 QQ；只有开发者可以查看真实身份。当前成员和退出未满 30 天的前成员都可以申诉。</p></div><button id="appealReload" class="btn">刷新案件</button></div><div class="grid"><div class="card span-5"><h3>提交申诉</h3><div class="field"><label>所属群组</label><select id="appealGroup"><option value="">请选择群组</option></select></div><div class="field"><label>申诉类型</label><select id="appealType"><option>禁言</option><option>踢出</option><option>AI黑名单</option><option>管理操作</option><option>排程</option><option>其他</option></select></div><div class="field"><label>相关消息 ID（选填）</label><input id="appealEvidence"></div><div class="field"><label>申诉内容</label><textarea id="appealContent" placeholder="请说明发生了什么、希望如何处理"></textarea></div><button id="appealSubmit" class="btn primary" style="width:100%">匿名提交</button><div id="appealMessage" class="notice">提交后可在“我的案件”查看处理状态。前成员资格从系统收到退群事件起保留 30 天。</div></div><div class="card span-7"><h3>我的案件</h3><div id="appealList" class="list"><div class="empty">暂无案件</div></div></div></div>';$('appealReload').onclick=loadAppeals;$('appealSubmit').onclick=submitAppeal}
  if(!$('v-violationhistory').dataset.ready){$('v-violationhistory').dataset.ready='1';$('v-violationhistory').innerHTML='<div class="section-head"><div><h2>历史违规记录</h2><p>你可以查看自己的群规记录，并对单条或多条记录一键申诉。只有属于你的记录会显示。</p></div><button id="vhReload" class="btn">重新加载</button></div><div class="card"><div class="row"><select id="vhGroup"><option value="">全部可申诉群组</option></select><button id="vhSelectAll" class="btn">全选当前列表</button><button id="vhAppealSelected" class="btn primary">申诉所选记录</button></div><div class="notice" style="margin-top:12px">退出群聊未满 30 天仍可查看并申诉；超过期限后不能再提交新申诉。</div></div><div id="vhList" class="list" style="margin-top:16px"><div class="empty">尚未加载</div></div>';$('vhReload').onclick=loadViolationHistory;$('vhGroup').onchange=loadViolationHistory;$('vhSelectAll').onclick=function(){document.querySelectorAll('.vhCheck:not(:disabled)').forEach(function(x){x.checked=true})};$('vhAppealSelected').onclick=function(){appealViolationRecords(Array.from(document.querySelectorAll('.vhCheck:checked')).map(function(x){return x.value}))}}
  if(!$('v-appealreview').dataset.ready){$('v-appealreview').dataset.ready='1';$('v-appealreview').innerHTML='<div class="section-head"><div><h2>申诉处理</h2><p>处理当前选中群组的匿名申诉。非开发者看不到申诉人的真实 QQ。</p></div><button id="appealReviewReload" class="btn">重新加载</button></div><div class="card"><div class="row"><select id="appealReviewStatus"><option value="">全部状态</option><option value="pending_owner">待处理</option><option value="pending_review">审核中</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select><button id="appealReviewSearch" class="btn primary">筛选</button></div></div><div id="appealReviewList" class="list" style="margin-top:16px"><div class="empty">请选择群组后加载案件</div></div>';$('appealReviewReload').onclick=loadAppealReviews;$('appealReviewSearch').onclick=loadAppealReviews}
  if(!$('v-bilibili').dataset.ready){$('v-bilibili').dataset.ready='1';$('v-bilibili').innerHTML='<div class="section-head"><div><h2>B站监控</h2><p>可选择主动低频检查，或接收外部服务推送的事件。</p></div><button id="biliReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="biliCreatorName" placeholder="创作者名称（选填）"><input id="biliCreatorId" inputmode="numeric" placeholder="B站用户 UID（必填）"><select id="biliMode"><option value="automatic_polling" selected>兼容轮询（输入 UID 即可使用）</option><option value="official_webhook">接收 Webhook（高级，需要外部事件来源）</option></select><select id="biliPollInterval"><option value="1800" selected>每 30 分钟</option><option value="3600">每 1 小时</option><option value="7200">每 2 小时</option><option value="21600">每 6 小时</option></select></div><div class="row"><label class="switch"><input id="biliLiveNotify" type="checkbox" checked>开播通知</label><label class="switch"><input id="biliLiveAtAll" type="checkbox">开播 @全体</label><label class="switch"><input id="biliVideoNotify" type="checkbox" checked>新视频通知</label><label class="switch"><input id="biliVideoAtAll" type="checkbox">新视频 @全体</label><button id="biliAdd" class="btn primary">保存监控</button></div><div id="biliModeHelp" class="notice"></div><div class="notice">兼容轮询最低 30 分钟一次；若 B站返回 412／429，系统会自动暂停 12～72 小时。Webhook 不会主动访问 B站，但必须另有开放平台应用或合法事件中继把事件发送到回调地址。</div><div id="biliWebhookResult" class="notice hidden"></div></div><div id="biliList" class="list" style="margin-top:16px"></div>';$('biliReload').onclick=loadBilibili;$('biliAdd').onclick=saveBilibiliConnector;$('biliMode').onchange=function(){var webhook=this.value==='official_webhook';$('biliPollInterval').disabled=webhook;$('biliModeHelp').textContent=webhook?'Webhook 模式：本 Worker 只负责接收事件。仅填写 UID 不会自动检查；保存后请复制回调地址到你的开放平台应用或事件中继。':'兼容轮询：Worker 会按频率主动检查该 UID，可以使用“立即检查”。首次检查只建立当前状态基准。'};$('biliMode').onchange()}
  if(!$('v-platform')){var b=document.createElement('button');b.dataset.view='platform';b.textContent='功能权限中心';b.hidden=true;$('nav').appendChild(b);b.onclick=function(){showView('platform')};var v=document.createElement('section');v.id='v-platform';v.className='view';v.innerHTML='<div class="section-head"><div><h2>功能权限中心</h2><p>这是机器人功能总开关，仅开发者本人可见并可修改全部 300 项。</p></div><button id="pfReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="pfSearch" class="grow" placeholder="搜索功能名称、ID、类别"><label id="pfAuditWrap" class="switch"><input id="pfAuditSilent" type="checkbox">不记录操作日志（仅开发者）</label><button id="pfGo" class="btn primary">搜索</button></div><div id="pfSummary" class="notice">尚未加载</div></div><div id="pfList" class="list" style="margin-top:16px"></div>';document.querySelector('.content').appendChild(v);$('pfReload').onclick=loadPlatformFeatures;$('pfGo').onclick=loadPlatformFeatures;$('pfSearch').onkeydown=function(e){if(e.key==='Enter')loadPlatformFeatures()}}
  ensureOperationsViews();
}
function organizeSidebarNavigation(){var nav=$('nav');if(!nav||nav.dataset.grouped==='2')return;var groups=[{name:'常用',items:['overview','collaboration','schedules','memory']},{name:'群组管理',items:['groups','ruleviolations','moderation','aidecisions','conversations','appealreview']},{name:'个人与更多',items:['appeals','violationhistory','settingscenter','models','bilibili'],collapsible:true},{name:'系统维护',items:['maintenance','health','tasks','simulator','models','quota','platform','logs'],collapsible:true,tier:'advanced',defaultCollapsed:false}],labels={overview:'首页',collaboration:'活动与投票',schedules:'排程提醒',memory:'AI 记忆',groups:'群组设置',ruleviolations:'群规与复核',moderation:'待确认操作',aidecisions:'AI 回复记录',conversations:'对话记录',appealreview:'申诉处理',appeals:'我的申诉',violationhistory:'违规记录',settingscenter:'更多设置',models:'AI 模型',bilibili:'B站监控',maintenance:'系统维护',health:'系统诊断',tasks:'任务队列',simulator:'事件模拟器',quota:'额度管理',platform:'功能权限',logs:'操作日志'},icons={overview:'首',collaboration:'活',schedules:'时',memory:'记',groups:'群',ruleviolations:'规',moderation:'审',aidecisions:'答',conversations:'聊',appealreview:'裁',appeals:'诉',violationhistory:'录',settingscenter:'设',models:'模',bilibili:'B',maintenance:'维',health:'诊',tasks:'列',simulator:'测',quota:'额',platform:'权',logs:'志'},saved=readSidebarCollapseState(),original=Array.from(nav.querySelectorAll(':scope > button[data-view]')),used=new Set();groups.forEach(function(def,index){var wrap=document.createElement('div');wrap.className='nav-group';wrap.dataset.navGroup=def.name;if(def.tier)wrap.dataset.tier=def.tier;if(def.collapsible)wrap.dataset.collapsible='1';var h=document.createElement('button');h.type='button';h.className='nav-heading';h.innerHTML='<span class="nav-heading-label">'+esc(def.name)+'</span><span class="nav-chevron" aria-hidden="true">⌄</span>';var items=document.createElement('div');items.className='nav-items';items.id='nav-group-items-'+index;wrap.appendChild(h);wrap.appendChild(items);def.items.forEach(function(v){var b=nav.querySelector('button[data-view="'+v+'"]');if(!b)return;used.add(b);b.textContent=labels[v]||b.textContent;b.dataset.icon=icons[v]||'•';items.appendChild(b)});if(def.collapsible){h.onclick=function(){setSidebarGroupCollapsed(wrap,!wrap.classList.contains('collapsed'),true)}}else{h.disabled=true;h.setAttribute('aria-expanded','true')}nav.appendChild(wrap);var collapsed=def.collapsible&&(Object.prototype.hasOwnProperty.call(saved,def.name)?!!saved[def.name]:(def.defaultCollapsed!==undefined?!!def.defaultCollapsed:true));setSidebarGroupCollapsed(wrap,collapsed,false)});original.forEach(function(b){if(!used.has(b)){var advanced=nav.querySelector('.nav-group[data-tier="advanced"] .nav-items');b.dataset.icon=b.dataset.icon||'•';advanced.appendChild(b)}});nav.dataset.grouped='2';updatePortalAdvancedUi();refreshSidebarGroupVisibility()}
var SIDEBAR_COLLAPSE_KEY='qqai_sidebar_collapsed_v1';
function readSidebarCollapseState(){try{var x=JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSE_KEY)||'{}');return x&&typeof x==='object'?x:{}}catch(e){return{}}}
function writeSidebarCollapseState(state){try{localStorage.setItem(SIDEBAR_COLLAPSE_KEY,JSON.stringify(state||{}))}catch(e){}}
function setSidebarGroupCollapsed(group,collapsed,persist){if(!group)return;group.classList.toggle('collapsed',!!collapsed);var toggle=group.querySelector('.nav-heading');if(toggle){toggle.setAttribute('aria-expanded',collapsed?'false':'true');toggle.title=collapsed?'展开 '+String(group.dataset.navGroup||'分类'):'收起 '+String(group.dataset.navGroup||'分类')}if(persist){var state=readSidebarCollapseState();state[String(group.dataset.navGroup||'')]=!!collapsed;writeSidebarCollapseState(state)}}
function expandSidebarGroupForView(view){var b=document.querySelector('#nav button[data-view="'+String(view||'').replace(/"/g,'')+'"]');var group=b&&b.closest('.nav-group');if(group)setSidebarGroupCollapsed(group,false,false)}
function refreshSidebarGroupVisibility(){var dev=!!(session&&session.permissions&&session.permissions.developer),advanced=dev&&portalAdvancedEnabled();document.querySelectorAll('#nav .nav-group').forEach(function(g){var buttons=Array.from(g.querySelectorAll('.nav-items button[data-view]')),visibleButtons=buttons.filter(function(b){return !b.hidden&&b.style.display!=='none'}),tierAllowed=g.dataset.tier!=='advanced'||advanced;g.style.display=visibleButtons.length&&tierAllowed?'':'none';g.classList.toggle('has-active',visibleButtons.some(function(b){return b.classList.contains('active')}));var toggle=g.querySelector('.nav-heading');if(toggle)toggle.disabled=visibleButtons.length===0})}
function closeMobileSidebar(){if($('sidebar'))$('sidebar').classList.remove('open');if($('sidebarBackdrop'))$('sidebarBackdrop').classList.remove('open');document.body.classList.remove('sidebar-open');if($('menu'))$('menu').setAttribute('aria-expanded','false')}
function toggleMobileSidebar(){if(window.innerWidth>1024){closeMobileSidebar();return}var open=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',open);if($('sidebarBackdrop'))$('sidebarBackdrop').classList.toggle('open',open);document.body.classList.toggle('sidebar-open',open)}
function syncResponsivePortal(){if(window.innerWidth>1024)closeMobileSidebar();var menu=$('menu');if(menu)menu.setAttribute('aria-expanded',$('sidebar')&&$('sidebar').classList.contains('open')?'true':'false')}
function applyR3RoleVisibility(){ensureR3Views();organizeSidebarNavigation();applyRoleVisibility();var perms=(session&&session.permissions)||{},role=(session&&session.role)||'member',management=!!(perms.aiAdmin||perms.groupOps||perms.nativeAdmin||perms.developer||['admin','owner'].includes(role)),dev=!!perms.developer;document.querySelectorAll('#nav button[data-view]').forEach(function(b){var v=b.dataset.view;if(['ruleviolations','bilibili','aidecisions','conversations','moderation','groups'].includes(v)&&!management){b.hidden=true;b.style.display='none'}if(v==='appealreview'&&!(perms.appealReviewer||perms.nativeAdmin||dev||['admin','owner'].includes(role))){b.hidden=true;b.style.display='none'}});if($('scDeveloper'))$('scDeveloper').classList.toggle('hidden',!dev);if($('scTargetQq')){$('scTargetQq').disabled=!dev;if(!dev)$('scTargetQq').value=session.qq}if($('scAuditLog')){$('scAuditLog').disabled=!dev;var auditLabel=$('scAuditLog').closest('label');if(auditLabel)auditLabel.classList.toggle('hidden',!dev)}if($('pfAuditWrap'))$('pfAuditWrap').classList.toggle('hidden',!dev);if($('rvSave'))$('rvSave').disabled=!management;if($('opsManagementSettings'))$('opsManagementSettings').classList.toggle('hidden',!management);updatePortalAdvancedUi();syncDashboardActions();refreshSidebarGroupVisibility()}
async function loadAiDecisions(){var p=new URLSearchParams({q:$('aiLogSearch').value||'',decision:$('aiLogDecision').value||'',triggerType:$('aiLogTrigger').value||'',limit:'500'});var r=await api('/ai-decisions?'+p.toString());if(!r.ok){$('aiDecisionList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('aiDecisionList').innerHTML=(r.logs||[]).map(function(x){var title=(x.decision||'unknown')+'｜'+(x.senderName||x.userId||'')+'（'+(x.userId||'')+'）';var meta=(x.at||'')+'｜觸發 '+(x.triggerType||'none')+'｜原因 '+(x.reason||'')+'｜'+(x.provider||'')+((x.model)?'/'+x.model:'')+'｜發送 '+(x.sendStatus||'');var body='來源訊息：'+(x.input||'')+(x.generatedReply?'\nAI 回覆：'+x.generatedReply:'')+'\n關係：'+JSON.stringify({mentionedQqs:x.mentionedQqs||[],quotedMessageId:x.quotedMessageId||'',quotedSenderId:x.quotedSenderId||''})+'\n智能 @ 規劃：'+JSON.stringify(x.mentionRouting||{})+'\n回覆計畫：'+JSON.stringify(x.replyPlan||{})+'\n是否搜索：'+(x.searchPerformed?'有':'無')+'（需要='+(x.searchRequired?'是':'否')+'，嘗試='+(x.searchAttempted?'是':'否')+'）'+'\n搜索查詢：'+(x.searchQuery||'')+'\n搜索關鍵詞：'+JSON.stringify(x.searchQueries||[])+'\n搜索提供者：'+(x.searchProvider||'')+((x.searchModel)?'/'+x.searchModel:'')+'\n搜索錯誤：'+(x.searchError||'')+'\n搜索內容：'+(x.searchContext||'')+'\n搜索來源：'+JSON.stringify(x.searchSources||[])+'\n上下文：原文 '+(x.contextExactMessages||0)+'／摘要 '+(x.contextSummarizedMessages||0)+'／提供者 '+(x.contextSummaryProvider||'');return '<div class="item"><div class="item-title">'+esc(title)+'</div><div class="item-meta">'+esc(meta)+'</div><div class="item-body" style="white-space:pre-wrap">'+esc(body)+'</div></div>'}).join('')||'<div class="empty">沒有符合的紀錄</div>'}
var ruleCategoryPolicies=[];var progressiveSteps=[];
function rulePolicyActionText(v){return({record:'仅记录',remind:'友善提醒（不累计）',warn:'正式警告（不累计）',recall:'撤回违规消息',mute:'固定禁言（不累计）',progressive:'使用本群累进规则',kick:'直接踢出',manual:'人工复核'})[v]||v}
function rulePolicyActionsText(list,fallback){var a=Array.isArray(list)&&list.length?list:[{action:fallback||'manual'}];return a.map(function(x){return rulePolicyActionText(x.action||x.punishment||x)+(String(x.action||x.punishment||x)==='mute'&&Number(x.muteSeconds||0)?' '+Number(x.muteSeconds)+' 秒':'')}).join('＋')}
function ruleStrictnessText(v){return({smart:'智慧',loose:'宽松',low:'低',medium:'中',high:'高',strict:'严格'})[v]||v}
function ruleActionText(v){return({record_only:'仅记录',remind:'已友善提醒',warn:'已警告，不累计',progressive_warn:'已警告并计入累计',recall:'已撤回违规消息',progressive_recall:'已撤回并计入累计',mute:'已禁言，不累计',progressive_mute:'已禁言并计入累计',kick:'已踢出',manual_review:'等待人工复核',cooldown:'冷却中',none:'未处理'})[v]||v}
function rulePolicyActionOptions(){return '<option value="record">仅记录</option><option value="remind">友善提醒（不累计）</option><option value="warn">正式警告（不累计）</option><option value="recall">撤回违规消息</option><option value="mute">固定禁言（不累计）</option><option value="progressive">使用本群累进规则</option><option value="kick">直接踢出</option><option value="manual">人工复核</option>'}
function normalizeClientRuleActions(p){var a=Array.isArray(p.actions)&&p.actions.length?p.actions:[{action:p.punishment||'manual',muteSeconds:Number(p.muteSeconds||0)}];return a.slice(0,8).map(function(x){return{action:x.action||x.punishment||'manual',muteSeconds:Number(x.muteSeconds||0)}})}
function renderRulePolicyRows(){var box=$('rvPolicyList');if(!box)return;ruleCategoryPolicies.forEach(function(p){p.actions=normalizeClientRuleActions(p)});box.innerHTML=ruleCategoryPolicies.map(function(p,i){var actionRows=p.actions.map(function(a,j){return '<div class="row" style="margin-top:8px"><select class="rvPolicyAction" data-i="'+i+'" data-a="'+j+'">'+rulePolicyActionOptions()+'</select><input class="rvPolicyActionMute" data-i="'+i+'" data-a="'+j+'" type="number" min="0" value="'+esc(Number(a.muteSeconds||0))+'" placeholder="禁言秒数"><button class="btn danger rvPolicyActionDelete" data-i="'+i+'" data-a="'+j+'" '+(p.actions.length<=1?'disabled':'')+'>删除动作</button></div>'}).join('');return '<div class="item"><div class="row"><input class="grow rvPolicyName" data-i="'+i+'" value="'+esc(p.name||'')+'" placeholder="分类名称"><button class="btn rvPolicyActionAdd" data-i="'+i+'">增加动作</button><button class="btn danger rvPolicyDelete" data-i="'+i+'">删除分类</button></div><div class="field"><label>动作（按顺序执行，可同时撤回＋禁言等）</label>'+actionRows+'</div><div class="field"><label>分类备注（AI 判断时优先遵守）</label><textarea class="rvPolicyNote" data-i="'+i+'" placeholder="说明哪些情况算违规、哪些玩笑、测试、误发或轻微情况需要排除；误判复核说明会自动追加到这里">'+esc(p.note||'')+'</textarea></div></div>'}).join('')||'<div class="empty">暂无分类</div>';box.querySelectorAll('.rvPolicyAction').forEach(function(el){el.value=ruleCategoryPolicies[Number(el.dataset.i)].actions[Number(el.dataset.a)].action||'manual';el.onchange=function(){ruleCategoryPolicies[Number(this.dataset.i)].actions[Number(this.dataset.a)].action=this.value}});box.querySelectorAll('.rvPolicyActionMute').forEach(function(el){el.oninput=function(){ruleCategoryPolicies[Number(this.dataset.i)].actions[Number(this.dataset.a)].muteSeconds=Math.max(0,Number(this.value||0))}});box.querySelectorAll('.rvPolicyActionAdd').forEach(function(el){el.onclick=function(){var p=ruleCategoryPolicies[Number(this.dataset.i)];if(p.actions.length>=8){toast('每个分类最多 8 个动作');return}p.actions.push({action:'remind',muteSeconds:0});renderRulePolicyRows()}});box.querySelectorAll('.rvPolicyActionDelete').forEach(function(el){el.onclick=function(){var p=ruleCategoryPolicies[Number(this.dataset.i)];p.actions.splice(Number(this.dataset.a),1);if(!p.actions.length)p.actions.push({action:'manual',muteSeconds:0});renderRulePolicyRows()}});box.querySelectorAll('.rvPolicyDelete').forEach(function(el){el.onclick=function(){ruleCategoryPolicies.splice(Number(this.dataset.i),1);renderRulePolicyRows()}})}
function collectRulePolicies(){var rows=[];document.querySelectorAll('.rvPolicyName').forEach(function(el){var i=Number(el.dataset.i),name=el.value.trim();if(!name)return;var note=document.querySelector('.rvPolicyNote[data-i="'+i+'"]'),actions=normalizeClientRuleActions(ruleCategoryPolicies[i]);rows.push({name:name,punishment:(actions[0]||{}).action||'manual',actions:actions,note:note?note.value.trim():''})});return rows}
function addRulePolicyRow(){ruleCategoryPolicies.push({name:'新分类',punishment:'remind',actions:[{action:'remind',muteSeconds:0}],note:''});renderRulePolicyRows()}
function progressiveActionOptions(){return '<option value="remind">提醒</option><option value="warn">警告</option><option value="recall">撤回违规消息</option><option value="mute">禁言</option><option value="kick">踢出</option><option value="manual">人工复核</option>'}
function normalizeProgressiveClientAction(x){x=x&&typeof x==='object'?x:{action:x};var action=['remind','warn','recall','mute','kick','manual'].includes(String(x.action||''))?String(x.action):'warn';return{action:action,muteSeconds:Math.max(0,Number(x.muteSeconds||0))}}
function normalizeProgressiveClientStep(x){x=x||{};var source=Array.isArray(x.actions)&&x.actions.length?x.actions:[{action:x.action||'warn',muteSeconds:Number(x.muteSeconds||0)}];var actions=source.slice(0,8).map(normalizeProgressiveClientAction);return{action:actions[0].action,muteSeconds:actions[0].muteSeconds,actions:actions}}
function renderProgressiveSteps(){var box=$('rvProgressiveSteps');if(!box)return;progressiveSteps=progressiveSteps.map(normalizeProgressiveClientStep);box.innerHTML=progressiveSteps.map(function(step,i){var rows=step.actions.map(function(spec,j){var muteDisabled=spec.action==='mute'?'':' disabled';return '<div class="progressive-action-row"><div class="field"><label>动作 '+(j+1)+'</label><input value="'+(j+1)+'" disabled></div><div class="field"><label>处罚动作</label><select class="rvStepAction" data-si="'+i+'" data-ai="'+j+'">'+progressiveActionOptions()+'</select></div><div class="field"><label>禁言秒数（仅禁言）</label><input class="rvStepMute" data-si="'+i+'" data-ai="'+j+'" type="number" min="0" value="'+esc(Number(spec.muteSeconds||0))+'"'+muteDisabled+'></div><button class="btn danger rvStepActionDelete" data-si="'+i+'" data-ai="'+j+'" '+(step.actions.length<=1?'disabled':'')+'>删除动作</button></div>'}).join('');return '<div class="progressive-step"><div class="progressive-step-head"><div class="progressive-step-title">第 '+(i+1)+' 次'+(i===progressiveSteps.length-1?'及以后':'')+'</div><div class="row"><button class="btn rvStepActionAdd" data-si="'+i+'" '+(step.actions.length>=8?'disabled':'')+'>增加动作</button><button class="btn danger rvStepDelete" data-i="'+i+'" '+(progressiveSteps.length<=1?'disabled':'')+'>删除次数</button></div></div><div class="progressive-step-actions">'+rows+'</div></div>'}).join('');box.querySelectorAll('.rvStepAction').forEach(function(el){var si=Number(el.dataset.si),ai=Number(el.dataset.ai);el.value=progressiveSteps[si].actions[ai].action||'warn';el.onchange=function(){var s=Number(this.dataset.si),a=Number(this.dataset.ai);progressiveSteps[s].actions[a].action=this.value;if(this.value!=='mute')progressiveSteps[s].actions[a].muteSeconds=0;progressiveSteps[s].action=progressiveSteps[s].actions[0].action;progressiveSteps[s].muteSeconds=progressiveSteps[s].actions[0].muteSeconds;renderProgressiveSteps()}});box.querySelectorAll('.rvStepMute').forEach(function(el){el.oninput=function(){var s=Number(this.dataset.si),a=Number(this.dataset.ai);progressiveSteps[s].actions[a].muteSeconds=Math.max(0,Number(this.value||0));if(a===0)progressiveSteps[s].muteSeconds=progressiveSteps[s].actions[a].muteSeconds}});box.querySelectorAll('.rvStepActionAdd').forEach(function(el){el.onclick=function(){var s=Number(this.dataset.si);if(progressiveSteps[s].actions.length<8)progressiveSteps[s].actions.push({action:'warn',muteSeconds:0});renderProgressiveSteps()}});box.querySelectorAll('.rvStepActionDelete').forEach(function(el){el.onclick=function(){var s=Number(this.dataset.si),a=Number(this.dataset.ai);if(progressiveSteps[s].actions.length>1)progressiveSteps[s].actions.splice(a,1);progressiveSteps[s]=normalizeProgressiveClientStep(progressiveSteps[s]);renderProgressiveSteps()}});box.querySelectorAll('.rvStepDelete').forEach(function(el){el.onclick=function(){progressiveSteps.splice(Number(this.dataset.i),1);renderProgressiveSteps()}})}
function addProgressiveStep(){var last=normalizeProgressiveClientStep(progressiveSteps[progressiveSteps.length-1]||{action:'warn',muteSeconds:0});progressiveSteps.push({actions:last.actions.map(function(x){return{action:x.action,muteSeconds:Number(x.muteSeconds||0)}})});renderProgressiveSteps()}
function loadProgressivePolicy(p){p=p||{};$('rvProgressiveWindow').value=p.windowDays||7;$('rvMinorAction').value=p.minorAction||'remind';if(Array.isArray(p.steps)&&p.steps.length)progressiveSteps=p.steps.map(normalizeProgressiveClientStep);else progressiveSteps=[normalizeProgressiveClientStep({action:p.firstAction||'mute',muteSeconds:Number(p.firstMuteSeconds||60)}),normalizeProgressiveClientStep({action:p.secondAction||'mute',muteSeconds:Number(p.secondMuteSeconds||600)}),normalizeProgressiveClientStep({action:p.thirdAction||'kick',muteSeconds:Number(p.thirdMuteSeconds||0)})];renderProgressiveSteps()}
function collectProgressivePolicy(){progressiveSteps=progressiveSteps.map(normalizeProgressiveClientStep);return{windowDays:$('rvProgressiveWindow').value,minorAction:$('rvMinorAction').value,steps:progressiveSteps.slice(0,20).map(function(step){return{action:step.actions[0].action,muteSeconds:Number(step.actions[0].muteSeconds||0),actions:step.actions.slice(0,8).map(function(x){return{action:x.action,muteSeconds:Number(x.muteSeconds||0)}})}})}}
async function loadRuleViolations(){var p=new URLSearchParams({member:$('rvMember').value||'',content:$('rvContent').value||'',type:$('rvType').value||''});var r=await api('/rule-violations?'+p.toString());if(!r.ok){$('rvList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('rvStrictness').value=r.settings.strictness||'medium';$('rvProxyMode').value=r.settings.proxyMode||'record';$('rvMuteSeconds').value=r.settings.muteSeconds||600;$('rvKickAuth').checked=!!r.settings.kickAuthorized;loadProgressivePolicy(r.settings.progressivePolicy);var ownerControls=!!r.settings.canOwnerControls;$('rvKickAuth').disabled=!ownerControls;var autoOption=Array.from($('rvProxyMode').options).find(function(o){return o.value==='auto'});if(autoOption)autoOption.disabled=!ownerControls;ruleCategoryPolicies=(r.settings.categoryPolicies||[]).map(function(x){return{name:x.name||'',punishment:x.punishment||'manual',actions:Array.isArray(x.actions)?x.actions:[],note:x.note||''}});renderRulePolicyRows();var selected=$('rvType').value;$('rvType').innerHTML='<option value="">全部违规项目</option>'+(r.violationTypes||[]).map(function(x){return'<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');$('rvType').value=selected;var canFeedback=!!((session&&session.permissions||{}).aiAdmin||(session&&session.permissions||{}).nativeAdmin||(session&&session.permissions||{}).developer||['admin','owner'].includes((session&&session.role)||''));$('rvList').innerHTML=(r.items||[]).map(function(x){var links=(x.urlInspections||[]).map(function(u){return esc(u.hostname||u.url||'链接')+(u.title?'｜'+esc(u.title):'')+(u.ok===false?'（检查失败）':'')}).join('<br>');var verdict=x.humanVerdict==='violation'?'<span class="status ok">人工确认违规</span>':x.humanVerdict==='violation_additional'?'<span class="status warning">人工确认并追加处分</span>':x.humanVerdict==='not_violation'?'<span class="status error">人工判定误判</span>':'';var reviewButtons=canFeedback&&!x.humanVerdict?'<button class="btn primary rvFeedback" data-id="'+esc(x.id)+'" data-verdict="violation">有违规</button><button class="btn danger rvFeedback" data-id="'+esc(x.id)+'" data-verdict="not_violation">无违规（撤销处罚）</button>':'';var additionalButton=canFeedback&&x.humanVerdict!=='not_violation'?'<button class="btn warning rvFeedback" data-id="'+esc(x.id)+'" data-verdict="violation_additional">有违规（追加处分）</button>':'';var actions=(reviewButtons||additionalButton)?'<div class="row" style="margin-top:12px">'+reviewButtons+additionalButton+'</div>':'';return '<div class="item"><div class="item-head"><div><div class="item-title">'+esc(x.senderName||x.userId)+'（'+esc(x.userId)+'）｜'+esc(x.violationType||'其他')+'</div><div class="item-meta">'+new Date(Number(x.createdAt||0)).toLocaleString()+'｜判断等级 '+esc(ruleStrictnessText(x.strictness||'medium'))+'｜影响程度 '+esc(ruleSeverityText(x.severity||'moderate'))+'｜置信度 '+esc(x.confidence)+'｜处理 '+esc(Array.isArray(x.actionsTaken)&&x.actionsTaken.length?x.actionsTaken.map(ruleActionText).join('＋'):ruleActionText(x.actionTaken||'none'))+(x.strikeCounted?'｜已计入累计次数':'｜未计入累计次数')+'</div></div>'+verdict+'</div><div class="item-body">'+esc(x.content)+'<br><b>分类：</b>'+esc(x.violationType||'')+'<br><b>分类动作：</b>'+esc(rulePolicyActionsText(x.policyActions,x.policyAction||'manual'))+(x.policyNote?'<br><b>分类备注：</b>'+esc(x.policyNote):'')+'<br><b>AI 原因：</b>'+esc(x.reason||'')+'<br><b>结果：</b>'+esc(x.actionResult||'')+(x.humanFeedbackNote?'<br><b>人工备注：</b>'+esc(x.humanFeedbackNote):'')+(x.reversalResult?'<br><b>撤销结果：</b>'+esc(x.reversalResult):'')+(links?'<br><b>链接检查：</b><br>'+links:'')+'</div>'+actions+'</div>'}).join('')||'<div class="empty">暂无违规记录</div>';$('rvList').querySelectorAll('.rvFeedback').forEach(function(btn){btn.onclick=function(){submitRuleFeedback(this.dataset.id,this.dataset.verdict)}})}
function parseRuleAdditionalActions(value){return String(value||'').split(/[,，、+＋;；\n]+/).map(function(x){x=x.trim();if(!x)return null;var lower=x.toLowerCase(),action='';if(/撤回|recall/.test(lower))action='recall';else if(/禁言|mute/.test(lower))action='mute';else if(/踢出|移出|kick/.test(lower))action='kick';else if(/警告|warn/.test(lower))action='warn';else if(/提醒|remind/.test(lower))action='remind';if(!action)return null;var n=Number((x.match(/\d+(?:\.\d+)?/)||[])[0]||0),seconds=0;if(action==='mute'){if(/天/.test(x))seconds=n*86400;else if(/小时|小時|时|時/.test(x))seconds=n*3600;else if(/分/.test(x))seconds=n*60;else seconds=n||600}return{action:action,muteSeconds:Math.max(0,Math.round(seconds))}}).filter(Boolean).slice(0,8)}
async function submitRuleFeedback(id,verdict){var additional=verdict==='violation_additional';var prompt=verdict==='not_violation'?'请说明为什么这是误判。系统会撤销可撤销处罚，并把你的原话自动追加到对应“分类备注”，供 AI 后续优先遵守。':additional?'请填写追加处分原因；该原因会写入永久复核记录。':'确认存在违规。可以填写分类调整、语境或判断备注。';var title=verdict==='not_violation'?'标记为误判':additional?'有违规（追加处分）':'确认违规';var note=await textModal(prompt,'',title,{placeholder:'请输入复核说明或追加处分原因'});if(note===null)return;note=String(note||'').trim();if((verdict==='not_violation'||additional)&&!note){toast(additional?'追加处分时必须填写原因':'标记为误判时必须填写复核说明');return}var actions=[];if(additional){var raw=await textModal('输入一个或多个动作，以逗号分隔。示例：撤回, 禁言10分钟；也支持警告、提醒、踢出。踢出仅群主或开发者可确认。','撤回, 禁言10分钟','追加处分动作',{required:true,requiredMessage:'请输入至少一个动作'});if(raw===null)return;actions=parseRuleAdditionalActions(raw);if(!actions.length){toast('没有识别到可执行动作');return}if(!(await confirmModal('将按顺序执行：'+actions.map(function(x){return rulePolicyActionText(x.action)+(x.action==='mute'?' '+x.muteSeconds+' 秒':'')}).join('＋')+'。确定继续吗？','确认追加处分',{danger:true,okText:'执行追加处分'})))return}if(verdict==='not_violation'&&!(await confirmModal('确定标记为误判、撤销目前可以自动撤销的处罚，并把复核说明写入分类备注吗？','撤销错误处罚',{danger:true,okText:'确认撤销'})))return;var r=await api('/rule-violations/feedback','POST',{id:id,verdict:verdict,note:note,actions:actions});toast(r.message||'处理完成');if(r.ok)loadRuleViolations()}
async function saveRuleViolationSettings(){var payload={strictness:$('rvStrictness').value,proxyMode:$('rvProxyMode').value,muteSeconds:$('rvMuteSeconds').value,categoryPolicies:collectRulePolicies(),progressivePolicy:collectProgressivePolicy()};if(!$('rvKickAuth').disabled)payload.kickAuthorized=$('rvKickAuth').checked;var r=await api('/rule-violations/settings','POST',payload);toast(r.message);if(r.ok)loadRuleViolations()}

async function loadSettingsCenter(){var dev=session&&(session.permissions||{}).developer;if(!currentGroup){$('scMessage').textContent='请先从右上角选择需要维护的群组。';$('scList').innerHTML='<div class="empty">尚未选择群组</div>';return}$('scMessage').textContent='正在加载设置…';$('scList').innerHTML='<div class="empty">正在读取当前群设置</div>';try{var p=new URLSearchParams();p.set('targetQq',dev?($('scTargetQq').value||session.qq):session.qq);var r=await api('/settings-center?'+p.toString());if(!r.ok){$('scMessage').textContent=r.message||'加载失败';$('scList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}if(!$('scTargetQq').value)$('scTargetQq').value=r.targetQq||session.qq;if($('scResolvedRole')){$('scResolvedRole').textContent='识别权限：'+portalRoleLabel(r.targetRole);$('scResolvedRole').className='status ok'}$('scMessage').textContent='已加载 '+(r.settings||[]).length+' 项设置；只会提交实际改动的项目。';$('scList').innerHTML='';(r.settings||[]).forEach(function(s){var d=document.createElement('div');d.className='item';var input;if(s.type==='boolean'){input=document.createElement('input');input.type='checkbox';input.checked=!!s.value}else if(s.type==='select'){input=document.createElement('select');(s.options||[]).forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=(s.optionLabels&&s.optionLabels[v])||v;input.appendChild(o)});input.value=String(s.value)}else if(s.type==='textarea'){input=document.createElement('textarea');input.value=String(s.value==null?'':s.value)}else{input=document.createElement('input');input.type=s.type==='number'?'number':'text';input.value=String(s.value==null?'':s.value);if(s.min!=null)input.min=s.min;if(s.max!=null)input.max=s.max}input.dataset.settingKey=s.key;input.dataset.initialValue=input.type==='checkbox'?String(input.checked):String(input.value);var roleText=portalRoleLabel(s.minRole);if(s.key==='rule_proxy_mode')roleText+='（auto 仅群主）';d.innerHTML='<div class="item-title">'+esc(s.label)+'</div><div class="item-meta">最低权限：'+esc(roleText)+'｜对应指令：'+esc(s.command||'无')+'</div>';d.appendChild(input);$('scList').appendChild(d)});if(!$('scList').children.length)$('scList').innerHTML='<div class="empty">当前没有可维护的设置项目</div>'}catch(e){$('scMessage').textContent='加载设置时发生错误。';$('scList').innerHTML='<div class="empty">'+esc(String(e&&e.message||e))+'</div>'}}
async function saveAllSettings(){var dev=session&&(session.permissions||{}).developer;var settings=Array.from(document.querySelectorAll('#scList [data-setting-key]')).filter(function(input){var now=input.type==='checkbox'?String(input.checked):String(input.value);return now!==String(input.dataset.initialValue)}).map(function(input){return{key:input.dataset.settingKey,value:input.type==='checkbox'?input.checked:input.value}});if(!settings.length){toast('没有检测到设置变化');return}var button=$('scSaveAll');button.disabled=true;button.textContent='保存中…';var payload={settings:settings,targetQq:dev?$('scTargetQq').value:session.qq,auditMode:dev&&$('scAuditLog').checked?'log':'silent'};var r=await api('/settings-center','POST',payload);button.disabled=false;button.textContent='保存全部设置';$('scMessage').textContent=r.message||'保存失败';toast(r.message||'保存失败');if(r.ok)loadSettingsCenter()}
async function copyPortalText(value){var text=String(value||'');if(!text)return false;try{await navigator.clipboard.writeText(text);toast('已复制');return true}catch(e){var input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();var ok=false;try{ok=document.execCommand('copy')}catch(x){}input.remove();toast(ok?'已复制':'复制失败，请手动选择地址');return ok}}
async function loadBilibili(){var r=await api('/integrations/bilibili');if(!r.ok){$('biliList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('biliList').innerHTML='';(r.connectors||[]).forEach(function(c){var d=document.createElement('div');d.className='item bili-connector';var state=c.pollState||{};var status=c.lastCheckStatus||'等待首次事件';var webhook=c.mode==='official_webhook';var next=webhook?'等待外部事件推送':(c.nextPollAt?new Date(Number(c.nextPollAt)).toLocaleString():'等待定时任务');d.innerHTML='<div class="item-title">'+esc(c.creatorName||('UID '+c.creatorId))+'</div><div class="item-meta">模式：'+(webhook?'开放平台／授权中继 Webhook':'兼容低频轮询')+'｜UID：'+esc(c.creatorId)+'｜直播：'+(c.liveNotify?'通知':'仅记录')+(c.liveAtAll?'＋@全体':'')+'｜视频：'+(c.videoNotify?'通知':'仅记录')+(c.videoAtAll?'＋@全体':'')+'</div><div class="item-body">状态：'+esc(status)+'｜当前直播：'+(state.live?'是':'否')+'｜最新视频：'+esc(state.latestVideoBvid||'尚未建立基准')+'<br>上次处理：'+esc(c.lastCheckAt?new Date(Number(c.lastCheckAt)).toLocaleString():(c.lastEventAt?new Date(Number(c.lastEventAt)).toLocaleString():'尚未处理'))+'｜下一步：'+esc(next)+(c.lastWebhookTestAt?'<br>Webhook 自检：'+(c.lastWebhookTestOk?'通过':'失败')+'｜'+esc(new Date(Number(c.lastWebhookTestAt)).toLocaleString())+(c.lastWebhookTestError?'｜'+esc(c.lastWebhookTestError):''):'')+(c.lastCheckError?'<br><b>错误：</b>'+esc(c.lastCheckError):'')+'</div>';if(webhook){var info=document.createElement('div');info.className='notice bili-webhook-box';info.style.marginTop='10px';info.innerHTML='<b>Webhook 不主动访问 B站</b><br>请将下方地址配置到哔哩哔哩开放平台，或你有权使用的事件中继。自检会验证回调密钥映射与 QQ 通知发送，但外部平台仍必须实际 POST 事件。<div class="row" style="margin-top:10px"><input class="grow" readonly value="'+esc(c.webhookUrl||'回调地址不可用')+'"><button class="btn" data-copy-webhook>复制回调地址</button><button class="btn" data-rotate-webhook>重新生成地址</button><button class="btn primary" data-webhook-self-test>Webhook 接收自检</button><button class="btn" data-switch-polling>改用兼容轮询</button></div>';d.appendChild(info);info.querySelector('[data-copy-webhook]').onclick=function(){copyPortalText(c.webhookUrl)};info.querySelector('[data-rotate-webhook]').onclick=function(){rotateBilibiliWebhook(c.id)};info.querySelector('[data-webhook-self-test]').onclick=function(){testBilibiliWebhook(c.id)};info.querySelector('[data-switch-polling]').onclick=function(){switchBilibiliMode(c.id,'automatic_polling')};}var row=document.createElement('div');row.className='row';row.style.marginTop='10px';if(!webhook){var interval=document.createElement('select');[[1800,'30 分钟'],[3600,'1 小时'],[7200,'2 小时'],[21600,'6 小时']].forEach(function(v){var o=document.createElement('option');o.value=v[0];o.textContent='每 '+v[1];interval.appendChild(o)});interval.value=String(c.pollIntervalSeconds||1800);var saveInterval=document.createElement('button');saveInterval.className='btn';saveInterval.textContent='保存检查频率';saveInterval.onclick=function(){updateBilibiliInterval(c.id,interval.value)};var check=document.createElement('button');check.className='btn primary';check.textContent='立即检查';check.onclick=function(){checkBilibiliNow(c.id)};var toWebhook=document.createElement('button');toWebhook.className='btn';toWebhook.textContent='改为 Webhook（推荐）';toWebhook.onclick=function(){switchBilibiliMode(c.id,'official_webhook')};row.append(interval,saveInterval,check,toWebhook)}var testLive=document.createElement('button');testLive.className='btn';testLive.textContent='测试发送开播通知';testLive.title='只测试发送到 QQ 群';testLive.onclick=function(){testBilibili(c.id,'live_start')};var testVideo=document.createElement('button');testVideo.className='btn';testVideo.textContent='测试发送新视频通知';testVideo.title='只测试发送到 QQ 群';testVideo.onclick=function(){testBilibili(c.id,'video_publish')};var del=document.createElement('button');del.className='btn danger';del.textContent='删除';del.onclick=async function(){if(!(await confirmModal('删除此 B站监控？','确认删除')))return;var x=await api('/integrations/bilibili','POST',{action:'delete',id:c.id});toast(x.message);if(x.ok)loadBilibili()};row.append(testLive,testVideo,del);d.appendChild(row);$('biliList').appendChild(d)});if(!$('biliList').children.length)$('biliList').innerHTML='<div class="empty">暂无 B站监控</div>'}
async function saveBilibiliConnector(){var uid=String($('biliCreatorId').value||'').replace(/\D/g,'');if(!uid){toast('请输入 B站用户 UID');return}var r=await api('/integrations/bilibili','POST',{action:'save',mode:$('biliMode').value,creatorName:$('biliCreatorName').value,creatorId:uid,pollIntervalSeconds:Number($('biliPollInterval').value||1800),liveNotify:$('biliLiveNotify').checked,liveAtAll:$('biliLiveAtAll').checked,videoNotify:$('biliVideoNotify').checked,videoAtAll:$('biliVideoAtAll').checked});toast(r.message);if(r.ok){if(r.webhookUrl){$('biliWebhookResult').innerHTML='Webhook 回调地址：<code>'+esc(r.webhookUrl)+'</code><br>请复制到你的开放平台应用或事件中继；若没有外部事件来源，请改用兼容轮询。';$('biliWebhookResult').classList.remove('hidden')}else $('biliWebhookResult').classList.add('hidden');$('biliCreatorName').value='';$('biliCreatorId').value='';loadBilibili()}}
async function rotateBilibiliWebhook(id){if(!(await confirmModal('重新生成后，旧回调地址会立即失效。','重新生成 Webhook 地址')))return;var r=await api('/integrations/bilibili','POST',{action:'rotate_webhook',id:id});toast(r.message);if(r.ok&&r.webhookUrl){await copyPortalText(r.webhookUrl);loadBilibili()}}
async function testBilibiliWebhook(id){var r=await api('/integrations/bilibili','POST',{action:'webhook_self_test',id:id});toast(r.message||'自检完成');loadBilibili()}
async function switchBilibiliMode(id,mode){var label=mode==='official_webhook'?'Webhook':'兼容轮询';if(!(await confirmModal('确定切换为'+label+'？切换后会停止原模式。','切换监控模式')))return;var r=await api('/integrations/bilibili','POST',{action:'switch_mode',id:id,mode:mode,pollIntervalSeconds:1800});toast(r.message);if(r.ok){if(r.webhookUrl)await copyPortalText(r.webhookUrl);loadBilibili()}}
async function updateBilibiliInterval(id,seconds){var r=await api('/integrations/bilibili','POST',{action:'update_interval',id:id,pollIntervalSeconds:Number(seconds)});toast(r.message);if(r.ok)loadBilibili()}
async function checkBilibiliNow(id){var r=await api('/integrations/bilibili','POST',{action:'check_now',id:id});toast(r.message);loadBilibili()}
async function testBilibili(id,eventType){var r=await api('/integrations/bilibili','POST',{action:'test',id:id,eventType:eventType});toast(r.message)}

function setNativeAdminVisibility(botIsOwner){var sel=$('opAction');if(!sel)return;Array.from(sel.options||[]).forEach(function(o){if(o.value==='set_admin'||o.value==='unset_admin'){o.hidden=!botIsOwner;o.disabled=!botIsOwner}});if(sel.selectedOptions&&sel.selectedOptions[0]&&sel.selectedOptions[0].disabled)sel.selectedIndex=0}
async function refreshCapabilities(){if(!currentGroup){setNativeAdminVisibility(false);return null}var r=await api('/capabilities');if(r&&r.ok)setNativeAdminVisibility(!!r.bot_is_owner);else setNativeAdminVisibility(false);return r}
function ensureDeveloperPermissionPanel(){if(!session||!(session.permissions||{}).developer||$('developerPermissionPanel')||!$('v-groups'))return;var grid=$('v-groups').querySelector('.grid');if(!grid)return;var card=document.createElement('div');card.id='developerPermissionPanel';card.className='card span-12';card.innerHTML='<h3>程序内 AI 管理权限</h3><p class="notice">这里授予的是使用机器人执行禁言、踢出、待确认操作等程序权限，不会把对方设为真正 QQ 管理员。</p><div class="row permission-editor"><input id="permissionQq" placeholder="目标 QQ"><select id="permissionType"><option value="ai_admin">AI 管理</option><option value="group_ops">群操作（可用 Bot 禁言等）</option></select><button id="grantPermission" class="btn primary">授予</button><button id="revokePermission" class="btn danger">撤销</button></div><div class="section-head compact permission-list-head"><div><h3>当前已授予</h3><p>显示群名片或昵称，以及对应 QQ 号。</p></div><button id="reloadProgramPermissions" class="btn">重新加载</button></div><div id="programPermissionList" class="list"><div class="empty">正在读取已授权成员</div></div>';grid.appendChild(card);$('grantPermission').onclick=function(){changeProgramPermission(true)};$('revokePermission').onclick=function(){changeProgramPermission(false)};$('reloadProgramPermissions').onclick=loadProgramPermissions;loadProgramPermissions()}
function programPermissionLabel(value){return value==='ai_admin'?'AI 管理':value==='group_ops'?'群操作（可用 Bot 禁言等）':value}
async function loadProgramPermissions(){var box=$('programPermissionList');if(!box||!currentGroup)return;box.innerHTML='<div class="empty">正在读取已授权成员</div>';var r=await api('/root/program-permissions');if(!r.ok){box.innerHTML='<div class="empty">'+esc(r.message||'无法读取权限名单')+'</div>';return}var rows=r.records||[];box.innerHTML=rows.map(function(item){var badges=(item.permissions||[]).map(function(permission){return '<span class="pill">'+esc(programPermissionLabel(permission))+'</span>'}).join('');var actions=(item.permissions||[]).map(function(permission){return '<button class="btn danger" data-program-revoke="'+esc(permission)+'" data-program-qq="'+esc(item.qq)+'">撤销 '+esc(programPermissionLabel(permission))+'</button>'}).join('');return '<div class="item permission-record"><div class="item-head"><div><div class="item-title">'+esc(item.displayName||item.qq)+'</div><div class="item-meta">QQ '+esc(item.qq)+(item.role&&item.role!=='member'?'｜'+esc(portalRoleLabel(item.role)):'')+'</div></div><div>'+badges+'</div></div><div class="row permission-record-actions">'+actions+'</div></div>'}).join('')||'<div class="empty">目前没有额外授予 AI 管理或群操作权限的成员。</div>';box.querySelectorAll('[data-program-revoke]').forEach(function(button){button.onclick=function(){changeProgramPermissionFor(button.dataset.programQq,button.dataset.programRevoke,false)}})}
async function changeProgramPermissionFor(qq,permission,enabled){qq=String(qq||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}var r=await api('/root/member','POST',{qq:qq,permission:permission,enabled:enabled});toast(r.message||'完成');if(r.ok){if($('permissionQq'))$('permissionQq').value=qq;await loadProgramPermissions()}}
async function changeProgramPermission(enabled){var qq=String($('permissionQq').value||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}await changeProgramPermissionFor(qq,$('permissionType').value,enabled)}
function ensureModelRegistryPanel(){if($('runtimeModelPanel')||!$('v-models'))return;var panel=document.createElement('div');panel.id='runtimeModelPanel';panel.className='card';panel.style.marginTop='16px';panel.innerHTML='<h3>运行时模型顺序（开发者）</h3><p class="notice">新增、删除与排序只写入 D1。wrangler 环境变量中的默认模型保持锁定，不修改源代码，并只作为后备。</p><div class="row"><select id="runtimeModelKind"><option value="chat">Gemini 聊天</option><option value="decision">Gemma 判断</option><option value="last_resort">Gemma 最后备案</option><option value="tts">TTS</option></select><input id="runtimeModelId" placeholder="模型 ID"><button id="runtimeModelAdd" class="btn primary">新增</button></div><div id="runtimeModelList" class="list" style="margin-top:12px"></div>';$('v-models').appendChild(panel);$('runtimeModelKind').onchange=loadRuntimeModels;$('runtimeModelAdd').onclick=async function(){var id=$('runtimeModelId').value.trim();if(!id){toast('请输入模型 ID');return}var r=await api('/root/model-registry','POST',{action:'add',kind:$('runtimeModelKind').value,id:id});toast(r.message||'完成');if(r.ok){$('runtimeModelId').value='';loadRuntimeModels()}}}
async function runtimeModelAction(action,id,direction,enabled){var r=await api('/root/model-registry','POST',{action:action,kind:$('runtimeModelKind').value,id:id,direction:direction,enabled:enabled});toast(r.message||'完成');if(r.ok)loadRuntimeModels()}
async function loadRuntimeModels(){if(!session||!(session.permissions||{}).developer)return;ensureModelRegistryPanel();var r=await api('/root/model-registry');if(!r.ok){$('runtimeModelList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var kind=$('runtimeModelKind').value;var state=(r.categories||{})[kind]||{custom:[],immutable:[]};var html='';(state.custom||[]).forEach(function(m){html+='<div class="item"><div class="item-head"><div><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">自定义｜'+(m.enabled?'已启用':'已停用')+'</div></div><div class="row"><button class="btn" data-act="up" data-id="'+esc(m.id)+'">上移</button><button class="btn" data-act="down" data-id="'+esc(m.id)+'">下移</button><button class="btn" data-act="toggle" data-enabled="'+(!m.enabled)+'" data-id="'+esc(m.id)+'">'+(m.enabled?'停用':'启用')+'</button><button class="btn danger" data-act="delete" data-id="'+esc(m.id)+'">删除</button></div></div></div>'});(state.immutable||[]).forEach(function(m){html+='<div class="item"><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">锁定默认后备｜不可修改</div></div>'});$('runtimeModelList').innerHTML=html||'<div class="empty">没有模型</div>';$('runtimeModelList').querySelectorAll('button[data-act]').forEach(function(b){b.onclick=function(){var a=b.dataset.act;if(a==='up'||a==='down')runtimeModelAction('move',b.dataset.id,a);else if(a==='toggle')runtimeModelAction('toggle',b.dataset.id,'',b.dataset.enabled==='true');else runtimeModelAction('delete',b.dataset.id)}})}

function ensureSearchTools(){if($('logList')&&!$('logSearch')){var wrap=document.createElement('div');wrap.className='card log-toolbar';wrap.innerHTML='<div class="row"><input id="logSearch" class="grow" placeholder="搜索“禁言”、QQ号、设置名称或错误"><select id="logCategory"><option value="">全部日志</option><option value="moderation">群管理</option><option value="settings">设置修改</option><option value="bilibili">B站监控</option><option value="permission">权限管理</option><option value="appeal">申诉处理</option><option value="system">系统任务</option><option value="error">失败与错误</option></select><button id="logSearchBtn" class="btn primary">搜索</button></div><div id="logSummary" class="notice log-summary" style="margin-top:12px">尚未加载日志。</div>';$('logList').parentNode.insertBefore(wrap,$('logList'));$('logSearchBtn').onclick=loadLogs;$('logSearch').onkeydown=function(e){if(e.key==='Enter')loadLogs()};$('logCategory').onchange=loadLogs}if($('memoryList')&&!$('vectorSearch')){var v=document.createElement('div');v.className='row';v.innerHTML='<input id="vectorSearch" placeholder="搜索群聊向量"><button id="vectorSearchBtn" class="btn">向量搜索</button><div id="vectorResults" style="width:100%"></div>';$('memoryList').parentNode.insertBefore(v,$('memoryList'));$('vectorSearchBtn').onclick=loadVectorSearch}}
async function loadVectorSearch(){var q=$('vectorSearch')?$('vectorSearch').value.trim():'';if(!q)return;var r=await api('/vector-search?q='+encodeURIComponent(q));$('vectorResults').innerHTML=r.ok?(r.results||[]).map(function(x){return '<div class="item"><div class="item-title">相关度 '+esc(Number(x.score||0).toFixed(3))+'</div><div class="item-meta">QQ '+esc(x.qq||'')+'</div><div class="item-body">'+esc(x.text||'')+'</div></div>'}).join(''):'<div class="empty">'+esc(r.message||'搜索失败')+'</div>'}

function healthStatusText(v){return({ok:'正常',warning:'警告',error:'错误',unknown:'未知',unconfigured:'未配置'})[String(v||'').toLowerCase()]||String(v||'未知')}
function humanizeHealthDetail(value){if(value==null||value==='')return '无详细信息';if(typeof value==='string')return value;var labels={connected:'已连接',sockets:'连接数',transportMode:'连接保存模式',connectionId:'连接编号',connectedAt:'连接建立时间',heartbeatAgeMs:'距离最后心跳（毫秒）',reconnectCount:'累计连接次数',closeCount:'累计关闭次数',errorCount:'累计错误次数',lastClose:'最近关闭详情',lastSocketError:'最近连接错误',recentGroupIngress:'最近各群收件诊断',pendingRpc:'等待中的 RPC',inFlightQuestions:'执行中的问题',queuedQuestions:'排队中的问题',lastHeartbeatAt:'最后心跳时间',configured:'已配置',enabled:'已启用',keys:'Key 数量',key:'使用的 Key',reachable:'可连接',model:'模型',provider:'提供者',responsePreview:'响应预览',preview:'响应预览',latencyMs:'耗时毫秒',keyPool:'Key 池',checkedAt:'检查时间',usage:'用量',attempts:'尝试记录',status:'状态',message:'消息',dimensions:'向量维度',matches:'匹配数量',lastRunAt:'上次执行时间',mode:'模式'};return Object.keys(value).map(function(k){var v=value[k];if((k==='lastHeartbeatAt'||k==='connectedAt'||k==='lastRunAt'||/At$/.test(k))&&v){try{v=new Date(Number(v)||v).toLocaleString('zh-CN',{timeZone:'Asia/Taipei'})}catch(e){}}if(typeof v==='boolean')v=v?'是':'否';else if(v&&typeof v==='object')v=JSON.stringify(v);return(labels[k]||k)+'：'+v}).join('\n')}
async function loadModelCheckCandidates(){var box=$('singleModelHealth');if(!box||!session)return;var dev=!!((session.permissions||{}).developer);box.classList.toggle('hidden',!dev);if(!dev)return;var r=await api('/health/model-candidates');if(!r.ok){$('modelCheckResult').textContent=r.message||'无法读取模型列表';return}var list=[];(r.candidates||[]).forEach(function(x){list.push(x)});$('modelCheckCandidates').innerHTML=list.map(function(x){return '<option value="'+esc(x.model||x.id||x)+'">'+esc((x.provider||'')+' '+(x.keyPool||''))+'</option>'}).join('');if(!$('modelCheckModel').value&&list.length){$('modelCheckModel').value=list[0].model||list[0].id||list[0];if(list[0].provider)$('modelCheckProvider').value=list[0].provider;if(list[0].keyPool)$('modelCheckKeyPool').value=list[0].keyPool}var m=r.limits||{};var rows=[['图片 AI 读取上限',(m.imageMiB||0)+' MiB'],['语音 AI 读取上限',(m.audioMiB||0)+' MiB'],['视频 AI 读取上限',(m.videoMiB||0)+' MiB'],['转发包数量',Number(m.forwardBundles||0).toLocaleString()],['每包转发节点',Number(m.forwardNodes||0).toLocaleString()],['转发文字',Number(m.forwardTextChars||0).toLocaleString()+' 字符'],['文件正文',m.documentMode||'仅记录元数据']];$('mediaLimitList').innerHTML=rows.map(function(x){return '<div class="media-limit-row"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>'}).join('')}
async function runSingleModelCheck(){var b=$('runModelCheck'),model=$('modelCheckModel').value.trim();if(!model){toast('请输入模型 ID');return}b.disabled=true;b.textContent='检查中…';$('modelCheckResult').textContent='正在向指定模型发送最小请求。';var r=await api('/health/model-check','POST',{provider:$('modelCheckProvider').value,model:model,keyPool:$('modelCheckKeyPool').value});b.disabled=false;b.textContent='检查此模型';$('modelCheckResult').textContent=r.ok?humanizeHealthDetail(r.result||r):String(r.message||'模型检查失败')}
function ensureConversationPager(){if($('conversationPager')||!$('conversationList'))return;var wrap=document.createElement('div');wrap.id='conversationPager';wrap.className='card';wrap.style.marginBottom='12px';wrap.innerHTML='<div class="row"><label class="row" style="gap:6px">每页<select id="conversationPageSize"><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><button id="conversationPrev" class="btn">上一页</button><span id="conversationPageStatus" class="grow muted">第 1 / 1 页</span><button id="conversationNext" class="btn">下一页</button></div>';$('conversationList').parentNode.insertBefore(wrap,$('conversationList'));$('conversationPageSize').value=String(conversationPageSize);if($('convSearch')){$('convSearch').onkeydown=function(e){if(e.key==='Enter')loadConversations(1)}}if($('convViolationOnly'))$('convViolationOnly').onchange=function(){loadConversations(1)};if($('convSearchBtn'))$('convSearchBtn').onclick=function(){loadConversations(1)};$('conversationPageSize').onchange=function(){conversationPageSize=Math.max(1,Math.min(100,Number(this.value)||20));loadConversations(1)};$('conversationPrev').onclick=function(){if(conversationPage>1)loadConversations(conversationPage-1)};$('conversationNext').onclick=function(){if(conversationPage<conversationTotalPages)loadConversations(conversationPage+1)}}
async function loadConversations(page){if(!currentGroup){$('conversationList').innerHTML='<div class="empty">请先选择群组</div>';return}ensureConversationPager();conversationPage=Math.max(1,Number(page||conversationPage)||1);var serial=++conversationRequestSerial;var p=new URLSearchParams({q:$('convSearch').value||'',page:String(conversationPage),pageSize:String(conversationPageSize)});if($('convViolationOnly').checked)p.set('violation','1');$('conversationList').innerHTML='<div class="empty">正在加载第 '+conversationPage+' 页…</div>';var r=await api('/conversations?'+p.toString());if(serial!==conversationRequestSerial)return;if(!r.ok){$('conversationList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}conversationCapabilities=r.capabilities||{recordViolation:false};var pg=r.pagination||{};conversationPage=Math.max(1,Number(pg.page||conversationPage)||1);conversationPageSize=Math.max(1,Math.min(100,Number(pg.pageSize||conversationPageSize)||20));conversationTotalPages=Math.max(1,Number(pg.totalPages||1)||1);if($('conversationPageSize'))$('conversationPageSize').value=String(conversationPageSize);if($('conversationPageStatus'))$('conversationPageStatus').textContent='第 '+conversationPage+' / '+conversationTotalPages+' 页｜共 '+Number(pg.total||0)+' 条';if($('conversationPrev'))$('conversationPrev').disabled=!pg.hasPrevious;if($('conversationNext'))$('conversationNext').disabled=!pg.hasNext;$('conversationList').innerHTML=(r.items||[]).map(renderConversationRecord).join('')||'<div class="empty">没有符合条件的群友消息</div>';$('conversationList').querySelectorAll('[data-conv-action]').forEach(function(b){b.onclick=function(){handleConversationAction(this.dataset.id,this.dataset.convAction)}});$('conversationList').querySelectorAll('[data-attachment-preview]').forEach(function(b){b.onclick=function(){openAttachmentPreview(this.dataset.attachmentPreview,this.dataset.attachmentType,this.dataset.attachmentName)}})}
function safeAttachmentUrl(value){try{var u=new URL(String(value||''),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return''}}
function attachmentTypeText(type){return({image:'图片',record:'语音',audio:'语音',video:'视频',file:'文件'})[String(type||'').toLowerCase()]||'附件'}
function conversationAttachmentProxy(x,source,index,download){var p=new URLSearchParams({id:String(x.messageId||''),source:source,index:String(index)});if(download)p.set('download','1');return'/api/portal/conversations/attachment?'+p.toString()}
function conversationAttachmentHtml(x){var rows=[];(x.media||[]).forEach(function(m,index){var type=String(m.type||'').toLowerCase(),label='['+attachmentTypeText(type)+']',name=String(m.name||m.file||''),preview=conversationAttachmentProxy(x,'media',index,false),download=conversationAttachmentProxy(x,'media',index,true);rows.push('<button type="button" class="attachment-link" data-attachment-preview="'+esc(preview)+'" data-attachment-type="'+esc(type)+'" data-attachment-name="'+esc(name||label)+'">'+esc(label)+'</button><a class="attachment-link" href="'+esc(preview)+'" target="_blank" rel="noopener noreferrer">新分页打开</a><a class="attachment-link" href="'+esc(download)+'">下载</a>')});(x.files||[]).forEach(function(f,index){var name=String(f.name||f.file||'未命名文件'),label='[文件] '+name,open=conversationAttachmentProxy(x,'files',index,false),download=conversationAttachmentProxy(x,'files',index,true);rows.push('<a class="attachment-link" href="'+esc(open)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a><a class="attachment-link" href="'+esc(download)+'">下载</a>')});return rows.length?'<div class="conversation-attachments">'+rows.join('')+'</div>':''}
function ensureAttachmentPreview(){if($('attachmentPreview'))return;var d=document.createElement('div');d.id='attachmentPreview';d.className='qqai-modal hidden';d.innerHTML='<div class="qqai-modal-card attachment-modal-card"><h3 id="attachmentPreviewTitle">查看附件</h3><div id="attachmentPreviewBody" class="attachment-preview-body"></div><div class="qqai-modal-actions"><a id="attachmentPreviewOpen" class="btn" target="_blank" rel="noopener noreferrer">在新分页打开</a><a id="attachmentPreviewDownload" class="btn">下载</a><button id="attachmentPreviewClose" class="btn primary">关闭</button></div></div>';document.body.appendChild(d);$('attachmentPreviewClose').onclick=function(){closeAttachmentPreview()};d.onclick=function(e){if(e.target===d)closeAttachmentPreview()}}
function closeAttachmentPreview(){if(!$('attachmentPreview'))return;$('attachmentPreview').classList.add('hidden');$('attachmentPreviewBody').innerHTML=''}
function attachmentDownloadVariant(url){try{var u=new URL(url,location.href);u.searchParams.set('download','1');return u.href}catch(e){return url}}
function attachmentPreviewFailure(url,type,name){var body=$('attachmentPreviewBody');body.innerHTML='<div class="attachment-error"><b>附件加载失败</b><p>QQ 图片直链可能已过期，系统已经尝试通过 NapCat 刷新。请确认 NapCat 在线后重试。</p><button id="attachmentRetry" class="btn primary">重试</button></div>';$('attachmentRetry').onclick=function(){openAttachmentPreview(url,type,name)}}
function openAttachmentPreview(url,type,name){ensureAttachmentPreview();url=safeAttachmentUrl(url);if(!url){toast('附件链接无效');return}$('attachmentPreviewTitle').textContent=name||attachmentTypeText(type);$('attachmentPreviewOpen').href=url;$('attachmentPreviewDownload').href=attachmentDownloadVariant(url);var body=$('attachmentPreviewBody'),t=String(type||'').toLowerCase();body.innerHTML='<div class="muted">正在加载附件…</div>';if(t==='image'){var img=document.createElement('img');img.alt='附件图片';img.onload=function(){body.innerHTML='';body.appendChild(img)};img.onerror=function(){attachmentPreviewFailure(url,type,name)};img.src=url}else if(t==='video'){var video=document.createElement('video');video.controls=true;video.playsInline=true;video.onloadeddata=function(){body.innerHTML='';body.appendChild(video)};video.onerror=function(){attachmentPreviewFailure(url,type,name)};video.src=url;video.load()}else if(t==='record'||t==='audio'){var audio=document.createElement('audio');audio.controls=true;audio.onloadeddata=function(){body.innerHTML='';body.appendChild(audio)};audio.onerror=function(){attachmentPreviewFailure(url,type,name)};audio.src=url;audio.load()}else body.innerHTML='<a class="attachment-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">打开附件</a>';$('attachmentPreview').classList.remove('hidden')}
function renderConversationRecord(x){var summary=[];if((x.forwardIds||[]).length)summary.push('合并转发 '+x.forwardIds.length+' 个');var badge=x.violationActive?'<span class="violation-badge">违规信息</span>':'';var status=[];if(x.essence)status.push('精华');if(x.groupTodo)status.push('群待办');if(x.recalledAt)status.push('已撤回');var detail={文件:x.files||[],媒体:x.media||[],转发:x.forwardSnapshots||[],违规:x.violation||null};var buttons='<button class="btn primary" data-conv-action="reply" data-id="'+esc(x.messageId)+'">回复</button><button class="btn" data-conv-action="set_essence" data-id="'+esc(x.messageId)+'">设为精华</button><button class="btn" data-conv-action="delete_essence" data-id="'+esc(x.messageId)+'">取消精华</button><button class="btn" data-conv-action="at_all" data-id="'+esc(x.messageId)+'">@全体成员</button><button class="btn" data-conv-action="at_owner" data-id="'+esc(x.messageId)+'">@群主</button><button class="btn" data-conv-action="pick_admins" data-id="'+esc(x.messageId)+'">选择 @管理员</button><button class="btn" data-conv-action="pick_members" data-id="'+esc(x.messageId)+'">选择 @群成员</button><button class="btn" data-conv-action="todo" data-id="'+esc(x.messageId)+'">设为群待办</button><button class="btn" data-conv-action="complete_todo" data-id="'+esc(x.messageId)+'">完成群待办</button><button class="btn" data-conv-action="cancel_todo" data-id="'+esc(x.messageId)+'">取消群待办</button><button class="btn" data-conv-action="announcement" data-id="'+esc(x.messageId)+'">设为公告</button><button class="btn" data-conv-action="refresh_forward" data-id="'+esc(x.messageId)+'" '+(!(x.forwardIds||[]).length?'disabled':'')+'>检查转发</button><button class="btn danger" data-conv-action="recall" data-id="'+esc(x.messageId)+'">撤回消息</button>'+(x.violationActive?'<button class="btn danger" data-conv-action="cancel_violation" data-id="'+esc(x.messageId)+'">取消违规</button>':(conversationCapabilities.recordViolation?'<button class="btn danger" data-conv-action="mark_violation" data-id="'+esc(x.messageId)+'">记录违规</button>':'<button class="btn" disabled title="机器人不是本群管理，群规记录已完全停用">群规记录已停用</button>'));return '<div class="item conversation-card">'+badge+'<div class="item-head"><div><div class="item-title">'+esc(x.senderName||x.userId)+'（'+esc(x.userId)+'）</div><div class="item-meta">'+esc(new Date(Number(x.createdAt||0)).toLocaleString())+'｜消息 ID '+esc(x.messageId)+(status.length?'｜'+esc(status.join('、')):'')+'</div></div></div><div class="item-body conversation-text">'+esc(x.text||'[无文字内容]')+(summary.length?'<br><span class="muted">'+esc(summary.join('｜'))+'</span>':'')+conversationAttachmentHtml(x)+'</div><details class="conversation-detail"><summary>查看附件、转发与违规详细资料</summary><pre>'+esc(JSON.stringify(detail,null,2))+'</pre></details><div class="conversation-actions">'+buttons+'</div></div>'}
async function handleConversationAction(messageId,action){if(action==='pick_admins'){return openMemberPicker(messageId,['admin'],'选择要 @ 的管理员')}if(action==='pick_members'){return openMemberPicker(messageId,['member'],'选择要 @ 的群成员')}var payload={messageId:messageId,action:action};if(['reply','at_all','at_owner','at_admins','at_members','announcement'].includes(action)){var label=action==='reply'?'回复内容':action==='announcement'?'公告内容':'提醒内容';var text=await textModal('请输入'+label+'。','',label,{required:action==='reply'||action==='at_all',requiredMessage:'请输入内容'});if(text===null)return;payload.text=text}if(action==='mark_violation'){var reason=await textModal('说明违规原因；提交后会触发当前群的违规代理流程。','', '记录违规',{required:true,requiredMessage:'请输入违规原因'});if(reason===null)return;payload.reason=reason;payload.violationType='管理员记录';payload.severity='moderate'}if(action==='cancel_violation'){var note=await textModal('取消后右上角“违规信息”会消失，并尝试撤销可撤销的处罚。','管理员复核后取消违规','取消违规');if(note===null)return;payload.note=note}if(['recall','set_essence','delete_essence','todo','complete_todo','cancel_todo','cancel_violation'].includes(action)){if(!(await confirmModal('确定执行此操作吗？','确认操作',{danger:action==='recall'||action==='cancel_violation'})))return}var r=await api('/conversations/action','POST',payload);toast(r.message||'操作完成');if(r.ok)loadConversations()}
var memberPickerEntries=[];var memberPickerSelection=new Set();
function ensureMemberPicker(){if($('memberPicker'))return;var d=document.createElement('div');d.id='memberPicker';d.className='qqai-modal hidden';d.innerHTML='<div class="qqai-modal-card"><h3 id="memberPickerTitle">选择群成员</h3><input id="memberPickerSearch" class="member-picker-search" placeholder="搜索群名片、昵称、QQ 或身份"><label class="switch"><input id="memberPickerAll" type="checkbox">一键全选当前搜索结果</label><div id="memberPickerList" class="member-picker-list"></div><div class="qqai-modal-actions" style="margin-top:14px"><button id="memberPickerCancel" class="btn">取消</button><button id="memberPickerOk" class="btn primary">继续</button></div></div>';document.body.appendChild(d)}
function renderMemberPickerList(){var q=String($('memberPickerSearch').value||'').trim().toLowerCase(),visible=memberPickerEntries.filter(function(m){return !q||[m.name,m.qq,portalRoleLabel(m.role)].join(' ').toLowerCase().includes(q)});$('memberPickerList').innerHTML=visible.map(function(m){return '<label class="member-picker-row"><input type="checkbox" value="'+esc(m.qq)+'" '+(memberPickerSelection.has(String(m.qq))?'checked':'')+'><span>'+esc(m.name||m.qq)+'</span><small>'+esc(portalRoleLabel(m.role))+'｜QQ:'+esc(m.qq)+'</small></label>'}).join('')||'<div class="empty">没有符合搜索条件的成员</div>';$('memberPickerList').querySelectorAll('input[type=checkbox]').forEach(function(c){c.onchange=function(){if(this.checked)memberPickerSelection.add(String(this.value));else memberPickerSelection.delete(String(this.value));syncMemberPickerAll()}});syncMemberPickerAll()}
function syncMemberPickerAll(){var boxes=Array.from($('memberPickerList').querySelectorAll('input[type=checkbox]'));$('memberPickerAll').checked=boxes.length>0&&boxes.every(function(c){return c.checked});$('memberPickerAll').indeterminate=boxes.some(function(c){return c.checked})&&!$('memberPickerAll').checked}
async function openMemberPicker(messageId,roles,title){ensureMemberPicker();var r=await api('/group-members');if(!r.ok){toast(r.message);return}var roleSet=new Set(roles||[]);memberPickerEntries=(r.members||[]).filter(function(m){return roleSet.has(String(m.role||'member'))&&!m.isRobot}).map(function(m){return{qq:String(m.qq||m.user_id||''),name:String(m.name||m.card||m.nickname||m.qq||''),role:String(m.role||'member')}}).filter(function(m){return m.qq});memberPickerSelection=new Set();$('memberPickerTitle').textContent=title||'选择群成员';$('memberPickerSearch').value='';$('memberPicker').classList.remove('hidden');renderMemberPickerList();$('memberPickerSearch').oninput=renderMemberPickerList;$('memberPickerAll').onchange=function(){var checked=this.checked;$('memberPickerList').querySelectorAll('input[type=checkbox]').forEach(function(c){c.checked=checked;if(checked)memberPickerSelection.add(String(c.value));else memberPickerSelection.delete(String(c.value))});syncMemberPickerAll()};$('memberPickerCancel').onclick=function(){$('memberPicker').classList.add('hidden')};$('memberPickerOk').onclick=async function(){var qqs=Array.from(memberPickerSelection);if(!qqs.length){toast('请至少选择一名成员');return}var text=await textModal('请输入提醒内容。','请查看这条群消息。','提醒内容');if(text===null)return;var x=await api('/conversations/action','POST',{messageId:messageId,action:'mention_selected',qqs:qqs,text:text});$('memberPicker').classList.add('hidden');toast(x.message||'操作完成');if(x.ok)loadConversations()}}

function showLogin(){$('login').classList.remove('hidden');$('app').classList.add('hidden')}
function showApp(){$('login').classList.add('hidden');$('app').classList.remove('hidden');closeMobileSidebar();syncResponsivePortal()}
async function loadPlatformFeatures(){var q=$('pfSearch')?$('pfSearch').value:'';var r=await api('/platform/features?q='+encodeURIComponent(q));if(!r.ok){$('pfList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('pfSummary').textContent='全部功能 '+r.total+' 项；当前权限可见 '+r.visible+' 项。不同权限等级看到的内容不同，开发者可查看全部。';$('pfList').innerHTML='';(r.features||[]).forEach(function(f){var d=document.createElement('div');d.className='item';var sw=document.createElement('input');sw.type='checkbox';sw.checked=!!f.enabled;sw.onchange=async function(){var silent=$('pfAuditSilent')&&$('pfAuditSilent').checked;var x=await api('/platform/features','POST',{id:f.id,enabled:sw.checked,auditMode:silent?'silent':'log'});toast(x.message);if(!x.ok)sw.checked=!sw.checked};d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(f.id)+'｜'+esc(f.name)+'</div><div class="item-meta">类别：'+esc(f.category)+'｜实现方式：'+esc(f.mode)+'｜最低权限：'+esc(portalRoleLabel(f.minRole))+'</div></div></div>';d.appendChild(sw);$('pfList').appendChild(d)});if(!$('pfList').children.length)$('pfList').innerHTML='<div class="empty">没有符合当前权限或搜索条件的功能</div>'}
function showView(name){var view=$('v-'+name),navButton=document.querySelector('#nav button[data-view="'+name+'"]');if(!view||!navButton||navButton.hidden||navButton.style.display==='none'){toast('你的账号没有这个功能的权限。');return}document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('#nav button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===name)});expandSidebarGroupForView(name);refreshSidebarGroupVisibility();view.classList.add('active');$('pageTitle').textContent=titles[name]||name;try{history.replaceState(null,'','#'+name)}catch(e){}closeMobileSidebar();if(name==='overview')refreshOverview();if(name==='maintenance'){loadOperations();['opsRules','opsAppeal'].forEach(opsLoadWorkspace)}if(name==='health'){loadHealth('quick');loadModelCheckCandidates();loadOperations()}if(name==='tasks'){loadTasks();loadOperations();opsLoadTasks()}if(name==='collaboration'){loadOperations();opsLoadWorkspace('opsCollab')}if(name==='schedules'){loadSchedules();loadOperations()}if(name==='moderation')loadProposals();if(name==='models')loadModels();if(name==='quota')loadQuota();if(name==='groups')loadGroupSettings();if(name==='memory'){loadMemory();loadOperations();opsLoadWorkspace('opsKnowledge')}if(name==='logs')loadLogs();if(name==='aidecisions')loadAiDecisions();else if(name==='appeals')loadAppeals();else if(name==='appealreview')loadAppealReviews();if(name==='ruleviolations')loadRuleViolations();if(name==='violationhistory')loadViolationHistory();if(name==='settingscenter'){loadSettingsCenter();loadOperations()}if(name==='bilibili')loadBilibili();if(name==='platform')loadPlatformFeatures();if(name==='conversations')loadConversations()}
async function loadGroupBindings(){if(!$('familyGroupChoices'))return;var r=await api('/group-bindings');if(!r.ok){$('familyBindingMessage').textContent=r.message||'加载失败';return}var groups=r.groups||[],family=r.family||null,head=(family&&family.headGroupId)||currentGroup||'';$('familyHeadGroup').innerHTML=groups.map(function(g){return '<option value="'+esc(g.groupId)+'">'+esc(g.displayName||g.groupName||g.groupId)+'（'+esc(g.groupId)+'）</option>'}).join('');$('familyHeadGroup').value=head;$('familyDefaultGroup').innerHTML=groups.map(function(g){return '<option value="'+esc(g.groupId)+'">'+esc(g.displayName||g.groupName||g.groupId)+'（'+esc(g.groupId)+'）</option>'}).join('');$('familyDefaultGroup').value=r.defaultGroupId||currentGroup||head;$('familyHeadAlias').value=family?String(family.headAlias||''):((groups.find(function(g){return g.groupId===head})||{}).displayName||'');$('familyJoinUrl').value=family?String(family.customJoinUrl||''):'';$('familyGuideText').value=family?String(family.guideText||''):'请加入总群，以便接收完整公告、群规与活动通知。';var branchMap=new Map((family&&family.branches||[]).map(function(x){return[String(x.groupId),x]}));$('familyGroupChoices').innerHTML=groups.filter(function(g){return g.groupId!==head}).map(function(g){var b=branchMap.get(String(g.groupId));return '<div class="group-binding-row"><label><input type="checkbox" data-family-group="'+esc(g.groupId)+'" '+(b?'checked':'')+'> '+esc(g.groupName||g.groupId)+'（'+esc(g.groupId)+'）</label><input data-family-alias="'+esc(g.groupId)+'" value="'+esc(b?b.alias:(g.displayName||g.groupName||g.groupId))+'" placeholder="显示名称"><input data-family-note="'+esc(g.groupId)+'" value="'+esc(b?b.note:'')+'" placeholder="用途备注，例如：游戏分群／通知群"></div>'}).join('')||'<div class="empty">没有其他可绑定群组</div>';$('familyGuideBranch').innerHTML=(family&&family.branches||[]).map(function(b){return '<option value="'+esc(b.groupId)+'">'+esc(b.alias||b.groupId)+'（'+esc(b.groupId)+'）'+(b.note?'｜'+esc(b.note):'')+'</option>'}).join('')||'<option value="">暂无分群</option>';$('saveGroupBinding').disabled=!r.canEdit;$('familyGuideMissing').disabled=!r.canEdit||!(family&&family.branches&&family.branches.length);var direct=(family&&family.customJoinUrl)||r.generatedJoinUrl||'';$('familyJoinPreview').innerHTML=direct?'实际发送链接：<a href="'+esc(direct)+'" target="_blank" rel="noreferrer">'+esc(direct)+'</a>'+(family&&family.customJoinUrl&&r.generatedJoinUrl?'<br>系统备用引导页：<a href="'+esc(r.generatedJoinUrl)+'" target="_blank" rel="noreferrer">'+esc(r.generatedJoinUrl)+'</a>':''):'保存后会生成总群引导链接。';var roleText=family?(String(family.headGroupId)===String(currentGroup)?'当前群是总群':'当前群是分群，所属总群：'+String(family.headAlias||family.headGroupId)):'当前群尚未加入多群绑定。';$('familyBindingMessage').textContent=roleText+' '+(r.canEdit?'你可以编辑绑定并提醒未加入总群的成员。':'只有总群 QQ 管理员、群主或开发者可以修改绑定。');$('familyHeadGroup').onchange=function(){loadGroupBindingsForHeadSelection(groups,this.value)}}
function loadGroupBindingsForHeadSelection(groups,head){$('familyGroupChoices').innerHTML=groups.filter(function(g){return g.groupId!==head}).map(function(g){return '<div class="group-binding-row"><label><input type="checkbox" data-family-group="'+esc(g.groupId)+'"> '+esc(g.groupName||g.groupId)+'（'+esc(g.groupId)+'）</label><input data-family-alias="'+esc(g.groupId)+'" value="'+esc(g.displayName||g.groupName||g.groupId)+'" placeholder="显示名称"><input data-family-note="'+esc(g.groupId)+'" value="" placeholder="用途备注"></div>'}).join('')||'<div class="empty">没有其他可绑定群组</div>';var selected=groups.find(function(g){return g.groupId===head});$('familyHeadAlias').value=selected?(selected.displayName||selected.groupName||head):head}
async function saveGroupBindings(){var head=$('familyHeadGroup').value;if(!head){toast('请选择总群');return}var branches=[];$('familyGroupChoices').querySelectorAll('[data-family-group]:checked').forEach(function(c){var id=c.dataset.familyGroup,a=$('familyGroupChoices').querySelector('[data-family-alias="'+id+'"]'),n=$('familyGroupChoices').querySelector('[data-family-note="'+id+'"]');branches.push({groupId:id,alias:a?a.value:id,note:n?n.value:''})});var r=await api('/group-bindings','POST',{headGroupId:head,headAlias:$('familyHeadAlias').value,customJoinUrl:$('familyJoinUrl').value,guideText:$('familyGuideText').value,branches:branches});toast(r.message||'完成');if(r.ok){await loadGroups();await loadGroupBindings()}}
async function saveFamilyDefaultGroup(){var groupId=$('familyDefaultGroup').value;if(!groupId){toast('请选择默认群');return}var r=await api('/group-bindings/default','POST',{groupId:groupId});toast(r.message||'保存失败')}
async function guideMissingHeadMembers(){var branch=$('familyGuideBranch').value;if(!branch){toast('请选择分群');return}if(!(await confirmModal('系统会 @ 该分群中所有尚未加入总群的成员；人数不设应用内上限，并会自动分批发送。','提醒未加入总群成员')))return;var r=await api('/group-bindings/guide','POST',{branchGroupId:branch,text:$('familyGuideText').value,joinUrl:$('familyJoinUrl').value});toast(r.message||'完成')}


function scheduleStatusText(v){return({active:'执行中',pending_owner:'待开发者处理',pending_review:'审核中',cancelled:'已取消',completed:'已完成',paused:'已暂停',rejected:'已拒绝',deleted:'已删除'})[String(v||'')]||String(v||'未知')}
function scheduleTypeText(x){if(!x)return'未知';if(x.type==='once')return'单次';if(x.type==='daily')return'每天 '+(x.timeOfDay||'');if(x.type==='weekly')return'每周'+('一二三四五六日'[Math.max(0,Number(x.weekday||1)-1)]||'')+' '+(x.timeOfDay||'');if(x.type==='monthly')return'每月 '+(x.dayOfMonth||'')+' 日 '+(x.timeOfDay||'');if(x.type==='interval')return'每隔 '+Math.max(1,Math.round(Number(x.intervalMs||0)/60000))+' 分钟';return String(x.type||'未知')}
function scheduleTimeText(ms){return ms?new Date(Number(ms)).toLocaleString('zh-CN',{timeZone:'Asia/Taipei'}):'无下次执行时间'}
function renderScheduleItem(x,mode){var action='';var terminal=['cancelled','completed','rejected','paused'].includes(String(x.status||''));if(mode==='mine'){action='<button class="btn" data-schedule-edit="'+esc(x.id)+'">编辑并更新</button>';if(x.type!=='once'&&x.enabled&&x.status==='active')action+='<button class="btn" data-schedule-skip="'+esc(x.id)+'">暂停一次</button>';if(x.enabled||['pending_owner','pending_review'].includes(x.status))action+='<button class="btn danger" data-schedule-cancel="'+esc(x.id)+'">取消排程</button>';if(terminal)action+='<button class="btn danger" data-schedule-delete="'+esc(x.id)+'">永久删除</button>'}if(mode==='review'&&['pending_review','pending_owner'].includes(x.status))action='<button class="btn primary" data-schedule-vote="approve" data-id="'+esc(x.id)+'">通过</button><button class="btn danger" data-schedule-vote="reject" data-id="'+esc(x.id)+'">拒绝</button>';if(mode==='root'){action='<button class="btn" data-schedule-root="edit" data-id="'+esc(x.id)+'">编辑并更新</button><button class="btn" data-schedule-root="rereview" data-id="'+esc(x.id)+'">重新 AI 审查</button>';if(x.type!=='once'&&x.enabled&&x.status==='active')action+='<button class="btn" data-schedule-root="skip_once" data-id="'+esc(x.id)+'">暂停一次</button>';if(['pending_owner','pending_review'].includes(x.status))action+='<button class="btn primary" data-schedule-root="approve" data-id="'+esc(x.id)+'">开发者通过</button><button class="btn danger" data-schedule-root="reject" data-id="'+esc(x.id)+'">开发者拒绝</button><button class="btn" data-schedule-root="assign" data-id="'+esc(x.id)+'">指定审核人</button>';action+='<button class="btn danger" data-schedule-root="delete" data-id="'+esc(x.id)+'">永久删除</button>'}var meta='编号：'+esc(x.id)+'｜'+esc(scheduleStatusText(x.status))+'｜'+esc(scheduleTypeText(x))+'｜下次：'+esc(scheduleTimeText(x.nextRunAt));if(x.creatorName||x.creatorId)meta+='｜建立者：'+esc(x.creatorName||x.creatorId)+'（'+esc(x.creatorId||'')+'）';var extra='';if(x.skipNextRun)extra+='<br><b>下一次执行将跳过，之后自动恢复。</b>';if(x.lastSkippedAt)extra+='<br>上次跳过：'+esc(new Date(x.lastSkippedAt).toLocaleString());if(x.lastRunAt)extra+='<br>上次执行：'+esc(new Date(x.lastRunAt).toLocaleString())+'｜结果：'+esc(x.lastResult||'成功');if(x.review&&x.review.reason){var provider=x.review.provider?String(x.review.provider).replace(/^./,function(v){return v.toUpperCase()}):'AI';extra+='<br>'+esc(provider)+' 审查：'+esc(x.review.decision||'')+'｜'+esc(x.review.reason)+(x.review.model?'｜模型：'+esc(x.review.model):'')}if(x.reviewedAgainAt)extra+='<br>开发者重新审查：'+esc(new Date(Number(x.reviewedAgainAt)).toLocaleString());return '<div class="item"><div class="item-head"><div><div class="item-title">'+esc(x.content||'无内容')+'</div><div class="item-meta">'+meta+'</div></div><span class="status">'+esc(scheduleStatusText(x.status))+'</span></div><div class="item-body">时区：'+esc(x.timezone||'Asia/Taipei')+extra+'</div>'+(action?'<div class="row" style="margin-top:10px">'+action+'</div>':'')+'</div>'}
async function createScheduleFromPortal(){if(!currentGroup){toast('请先选择群组');return}var text=String($('scheduleText').value||'').trim();if(!text){toast('请输入排程内容');return}var r=await api('/schedules','POST',{schedule:text});toast(r.message||'完成');if(r.ok){$('scheduleText').value='';loadSchedules()}}
async function cancelScheduleFromPortal(id){if(!(await confirmModal('取消后不会再执行，已发送的消息不会被撤回。','取消排程',{danger:true})))return;var r=await api('/schedules','DELETE',{id:id});toast(r.message||'完成');if(r.ok)loadSchedules()}
async function editScheduleFromPortal(id){var r=await api('/schedules');if(!r.ok)return toast(r.message||'读取失败');var x=(r.schedules||[]).find(function(v){return String(v.id)===String(id)});if(!x)return toast('找不到该排程');var spec=await textModal('编辑排程时间与内容',x.scheduleSpec||x.content||'','编辑排程',{placeholder:'例如：每天 18:00 @123456789 提醒内容'});if(spec===null)return;if(!String(spec).trim())return toast('排程内容不能为空');var y=await api('/schedules/edit','POST',{id:id,schedule:String(spec).trim()});toast(y.message||'更新失败');if(y.ok)loadSchedules()}
async function deleteScheduleFromPortal(id){if(!(await confirmModal('永久删除后无法恢复，确定继续吗？','永久删除排程',{danger:true})))return;var r=await api('/schedules/delete','POST',{id:id});toast(r.message||'删除失败');if(r.ok)loadSchedules()}
async function skipScheduleOnceFromPortal(id){if(!(await confirmModal('只跳过下一次执行，之后会自动恢复。','暂停一次')))return;var r=await api('/schedules/skip-once','POST',{id:id});toast(r.message||'操作失败');if(r.ok)loadSchedules()}
async function voteScheduleFromPortal(id,vote){var r=await api('/review/schedule','POST',{id:id,vote:vote});toast(r.message||'审核完成');if(r.ok)loadSchedules()}
async function rootScheduleAction(id,action){if(action==='assign'){var reviewers=await textModal('输入具有排程审核权限的 QQ，可用逗号或空格分隔。','', '指定排程审核人',{required:true,requiredMessage:'请输入审核人 QQ'});if(reviewers===null)return;var rule=await textModal('审核规则可输入 single、majority 或 all。','single','审核规则',{required:true});if(rule===null)return;var a=await api('/root/schedule-assign','POST',{id:id,reviewerIds:String(reviewers).split(/[,\s]+/).filter(Boolean),approvalRule:String(rule).trim()});toast(a.message||'已指派');if(a.ok)loadSchedules();return}if(action==='edit'){var all=await api('/root/schedules');var x=(all.schedules||[]).find(function(v){return String(v.id)===String(id)});var spec=await textModal('开发者可直接修改时间与内容；已完成的单次排程会据新时间重新启用。',x&&(x.scheduleSpec||x.content)||'','编辑并更新排程',{required:true});if(spec===null)return;var e=await api('/root/schedule-action','POST',{id:id,action:'edit',schedule:String(spec).trim()});toast(e.message||'更新失败');if(e.ok)loadSchedules();return}if(action==='delete'&&!(await confirmModal('永久删除此排程与其记录？','开发者永久删除',{danger:true})))return;if(action==='skip_once'&&!(await confirmModal('只暂停下一次执行，之后自动恢复。','暂停一次')))return;var r=await api('/root/schedule-action','POST',{id:id,action:action});toast(r.message||'处理完成');if(r.ok)loadSchedules()}
async function loadSchedules(){if(!$('scheduleMine'))return;if(!currentGroup){$('scheduleMine').innerHTML='<div class="empty">请先选择群组。</div>';return}var r=await api('/schedules');if(!r.ok){$('scheduleMine').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var cron=r.cron||{};$('scheduleCronState').textContent=cron.lastRunAt?'Cron 最近执行：'+new Date(Number(cron.lastRunAt)).toLocaleString()+(cron.recent?'（正常）':'（超过 5 分钟，可能未持续触发）'):(cron.message||'尚未记录 Cron 执行');$('scheduleMine').innerHTML=(r.schedules||[]).map(function(x){return renderScheduleItem(x,'mine')}).join('')||'<div class="empty">目前群没有你建立的排程</div>';$('scheduleMine').querySelectorAll('[data-schedule-cancel]').forEach(function(b){b.onclick=function(){cancelScheduleFromPortal(this.dataset.scheduleCancel)}});$('scheduleMine').querySelectorAll('[data-schedule-delete]').forEach(function(b){b.onclick=function(){deleteScheduleFromPortal(this.dataset.scheduleDelete)}});$('scheduleMine').querySelectorAll('[data-schedule-edit]').forEach(function(b){b.onclick=function(){editScheduleFromPortal(this.dataset.scheduleEdit)}});$('scheduleMine').querySelectorAll('[data-schedule-skip]').forEach(function(b){b.onclick=function(){skipScheduleOnceFromPortal(this.dataset.scheduleSkip)}});var canReview=!!(r.permissions&&r.permissions.canReview),dev=!!(r.permissions&&r.permissions.developer);$('scheduleReviewCard').classList.toggle('hidden',!canReview);$('scheduleRootCard').classList.toggle('hidden',!dev);if(canReview){var q=await api('/review/schedules');$('scheduleReviewList').innerHTML=q.ok?(q.schedules||[]).map(function(x){return renderScheduleItem(x,'review')}).join('')||'<div class="empty">没有分配给你的排程审核</div>':'<div class="empty">'+esc(q.message||'无法读取审核排程')+'</div>';$('scheduleReviewList').querySelectorAll('[data-schedule-vote]').forEach(function(b){b.onclick=function(){voteScheduleFromPortal(this.dataset.id,this.dataset.scheduleVote)}})}if(dev){var all=await api('/root/schedules');$('scheduleRootList').innerHTML=all.ok?(all.schedules||[]).map(function(x){return renderScheduleItem(x,'root')}).join('')||'<div class="empty">没有排程</div>':'<div class="empty">'+esc(all.message||'无法读取全部排程')+'</div>';$('scheduleRootList').querySelectorAll('[data-schedule-root]').forEach(function(b){b.onclick=function(){rootScheduleAction(this.dataset.id,this.dataset.scheduleRoot)}})}}

async function loadGroups(){var r=await api('/groups');if(!r.ok){toast(r.message);return false}var sel=$('groupSelect'),groups=r.groups||[];sel.innerHTML='<option value="">选择群组</option>';groups.forEach(function(g){var o=document.createElement('option');o.value=g.groupId;o.textContent=(g.displayName||g.groupName||g.groupId)+' ('+g.groupId+')';sel.appendChild(o)});if(r.selectedGroupId){sel.value=r.selectedGroupId;currentGroup=r.selectedGroupId}else if(groups.length===1){sel.value=groups[0].groupId;await selectGroup(groups[0].groupId)}else if(!groups.length){toast('没有找到你已加入且启用 QQAI 的群组；仍可使用匿名申诉与个人功能。')}return true}
async function selectGroup(id){if(!id){currentGroup='';setNativeAdminVisibility(false);refreshOverview();return}var r=await api('/select-group','POST',{groupId:id});if(!r.ok){toast(r.message);return}currentGroup=id;session=r.session;$('identity').innerHTML='<b>QQ '+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(portalRoleLabel(session.role||'member'))+'</span>';await refreshCapabilities();applyR3RoleVisibility();toast('已切换群组');refreshOverview()}
function ensureAccountSecurityPanel(){var view=$('v-settingscenter');if(!view||$('accountSecurityPanel'))return;var panel=document.createElement('div');panel.id='accountSecurityPanel';panel.className='card';panel.style.marginBottom='16px';panel.innerHTML='<div class="section-head" style="margin-bottom:12px"><div><h3>登录与双因数验证</h3><p>验证码登录永远保留；密码为可选。启用 2FA 后，密码登录还需要验证器动态码、单次备用码或 QQ 私信验证码。</p></div><button id="authSecurityReload" class="btn">刷新状态</button></div><div id="authSecurityStatus" class="notice">尚未加载。</div><div class="security-grid" style="margin-top:14px"><div class="card"><h3>设置或修改密码</h3><div class="field"><label>当前密码（首次设置可留空）</label><input id="authCurrentPassword" type="password" autocomplete="current-password"></div><div class="field"><label>新密码（至少 10 个字符）</label><input id="authNewPassword" type="password" maxlength="128" autocomplete="new-password"></div><div class="field"><label>确认新密码</label><input id="authConfirmPassword" type="password" maxlength="128" autocomplete="new-password"></div><div class="field"><label>QQ 验证码（登录超过 15 分钟或忘记当前密码时使用）</label><input id="authVerificationCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><div class="row"><button id="authSendCode" class="btn ghost">发送 QQ 验证码</button><button id="authSavePassword" class="btn primary">保存密码</button></div></div><div class="card"><h3>双因数验证（TOTP）</h3><div class="field"><label>当前密码</label><input id="auth2faPassword" type="password" autocomplete="current-password"></div><div class="row"><button id="auth2faSetup" class="btn primary">开始设置 2FA</button><button id="auth2faDisable" class="btn danger">关闭 2FA</button></div><div id="auth2faSetupArea" class="hidden"><div class="field"><label>验证器密钥</label><input id="auth2faSecret" readonly></div><div class="field"><label>otpauth URI</label><textarea id="auth2faUri" readonly></textarea></div><div class="field"><label>验证器当前六位动态码</label><input id="auth2faCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><div class="row"><button id="auth2faEnable" class="btn primary">验证并启用</button><button id="authBackupRegenerate" class="btn">重新生成备用码</button></div></div></div></div><div id="authBackupCodes" class="notice hidden backup-codes"></div>';var anchor=$('scMessage');view.insertBefore(panel,anchor||view.firstChild);$('authSecurityReload').onclick=loadAccountSecurity;$('authSendCode').onclick=sendAccountSecurityCode;$('authSavePassword').onclick=saveAccountPassword;$('auth2faSetup').onclick=setupAccount2fa;$('auth2faEnable').onclick=enableAccount2fa;$('auth2faDisable').onclick=disableAccount2fa;$('authBackupRegenerate').onclick=regenerateBackupCodes}
async function loadAccountSecurity(){if(!$('authSecurityStatus'))return;var r=await api('/security/auth-state');if(!r.ok){$('authSecurityStatus').textContent=r.message||'读取失败';return}$('authSecurityStatus').textContent='密码：'+(r.passwordSet?'已设置':'未设置')+'；双因数验证：'+(r.twoFactorEnabled?'已启用':'未启用')+(r.twoFactorEnabled?'；剩余备用码 '+Number(r.backupCodesRemaining||0)+' 组':'')+(r.encryptionReady?'':'；管理员尚未设置 PORTAL_AUTH_SECRET，暂时不能启用 2FA');$('auth2faSetup').disabled=!r.passwordSet||!r.encryptionReady||r.twoFactorEnabled;$('auth2faDisable').disabled=!r.twoFactorEnabled;$('authBackupRegenerate').disabled=!r.twoFactorEnabled;$('auth2faSetupArea').classList.toggle('hidden',!r.twoFactorEnabled)}
async function sendAccountSecurityCode(){if(!session)return;var r=await raw('/api/auth/request-code','POST',{qq:session.qq});toast(r.message||'发送失败')}
async function saveAccountPassword(){var next=$('authNewPassword').value,confirm=$('authConfirmPassword').value;if(next!==confirm){toast('两次输入的新密码不一致');return}var r=await api('/security/password','POST',{currentPassword:$('authCurrentPassword').value,newPassword:next,verificationCode:$('authVerificationCode').value});toast(r.message||'保存失败');if(r.ok){$('authCurrentPassword').value='';$('authNewPassword').value='';$('authConfirmPassword').value='';$('authVerificationCode').value='';loadAccountSecurity()}}
async function setupAccount2fa(){var r=await api('/security/2fa/setup','POST',{currentPassword:$('auth2faPassword').value});toast(r.message||'设置失败');if(!r.ok)return;$('auth2faSetupArea').classList.remove('hidden');$('auth2faSecret').value=r.secret||'';$('auth2faUri').value=r.uri||'';$('auth2faCode').focus()}
function showBackupCodes(codes,message){var box=$('authBackupCodes');box.classList.remove('hidden');box.textContent=String(message||'请保存备用码')+'\n\n'+(codes||[]).join('\n')+'\n\n每组备用码只能使用一次。关闭或刷新页面后不会再次显示原文。'}
async function enableAccount2fa(){var r=await api('/security/2fa/enable','POST',{code:$('auth2faCode').value});toast(r.message||'启用失败');if(r.ok){showBackupCodes(r.backupCodes,r.message);$('auth2faPassword').value='';$('auth2faCode').value='';loadAccountSecurity()}}
async function regenerateBackupCodes(){var code=$('auth2faCode').value;if(!code){toast('请先输入验证器当前六位动态码');return}if(!(await confirmModal('旧备用码会立即全部失效，确定重新生成吗？','重新生成备用码')))return;var r=await api('/security/2fa/backup-codes','POST',{code:code});toast(r.message||'生成失败');if(r.ok)showBackupCodes(r.backupCodes,r.message)}
async function disableAccount2fa(){var password=$('auth2faPassword').value,code=$('auth2faCode').value;if(!password||!code){toast('关闭 2FA 需要当前密码和验证器动态码');return}if(!(await confirmModal('关闭后所有备用码都会失效，确定继续吗？','关闭双因数验证')))return;var r=await api('/security/2fa/disable','POST',{currentPassword:password,code:code});toast(r.message||'关闭失败');if(r.ok){$('auth2faPassword').value='';$('auth2faCode').value='';$('auth2faSetupArea').classList.add('hidden');$('authBackupCodes').classList.add('hidden');loadAccountSecurity()}}
async function boot(attempt){attempt=Number(attempt||0);migratePortalMaintenanceV140();ensureR3Views();ensureAccountSecurityPanel();organizeSidebarNavigation();bindDashboardActions();var me=await api('/me');if(!me.ok){if(me.retryable||me.code==='SESSION_STORAGE_UNAVAILABLE'){setNativeAdminVisibility(false);$('loginNotice').textContent=me.message||'登录会话资料库暂时不可用，正在重试…';if(attempt<3){setTimeout(function(){boot(attempt+1)},500*(attempt+1));return}showLogin();return}setNativeAdminVisibility(false);showLogin();return}showApp();session=me.session;loadAccountSecurity();$('identity').innerHTML='<b>QQ '+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(portalRoleLabel(session.role||'member'))+'</span>';var loaded=await loadGroups();if(!loaded)return;await refreshCapabilities();applyR3RoleVisibility();var hash=String(location.hash||'').replace(/^#/,'');if(hash&&$('v-'+hash)){var b=document.querySelector('#nav button[data-view="'+hash+'"]');if(b&&!b.hidden&&b.style.display!=='none')showView(hash);else showView('overview')}else showView('overview')}
async function loadHealth(mode){$('healthList').innerHTML='<div class="empty">检查中…</div>';var r=await api('/health?mode='+encodeURIComponent(mode||'quick'));if(!r.checks){$('healthList').innerHTML='<div class="empty">'+esc(r.message||'检查失败')+'</div>';return}renderHealth(r)}
function renderHealth(r){$('healthSummary').innerHTML='<div class="card span-4"><div class="metric-label">正常</div><div class="metric-value">'+esc(r.counts.ok)+'</div></div><div class="card span-4"><div class="metric-label">警告</div><div class="metric-value">'+esc(r.counts.warning)+'</div></div><div class="card span-4"><div class="metric-label">错误</div><div class="metric-value">'+esc(r.counts.error)+'</div></div>';$('healthList').innerHTML=(r.checks||[]).map(function(c){var detail=c.error||humanizeHealthDetail(c.detail);return '<div class="health-card"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(healthStatusText(c.status))+'</span></div><div class="latency">耗时：'+esc(c.latencyMs)+' ms</div><div class="detail">'+esc(detail)+'</div></div>'}).join('')||'<div class="empty">没有检查项目</div>';var issues=(r.checks||[]).filter(function(c){return c.status!=='ok'});$('overviewIssues').innerHTML=issues.map(function(c){return '<div class="item"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(healthStatusText(c.status))+'</span></div><div class="item-meta">'+esc(c.error||humanizeHealthDetail(c.detail))+'</div></div>'}).join('')||'<div class="empty">所有检查项目正常</div>';$('overallStatus').className='status '+(r.ok?'ok':'error');$('overallStatus').textContent=r.ok?'系统正常':'需要处理'}
async function loadTasks(){var r=await api('/tasks');if(!r.ok){$('taskList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('mActive').textContent=r.inFlightQuestions||0;$('mQueued').textContent=r.queuedQuestions||0;$('taskStats').innerHTML='<div class="card span-6"><div class="metric-label">執行中</div><div class="metric-value">'+esc(r.inFlightQuestions||0)+'</div></div><div class="card span-6"><div class="metric-label">等待中</div><div class="metric-value">'+esc(r.queuedQuestions||0)+'</div></div>';$('taskList').innerHTML='';(r.queues||[]).forEach(function(q){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">群 '+esc(q.groupId)+'／QQ '+esc(q.userId)+'</div><div class="item-meta">執行中：'+esc(q.preview||'無')+'<br>排隊：'+esc((q.queued||[]).length)+' 題</div></div></div>';(q.queued||[]).forEach(function(x){var p=document.createElement('div');p.className='item-body';p.textContent='等待：'+x.preview;d.appendChild(p)});var b=document.createElement('button');b.className='btn danger';b.textContent='取消此使用者等待列';b.addEventListener('click',async function(){var x=await api('/tasks/cancel','POST',{groupId:q.groupId,userId:q.userId});toast(x.message||'完成');loadTasks()});d.appendChild(b);$('taskList').appendChild(d)});if(!$('taskList').children.length)$('taskList').innerHTML='<div class="empty">目前沒有執行中或等待中的問題</div>'}
function proposalState(p){if(p.status==='pending'&&Date.now()>Number(p.expiresAt||0))return'expired';return p.status||'pending'}
function proposalStatusText(v){return({pending:'待确认',executed:'已执行',failed:'失败',cancelled:'已取消',expired:'已过期'})[String(v||'')]||String(v||'未知')}
async function loadProposals(){await refreshCapabilities();var r=await api('/moderation/proposals');if(!r.ok){$('proposalList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var pending=(r.proposals||[]).filter(function(p){return proposalState(p)==='pending'});$('mProposals').textContent=pending.length;$('proposalList').innerHTML='';(r.proposals||[]).forEach(function(p){var st=proposalState(p);var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(p.id)+'｜'+esc(p.actionLabel||p.action)+'</div><div class="item-meta">提出者：'+esc((p.actorName||p.actorId)+(p.actorId&&String(p.actorName||'').indexOf(String(p.actorId))<0?'（QQ:'+p.actorId+'）':''))+'｜目标：'+esc(p.targetName||p.targetId||'全群')+'｜状态：'+esc(proposalStatusText(st))+'</div></div><span class="status '+(st==='executed'?'ok':st==='pending'?'warning':st==='failed'?'error':'')+'">'+esc(proposalStatusText(st))+'</span></div><div class="item-body">'+esc(p.sourceText||'')+(p.reason?'<br><b>原因：</b>'+esc(p.reason):'')+(p.classifierReason?'<br><b>识别依据：</b>'+esc(p.classifierReason):'')+(p.action==='mute'&&p.preventUnmute?'<br><b>防解除：</b>'+(p.allowOwnerUnmute?'开发者或群主可解除':'仅开发者可解除'):'')+(p.skipConfirmation?'<br><b>网页确认：</b>执行按钮将跳过确认视窗':'')+'</div>';if(st==='pending'){var a=document.createElement('div');a.className='row';a.style.marginTop='10px';var yes=document.createElement('button');yes.className='btn primary';yes.textContent='确认并执行';yes.onclick=async function(){if(!p.skipConfirmation&&!(await confirmModal('确定执行 '+p.id+'？','确认待执行操作')))return;var x=await api('/moderation/confirm','POST',{id:p.id});toast(x.message);loadProposals()};var no=document.createElement('button');no.className='btn danger';no.textContent='取消';no.onclick=async function(){var x=await api('/moderation/cancel','POST',{id:p.id});toast(x.message);loadProposals()};a.append(yes,no);d.appendChild(a)}$('proposalList').appendChild(d)});if(!$('proposalList').children.length)$('proposalList').innerHTML='<div class="empty">暂无待确认操作</div>'}
async function loadModels(){var r=await api('/models');if(!r.ok){$('modelList').innerHTML='<div class="empty span-12">'+esc(r.message)+'</div>';return}var routing=r.routing||{},lines=Object.keys(routing).map(function(k){var names={decision:'审查判断',chat:'聊天回答',vision:'图片理解',search:'联网搜索',contextSummary:'上下文整理',deepseekChat:'DeepSeek 聊天权限'};return '<div class="item"><div class="item-title">'+esc(names[k]||k)+'</div><div class="item-meta">'+esc(routing[k])+'</div></div>'}).join('');var dev=session&&(session.permissions||{}).developer,windows=dev?(r.deepseekEmergencyWindows||[]):[];if(dev&&windows.length){lines+='<div class="item"><div class="item-title">DeepSeek 临时开放记录（永久保留）</div><div class="item-meta">'+windows.slice(0,20).map(function(w){var start=w.startedAt?new Date(w.startedAt).toLocaleString():'未记录',end=(w.endedAt||w.expiresAt)?new Date(w.endedAt||w.expiresAt).toLocaleString():'进行中',actual=Math.round(Number(w.totalModelCallMs||0)/1000*10)/10;return esc('群 '+(w.groupId||'私聊')+'／QQ '+(w.userId||'未知')+'｜'+start+' ～ '+end+'｜调用 '+Number(w.useCount||0)+' 次｜模型实际耗时 '+actual+' 秒')}).join('<br>')+'</div></div>'}$('modelRoutingSummary').innerHTML=lines||'<div class="empty">没有路由资料</div>';$('modelList').innerHTML=(r.models||[]).map(function(m){return '<div class="card span-4"><div class="item-head"><div><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">'+esc(m.provider)+'／'+esc(m.family)+(m.billing?'／'+esc(m.billing):'')+'</div></div><span class="status '+statusClass(m.status)+'">'+esc(m.statusLabel||m.status)+'</span></div><div style="margin-top:10px">'+(m.capabilities||[]).map(function(x){return'<span class="pill">'+esc(x)+'</span>'}).join('')+'</div></div>'}).join('')||'<div class="empty span-12">没有模型</div>';if(dev){ensureModelRegistryPanel();loadRuntimeModels()}}
async function loadQuota(){var r=await api('/root/quotas');if(!r.ok){$('quotaStatus').textContent=r.message;$('globalQuota').disabled=true;$('groupQuota').disabled=true;$('saveQuota').disabled=true;return}$('globalQuota').disabled=false;$('groupQuota').disabled=false;$('saveQuota').disabled=false;$('globalQuota').value=r.globalDailyCny||'';$('groupQuota').value=r.groupDailyCny||'';$('quotaStatus').textContent='全站：'+(r.globalDailyCny===''?'無限制':r.globalDailyCny+' CNY／日')+'；目前群：'+(r.groupDailyCny===''?'無限制':r.groupDailyCny+' CNY／日')}
async function loadGroupSettings(){ensureGroupSettingsExtras();var r=await api('/admin/state');if(!r.ok){toast(r.message);return}$('groupAi').checked=!!r.ai_on;$('groupMemory').checked=!!r.memory_on;$('activeSpeaking').checked=!!r.active_speaking;var as=r.active_speaking_status||{};if($('activeSpeakingStatus')){var last=as.lastResult||{};$('activeSpeakingStatus').innerHTML='<b>状态：</b>'+(as.enabled?'已开启':'已关闭')+'｜今日自动发话 '+esc(as.todayCount||0)+' 次'+(last.at?'<br>最近结果：'+(last.ok?'成功':'失败')+'｜'+esc(new Date(Number(last.at)).toLocaleString())+(last.error?'｜'+esc(last.error):''):'<br>尚无发送记录')};if($('activeSpeakingTest'))$('activeSpeakingTest').classList.toggle('hidden',!as.canTest);$('interjectRate').value=r.interject_rate;$('groupPersona').value=r.persona||'';$('groupKeywords').value=(r.keywords||[]).join('\n');$('welcomeEnabled').checked=!!r.welcome_enabled;$('joinAssistEnabled').checked=!!r.join_assist_enabled;$('joinAiApproveEnabled').checked=!!r.join_ai_approve_enabled;$('ruleMonitorEnabled').checked=!!r.rule_monitor_enabled;$('ruleMuteGuardEnabled').checked=!!r.rule_mute_guard_enabled;$('ruleSpamWindow').value=Number(r.rule_spam_window_seconds||60);$('ruleSpamThreshold').value=Number(r.rule_spam_threshold||4);$('ruleSpamKeep').value=Number(r.rule_spam_keep_count||3);$('welcomeText').value=r.welcome_text||'欢迎 {at} 加入本群 🎉 请先阅读群规，有问题可以询问管理员。';$('moderationCooldown').value=Number(r.moderation_target_cooldown_seconds||0);$('newcomerDays').value=Number(r.newcomer_observation_days||0);var canSetCommon=!!(session&&((session.permissions||{}).aiAdmin||(session.permissions||{}).developer));$('joinAssistEnabled').disabled=!canSetCommon;$('joinAiApproveEnabled').disabled=!canSetCommon;['ruleSpamWindow','ruleSpamThreshold','ruleSpamKeep'].forEach(function(id){$(id).disabled=!canSetCommon});var canMonitor=!!r.can_manage_rule_monitor;$('ruleMonitorEnabled').disabled=!canMonitor;$('ruleMonitorHint').textContent=canMonitor?'机器人与当前账号均具备所需权限，可以开关群规监控。':(r.rule_monitor_available===false?'机器人在当前群不是群主或管理员：群规监控完全停用，也不会建立记录。':'你在当前群不是 QQ 管理员或群主，暂不开放群规监控。');var owner=!!(session&&session.role==='owner'),ownerOrDeveloper=!!(session&&(owner||(session.permissions||{}).developer));['welcomeEnabled','welcomeText','moderationCooldown','newcomerDays','ruleMuteGuardEnabled'].forEach(function(id){$(id).disabled=!ownerOrDeveloper});setNativeAdminVisibility(!!r.bot_is_owner);ensureDeveloperPermissionPanel();if(session&&(session.permissions||{}).developer)await loadProgramPermissions();await loadGroupBindings()}
async function loadMemory(){var r=await api('/memories');if(!r.ok){$('memoryList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var all=(r.private||[]).map(function(x){return Object.assign({},x,{_scope:'private'})}).concat((r.public||[]).map(function(x){return Object.assign({},x,{_scope:'public'})})).filter(function(x){return x.id&&String(x.text||'').trim()});$('memoryList').innerHTML='';all.forEach(function(m){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(m.text)+'</div><div class="item-meta">'+esc(m._scope)+'｜'+esc(m.at||m.updatedAt||'')+'</div></div></div>';var row=document.createElement('div');row.className='row';var edit=document.createElement('button');edit.className='btn';edit.textContent='编辑';edit.onclick=async function(){var text=await textModal('修改记忆内容',m.text,'编辑记忆');if(text===null)return;var x=await api('/memories','PUT',{scope:m._scope,id:m.id,text:text});toast(x.message|| (x.ok?'已更新':'更新失败'));loadMemory()};var del=document.createElement('button');del.className='btn danger';del.textContent='删除';del.onclick=async function(){if(!(await confirmModal('删除这条记忆？对应的长期记忆向量也会删除。','删除记忆')))return;var x=await api('/memories','DELETE',{scope:m._scope,id:m.id});toast(x.message||'已删除');loadMemory()};row.append(edit,del);d.appendChild(row);$('memoryList').appendChild(d)});if(!$('memoryList').children.length)$('memoryList').innerHTML='<div class="empty">暂无记忆</div>';ensureSearchTools()}
function ruleSeverityText(v){return({minor:'轻微',moderate:'一般',severe:'严重',critical:'紧急'})[v]||v||'一般'}
async function syncViolationGroups(){var r=await api('/appeals/eligible-groups'),sel=$('vhGroup');if(!sel||!r.ok)return;var selected=sel.value;sel.innerHTML='<option value="">全部可申诉群组</option>';(r.groups||[]).forEach(function(g){var o=document.createElement('option');o.value=g.groupId;o.textContent=(g.groupName||g.groupId)+'（'+g.groupId+'）'+(g.former?'｜前成员资格':'');sel.appendChild(o)});sel.value=selected||currentGroup||''}
async function loadViolationHistory(){await syncViolationGroups();var group=$('vhGroup')?$('vhGroup').value:'';var r=await api('/violations/mine?groupId='+encodeURIComponent(group||''));if(!r.ok){$('vhList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('vhList').innerHTML=(r.records||[]).map(function(x){var appealed=x.appealedByUser?'<span class="status warning">已申诉 '+esc(x.userAppealId||'')+'</span>':'';var check='<input type="checkbox" class="vhCheck" value="'+esc(x.id)+'" '+(x.appealedByUser?'disabled':'')+'>';return '<div class="item"><div class="item-head"><div class="row">'+check+'<div><div class="item-title">'+esc(x.groupName||x.groupId)+'｜'+esc(x.violationType||'其他')+'</div><div class="item-meta">'+esc(new Date(Number(x.createdAt||0)).toLocaleString())+'｜程度 '+esc(ruleSeverityText(x.severity))+'｜处理 '+esc(ruleActionText(x.actionTaken||'record_only'))+'</div></div></div>'+appealed+'</div><div class="item-body">'+esc(x.content||'')+'<br><b>AI 原因：</b>'+esc(x.reason||'')+'<br><b>处理结果：</b>'+esc(x.actionResult||'仅记录')+(x.humanVerdict==='not_violation'?'<br><b>复核：</b>管理员已判定为误判并撤销可撤销处罚。':'')+'</div>'+(!x.appealedByUser?'<div class="row" style="margin-top:12px"><button class="btn vhSingleAppeal" data-id="'+esc(x.id)+'">申诉此记录</button></div>':'')+'</div>'}).join('')||'<div class="empty">没有历史违规记录</div>';$('vhList').querySelectorAll('.vhSingleAppeal').forEach(function(btn){btn.onclick=function(){appealViolationRecords([this.dataset.id])}})}
async function appealViolationRecords(ids){ids=[...new Set((ids||[]).filter(Boolean))];if(!ids.length){toast('请先选择需要申诉的记录');return}var note=await textModal('请说明为什么这些记录需要重新复核。可以补充当时语境、误会、测试情境或其他证据。','',ids.length>1?'申诉所选违规记录':'申诉违规记录');if(note===null)return;if(!String(note).trim()){toast('请填写申诉说明');return}if(!(await confirmModal('确定提交 '+ids.length+' 条违规记录的申诉吗？提交后可在“匿名申诉”查看处理状态。','确认提交申诉')))return;var r=await api('/violations/appeal','POST',{violationIds:ids,note:String(note).trim()});toast(r.message||'提交失败');if(r.ok){loadViolationHistory();loadAppeals()}}
async function syncAppealGroups(){var r=await api('/appeals/eligible-groups'),sel=$('appealGroup');if(!sel||!r.ok)return;var selected=sel.value;sel.innerHTML='<option value="">请选择群组</option>';(r.groups||[]).forEach(function(g){var o=document.createElement('option');o.value=g.groupId;o.textContent=(g.groupName||g.groupId)+' ('+g.groupId+')'+(g.former?'｜前成员，可申诉至 '+new Date(g.eligibleUntil).toLocaleDateString():'');sel.appendChild(o)});sel.value=selected||currentGroup||''}
async function loadAppeals(){await syncAppealGroups();var r=await api('/appeals/mine');if(!r.ok){$('appealList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('appealList').innerHTML=(r.appeals||[]).map(function(a){var refs=(a.violationIds||[]).length?'<br><b>关联违规记录：</b>'+esc(a.violationIds.join('、')):'';return '<div class="item"><div class="item-title">'+esc(a.id)+'｜'+esc(appealStatusText(a.status))+'</div><div class="item-meta">群 '+esc(a.groupId)+'｜'+esc(a.type)+'｜'+esc(new Date(a.createdAt).toLocaleString())+'</div><div class="item-body">'+esc(a.content)+refs+(a.result?'<br><b>处理结果：</b>'+esc(a.result):'')+'</div></div>'}).join('')||'<div class="empty">暂无案件</div>'}
async function submitAppeal(){var r=await api('/appeals/submit','POST',{groupId:$('appealGroup').value,type:$('appealType').value,evidenceMessageId:$('appealEvidence').value,content:$('appealContent').value});$('appealMessage').textContent=r.message||'提交失败';toast(r.message||'提交失败');if(r.ok){$('appealContent').value='';$('appealEvidence').value='';loadAppeals()}}
function appealStatusText(v){return({pending_owner:'待处理',pending_review:'审核中',approved:'已通过',rejected:'已驳回'})[v]||v||'待处理'}
async function loadAppealReviews(){if(!currentGroup){$('appealReviewList').innerHTML='<div class="empty">请先从右上角选择群组。</div>';return}var r=await api('/appeals/review?status='+encodeURIComponent($('appealReviewStatus').value||''));if(!r.ok){$('appealReviewList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('appealReviewList').innerHTML=(r.appeals||[]).map(function(a){var buttons=a.canDecide&&['pending_owner','pending_review'].includes(a.status)?'<div class="row" style="margin-top:12px"><button class="btn primary appealDecision" data-id="'+esc(a.id)+'" data-decision="approve">通过申诉</button><button class="btn danger appealDecision" data-id="'+esc(a.id)+'" data-decision="reject">驳回申诉</button></div>':'';return '<div class="item"><div class="item-head"><div><div class="item-title">'+esc(a.anonymousLabel||a.id)+'｜'+esc(appealStatusText(a.status))+'</div><div class="item-meta">'+esc(a.identityText||'匿名申诉人')+'｜'+esc(a.type||'其他')+'｜'+esc(a.createdAt||'')+(a.applicantMembership==='former'?'｜前成员申诉':'')+'</div></div></div><div class="item-body">'+esc(a.content||'')+(a.evidenceMessageId?'<br><b>相关消息：</b>'+esc(a.evidenceMessageId):'')+(a.result?'<br><b>处理结果：</b>'+esc(a.result):'')+(a.againstAdmin?'<br><b>注意：</b>该案件涉及管理层，只能由群主或开发者决定。':'')+'</div>'+buttons+'</div>'}).join('')||'<div class="empty">当前群没有符合条件的申诉</div>';$('appealReviewList').querySelectorAll('.appealDecision').forEach(function(btn){btn.onclick=function(){decideAppeal(this.dataset.id,this.dataset.decision)}})}
async function decideAppeal(id,decision){var note=await textModal(decision==='approve'?'请输入通过原因、需要撤销的处理或其他补救说明。':'请输入驳回原因，让申诉人知道为什么没有通过。','',decision==='approve'?'通过申诉':'驳回申诉',{placeholder:'建议填写清楚的处理说明'});if(note===null)return;if(!String(note).trim()&&!(await confirmModal('没有填写处理说明，仍要继续吗？','未填写说明')))return;var r=await api('/appeals/review','POST',{id:id,decision:decision,note:String(note||'').trim()});toast(r.message||'处理完成');if(r.ok)loadAppealReviews()}
var logTypeLabels={moderation_proposed:'已建立待确认操作',moderation_cancelled:'已取消待确认操作',moderation_confirmed:'已确认并执行操作',moderation_failed:'待确认操作执行失败',group_operation:'群管理操作成功',group_operation_failed:'群管理操作失败',portal_ai_settings:'群组 AI 设置已保存',ai_settings:'AI 设置已修改',settings_center:'设置中心已修改',bilibili_connector:'B站监控设置已修改',bilibili_auto_monitor:'B站自动监控已修改',bilibili_auto_poll:'B站自动检查',permission:'程序权限已修改',platform_feature:'功能开关已修改',rule_monitor_setting:'群规监控设置已修改',rule_proxy_setting:'AI 群规代理设置已修改',rule_strictness_setting:'群规判断严格度已修改',rule_proxy_action:'AI 群规代理已处理',rule_proxy_portal_settings:'AI 群规代理设置已保存',rule_proxy_kick_auth:'AI 踢出授权已修改',rule_manager_clarification:'群规判断已询问管理',rule_policy_human_correction:'群规分类备注已记录人工纠错',rule_violation_feedback:'群规记录已人工复核',join_reject_auth:'入群拒绝授权已修改',rate_limit_setting:'回复间隔已修改',rate_limit_portal:'回复间隔已保存',quota:'DeepSeek 额度已修改',context:'聊天上下文已处理',group_checkin:'群打卡任务',thinking_indicator_recall:'思考提示已撤回',thinking_indicator_residual:'思考提示残留',question_cancelled_by_recall:'问题因撤回取消',groupwork_requested:'已建立群务申请',groupwork_decided:'群务申请已处理',runtime_model_registry:'模型顺序已修改',platform_job:'系统任务',portal_login:'Control Center 登录',appeal_review:'申诉处理',violation_appeal_submitted:'违规记录申诉已提交',rule_violation_reversed:'群规误判已撤销',conversation_action:'对话记录操作',conversation_action_failed:'对话记录操作失败',single_model_health_check:'单一模型健康检查',schedule_skipped_once:'重复排程已跳过一次',schedule_completed:'单次排程已完成并保留',active_speaking:'主动发话状态',rule_mute_guard_setting:'违规禁言保护设置已修改',rule_mute_guard_reapplied:'违规禁言已按剩余时间恢复',rule_mute_guard_failed:'违规禁言恢复失败',rule_mute_guard_skipped:'违规禁言保护未执行',join_request_ai_approved:'AI 已同意入群申请'};
var logActionLabels={mute:'禁言',unmute:'解除禁言',kick:'踢出群聊',reject:'拒绝入群',whole_mute:'开启全员禁言',whole_unmute:'解除全员禁言',set_admin:'设为 QQ 管理员',unset_admin:'取消 QQ 管理员',recall:'撤回消息',create:'新增',update:'更新',enabled:'开启',disabled:'关闭',authorized:'已授权',revoked:'已取消授权',ai_on:'开启 AI',ai_off:'关闭 AI',checked:'检查完成',baseline_created:'建立初始状态',failed:'失败',cancelled:'已取消',commands_enabled:'设置型指令开关',interject_rate:'主动插话率',welcome_enabled:'自动欢迎新人',author_recall:'发送者撤回自己的消息',moderator_recall:'管理撤回成员消息',skip_once:'跳过下一次排程',completed_and_kept:'完成并保留',automatic_sent:'自动发话成功',automatic_failed:'自动发话失败',manual_test_sent:'主动发话测试成功',manual_test_failed:'主动发话测试失败'};
function logCategoryOf(a){var t=String(a.type||'');if(/moderation|group_operation|groupwork|rule_proxy_action|rule_manager_clarification|rule_policy_human_correction|rule_violation_feedback/.test(t))return 'moderation';if(/settings|portal_ai|ai_settings|rule_monitor|rule_proxy_setting|rule_strictness|rate_limit|quota|runtime_model|platform_feature|context/.test(t))return 'settings';if(/bilibili/.test(t))return 'bilibili';if(/conversation_action/.test(t))return 'moderation';if(/appeal/.test(t))return 'appeal';if(/permission|auth/.test(t))return 'permission';if(/failed|error/.test(t)||a.error)return 'error';return 'system'}
function logTone(a){var t=String(a.type||''),r=String(a.result||'');if(/failed|error/.test(t)||a.error||/失败|failed/i.test(r))return 'error';if(/cancelled/.test(t))return 'warn';if(/proposed|requested/.test(t))return 'info';return 'ok'}
function logStatusText(a){var type=String(a.type||''),action=String(a.action||'');if(type==='appeal_review')return action==='approve'?'已通过':'已驳回';if(type==='violation_appeal_submitted')return '待处理';var tone=logTone(a);if(tone==='error')return '失败';if(type.includes('cancelled'))return '已取消';if(type.includes('proposed'))return '待确认';return '成功'}
function logActionText(a){var raw=String(a.action||'').trim(),type=String(a.type||'');if(type==='appeal_review')return raw==='approve'?'通过申诉':raw==='reject'?'驳回申诉':'处理申诉';if(type==='violation_appeal_submitted')return '提交违规记录申诉';if(!raw)return '';if(logActionLabels[raw])return logActionLabels[raw];if(raw.indexOf(':')>0){var parts=raw.split(':');return (logActionLabels[parts[0]]||parts[0])+'：'+parts.slice(1).join(':')}return raw}
function logTimeText(v){try{var d=new Date(v);if(isNaN(d.getTime()))return String(v||'');return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)}catch(e){return String(v||'')}}
function logRoleText(){if(!session)return '用户';var p=session.permissions||{};if(p.developer||session.role==='developer')return '开发者';if(session.role==='owner')return '群主';if(session.role==='admin')return 'QQ 管理员';return '群成员'}
function logActorText(a){var id=String(a.actorId||'');if(!id)return '未知操作者';if(id==='system'||id.indexOf('system:')===0)return '系统自动任务';var role=portalRoleLabel(a.actorRole||(session&&id===String(session.qq)?session.role:'member'));var name=String(a.actorName||'').trim();return (name?name+'｜':'')+'QQ '+id+'｜'+role}
function logTargetText(a){var id=String(a.targetId||'');if(!id)return '';if(a.targetKind==='appeal'||/^app_/i.test(id))return (a.targetName?String(a.targetName)+'｜':'')+'案件 '+id;var role=a.targetRole?'｜'+portalRoleLabel(a.targetRole):'';return a.targetName&&String(a.targetName)!==id?String(a.targetName)+'（QQ '+id+'）'+role:'QQ '+id+role}
function logDurationText(v){var n=Number(v||0);if(!n)return '';if(n%3600===0)return n/3600+' 小时';if(n%60===0)return n/60+' 分钟';return n+' 秒'}
function logHumanText(a){var actor=logActorText(a),action=logActionText(a),target=logTargetText(a),type=String(a.type||'');if(type==='moderation_proposed')return actor+'建立了“'+(action||'群管理')+'”待确认操作'+(target?'，目标是 '+target:'')+'。';if(type==='moderation_cancelled')return actor+'取消了“'+(action||'群管理')+'”操作，实际没有执行。';if(type==='moderation_confirmed')return actor+'确认并执行了“'+(action||'群管理')+'”操作'+(target?'，目标是 '+target:'')+'。';if(type==='moderation_failed')return actor+'确认了“'+(action||'群管理')+'”操作，但执行失败。';if(type==='group_operation')return actor+'执行了“'+(action||'群管理')+'”'+(target?'，目标是 '+target:'')+'，执行成功。';if(type==='group_operation_failed')return actor+'尝试执行“'+(action||'群管理')+'”'+(target?'，目标是 '+target:'')+'，但执行失败。';if(type==='portal_ai_settings')return actor+'保存了当前群的 AI 设置。';if(type==='settings_center')return actor+'修改了设置中心项目：'+(action||'设置')+'。';if(type==='rule_strictness_setting')return actor+'将群规判断严格度设为“'+ruleStrictnessText(action||'medium')+'”。';if(type==='bilibili_connector'||type==='bilibili_auto_monitor')return actor+(String(a.action)==='create'?'新增':'更新')+'了 B站自动监控。';if(type==='bilibili_auto_poll')return '系统完成了一次 B站自动检查。';if(type==='permission')return actor+'修改了 '+(target||'指定用户')+' 的程序权限：'+(action||'权限')+'。';if(type==='platform_feature')return actor+(a.enabled?'开启':'关闭')+'了功能：'+String(a.featureName||a.action||'未知功能')+'。';if(type==='appeal_review')return actor+(String(a.action)==='approve'?'通过了':'驳回了')+'申诉案件 '+(target||String(a.targetId||''))+'。';if(type==='violation_appeal_submitted')return actor+'提交了违规记录申诉 '+(target||String(a.targetId||''))+'。';if(type==='rule_violation_reversed')return actor+'复核后撤销了一条错误的群规判定及可撤销处罚。';if(type==='question_cancelled_by_recall')return String(a.action)==='author_recall'?'发送者撤回了自己的提问，系统已取消尚未完成的 AI 处理。':'管理员撤回了该成员的提问，系统已取消尚未完成的 AI 处理。';if(type==='portal_ai_settings'||type==='ai_settings')return actor+'修改了 AI 设置。';return actor+'执行了“'+(action||logTypeLabels[type]||type||'操作')+'”。'}
function logFacts(a){var rows=[],target=logTargetText(a),duration=logDurationText(a.durationSeconds),type=String(a.type||'');if(target)rows.push((type==='appeal_review'||type==='violation_appeal_submitted'?'案件：':'目标：')+target);if(Array.isArray(a.violationIds)&&a.violationIds.length)rows.push('违规记录：'+a.violationIds.join('、'));if(duration)rows.push('时长：'+duration);if(a.classifierReason)rows.push('识别原因：'+String(a.classifierReason));if(a.reason)rows.push('补充原因：'+String(a.reason));if(a.proposalId)rows.push('操作编号：'+String(a.proposalId));if(a.error)rows.push('错误：'+String(a.error));else if(a.result&&String(a.result)!=='cancelled')rows.push('结果：'+String(a.result));return rows}
function renderReadableLog(a){var type=String(a.type||''),title=logTypeLabels[type]||logActionText(a)||'系统操作',tone=logTone(a),facts=logFacts(a);return '<div class="item log-card"><div class="log-card-head"><div><div class="log-card-title">'+esc(title)+'</div><div class="log-card-time">'+esc(logTimeText(a.at))+'｜'+esc(logActorText(a))+'</div></div><span class="log-badge '+tone+'">'+esc(logStatusText(a))+'</span></div><div class="log-human">'+esc(logHumanText(a))+'</div>'+(facts.length?'<div class="log-facts">'+facts.map(function(x){return '<span class="log-fact">'+esc(x)+'</span>'}).join('')+'</div>':'')+'<details class="log-details"><summary>查看技术详情</summary><pre>'+esc(JSON.stringify(a,null,2))+'</pre></details></div>'}
async function loadLogs(){ensureSearchTools();var q=$('logSearch')?$('logSearch').value.trim():'',category=$('logCategory')?$('logCategory').value:'';var r=await api('/admin/logs?q='+encodeURIComponent(q));if(!r.ok){$('logList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';if($('logSummary'))$('logSummary').textContent='加载失败：'+String(r.message||'未知错误');return}var all=r.logs||[],logs=category?all.filter(function(a){return logCategoryOf(a)===category}):all;if($('logSummary'))$('logSummary').textContent='共显示 '+logs.length+' 条日志'+(q?'，搜索内容：“'+q+'”':'')+(category?'，已按类别筛选':'')+'。时间已换算为台北时间。';$('logList').innerHTML=logs.map(renderReadableLog).join('')||'<div class="empty">没有符合条件的操作日志</div>'}
async function refreshOverview(){if(!$('mNapcat'))return;var selected=$('groupSelect')&&$('groupSelect').selectedOptions&&$('groupSelect').selectedOptions[0],groupName=selected&&selected.value?selected.textContent:'尚未选择群组';$('overviewGreeting').textContent=selected&&selected.value?groupName:'先选择一个群组';$('overviewSummary').textContent=selected&&selected.value?'这里会用简单文字告诉你机器人是否正常，以及有没有需要处理的事情。':'请从右上角选择群组；个人申诉与个人记录仍可直接使用。';var h=await api('/health?mode=quick');if(h.checks)renderHealth(h);var t=await api('/tasks'),active=0,queued=0;if(t.ok){active=Number(t.inFlightQuestions||0);queued=Number(t.queuedQuestions||0);$('mActive').textContent=active;$('mQueued').textContent=queued}var p=await api('/moderation/proposals'),pending=0;if(p.ok){pending=(p.proposals||[]).filter(function(x){return proposalState(x)==='pending'}).length;$('mProposals').textContent=pending}var doCheck=(h.checks||[]).find(function(c){return c.name==='Durable Object／NapCat'}),connected=!!(doCheck&&doCheck.status==='ok');$('mNapcat').textContent=connected?'连接正常':'连接异常';$('mNapcatSub').textContent=doCheck?(connected?'回应 '+String(doCheck.latencyMs)+' ms':'请检查 NapCat 连接'):'暂时没有连接资料';var issueCount=(h.checks||[]).filter(function(c){return c.status!=='ok'}).length;var parts=[];if(!selected||!selected.value)parts.push('尚未选择群组');if(!connected)parts.push('机器人连接需要检查');if(pending)parts.push(pending+' 项操作等待确认');if(queued)parts.push(queued+' 个问题正在排队');$('overviewSummary').textContent=parts.length?parts.join('；')+'。':groupName+' 目前运作正常，没有需要立即处理的事项。'}
var lastPortalInteractionAt=Date.now();['pointerdown','keydown','input','change','touchstart'].forEach(function(eventName){document.addEventListener(eventName,function(){lastPortalInteractionAt=Date.now()},{passive:true})});function renewPortalSession(force){if(!session||document.hidden)return;if(!force&&Date.now()-lastPortalInteractionAt>5*60*1000)return;api('/heartbeat','POST',{}).then(function(r){if(!r.ok&&r.message)console.warn('会话续期失败：'+r.message)})}var portalHeartbeatTimer=setInterval(function(){renewPortalSession(false)},4*60*1000);document.addEventListener('visibilitychange',function(){if(!document.hidden){lastPortalInteractionAt=Date.now();renewPortalSession(true)}});
function setLoginMethod(method){var password=method==='password';$('loginCodePane').classList.toggle('hidden',password);$('loginPasswordPane').classList.toggle('hidden',!password);$('loginMethodCode').classList.toggle('active',!password);$('loginMethodPassword').classList.toggle('active',password);$('loginNotice').textContent=password?'输入已设置的密码。启用 2FA 的账号还需要动态码、备用码或 QQ 验证码。':'验证码会由已连接的 NapCat 私信发送至你的 QQ。'}
async function requestLoginCode(){var qq=String($('loginQq').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){$('loginNotice').textContent='请输入正确的 QQ 号。';return}try{localStorage.setItem('qqai_last_login_qq',qq)}catch(e){}var b=$('sendCode');b.disabled=true;b.textContent='发送中…';$('loginNotice').textContent='正在通过 NapCat 发送验证码…';var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'验证码发送失败。';b.disabled=false;b.textContent=r.ok?'重新发送验证码':'发送验证码'}
async function verifyLoginCode(){var qq=String($('loginQq').value||'').replace(/\D/g,''),code=String($('loginCode').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)||!/^\d{6}$/.test(code)){$('loginNotice').textContent='请输入正确的 QQ 号和六位验证码。';return}var b=$('verifyCode');b.disabled=true;b.textContent='验证中…';var r=await raw('/api/auth/verify-code','POST',{qq:qq,code:code,remember:!$('rememberLogin')||$('rememberLogin').checked});$('loginNotice').textContent=r.message||'验证失败。';b.disabled=false;b.textContent='使用验证码登录';if(r.ok){await boot()}}
async function verifyPasswordLogin(){var qq=String($('loginQq').value||'').replace(/\D/g,''),password=$('loginPassword').value;if(!/^\d{5,12}$/.test(qq)||!password){$('loginNotice').textContent='请输入正确的 QQ 号和密码。';return}var b=$('verifyPassword');b.disabled=true;b.textContent='验证中…';var factorVisible=!$('loginFactorWrap').classList.contains('hidden');var r=await raw('/api/auth/login-password','POST',{qq:qq,password:password,remember:!$('rememberLogin')||$('rememberLogin').checked,factorType:factorVisible?$('loginFactorType').value:'',factorCode:factorVisible?$('loginFactorCode').value:''});b.disabled=false;b.textContent='使用密码登录';$('loginNotice').textContent=r.message||'登录失败。';if(r.requiresTwoFactor||r.code==='TWO_FACTOR_REQUIRED'){$('loginFactorWrap').classList.remove('hidden');$('loginFactorCode').focus();return}if(r.ok){await boot()}}
async function requestPasswordFactorCode(){var qq=String($('loginQq').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){toast('请先输入正确的 QQ 号');return}var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'验证码发送失败。';if(r.ok){$('loginFactorType').value='qq_code';$('loginFactorWrap').classList.remove('hidden')}}
try{var lastLoginQq=localStorage.getItem('qqai_last_login_qq');if(lastLoginQq)$('loginQq').value=lastLoginQq}catch(e){}$('loginMethodCode').addEventListener('click',function(){setLoginMethod('code')});$('loginMethodPassword').addEventListener('click',function(){setLoginMethod('password')});$('sendCode').addEventListener('click',requestLoginCode);$('verifyCode').addEventListener('click',verifyLoginCode);$('verifyPassword').addEventListener('click',verifyPasswordLogin);$('passwordSendFactorCode').addEventListener('click',requestPasswordFactorCode);$('loginQq').addEventListener('keydown',function(e){if(e.key==='Enter'){if($('loginPasswordPane').classList.contains('hidden'))requestLoginCode();else verifyPasswordLogin()}});$('loginCode').addEventListener('keydown',function(e){if(e.key==='Enter')verifyLoginCode()});$('loginPassword').addEventListener('keydown',function(e){if(e.key==='Enter')verifyPasswordLogin()});$('loginFactorCode').addEventListener('keydown',function(e){if(e.key==='Enter')verifyPasswordLogin()});$('loginThemeToggle').addEventListener('click',toggleTheme);$('themeToggle').addEventListener('click',toggleTheme);updateThemeButtons();
$('logout').onclick=async function(){await raw('/api/auth/logout','POST',{});location.reload()};if($('advancedToggle'))$('advancedToggle').onclick=function(){setPortalAdvanced(!portalAdvancedEnabled())};bindDashboardActions();$('menu').onclick=toggleMobileSidebar;if($('sidebarBackdrop'))$('sidebarBackdrop').onclick=closeMobileSidebar;document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMobileSidebar()});window.addEventListener('resize',syncResponsivePortal,{passive:true});syncResponsivePortal();$('refresh').onclick=function(){var active=document.querySelector('#nav button[data-view].active');showView(active?active.dataset.view:'overview')};$('groupSelect').onchange=function(){selectGroup(this.value)};document.querySelectorAll('#nav button[data-view]').forEach(function(b){b.onclick=function(){showView(b.dataset.view)}});
$('quickHealth').onclick=function(){loadHealth('quick')};$('fullHealth').onclick=function(){loadHealth('full')};$('runModelCheck').onclick=runSingleModelCheck;$('modelCheckProvider').onchange=function(){var p=this.value;$('modelCheckKeyPool').disabled=p!=='gemini'};$('reloadTasks').onclick=loadTasks;$('clearQueue').onclick=async function(){if(!currentGroup){toast('请先选择群组');return}if(!(await confirmModal('清空当前群所有等待中的问题？正在生成的问题不会被强制中断。','清空等待队列')))return;var r=await api('/tasks/clear','POST',{groupId:currentGroup});toast(r.message||'完成');loadTasks()};$('reloadProposals').onclick=loadProposals;
$('opProtect').onchange=function(){$('opOwnerUnlock').disabled=!this.checked;if(!this.checked)$('opOwnerUnlock').checked=false};$('opAction').onchange=function(){var mute=this.value==='mute';$('opProtect').disabled=!mute;$('opOwnerUnlock').disabled=!mute||!$('opProtect').checked;if(!mute){$('opProtect').checked=false;$('opOwnerUnlock').checked=false}};$('createProposal').onclick=async function(){var r=await api('/ops/action','POST',{action:$('opAction').value,qq:$('opQq').value,duration:$('opDuration').value,reason:$('opReason').value,preventUnmute:$('opProtect').checked,allowOwnerUnmute:$('opOwnerUnlock').checked,skipConfirmation:$('opSkipConfirm').checked});$('opMessage').textContent=r.message;toast(r.message);if(r.ok)loadProposals()};
$('runSimulator').onclick=async function(){var r=await api('/simulator','POST',{text:$('simText').value,senderRole:$('simRole').value,mentionsBot:$('simMention').checked,hasImage:$('simImage').checked,currentlyBusy:$('simBusy').checked});if(!r.ok){toast(r.message);return}$('simDecision').textContent=r.decisions.final;$('simSteps').innerHTML=(r.steps||[]).map(function(x){return'<div class="step"><i></i><span>'+esc(x)+'</span></div>'}).join('')};$('reloadModels').onclick=loadModels;$('saveQuota').onclick=async function(){var r=await api('/root/quotas','POST',{globalDailyCny:$('globalQuota').value,groupDailyCny:$('groupQuota').value});toast(r.message);if(r.ok)loadQuota()};
if($('activeSpeakingTest'))$('activeSpeakingTest').onclick=async function(){if(!currentGroup){toast('请先选择群组');return}var r=await api('/admin/active-speaking-test','POST',{});toast(r.message||'测试完成');loadGroupSettings()};$('saveGroup').onclick=async function(){ensureGroupSettingsExtras();var payload={ai_on:$('groupAi').checked,memory_on:$('groupMemory').checked,active_speaking:$('activeSpeaking').checked,interject_rate:$('interjectRate').value,persona:$('groupPersona').value,keywords:$('groupKeywords').value};var perms=(session&&session.permissions)||{};if(perms.aiAdmin||perms.developer){payload.join_assist_enabled=$('joinAssistEnabled').checked;payload.join_ai_approve_enabled=$('joinAiApproveEnabled').checked;payload.rule_spam_window_seconds=$('ruleSpamWindow').value;payload.rule_spam_threshold=$('ruleSpamThreshold').value;payload.rule_spam_keep_count=$('ruleSpamKeep').value;}if(!$('ruleMonitorEnabled').disabled)payload.rule_monitor_enabled=$('ruleMonitorEnabled').checked;if(session&&(session.role==='owner'||perms.developer)){payload.welcome_enabled=$('welcomeEnabled').checked;payload.welcome_text=$('welcomeText').value;payload.moderation_target_cooldown_seconds=$('moderationCooldown').value;payload.newcomer_observation_days=$('newcomerDays').value;payload.rule_mute_guard_enabled=$('ruleMuteGuardEnabled').checked}var r=await api('/admin/state','POST',payload);toast(r.message)};$('reloadMemory').onclick=loadMemory;$('addMemory').onclick=async function(){var r=await api('/memories','POST',{scope:$('memoryScope').value,text:$('memoryText').value});toast(r.message||'已新增');if(r.ok){$('memoryText').value='';loadMemory()}};$('reloadLogs').onclick=loadLogs;
boot();
})();
</script>
</body></html>`);
}

export { getAppealPage, getLiveHtmlPage, getPortalHomePage, handleAppealApi, handleGeminiLiveUpgrade, handleOpsPortalApi, handlePortalApi };
