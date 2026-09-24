// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { DEFAULTS } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { appendIndex, callOneBotAction, getEffectivePermissions, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { dispatchHumanAttentionNotification } from "../notifications/routing.js";
import { toSimplifiedChinese } from "../i18n/commands.js";
import { waitMs } from "../integrations/bilibili.js";
import { attachModerationProposalMessage, extractOneBotMessageId, getGroupMemberSafe, moderationActionLabel, moderationActionNeedsTarget } from "../moderation/runtime.js";
import { formatDuration } from "../onebot/messages.js";
import { readJson, resolvePortalRole } from "../portal/auth.js";
import { isGroupWhitelisted, numericId } from "../security/network.js";




function normalizeJoinUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["https:", "http:", "mqqapi:"].includes(parsed.protocol)) return "";
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}



function serverHtmlEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}



async function getGroupFamilyForGroup(env, groupId) {
  const id = String(groupId || "").replace(/\D/g, "");
  if (!id) return null;
  const headId = String(await dbGet(env, `group_family:member:${id}`) || id);
  const family = await readJson(env, `group_family:${headId}`, null);
  if (!family) return null;
  const memberIds = [String(family.headGroupId || ""), ...(family.branches || []).map(item => String(item.groupId || ""))];
  return memberIds.includes(id) ? family : null;
}



function familyAliasForGroup(family, groupId, fallback = "") {
  const id = String(groupId || "");
  if (!family) return String(fallback || id);
  if (String(family.headGroupId || "") === id) return String(family.headAlias || fallback || id);
  const branch = (family.branches || []).find(item => String(item.groupId || "") === id);
  return String(branch?.alias || fallback || id);
}



async function enrichPortalGroupsWithBindings(env, groups) {
  const output = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    const family = await getGroupFamilyForGroup(env, group.groupId);
    output.push({
      ...group,
      displayName: familyAliasForGroup(family, group.groupId, group.groupName),
      family: family ? {
        headGroupId: String(family.headGroupId || ""),
        headAlias: String(family.headAlias || family.headGroupId || ""),
        role: String(family.headGroupId || "") === String(group.groupId || "") ? "head" : "branch"
      } : null
    });
  }
  return output;
}



async function saveGroupFamily(env, data) {
  const headGroupId = String(data.headGroupId || "").replace(/\D/g, "");
  if (!headGroupId) throw new Error("请选择总群");
  const previous = await readJson(env, `group_family:${headGroupId}`, null);
  const branchMap = new Map();
  for (const item of Array.isArray(data.branches) ? data.branches : []) {
    const groupId = String(item?.groupId || "").replace(/\D/g, "");
    if (!groupId || groupId === headGroupId) continue;
    branchMap.set(groupId, { groupId, alias: String(item?.alias || groupId).trim().slice(0, 80) || groupId, note: String(item?.note || "").trim().slice(0, 300) });
  }
  const family = {
    id: `family_${headGroupId}`,
    headGroupId,
    headAlias: String(data.headAlias || headGroupId).trim().slice(0, 80) || headGroupId,
    customJoinUrl: normalizeJoinUrl(data.customJoinUrl),
    guideText: String(data.guideText || "请加入总群，以便接收完整公告、群规与活动通知。").trim().slice(0, 1000),
    branches: [...branchMap.values()],
    updatedBy: String(data.updatedBy || ""),
    updatedAt: Date.now()
  };
  const oldIds = previous ? [String(previous.headGroupId || ""), ...(previous.branches || []).map(item => String(item.groupId || ""))] : [];
  const newIds = [headGroupId, ...family.branches.map(item => item.groupId)];
  for (const id of oldIds) if (id && !newIds.includes(id)) await dbDel(env, `group_family:member:${id}`);
  for (const id of newIds) await dbPut(env, `group_family:member:${id}`, headGroupId);
  await dbPut(env, `group_family:${headGroupId}`, JSON.stringify(family));
  await appendIndex(env, "group_family:index", headGroupId, 500);
  return family;
}



function getGroupJoinPage(family, origin) {
  const headGroupId = String(family?.headGroupId || "");
  const headAlias = String(family?.headAlias || headGroupId || "总群");
  const customJoinUrl = normalizeJoinUrl(family?.customJoinUrl);
  const guideText = String(family?.guideText || "请加入总群，以便接收完整公告、群规与活动通知。");
  const action = customJoinUrl
    ? `<a class="button" href="${serverHtmlEscape(customJoinUrl)}" rel="noreferrer">打开总群加入链接</a>`
    : `<button class="button" id="copy">复制总群 QQ 号</button><div id="copied" class="muted"></div>`;
  return toSimplifiedChinese(`<!doctype html><html lang="zh-Hans-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${serverHtmlEscape(headAlias)}｜总群引导</title><style>:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#080b12;color:#eef3fb}.card{width:min(620px,100%);background:#111722;border:1px solid #2a3549;border-radius:18px;padding:24px;box-shadow:0 24px 70px #0007}h1{margin:0 0 8px}.muted{color:#aab6c9;line-height:1.65}.group{font-size:22px;font-weight:850;margin:18px 0 5px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border:0;border-radius:12px;padding:0 18px;background:#8585ff;color:#fff;text-decoration:none;font-weight:800;cursor:pointer;margin-top:18px}</style></head><body><main class="card"><h1>总群加入引导</h1><div class="muted">${serverHtmlEscape(guideText)}</div><div class="group">${serverHtmlEscape(headAlias)}</div><div class="muted">QQ群：${serverHtmlEscape(headGroupId)}</div>${action}</main><script>var b=document.getElementById('copy');if(b)b.onclick=async function(){try{await navigator.clipboard.writeText(${JSON.stringify(headGroupId)});document.getElementById('copied').textContent='已复制，请在 QQ 搜索群号加入。'}catch(e){document.getElementById('copied').textContent='请手动复制群号：${serverHtmlEscape(headGroupId)}'}}</script></body></html>`);
}



function proposalActorText(proposal) {
  const name = String(proposal?.actorName || proposal?.actorId || "未知提出者");
  const id = String(proposal?.actorId || "");
  return id && !name.includes(id) ? `${name}（QQ:${id}）` : name;
}



async function notifyModerationProposalGroup(env, proposal) {
  const targetLine = moderationActionNeedsTarget(proposal.action)
    ? `\n目标：${proposal.targetName || proposal.targetId}（QQ:${proposal.targetId}）`
    : "\n目标：全群";
  const durationLine = proposal.action === "mute" ? `\n时长：${formatDuration(proposal.durationSeconds || 600)}` : "";
  const reasonLine = proposal.reason ? `\n补充原因：${proposal.reason}` : "";
  const message = `【Portal 群管理待确认】\n编号：${proposal.id}\n群号：${proposal.groupId}\n提出者：${proposalActorText(proposal)}\n动作：${moderationActionLabel(proposal.action)}${targetLine}${durationLine}${reasonLine}\n状态：待确认\n请在对应群聊于 2 分钟内发送“确认 ${proposal.id}”或“取消 ${proposal.id}”。未确认不会执行。`;
  return dispatchHumanAttentionNotification(env, {
    groupId: proposal.groupId,
    eventId: "moderation_proposal",
    message,
    audit: { actorId: proposal.actorId, proposalId: proposal.id, actionName: proposal.action }
  });
}


async function getLiveGroupMemberList(env, groupId) {
  const live = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 25000);
  const list = Array.isArray(live) ? live : Array.isArray(live?.data) ? live.data : [];
  return list.map(item => ({
    qq: String(item?.user_id || item?.qq || ""),
    name: String(item?.card || item?.nickname || item?.name || item?.user_id || ""),
    role: String(item?.role || "member"),
    isRobot: Boolean(item?.is_robot)
  })).filter(item => item.qq);
}



function oneBotSnapshotMentionIds(snapshot) {
  const data = snapshot?.data && typeof snapshot.data === "object" ? snapshot.data : snapshot;
  const message = data?.message ?? data?.raw_message ?? "";
  const ids = [];
  if (Array.isArray(message)) {
    for (const part of message) {
      if (String(part?.type || "").toLowerCase() !== "at") continue;
      const qq = part?.data?.qq ?? part?.data?.user_id;
      if (qq !== undefined && qq !== null) ids.push(String(qq));
    }
  }
  const raw = String(data?.raw_message || (typeof message === "string" ? message : ""));
  for (const match of raw.matchAll(/\[CQ:at,[^\]]*qq=([^,\]]+)/gi)) ids.push(String(match[1] || ""));
  return [...new Set(ids.filter(Boolean))];
}



async function sendGroupSelectedMentions(env, { groupId, qqs, text, replyId = "", actionKey = "selected" }) {
  const cooldownKey = `portal_role_mention:${groupId}:${actionKey}`;
  const lastAt = Number(await dbGet(env, cooldownKey) || 0);
  if (lastAt && Date.now() - lastAt < 60000) throw new Error("同类批量提醒 60 秒内只能执行一次");
  const members = await getLiveGroupMemberList(env, groupId);
  const directory = new Map(members.filter(item => !item.isRobot).map(item => [item.qq, item]));
  const recipients = [...new Set((qqs || []).map(value => String(value).replace(/\D/g, "")).filter(value => directory.has(value)))];
  if (!recipients.length) throw new Error("没有选择有效群成员");
  const batches = [];
  let current = [], currentChars = 0;
  for (const qq of recipients) {
    const cost = qq.length + 24;
    if (current.length && currentChars + cost > 3200) { batches.push(current); current = []; currentChars = 0; }
    current.push(qq); currentChars += cost;
  }
  if (current.length) batches.push(current);
  let mentionFallbacks = 0;
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    const bodyText = String(text || "请查看这条群消息。").slice(0, 1500);
    const segments = [];
    if (index === 0 && replyId) segments.push({ type: "reply", data: { id: String(replyId) } });
    for (const qq of batch) segments.push({ type: "at", data: { qq: numericId(qq) } }, { type: "text", data: { text: " " } });
    segments.push({ type: "text", data: { text: bodyText } });
    const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: segments, auto_escape: false } }, 25000);
    const messageId = String(extractOneBotMessageId(sent) || "");
    if (messageId) {
      try {
        const snapshot = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(messageId) } }, 12000);
        const actual = new Set(oneBotSnapshotMentionIds(snapshot));
        const missing = batch.filter(qq => !actual.has(String(qq)));
        if (missing.length) {
          const cq = `${index === 0 && replyId ? `[CQ:reply,id=${String(replyId)}]` : ""}${batch.map(qq => `[CQ:at,qq=${qq}] `).join("")}${bodyText}`;
          await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(messageId) } }, 10000).catch(() => null);
          await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: cq, auto_escape: false } }, 25000);
          mentionFallbacks += 1;
        }
      } catch (error) {
        const cq = `${index === 0 && replyId ? `[CQ:reply,id=${String(replyId)}]` : ""}${batch.map(qq => `[CQ:at,qq=${qq}] `).join("")}${bodyText}`;
        const deleted = await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(messageId) } }, 10000).then(() => true).catch(() => false);
        if (deleted) {
          await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: cq, auto_escape: false } }, 25000);
          mentionFallbacks += 1;
        }
        await writeSystemAudit(env, { type: "group_mention_verify_skipped", groupId: String(groupId), actorId: "system", action: actionKey, messageId, fallbackResent: deleted, error: String(error?.message || error).slice(0, 500) }).catch(() => {});
      }
    }
    if (index < batches.length - 1) await waitMs(1000);
  }
  await dbPut(env, cooldownKey, String(Date.now()));
  return { recipients: recipients.length, batches: batches.length, truncated: false, mentionFallbacks };
}



async function sendMissingHeadGroupGuide(env, { family, branchGroupId, text = "" }) {
  const branchId = String(branchGroupId || "").replace(/\D/g, "");
  if (!family || !branchId || !(family.branches || []).some(item => String(item.groupId) === branchId)) throw new Error("请选择已绑定的分群");
  const [headMembers, branchMembers] = await Promise.all([getLiveGroupMemberList(env, family.headGroupId), getLiveGroupMemberList(env, branchId)]);
  const headSet = new Set(headMembers.map(item => item.qq));
  const missing = branchMembers.filter(item => !item.isRobot && !headSet.has(item.qq)).map(item => item.qq);
  if (!missing.length) return { recipients: 0, batches: 0, message: "该分群成员都已在总群内。" };
  const guideLink = `${String(text || "").trim()}`;
  const result = await sendGroupSelectedMentions(env, {
    groupId: branchId,
    qqs: missing,
    text: guideLink || `${family.guideText || "请加入总群，以便接收完整公告、群规与活动通知。"}`,
    actionKey: `family_${family.headGroupId}`
  });
  return { ...result, missingQqs: missing };
}



async function getWhitelistedGroupsForUser(env, userId) {
  let groups = [];
  try {
    const list = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: false } }, 15000);
    groups = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];
  } catch {
    const known = await readJson(env, "known_groups", []);
    groups = known;
  }
  const result = [];
  for (const group of groups.slice(0, 300)) {
    const groupId = String(group.group_id || group.groupId || group.id || "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) continue;
    let member = null;
    try {
      member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 8000);
    } catch {
      member = (await readJson(env, `group_members:${groupId}`, [])).find(x => String(x.qq) === String(userId));
    }
    if (!member || member.active === false || member.leftAt) continue;
    result.push({ groupId, groupName: String(group.group_name || group.groupName || groupId), role: String(member.role || "member"), card: String(member.card || member.nickname || member.name || userId) });
  }
  return result;
}



async function getAppealEligibleGroupsForUser(env, userId) {
  const current = await getWhitelistedGroupsForUser(env, userId);
  const byId = new Map(current.map(group => [String(group.groupId), { ...group, former: false, eligibility: "current" }]));
  const cutoff = Date.now() - Number(DEFAULTS.appealFormerMemberDays || 30) * 24 * 60 * 60 * 1000;
  const known = await readJson(env, "known_groups", []);
  for (const group of known.slice(-1000)) {
    const groupId = String(group?.group_id || group?.groupId || group?.id || group || "");
    if (!groupId || byId.has(groupId) || !(await isGroupWhitelisted(env, groupId))) continue;
    const members = await readJson(env, `group_members:${groupId}`, []);
    const member = members.find(item => String(item.qq) === String(userId));
    if (!member || member.active !== false || !member.leftAt) continue;
    const leftAt = Date.parse(member.leftAt);
    if (!Number.isFinite(leftAt) || leftAt < cutoff) continue;
    const eligibleUntil = new Date(leftAt + Number(DEFAULTS.appealFormerMemberDays || 30) * 24 * 60 * 60 * 1000).toISOString();
    byId.set(groupId, {
      groupId,
      groupName: String(group?.group_name || group?.groupName || member.groupName || groupId),
      role: String(member.role || "member"),
      card: String(member.name || member.card || userId),
      former: true,
      eligibility: "former_within_30_days",
      leftAt: new Date(leftAt).toISOString(),
      eligibleUntil
    });
  }
  return [...byId.values()];
}



async function filterAuthorizedReviewers(env, groupId, reviewerIds, kind) {
  const valid = [], invalid = [];
  for (const reviewerId of [...new Set((reviewerIds || []).map(String).filter(Boolean))]) {
    const role = await resolvePortalRole(env, reviewerId, groupId);
    const perms = await getEffectivePermissions(env, groupId, reviewerId, role, isDeveloperId(env, reviewerId));
    const allowed = kind === "schedule" ? (perms.scheduleReviewer || perms.groupOps || perms.nativeAdmin || perms.developer) : (perms.appealReviewer || perms.nativeAdmin || perms.developer);
    (allowed ? valid : invalid).push(reviewerId);
  }
  return { valid, invalid };
}



async function getBotIdentity(env) {
  const cached = await readJson(env, "onebot:self_identity", null);
  if (cached?.userId && Date.now() - Number(cached.at || 0) < 5 * 60 * 1000) return cached;
  try {
    const data = await callOneBotAction(env, { action: "get_login_info", params: {} }, 10000);
    const identity = { userId: String(data?.user_id || data?.userId || ""), nickname: String(data?.nickname || ""), at: Date.now() };
    if (identity.userId) await dbPut(env, "onebot:self_identity", JSON.stringify(identity));
    return identity;
  } catch {
    return cached || { userId: "", nickname: "", at: 0 };
  }
}



async function getBotGroupRole(env, groupId) {
  const normalizedGroupId = String(groupId || "").replace(/\D/g, "");
  const cacheKey = `onebot:self_group_role:${normalizedGroupId}`;
  const cached = await readJson(env, cacheKey, null);
  const normalizedCached = cached
    ? { ...cached, exists: typeof cached.exists === "boolean" ? cached.exists : ["owner", "admin", "member"].includes(String(cached.role || "")) }
    : null;
  if (normalizedCached && Date.now() - Number(normalizedCached.at || 0) < 60 * 1000) return normalizedCached;
  const self = await getBotIdentity(env);
  if (!self.userId) return normalizedCached || { userId: "", role: "unknown", exists: false, verifiedBy: "identity_unavailable", at: 0 };
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(normalizedGroupId), user_id: numericId(self.userId), no_cache: true } }, 10000);
    const state = { userId: self.userId, role: String(member?.role || "member"), exists: true, verifiedBy: "get_group_member_info", at: Date.now() };
    await dbPut(env, cacheKey, JSON.stringify(state));
    return state;
  } catch (memberError) {
    try {
      const list = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: true } }, 12000);
      const groups = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];
      const exists = groups.some(item => String(item?.group_id || item?.groupId || item?.id || "") === normalizedGroupId);
      const state = {
        userId: self.userId,
        role: exists ? (normalizedCached?.exists ? String(normalizedCached.role || "member") : "member") : "unknown",
        exists,
        verifiedBy: "get_group_list",
        memberProbeError: String(memberError?.message || memberError).slice(0, 500),
        at: Date.now()
      };
      await dbPut(env, cacheKey, JSON.stringify(state));
      return state;
    } catch (listError) {
      return normalizedCached || { userId: self.userId, role: "unknown", exists: false, verifiedBy: "probe_failed", error: `${String(memberError?.message || memberError)}; ${String(listError?.message || listError)}`.slice(0, 500), at: 0 };
    }
  }
}



async function isBotVerifiedGroupOwner(env, groupId) {
  return (await getBotGroupRole(env, groupId)).role === "owner";
}



function botCanRunRuleMonitor(state) {
  const role = String(state?.role || "unknown");
  const age = Date.now() - Number(state?.at || 0);
  return (role === "owner" || role === "admin") && age >= 0 && age <= 90 * 1000;
}



async function canUseBotGroupOperations(env, groupId, userId) {
  const role = await resolvePortalRole(env, String(userId), String(groupId));
  const permissions = await getEffectivePermissions(env, String(groupId), String(userId), role, isDeveloperId(env, userId));
  return Boolean(permissions.groupOps || permissions.nativeAdmin || permissions.developer);
}



async function getGroupOwnerId(env, groupId) {
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    const owner = (Array.isArray(members) ? members : []).find(m => m.role === "owner");
    return owner ? String(owner.user_id || owner.qq || "") : "";
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return String(members.find(m => m.role === "owner")?.qq || "");
  }
}



async function isVerifiedGroupOwner(env, groupId, userId) {
  const wanted = String(userId || "");
  if (!groupId || !wanted) return false;
  const ownerId = await getGroupOwnerId(env, groupId);
  if (ownerId) return String(ownerId) === wanted;
  const member = await getGroupMemberSafe(env, groupId, wanted);
  return String(member?.role || "") === "owner";
}



async function verifyGroupMembership(env, groupId, userId) {
  if (!(await isGroupWhitelisted(env, groupId))) return false;
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 10000);
    return Boolean(member && (member.user_id || member.qq || member.nickname));
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return members.some(x => String(x.qq) === String(userId) && x.active !== false && !x.leftAt);
  }
}

export { botCanRunRuleMonitor, canUseBotGroupOperations, enrichPortalGroupsWithBindings, familyAliasForGroup, filterAuthorizedReviewers, getAppealEligibleGroupsForUser, getBotGroupRole, getBotIdentity, getGroupFamilyForGroup, getGroupJoinPage, getGroupOwnerId, getLiveGroupMemberList, getWhitelistedGroupsForUser, isBotVerifiedGroupOwner, isVerifiedGroupOwner, normalizeJoinUrl, notifyModerationProposalGroup, oneBotSnapshotMentionIds, proposalActorText, saveGroupFamily, sendGroupSelectedMentions, sendMissingHeadGroupGuide, serverHtmlEscape, verifyGroupMembership };
