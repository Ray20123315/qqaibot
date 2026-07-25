// Social decision, continuity and output controls for the single Worker.
// The module stores aggregate style statistics only; it does not copy raw private speech into a persona.

import { callGoogleDecision } from "../ai/runtime.js";
import { dbGet, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";

const SOCIAL_PROFILE_VERSION = 1;
const SOCIAL_STYLE_ALPHA = 0.08;
const SOCIAL_MANAGER_APPEAL_COOLDOWN_MS = 30 * 60 * 1000;
const SOCIAL_RELATION_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const DEFAULT_STYLE = Object.freeze({
  samples: 0,
  averageChars: 14,
  emojiRate: 0,
  kaomojiRate: 0,
  punctuationOnlyRate: 0.08,
  repeatedQuestionRate: 0.08,
  ellipsisRate: 0.08,
  actionTextRate: 0.08,
  lineBreakRate: 0.08,
  updatedAt: 0
});

const DEFAULT_CANON = Object.freeze({
  name: "",
  birthday: "",
  age: null,
  gender: "",
  heightCm: null,
  weight: "",
  gamesPlayed: [],
  gamesNotPlayed: []
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function socialProfileKey(groupId) {
  return `social_persona:${cleanId(groupId) || "private"}`;
}

function socialStyleKey(groupId) {
  return `social_style:${cleanId(groupId) || "private"}`;
}

function socialRelationshipKey(groupId, userId) {
  return `social_relation:${cleanId(groupId) || "private"}:${cleanId(userId)}`;
}

function normalizeStyle(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    samples: Math.max(0, Math.trunc(Number(source.samples || 0))),
    averageChars: clamp(source.averageChars || DEFAULT_STYLE.averageChars, 1, 300),
    emojiRate: clamp(source.emojiRate, 0, 1),
    kaomojiRate: clamp(source.kaomojiRate, 0, 1),
    punctuationOnlyRate: clamp(source.punctuationOnlyRate ?? DEFAULT_STYLE.punctuationOnlyRate, 0, 1),
    repeatedQuestionRate: clamp(source.repeatedQuestionRate ?? DEFAULT_STYLE.repeatedQuestionRate, 0, 1),
    ellipsisRate: clamp(source.ellipsisRate ?? DEFAULT_STYLE.ellipsisRate, 0, 1),
    actionTextRate: clamp(source.actionTextRate ?? DEFAULT_STYLE.actionTextRate, 0, 1),
    lineBreakRate: clamp(source.lineBreakRate ?? DEFAULT_STYLE.lineBreakRate, 0, 1),
    updatedAt: Number(source.updatedAt || 0)
  };
}

function normalizeCanon(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: String(source.name || "").trim().slice(0, 80),
    birthday: String(source.birthday || "").trim().slice(0, 40),
    age: Number.isFinite(Number(source.age)) && Number(source.age) > 0 ? Math.trunc(Number(source.age)) : null,
    gender: String(source.gender || "").trim().slice(0, 40),
    heightCm: Number.isFinite(Number(source.heightCm)) && Number(source.heightCm) > 0 ? Math.trunc(Number(source.heightCm)) : null,
    weight: String(source.weight || "").trim().slice(0, 40),
    gamesPlayed: [...new Set((Array.isArray(source.gamesPlayed) ? source.gamesPlayed : []).map(item => String(item || "").trim()).filter(Boolean))].slice(0, 100),
    gamesNotPlayed: [...new Set((Array.isArray(source.gamesNotPlayed) ? source.gamesNotPlayed : []).map(item => String(item || "").trim()).filter(Boolean))].slice(0, 100)
  };
}

function normalizeGeneratedCanon(value) {
  const source = value && typeof value === "object" ? value : {};
  const output = {};
  for (const key of ["birthday", "age", "gender", "heightCm", "weight"]) {
    const row = source[key];
    if (!row || typeof row !== "object" || row.value === undefined || row.value === null || row.value === "") continue;
    output[key] = { value: row.value, source: String(row.source || "generated"), createdAt: Number(row.createdAt || Date.now()) };
  }
  return output;
}

async function getSocialProfile(env, groupId) {
  const stored = await readJson(env, socialProfileKey(groupId), null);
  const learnedStyle = normalizeStyle(await readJson(env, socialStyleKey(groupId), DEFAULT_STYLE));
  const profile = stored && typeof stored === "object" ? stored : {};
  return {
    version: SOCIAL_PROFILE_VERSION,
    canon: normalizeCanon(profile.canon || DEFAULT_CANON),
    generatedCanon: normalizeGeneratedCanon(profile.generatedCanon),
    style: learnedStyle,
    updatedAt: Number(profile.updatedAt || 0)
  };
}

async function saveSocialProfile(env, groupId, profile) {
  const next = {
    version: SOCIAL_PROFILE_VERSION,
    canon: normalizeCanon(profile?.canon || DEFAULT_CANON),
    generatedCanon: normalizeGeneratedCanon(profile?.generatedCanon),
    updatedAt: Date.now()
  };
  await dbPut(env, socialProfileKey(groupId), JSON.stringify(next));
  return { ...next, style: normalizeStyle(await readJson(env, socialStyleKey(groupId), DEFAULT_STYLE)) };
}

function effectivePersonaFact(profile, key) {
  const fixed = profile?.canon?.[key];
  if (fixed !== undefined && fixed !== null && fixed !== "" && !(Array.isArray(fixed) && !fixed.length)) return fixed;
  return profile?.generatedCanon?.[key]?.value ?? null;
}

function eventSegments(body) {
  if (Array.isArray(body?.message)) return body.message;
  return [];
}

function oneBotEventHasMedia(body) {
  if (eventSegments(body).some(part => ["image", "record", "video", "file", "forward"].includes(String(part?.type || "").toLowerCase()))) return true;
  return /\[CQ:(?:image|record|video|file|forward),/i.test(String(body?.raw_message || (typeof body?.message === "string" ? body.message : "")));
}

function eventMentionIds(body) {
  const ids = [];
  for (const part of eventSegments(body)) {
    if (String(part?.type || "").toLowerCase() !== "at") continue;
    const id = part?.data?.qq ?? part?.data?.user_id;
    if (id !== undefined && id !== null) ids.push(String(id));
  }
  const raw = String(body?.raw_message || (typeof body?.message === "string" ? body.message : ""));
  for (const match of raw.matchAll(/\[CQ:at,[^\]]*qq=([^,\]]+)/gi)) ids.push(String(match[1] || ""));
  return [...new Set(ids.filter(Boolean))];
}

function eventVisibleText(body) {
  if (Array.isArray(body?.message)) {
    return body.message.map(part => {
      const type = String(part?.type || "").toLowerCase();
      if (type === "text") return String(part?.data?.text || "");
      if (type === "image") return "[图片]";
      if (type === "record") return "[语音]";
      if (type === "video") return "[视频]";
      if (type === "file") return "[文件]";
      if (type === "forward") return "[转发消息]";
      return "";
    }).join("").trim();
  }
  return String(body?.raw_message || body?.message || "")
    .replace(/\[CQ:at,[^\]]+\]/gi, "")
    .replace(/\[CQ:reply,[^\]]+\]/gi, "")
    .replace(/\[CQ:image,[^\]]+\]/gi, "[图片]")
    .replace(/\[CQ:record,[^\]]+\]/gi, "[语音]")
    .replace(/\[CQ:video,[^\]]+\]/gi, "[视频]")
    .replace(/\[CQ:file,[^\]]+\]/gi, "[文件]")
    .replace(/\[CQ:forward,[^\]]+\]/gi, "[转发消息]")
    .replace(/\[CQ:[^\]]+\]/gi, "")
    .trim();
}

function oneBotEventIsBareMention(body) {
  const selfId = String(body?.self_id || "");
  if (!selfId || body?.message_type !== "group" || !eventMentionIds(body).includes(selfId)) return false;
  return !eventVisibleText(body) && !oneBotEventHasMedia(body);
}

function socialInputDelayMs(parts) {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (!list.length) return 1200;
  const latest = list[list.length - 1];
  if (oneBotEventIsBareMention(latest)) return 3400;
  if (oneBotEventHasMedia(latest)) return list.length > 1 ? 1500 : 2200;
  if (list.length > 1) return 1100;
  return 1300;
}

async function shouldSendSocialBufferNotice(env, groupId) {
  return await dbGet(env, `social_buffer_notice_enabled:${cleanId(groupId)}`) === "true";
}

function ema(previous, current, alpha = SOCIAL_STYLE_ALPHA) {
  return Number(previous || 0) * (1 - alpha) + Number(current || 0) * alpha;
}

function hasEmoji(text) {
  try { return /\p{Extended_Pictographic}/u.test(text); } catch { return false; }
}

function hasKaomoji(text) {
  return /[（(][^）)]{0,24}(?:ω|▽|≧|≦|＾|•|﹏|Д|皿|￣|｀|´)[^）)]{0,24}[）)]/.test(text);
}

async function observeSocialStyle(env, { groupId, text, isCommand = false, isRobot = false }) {
  const source = String(text || "").trim();
  if (!groupId || !source || isCommand || isRobot || source.length > 500 || /^https?:\/\//i.test(source)) return null;
  const previous = normalizeStyle(await readJson(env, socialStyleKey(groupId), DEFAULT_STYLE));
  const chars = [...source.replace(/\s+/g, "")].length;
  const punctuationOnly = /^[.。…?？!！~～]{1,8}$/.test(source) ? 1 : 0;
  const repeatedQuestion = /(?:\?\?+|？？+)/.test(source) ? 1 : 0;
  const ellipsis = /(?:\.\.\.+|……+|。。。+)/.test(source) ? 1 : 0;
  const actionText = /^[（(][^）)]{1,30}[）)]$/.test(source) ? 1 : 0;
  const next = {
    samples: previous.samples + 1,
    averageChars: ema(previous.averageChars, clamp(chars, 1, 300)),
    emojiRate: ema(previous.emojiRate, hasEmoji(source) ? 1 : 0),
    kaomojiRate: ema(previous.kaomojiRate, hasKaomoji(source) ? 1 : 0),
    punctuationOnlyRate: ema(previous.punctuationOnlyRate, punctuationOnly),
    repeatedQuestionRate: ema(previous.repeatedQuestionRate, repeatedQuestion),
    ellipsisRate: ema(previous.ellipsisRate, ellipsis),
    actionTextRate: ema(previous.actionTextRate, actionText),
    lineBreakRate: ema(previous.lineBreakRate, source.includes("\n") ? 1 : 0),
    updatedAt: Date.now()
  };
  await dbPut(env, socialStyleKey(groupId), JSON.stringify(next));
  return next;
}

function normalizeRelationship(value, userId) {
  const source = value && typeof value === "object" ? value : {};
  return {
    userId: cleanId(userId),
    familiarity: clamp(source.familiarity ?? 0.25, 0, 1),
    teasingTolerance: clamp(source.teasingTolerance ?? 0.25, 0, 1),
    playfulCount: Math.max(0, Math.trunc(Number(source.playfulCount || 0))),
    seriousConflictCount: Math.max(0, Math.trunc(Number(source.seriousConflictCount || 0))),
    repairCount: Math.max(0, Math.trunc(Number(source.repairCount || 0))),
    quietUntil: Number(source.quietUntil || 0),
    lastSceneType: String(source.lastSceneType || ""),
    lastAt: Number(source.lastAt || 0)
  };
}

async function getSocialRelationship(env, groupId, userId) {
  const item = normalizeRelationship(await readJson(env, socialRelationshipKey(groupId, userId), null), userId);
  if (item.lastAt && Date.now() - item.lastAt > SOCIAL_RELATION_TTL_MS) return normalizeRelationship(null, userId);
  return item;
}

async function updateSocialRelationship(env, groupId, userId, sceneType) {
  const current = await getSocialRelationship(env, groupId, userId);
  const next = { ...current, lastSceneType: sceneType, lastAt: Date.now() };
  if (sceneType === "playful_tease" || sceneType === "action_play") {
    next.playfulCount += 1;
    next.familiarity = clamp(next.familiarity + 0.015, 0, 1);
    next.teasingTolerance = clamp(next.teasingTolerance + 0.02, 0, 1);
  } else if (sceneType === "serious_attack") {
    next.seriousConflictCount += 1;
    next.teasingTolerance = clamp(next.teasingTolerance - 0.08, 0, 1);
  } else if (sceneType === "repair") {
    next.repairCount += 1;
    next.quietUntil = Date.now() + 5 * 60 * 1000;
  } else if (sceneType === "casual" || sceneType === "question") {
    next.familiarity = clamp(next.familiarity + 0.003, 0, 1);
  }
  await dbPut(env, socialRelationshipKey(groupId, userId), JSON.stringify(next));
  return next;
}

function localSocialDecision({ text, recentContext = "", direct = false, hasMedia = false, relationship }) {
  const source = String(text || "").trim();
  const context = String(recentContext || "");
  const punctuationOnly = /^[.。…?？!！~～]{1,8}$/.test(source);
  const actionPlay = /^[（(][^）)]{1,30}[）)]$/.test(source) || /^(?:抱抱|抱走|抢|搶|喂猫条|餵貓條|喂鱼干|餵魚乾|蹭蹭|摸摸|看看腿|呜呜呜|嗚嗚嗚)$/.test(source);
  const repair = /(?:你把.+(?:说哭|說哭)|说得太过分|說得太過分|你过分了|你太过分|道歉|别说了|別說了|不许再说|不許再說|真的生气|真的生氣|伤到人|傷到人)/i.test(source);
  const severeWords = /(?:去死|废物|廢物|脑残|腦殘|垃圾东西|滾出去|滚出去|有病吧|你妈|你媽|全家|活该|活該)/i.test(source);
  const mildTease = /(?:人工智障|笨蛋|笨死|你好笨|你真笨|傻瓜|你傻|菜狗|呆子)/i.test(source);
  const playfulSignals = /(?:哈哈|笑死|草|哼|呜呜|嗚嗚|开玩笑|開玩笑|逗你|皮痒|皮癢|抱抱|摸摸)/i.test(source + "\n" + context.slice(-1000));
  const objections = /(?:别骂|別罵|别吵|別吵|别说了|別說了|太过分|太過分|不舒服|真生气|真生氣)/i.test(context.slice(-1500));
  let sceneType = "casual";
  let outputType = "micro_chat";
  let action = "reply";
  let maxChars = 36;
  let confidence = 0.72;
  if (repair) {
    sceneType = "repair";
    outputType = severeWords || /(?:哭|伤|傷|真的)/i.test(source) ? "normal_chat" : "micro_chat";
    action = outputType === "normal_chat" ? "apology_serious" : "apology_light";
    maxChars = outputType === "normal_chat" ? 120 : 36;
    confidence = 0.9;
  } else if (punctuationOnly) {
    sceneType = "punctuation";
    outputType = "punctuation";
    maxChars = 6;
    confidence = 0.98;
  } else if (actionPlay) {
    sceneType = "action_play";
    outputType = "action_text";
    maxChars = 24;
    confidence = 0.9;
  } else if (severeWords || (mildTease && objections && !playfulSignals)) {
    sceneType = "serious_attack";
    outputType = "micro_chat";
    action = "boundary_reply";
    maxChars = 32;
    confidence = severeWords ? 0.9 : 0.68;
  } else if (mildTease) {
    sceneType = "playful_tease";
    outputType = "micro_chat";
    action = "tease_back";
    maxChars = 24;
    confidence = playfulSignals || Number(relationship?.teasingTolerance || 0) >= 0.45 ? 0.86 : 0.62;
  } else if (hasMedia) {
    sceneType = "media_reaction";
    outputType = "reaction";
    maxChars = 24;
    confidence = 0.8;
  } else if (/[?？]|(?:吗|嗎|么|麼|咋|怎么|怎麼|为什么|為什麼|谁|誰|哪|啥|什么|什麼)$/.test(source)) {
    sceneType = "question";
    outputType = source.length > 60 ? "normal_chat" : "micro_chat";
    maxChars = source.length > 60 ? 140 : 60;
    confidence = 0.82;
  }
  const mayInterject = !direct && ["media_reaction", "question", "action_play"].includes(sceneType) && !objections;
  const allowLowContextInterject = !direct && ["media_reaction", "action_play"].includes(sceneType);
  return {
    sceneType,
    outputType,
    action,
    maxChars,
    confidence,
    shouldReply: direct || mayInterject,
    mayInterject,
    allowLowContextInterject,
    reason: `local:${sceneType}`
  };
}

function parseDecisionJson(text) {
  try { return JSON.parse(String(text || "").match(/\{[\s\S]*\}/)?.[0] || "{}"); } catch { return {}; }
}

async function chooseManagerMention(env, groupId, userId, relation, action) {
  if (action !== "manager_appeal" || Number(relation?.seriousConflictCount || 0) < 2) return "";
  const key = `social_manager_appeal:${cleanId(groupId)}:${cleanId(userId)}`;
  const lastAt = Number(await dbGet(env, key) || 0);
  if (lastAt && Date.now() - lastAt < SOCIAL_MANAGER_APPEAL_COOLDOWN_MS) return "";
  const members = await readJson(env, `group_members:${cleanId(groupId)}`, []);
  const managers = (Array.isArray(members) ? members : []).filter(item => ["owner", "admin", "developer"].includes(String(item?.role || "")) && cleanId(item?.qq || item?.user_id));
  if (!managers.length) return "";
  const selected = managers[Math.floor(Math.random() * managers.length)];
  await dbPut(env, key, String(Date.now()));
  return cleanId(selected?.qq || selected?.user_id);
}

async function buildSocialDecision(env, { groupId, userId, senderName = "", text, recentContext = "", direct = false, hasMedia = false, isPrivate = false }) {
  const profile = await getSocialProfile(env, groupId);
  const previousRelationship = await getSocialRelationship(env, groupId, userId);
  let decision = localSocialDecision({ text, recentContext, direct, hasMedia, relationship: previousRelationship });
  const risky = /(?:笨|傻|智障|废物|廢物|垃圾|滚|滾|去死|哭|生气|生氣|道歉|过分|過分|欺负|欺負)/i.test(String(text || ""));
  if (risky && !isPrivate) {
    try {
      const result = await callGoogleDecision(env, {
        system: `你是 QQ 粉丝群的社交场景判断器，不负责直接回复。区分玩笑互怼、故意攻击、小情绪、真实受伤和修复场景。只能输出 JSON：{"sceneType":"playful_tease|serious_attack|repair|casual","outputType":"punctuation|reaction|micro_chat|normal_chat","action":"tease_back|boundary_reply|manager_appeal|apology_light|apology_serious|reply","maxChars":数字,"confidence":0到1,"reason":"简短原因"}。
规则：熟人轻度互怼可以回嘴但不得升级；真实攻击可以设边界，连续攻击才可低频向管理卖惨；小事道歉要自然简短，确实伤人时必须诚恳。不得把单个“笨蛋”一律判断为恶意。`,
        prompt: JSON.stringify({ senderName, text: String(text || "").slice(0, 500), recentContext: String(recentContext || "").slice(-3500), relationship: previousRelationship }).slice(0, 6000),
        maxOutputTokens: 180,
        deadlineAt: Date.now() + 7000,
        maxAttempts: 1
      });
      const parsed = parseDecisionJson(result?.text);
      const sceneTypes = ["playful_tease", "serious_attack", "repair", "casual"];
      const outputTypes = ["punctuation", "reaction", "micro_chat", "normal_chat"];
      const actions = ["tease_back", "boundary_reply", "manager_appeal", "apology_light", "apology_serious", "reply"];
      if (sceneTypes.includes(parsed.sceneType) && Number(parsed.confidence || 0) >= 0.62) {
        decision = {
          ...decision,
          sceneType: parsed.sceneType,
          outputType: outputTypes.includes(parsed.outputType) ? parsed.outputType : decision.outputType,
          action: actions.includes(parsed.action) ? parsed.action : decision.action,
          maxChars: clamp(parsed.maxChars || decision.maxChars, 4, 160),
          confidence: clamp(parsed.confidence, 0, 1),
          reason: String(parsed.reason || "social_scene_ai").slice(0, 300),
          shouldReply: direct || decision.mayInterject
        };
      }
    } catch (error) {
      decision = { ...decision, sceneAiError: String(error?.message || error).slice(0, 300) };
    }
  }
  const relationship = await updateSocialRelationship(env, groupId, userId, decision.sceneType);
  const managerMentionId = await chooseManagerMention(env, groupId, userId, relationship, decision.action).catch(() => "");
  return { ...decision, profile, relationship, managerMentionId };
}

function personaFactsForPrompt(profile) {
  const rows = [];
  for (const [key, label] of [["name", "名字"], ["birthday", "生日"], ["age", "年龄"], ["gender", "性别"], ["heightCm", "身高"], ["weight", "体重"]]) {
    const value = effectivePersonaFact(profile, key);
    if (value !== null && value !== "") rows.push(`${label}=${key === "heightCm" ? `${value}cm` : value}`);
  }
  if (profile?.canon?.gamesPlayed?.length) rows.push(`明确玩过的游戏=${profile.canon.gamesPlayed.join("、")}`);
  if (profile?.canon?.gamesNotPlayed?.length) rows.push(`明确没玩的游戏=${profile.canon.gamesNotPlayed.join("、")}`);
  return rows;
}

function buildSocialPromptBlock({ decision, profile, relationship, direct = false }) {
  const style = normalizeStyle(profile?.style || DEFAULT_STYLE);
  const facts = personaFactsForPrompt(profile);
  const emojiPolicy = style.samples >= 20 && style.emojiRate >= 0.05 ? "最多一个普通表情符号" : "不要使用 Emoji 或颜文字";
  return `【社交决策层：脑与嘴分离】
本轮场景=${decision.sceneType}；行为=${decision.action}；输出形态=${decision.outputType}；建议上限=${Math.round(decision.maxChars || 60)}字；判断信心=${Number(decision.confidence || 0).toFixed(2)}。
必须执行行为决策，不要在回复中解释这些标签。允许只回“.”、“...”、“？”、“？？？”、极短口语或括号动作，不得为了完整而扩写。
群体风格统计：平均约 ${Math.round(style.averageChars)} 字；重复问号比例 ${Math.round(style.repeatedQuestionRate * 100)}%；省略号比例 ${Math.round(style.ellipsisRate * 100)}%；括号动作比例 ${Math.round(style.actionTextRate * 100)}%。只模仿句长、标点、拆句和口语程度，不复制任何单一群友的秘密、攻击词或专属口癖。
${emojiPolicy}。禁止客服腔、教程腔、“作为 AI”、过量礼貌和机械总结。
互怼规则：玩笑可以回“你才是”“哼”“你皮痒了？”等轻度回嘴或卖惨，但不得升级到外貌、家庭、疾病、智力缺陷、现实创伤和恶毒诅咒。真攻击只回一次边界或低频向管理卖惨，随后降温。
道歉规则：小情绪可用“好嘛，对不起”“不气了，抱抱”；明确伤到人时必须诚恳承担责任，不能只用抱抱敷衍。
人格连续性：${facts.length ? facts.join("；") : "尚无固定个人资料"}。已存在的资料绝不能改变；没有资料且被直接询问时可以形成一个普通设定，但不能伪造可验证的现实行为、游戏账号、在线状态或线下承诺。别人邀请打游戏而资料没有确认玩过时，只能自然说没玩、没空、正在忙或不了解。
${direct ? "当前是直接互动，应给出符合场景的自然回应。" : "当前是候选主动插话；接不上话题时只输出 [SKIP]。"}`;
}

function removeEmoji(text, maxCount) {
  let seen = 0;
  try {
    return String(text || "").replace(/\p{Extended_Pictographic}/gu, match => {
      seen += 1;
      return seen <= maxCount ? match : "";
    });
  } catch {
    return String(text || "");
  }
}

function removeKaomoji(text) {
  return String(text || "").replace(/[（(][^）)]{0,24}(?:ω|▽|≧|≦|＾|•|﹏|Д|皿|￣|｀|´)[^）)]{0,24}[）)]/g, "");
}

function compactToChars(text, maxChars) {
  const chars = [...String(text || "").trim()];
  if (chars.length <= maxChars) return chars.join("");
  const sliced = chars.slice(0, maxChars).join("");
  const boundary = Math.max(sliced.lastIndexOf("。"), sliced.lastIndexOf("！"), sliced.lastIndexOf("？"), sliced.lastIndexOf("!"), sliced.lastIndexOf("?"), sliced.lastIndexOf("\n"));
  return (boundary >= Math.floor(maxChars * 0.45) ? sliced.slice(0, boundary + 1) : sliced).trim();
}

function safeAggressiveReply(text, decision) {
  const unsafe = /(?:废物|廢物|脑残|腦殘|智障东西|你妈|你媽|全家|去死|活该|活該|贱|賤|没人要|沒人要|有病|没教养|沒教養)/i;
  if (!unsafe.test(text)) return text;
  if (decision.sceneType === "playful_tease") return "你才是，哼";
  return "少骂我，不跟你吵了";
}

function personaFactAnswer(profile, userText) {
  const source = String(userText || "");
  const height = effectivePersonaFact(profile, "heightCm");
  if (height && /(?:多高|身高)/i.test(source)) return `我${height}cm`;
  const age = effectivePersonaFact(profile, "age");
  if (age && /(?:多大|几岁|幾歲|年龄|年齡)/i.test(source)) return `我${age}岁`;
  const birthday = effectivePersonaFact(profile, "birthday");
  if (birthday && /(?:生日|哪天出生)/i.test(source)) return `我生日是${birthday}`;
  const gender = effectivePersonaFact(profile, "gender");
  if (gender && /(?:性别|性別|男的女的|男生女生)/i.test(source)) return `我是${gender}`;
  const weight = effectivePersonaFact(profile, "weight");
  if (weight && /(?:体重|體重|多重)/i.test(source)) return `我${weight}`;
  return "";
}

function applySocialOutputPolicy({ text, userText = "", decision, profile, isGroup = true, explicitLong = false }) {
  const style = normalizeStyle(profile?.style || DEFAULT_STYLE);
  const fixedAnswer = personaFactAnswer(profile, userText);
  if (fixedAnswer) return fixedAnswer;
  let output = String(text || "")
    .replace(/\*\*|```|^#+\s*/gm, "")
    .replace(/(?:作为一个?AI|作为人工智能|很高兴为你解答|希望以上内容对你有所帮助|如果你愿意的话)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const emojiMax = style.samples >= 20 && style.emojiRate >= 0.05 ? 1 : 0;
  output = removeEmoji(output, emojiMax);
  if (!(style.samples >= 20 && style.kaomojiRate >= 0.04)) output = removeKaomoji(output);
  output = safeAggressiveReply(output, decision);
  if (decision.action === "apology_serious" && !/(?:对不起|抱歉)/.test(output)) output = "对不起，刚才那句确实过分了。我会停下，不再拿这件事开玩笑。";
  if (decision.action === "apology_light" && (!output || output.length > 50 || /(?:深表歉意|造成困扰|作为)/.test(output))) output = "好嘛，对不起，抱抱";
  if (decision.action === "manager_appeal" && (!output || output.length > 40)) output = "呜呜呜，他欺负我";
  if (decision.outputType === "punctuation" && !/^[.。…?？!！~～]{1,8}$/.test(output)) {
    output = /[?？]/.test(String(userText || "")) ? "？？？" : "...";
  }
  if (!output) {
    if (decision.sceneType === "playful_tease") output = "你才是，哼";
    else if (decision.sceneType === "serious_attack") output = "少骂我";
    else if (decision.sceneType === "repair") output = decision.action === "apology_serious" ? "对不起，刚才是我过分了" : "好嘛，对不起";
    else if (decision.outputType === "punctuation") output = "？";
    else output = "嗯？";
  }
  let maxChars = clamp(decision.maxChars || 60, 4, isGroup ? 300 : 2000);
  if (isGroup && explicitLong) maxChars = Math.max(maxChars, 260);
  if (isGroup && !explicitLong) {
    if (decision.outputType === "reaction") maxChars = Math.min(maxChars, 16);
    if (decision.outputType === "micro_chat") maxChars = Math.min(maxChars, Math.max(24, Math.round(style.averageChars * 2.5)));
    if (decision.outputType === "normal_chat") maxChars = Math.min(maxChars, Math.max(80, Math.round(style.averageChars * 7)));
  }
  return compactToChars(output.replace(/\s+([，。！？!?])/g, "$1").trim(), Math.round(maxChars));
}

function extractGeneratedFact(userText, replyText) {
  const user = String(userText || "");
  const reply = String(replyText || "");
  if (/(?:多高|身高)/i.test(user)) {
    const match = reply.match(/(\d{2,3})\s*(?:cm|厘米|公分)/i);
    if (match && Number(match[1]) >= 100 && Number(match[1]) <= 220) return { key: "heightCm", value: Number(match[1]) };
  }
  if (/(?:多大|几岁|幾歲|年龄|年齡)/i.test(user)) {
    const match = reply.match(/(\d{1,2})\s*岁/);
    if (match && Number(match[1]) >= 10 && Number(match[1]) <= 99) return { key: "age", value: Number(match[1]) };
  }
  if (/(?:生日|哪天出生)/i.test(user)) {
    const match = reply.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (match) return { key: "birthday", value: `${Number(match[1])}月${Number(match[2])}日` };
  }
  if (/(?:性别|性別|男的女的|男生女生)/i.test(user)) {
    const match = reply.match(/(?:我是|算是)?\s*(女生|女的|女性|男生|男的|男性)/);
    if (match) return { key: "gender", value: match[1] };
  }
  if (/(?:体重|體重|多重)/i.test(user)) {
    const match = reply.match(/(\d{2,3})\s*(公斤|kg|KG|斤)/);
    if (match) return { key: "weight", value: `${match[1]}${match[2]}` };
  }
  return null;
}

async function capturePersonaContinuity(env, { groupId, userText, replyText }) {
  const found = extractGeneratedFact(userText, replyText);
  if (!found) return null;
  const profile = await getSocialProfile(env, groupId);
  if (effectivePersonaFact(profile, found.key) !== null) return null;
  profile.generatedCanon[found.key] = { value: found.value, source: "first_generated_answer", createdAt: Date.now() };
  await saveSocialProfile(env, groupId, profile);
  return found;
}

function socialTypingDelayMs({ text, decision, isGroup = true, direct = false }) {
  if (!isGroup) return 0;
  const length = [...String(text || "")].length;
  const type = String(decision?.outputType || "micro_chat");
  let base = type === "punctuation" ? 280 : type === "reaction" ? 500 : type === "action_text" ? 650 : type === "normal_chat" ? 1200 : 750;
  base += Math.min(2600, length * (type === "normal_chat" ? 22 : 30));
  if (!direct) base = Math.max(450, base - 250);
  return Math.round(clamp(base + Math.random() * 650, 250, 4600));
}

async function waitForSocialTyping(args) {
  const delay = socialTypingDelayMs(args);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  return delay;
}

export {
  applySocialOutputPolicy,
  buildSocialDecision,
  buildSocialPromptBlock,
  capturePersonaContinuity,
  effectivePersonaFact,
  getSocialProfile,
  getSocialRelationship,
  oneBotEventHasMedia,
  oneBotEventIsBareMention,
  observeSocialStyle,
  shouldSendSocialBufferNotice,
  socialInputDelayMs,
  socialTypingDelayMs,
  waitForSocialTyping
};
