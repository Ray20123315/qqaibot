Warning: truncated output (original token count: 112956)
Total output lines: 3071

// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { baseGoogleApiKeys, deepSeekApiKeys, effectiveRuntimeModels, geminiSearchApiKeys, geminiVisionApiKeys, getQuotaNumber, googleApiKeysFor, imageInspectionEnabled, immutableRuntimeModelDefaults, listDeepSeekEmergencyWindows, normalizeRuntimeModelKind, notifyDeveloper, parseList, partitionGoogleApiKeys, readCustomRuntimeModels, roundRobinKeys, runtimeModelRegistryState, taipeiDateKey, validRuntimeModelId, writeCustomRuntimeModels } from "../ai/runtime.js";
import { AI_MEDIA_LIMITS, DEFAULTS, PLATFORM_FEATURE_COUNT, VERSION } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { appendIndex, callOneBotAction, enrichAuditLogsForPortal, getEffectivePermissions, getRuntimeRateLimitSeconds, listAiDecisionLogs, listExplicitPrivateAccess, listExplicitProgramPermissions, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, normalizeModelPreference, normalizePermissionName, removeFromIndex, setExplicitPermission, setPrivateAccessMode, writeSystemAudit } from "../core/permissions.js";
import { clearChatSessionHistory, dbClaimLeaseStrict, dbDel, dbDeleteKeyIfJsonFieldEquals, dbGet, dbPut } from "../data/store.js";
import { botCanRunRuleMonitor, enrichPortalGroupsWithBindings, filterAuthorizedReviewers, getAppealEligibleGroupsForUser, getBotGroupRole, getGroupFamilyForGroup, getGroupOwnerId, getLiveGroupMemberList, getWhitelistedGroupsForUser, isBotVerifiedGroupOwner, isVerifiedGroupOwner, normalizeJoinUrl, notifyModerationProposalGroup, saveGroupFamily, sendGroupSelectedMentions, sendMissingHeadGroupGuide, verifyGroupMembership } from "../group/runtime.js";
import { apiModelHealthCandidates, buildHealthState, runHealthChecks, runSingleApiModelHealthCheck } from "../health/runtime.js";
import { toSimplifiedChinese } from "../i18n/commands.js";
import { BILIBILI_POLL_DEFAULT_SECONDS, bilibiliPollIntervalSeconds, listBilibiliConnectors, normalizeBilibiliUid, pollOneAutomaticBilibiliConnector, sendBilibiliConnectorNotification } from "../integrations/bilibili.js";
import { appendRuleViolationRecord, createModerationProposal, defaultRuleCategoryPolicies, getGroupMemberSafe, getRuleCategoryPolicies, getRuleProgressivePolicy, handleGroupWorkDecision, handleModerationConfirmation, listModerationProposals, localModerationIntent, moderationActionLabel, moderationActionNeedsTarget, normalizeRuleCategoryPolicies, normalizeRulePolicyActions, normalizeRuleProgressivePolicy, normalizeRuleProxyMode, normalizeRuleSeverity, normalizeRuleStrictness, parseUnlimitedNonNegativeInteger, performRuleProxyAction, recordRuleViolationFeedback, reverseRuleViolationAction, updateRuleViolationRecord } from "../moderation/runtime.js";
import { fetchConversationAttachmentResponse, getForwardMessageSnapshot, getTaipeiTimeContext, parseDurationSeconds, sendGroupRoleMentions, updatePortalConversationRecord } from "../onebot/messages.js";
import { OPS_CAPABILITIES, OPS_RECORD_TYPES, opsActiveRuleRecords, opsActivityParticipants, opsActivitySummary, opsAnalytics, opsAnnounceActivity, opsCapabilityDef, opsCleanupThinking, opsConsumeQuota, opsCreateScheduleFromSpec, opsDeleteRecord, opsDependencyCheck, opsEffectiveCapability, opsExecuteHandoff, opsFuseState, opsGetRecord, opsGetSettings, opsImpactPreview, opsInviteActivityParticipant, opsJoinActivity, opsLeaveActivity, opsListRecords, opsMemberSummary, opsModelMetrics, opsPatchActivityParticipant, opsPermissionKey, opsPollVotesKey, opsPreviewMessage, opsPublishAnnouncement, opsPurgeRemovedRecordTypes, opsRecordKey, opsRecordQualityFeedback, opsRemovedType, opsRequire, opsResetFuse, opsRestoreSnapshot, opsRetentionCleanup, opsRoleRank, opsRuleConflictCheck, opsRuleSandbox, opsSaveRecord, opsSaveSettings, opsSchedulePreview, opsSendDailyDigest, opsSendDraftNow, opsSnapshotConfig, opsTaipeiDateKey, opsTaskAction, opsTaskCenter, opsTypeDef, opsVersionKey, opsVotePoll, opsWelcomePreview } from "../operations/runtime.js";
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
    await opsPatchActivityParticipant(env, activity.id, participant);
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
      const result = await opsInviteActivityParticipant(env, activity, participant, authed.qq);
      await opsPatchActivityParticipant(env, activity.id, participant);
      results.push({ userId: participant.userId, ...result });
    }
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
  const bearerToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  const cookieToken = readCookie(request, "qqai_session");
  const token = bearerToken || cookieToken;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()) && !bearerToken && cookieToken) {
    let origin = "";
    try { origin = new URL(request.headers.get("Origin") || "").origin; } catch {}
    const isJson = String(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json");
    if (origin !== url.origin || !isJson) return jsonResponse({ ok: false, code: "CSRF_REJECTED", message: "請從已登入的同一個控制台頁面送出變更。" }, 403);
  }
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
      return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: error?.code === "PORTAL_AUTH_SECRET_MISSING" ? "请管理员先设置至少 16 字符、且独立于 OneBot Token 的 TOTP_ENCRYPTION_KEY 或 PORTAL_AUTH_SECRET，再启用 2FA。" : "无法建立双因数验证设置，请稍后重试。" }, 503);
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
      await removeFromIndex(env, `bili:connector:index:${groupId}`, item.id);
      await removeFromIndex(env, "bili:connector:index:all", item.id);
      await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: "delete", connectorId: item.id });
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
        search: geminiSearchApiKeys(env).length ? `Gemini 独立搜索 Key 池（${geminiSearchApiKeys(env).length} 把）` : "未配置独立搜索 Key",…62956 tokens truncated…on class="btn danger" data-program-revoke="'+esc(permission)+'" data-program-qq="'+esc(item.qq)+'">撤销 '+esc(programPermissionLabel(permission))+'</button>'}).join('');return '<div class="item permission-record"><div class="item-head"><div><div class="item-title">'+esc(item.displayName||item.qq)+'</div><div class="item-meta">QQ '+esc(item.qq)+(item.role&&item.role!=='member'?'｜'+esc(portalRoleLabel(item.role)):'')+'</div></div><div>'+badges+'</div></div><div class="row permission-record-actions">'+actions+'</div></div>'}).join('')||'<div class="empty">目前没有额外授予程序群组权限的成员。</div>';box.querySelectorAll('[data-program-revoke]').forEach(function(button){button.onclick=function(){changeProgramPermissionFor(button.dataset.programQq,button.dataset.programRevoke,false)}})}
async function changeProgramPermissionFor(qq,permission,enabled){qq=String(qq||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}var r=await api('/root/member','POST',{qq:qq,permission:permission,enabled:enabled});toast(r.message||'完成');if(r.ok){if($('permissionQq'))$('permissionQq').value=qq;await loadProgramPermissions()}}
async function changeProgramPermission(enabled){var qq=String($('permissionQq').value||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}await changeProgramPermissionFor(qq,$('permissionType').value,enabled)}
function privateAccessLabel(value){return value==='full'?'完整私聊':value==='commands'?'仅私聊指令':'关闭'}
async function loadPrivateAccessForTarget(){var qq=String($('privateAccessQq').value||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}var r=await api('/root/private-access?qq='+encodeURIComponent(qq));if(!r.ok){$('privateAccessStatus').textContent=r.message||'读取失败';return}$('privateAccessMode').value=r.access||'none';$('privateAccessMode').disabled=!!r.developerDefault;$('savePrivateAccess').disabled=!!r.developerDefault;$('privateAccessStatus').textContent='QQ '+qq+'：'+privateAccessLabel(r.access)+(r.developerDefault?'（开发者固定权限）':'');renderPrivateAccessList(r.records||[])}
function renderPrivateAccessList(rows){var box=$('privateAccessList');if(!box)return;box.innerHTML=(rows||[]).map(function(item){return '<div class="item"><div class="item-head"><div><div class="item-title">QQ '+esc(item.qq)+'</div><div class="item-meta">'+esc(privateAccessLabel(item.privateAccess))+'（全站）</div></div><button class="btn" data-private-access-edit="'+esc(item.qq)+'">编辑</button></div></div>'}).join('')||'<div class="empty">目前没有已登记的私聊权限。</div>';box.querySelectorAll('[data-private-access-edit]').forEach(function(button){button.onclick=function(){$('privateAccessQq').value=button.dataset.privateAccessEdit;loadPrivateAccessForTarget()}})}
async function loadPrivateAccessList(){var r=await api('/root/private-access');if(r.ok)renderPrivateAccessList(r.records||[])}
async function savePrivateAccessForTarget(){var qq=String($('privateAccessQq').value||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}var r=await api('/root/member','POST',{qq:qq,privateAccess:$('privateAccessMode').value});toast(r.message||'完成');if(r.ok){await loadPrivateAccessForTarget()}}
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
async function loadPlatformFeatures() {
  var q = $('pfSearch') ? $('pfSearch').value : '';
  var r = await api('/platform/features?q=' + encodeURIComponent(q));
  if (!r.ok) { $('pfList').innerHTML = '<div class="empty">' + esc(r.message) + '</div>'; return; }
  $('pfSummary').textContent = '目录共 ' + r.total + ' 项；这些记录目前不会控制实际执行。';
  $('pfList').innerHTML = '';
  (r.features || []).forEach(function (f) {
    var d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = '<div class="item-head"><div><div class="item-title">' + esc(f.id) + '｜' + esc(f.name) + '</div><div class="item-meta">类别：' + esc(f.category) + '｜实现方式：' + esc(f.mode) + '｜最低权限：' + esc(portalRoleLabel(f.minRole)) + '</div></div></div>';
    var state = document.createElement('div');
    state.className = 'item-meta';
    state.textContent = '执行控制：未接入' + (f.configuredEnabled ? '；历史记录为开启' : '；历史记录为关闭');
    d.appendChild(state);
    $('pfList').appendChild(d);
  });
  if (!$('pfList').children.length) $('pfList').innerHTML = '<div class="empty">没有符合当前权限或搜索条件的功能</div>';
}
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
async function verifyPasswordLogin(){var account=String($('loginQq').value||'').normalize('NFKC').trim(),qq=/^\d{5,12}$/.test(account)?account:'',password=$('loginPassword').value;if(!account||(!qq&&account.length>32)||!password){$('loginNotice').textContent='请输入有效的管理员帐号或 QQ 号及密码。';return}var b=$('verifyPassword');b.disabled=true;b.textContent='验证中…';var factorVisible=!$('loginFactorWrap').classList.contains('hidden'),payload={username:account,password:password,remember:qq?(!$('rememberLogin')||$('rememberLogin').checked):false,factorType:factorVisible?$('loginFactorType').value:'',factorCode:factorVisible?$('loginFactorCode').value:''};if(qq)payload.qq=qq;var r=await raw('/api/auth/login-password','POST',payload);b.disabled=false;b.textContent='使用密码登录';$('loginNotice').textContent=r.message||'登录失败。';if(r.code==='PASSWORD_RECORD_INVALID'&&$('loginPasswordReset'))$('loginPasswordReset').open=true;if(r.requiresTwoFactor||r.code==='TWO_FACTOR_REQUIRED'){$('loginFactorWrap').classList.remove('hidden');$('loginFactorCode').focus();return}if(r.ok&&r.systemAdmin){location.replace('/system-admin');return}if(r.ok){await boot()}}
async function requestPasswordFactorCode(){var qq=String($('loginQq').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){toast('请先输入正确的 QQ 号');return}var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'验证码发送失败。';if(r.ok){$('loginFactorType').value='qq_code';$('loginFactorWrap').classList.remove('hidden')}}
async function requestPasswordResetCode(){var qq=String($('loginQq').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){$('loginNotice').textContent='请先输入正确的 QQ 号。';return}var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'重设验证码发送失败。';if(r.ok&&$('loginPasswordReset'))$('loginPasswordReset').open=true}
async function resetPasswordLogin(){var qq=String($('loginQq').value||'').replace(/\D/g,''),next=$('loginResetPassword').value,confirm=$('loginResetConfirm').value,code=String($('loginResetCode').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){$('loginNotice').textContent='请输入正确的 QQ 号。';return}if(next!==confirm){$('loginNotice').textContent='两次输入的新密码不一致。';return}if(next.length<10||!/^\d{6}$/.test(code)){$('loginNotice').textContent='请输入至少 10 个字符的新密码和六位 QQ 验证码。';return}var b=$('passwordResetSubmit');b.disabled=true;b.textContent='重设中…';var r=await raw('/api/auth/reset-password','POST',{qq:qq,code:code,newPassword:next});b.disabled=false;b.textContent='重设密码';$('loginNotice').textContent=r.message||'密码重设失败。';if(r.ok){$('loginPassword').value=next;$('loginResetPassword').value='';$('loginResetConfirm').value='';$('loginResetCode').value='';if($('loginPasswordReset'))$('loginPasswordReset').open=false}}
try{var lastLoginQq=localStorage.getItem('qqai_last_login_qq');if(lastLoginQq)$('loginQq').value=lastLoginQq}catch(e){}$('loginMethodCode').addEventListener('click',function(){setLoginMethod('code')});$('loginMethodPassword').addEventListener('click',function(){setLoginMethod('password')});$('sendCode').addEventListener('click',requestLoginCode);$('verifyCode').addEventListener('click',verifyLoginCode);$('verifyPassword').addEventListener('click',verifyPasswordLogin);$('passwordSendFactorCode').addEventListener('click',requestPasswordFactorCode);$('passwordResetSendCode').addEventListener('click',requestPasswordResetCode);$('passwordResetSubmit').addEventListener('click',resetPasswordLogin);$('loginQq').addEventListener('keydown',function(e){if(e.key==='Enter'){if($('loginPasswordPane').classList.contains('hidden'))requestLoginCode();else verifyPasswordLogin()}});$('loginCode').addEventListener('keydown',function(e){if(e.key==='Enter')verifyLoginCode()});$('loginPassword').addEventListener('keydown',function(e){if(e.key==='Enter')verifyPasswordLogin()});$('loginFactorCode').addEventListener('keydown',function(e){if(e.key==='Enter')verifyPasswordLogin()});$('loginThemeToggle').addEventListener('click',toggleTheme);$('themeToggle').addEventListener('click',toggleTheme);bindSystemThemeChanges();updateThemeButtons();
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
