import { dbGet } from "../data/store.js";

const FLIRT_MUTE_MAX_SECONDS = 5 * 60;
const MANAGER_PARTICIPATION_WINDOW_MS = 3 * 60 * 1000;
const MANAGER_INTERVENTION_WINDOW_MS = 8 * 60 * 1000;

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function isManagementRole(role) {
  return ["admin", "owner", "developer"].includes(String(role || "").toLowerCase());
}

function isManagerStopSignal(text) {
  return /(?:都?别吵|都?別吵|不要吵|停止争吵|停止爭吵|到此为止|到此為止|别骂了|別罵了|不要再骂|不要再罵|别继续|別繼續|够了|夠了|打住|收一收|冷静一下|冷靜一下|停止人身攻击|停止人身攻擊|管理提醒.{0,8}(?:停止|别吵|別吵))/i.test(String(text || ""));
}

function looksLikeRoughBanter(text) {
  return /(?:滚|滾|闭嘴|閉嘴|神经|神經|有病|笨蛋|傻子|傻逼|智障|垃圾|废物|廢物|妈的|媽的|操你|去死|恶心|噁心|人身攻击|人身攻擊|吵架)/i.test(String(text || ""));
}

function isFlirtRefusalSignal(text) {
  return /(?:不要这样|不要這樣|别这样|別這樣|别撩|別撩|别碰我|別碰我|别摸|別摸|别亲|別親|不接受|我不愿意|我不願意|离我远点|離我遠點|停止|到此为止|到此為止|恶心|噁心|滚开|滾開|别继续|別繼續)/i.test(String(text || ""));
}

function looksLikeFlirtCandidate(text, recentRecords = []) {
  const source = String(text || "");
  const strong = /(?:做爱|做愛|约炮|約炮|上床|开房|開房|睡你|想睡你|脱衣|脫衣|胸|屁股|摸腿|摸胸|舔你|亲嘴|親嘴|舌吻|色色|发情|發情)/i.test(source);
  const affectionate = /(?:老婆|老公|宝贝|寶貝|宝宝|寶寶|亲亲|親親|贴贴|貼貼|抱抱|抱着睡|抱著睡|爱你|愛你|喜欢你|喜歡你|想你|嫁给我|嫁給我|娶你|亲一口|親一口|看看腿|摸摸你)/i.test(source);
  if (strong || affectionate) return true;
  if (!isFlirtRefusalSignal(source)) return false;
  const cutoff = Date.now() - 5 * 60 * 1000;
  return (Array.isArray(recentRecords) ? recentRecords : []).some(record => Number(record?.createdAt || 0) >= cutoff && /(?:老婆|老公|宝贝|寶貝|亲亲|親親|贴贴|貼貼|抱抱|爱你|愛你|喜欢你|喜歡你|想你|摸|亲|親|睡你|开房|開房|上床)/i.test(String(record?.text || "")));
}

async function readRecentConversationRecords(env, groupId, limit = 24) {
  const group = cleanId(groupId);
  if (!group) return [];
  let ids = [];
  try {
    const raw = await dbGet(env, `conversation:index:${group}`);
    ids = raw ? JSON.parse(raw) : [];
  } catch {
    ids = [];
  }
  const selected = (Array.isArray(ids) ? ids : []).slice(-Math.max(1, Math.min(80, Number(limit || 24))));
  const records = [];
  for (const id of selected) {
    try {
      const raw = await dbGet(env, `conversation:${group}:${String(id)}`);
      if (!raw) continue;
      const item = JSON.parse(raw);
      records.push({
        messageId: String(item?.messageId || item?.id || id),
        groupId: group,
        userId: cleanId(item?.userId),
        senderName: String(item?.senderName || item?.userId || ""),
        senderRole: String(item?.senderRole || "member").toLowerCase(),
        text: String(item?.text || "").slice(0, 4000),
        mentions: (Array.isArray(item?.mentions) ? item.mentions : []).map(cleanId).filter(Boolean),
        replyId: String(item?.replyId || ""),
        createdAt: Number(item?.createdAt || item?.updatedAt || 0)
      });
    } catch {}
  }
  return records.sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
}

function managerExchangeContext(records, { userId = "", senderRole = "member", text = "", mentionedQqs = [], quotedSenderId = "", now = Date.now() } = {}) {
  const currentUser = cleanId(userId);
  const quoted = cleanId(quotedSenderId);
  const mentions = new Set((Array.isArray(mentionedQqs) ? mentionedQqs : []).map(cleanId).filter(Boolean));
  const list = (Array.isArray(records) ? records : []).filter(record => record?.userId);
  const prior = list.filter(record => record.userId !== currentUser || Number(record.createdAt || 0) < now - 1000);
  const recentManagers = prior.filter(record => isManagementRole(record.senderRole) && now - Number(record.createdAt || 0) <= MANAGER_PARTICIPATION_WINDOW_MS);
  const lastPrior = prior[prior.length - 1] || null;
  const currentIsManager = isManagementRole(senderRole);
  const currentManagerStop = currentIsManager && isManagerStopSignal(text);
  const managerStopRecord = [...recentManagers].reverse().find(record => isManagerStopSignal(record.text)) || null;
  const managerParticipating = currentIsManager || recentManagers.some(record => {
    if (isManagerStopSignal(record.text)) return false;
    return quoted === record.userId
      || mentions.has(record.userId)
      || (Array.isArray(record.mentions) && record.mentions.includes(currentUser))
      || lastPrior?.userId === record.userId;
  });
  return {
    currentIsManager,
    currentManagerStop,
    managerStopRecord,
    managerStopActive: Boolean(managerStopRecord && now - Number(managerStopRecord.createdAt || 0) <= MANAGER_INTERVENTION_WINDOW_MS),
    managerParticipating,
    managerIds: recentManagers.map(record => record.userId)
  };
}

function normalizeFlirtAction(value, fallback = "none") {
  const action = String(value || "").toLowerCase();
  return ["none", "warn", "warn_recall", "warn_recall_mute"].includes(action) ? action : fallback;
}

function clampFlirtMuteSeconds(value, fallback = 60) {
  const parsed = Math.trunc(Number(value));
  const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.max(1, Math.min(FLIRT_MUTE_MAX_SECONDS, safe));
}

export {
  FLIRT_MUTE_MAX_SECONDS,
  MANAGER_INTERVENTION_WINDOW_MS,
  MANAGER_PARTICIPATION_WINDOW_MS,
  clampFlirtMuteSeconds,
  isFlirtRefusalSignal,
  isManagementRole,
  isManagerStopSignal,
  looksLikeFlirtCandidate,
  looksLikeRoughBanter,
  managerExchangeContext,
  normalizeFlirtAction,
  readRecentConversationRecords
};
