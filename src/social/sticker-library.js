import { dbGet, dbPut } from "../data/store.js";

const STICKER_LIMIT = 200;
const DEFAULT_STICKER_CATEGORIES = Object.freeze(["开心", "无语", "疑惑", "震惊", "抱抱", "生气", "道歉", "拒绝", "猫条", "鱼干", "看戏"]);

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function cleanGroupId(value) {
  return String(value || "").replace(/\D/g, "");
}

function stickerLibraryKey(groupId) {
  return `sticker_library:${cleanGroupId(groupId)}`;
}

function normalizeStickerSource(value) {
  const text = String(value || "").trim().slice(0, 1000);
  if (!text) return "";
  if (/^(?:https?:\/\/|base64:\/\/)/i.test(text)) return text;
  if (/^[\w./:@%+~=-]{1,500}$/.test(text)) return text;
  return "";
}

function normalizeSticker(item) {
  const source = item && typeof item === "object" ? item : {};
  const file = normalizeStickerSource(source.file || source.url || source.source);
  return {
    id: cleanId(source.id) || `stk_${crypto.randomUUID().slice(0, 12)}`,
    name: String(source.name || source.category || "未命名表情").trim().slice(0, 60),
    category: String(source.category || "其他").trim().slice(0, 30),
    file,
    enabled: source.enabled !== false,
    weight: Math.max(1, Math.min(100, Math.trunc(Number(source.weight || 10)))),
    createdAt: Number(source.createdAt || Date.now()),
    updatedAt: Number(source.updatedAt || Date.now()),
    createdBy: String(source.createdBy || "").replace(/\D/g, "")
  };
}

async function readStickerLibrary(env, groupId) {
  const raw = await dbGet(env, stickerLibraryKey(groupId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map(normalizeSticker).filter(item => item.file).slice(0, STICKER_LIMIT);
  } catch {
    return [];
  }
}

async function writeStickerLibrary(env, groupId, items) {
  const normalized = (Array.isArray(items) ? items : []).map(normalizeSticker).filter(item => item.file).slice(0, STICKER_LIMIT);
  await dbPut(env, stickerLibraryKey(groupId), JSON.stringify(normalized));
  return normalized;
}

async function upsertSticker(env, groupId, input, actorId = "") {
  const item = normalizeSticker({ ...input, createdBy: input?.createdBy || actorId, updatedAt: Date.now() });
  if (!item.file) return { ok: false, message: "表情图片地址或 OneBot 文件标识无效。" };
  const list = await readStickerLibrary(env, groupId);
  const index = list.findIndex(entry => entry.id === item.id);
  if (index >= 0) item.createdAt = list[index].createdAt;
  else if (list.length >= STICKER_LIMIT) return { ok: false, message: `表情库已达到 ${STICKER_LIMIT} 个上限。` };
  if (index >= 0) list[index] = item;
  else list.push(item);
  await writeStickerLibrary(env, groupId, list);
  return { ok: true, sticker: item };
}

async function removeSticker(env, groupId, stickerId) {
  const id = cleanId(stickerId);
  const list = await readStickerLibrary(env, groupId);
  const target = list.find(item => item.id === id) || null;
  if (!target) return null;
  await writeStickerLibrary(env, groupId, list.filter(item => item.id !== id));
  return target;
}

function weightedPick(items) {
  const list = (Array.isArray(items) ? items : []).filter(item => item.enabled && item.file);
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + Math.max(1, Number(item.weight || 1)), 0);
  let cursor = Math.random() * total;
  for (const item of list) {
    cursor -= Math.max(1, Number(item.weight || 1));
    if (cursor <= 0) return item;
  }
  return list[list.length - 1];
}

async function pickSticker(env, groupId, category = "") {
  const list = await readStickerLibrary(env, groupId);
  const wanted = String(category || "").trim().toLowerCase();
  const candidates = wanted
    ? list.filter(item => item.category.toLowerCase() === wanted || item.name.toLowerCase().includes(wanted))
    : list;
  return weightedPick(candidates.length ? candidates : list);
}

function stickerCategoryForText(value) {
  const text = String(value || "").replace(/\s+/g, "").toLowerCase();
  if (!text) return "";
  if (/^(?:抱抱|抱一下|摸摸|蹭蹭|贴贴|貼貼|抱走)$/.test(text)) return "抱抱";
  if (/^(?:对不起|對不起|抱歉|我错了|我錯了)$/.test(text)) return "道歉";
  if (/^(?:\?+|？+|啥|什么|什麼)$/.test(text)) return "疑惑";
  if (/^(?:草|6|666|笑死|哈哈+)$/.test(text)) return "开心";
  if (/^(?:不要|不行|拒绝|拒絕|达咩|達咩)$/.test(text)) return "拒绝";
  if (/^(?:生气|生氣|哼+|气死|氣死)$/.test(text)) return "生气";
  if (/^(?:震惊|震驚|真的假的|卧槽|臥槽)$/.test(text)) return "震惊";
  if (/^(?:无语|無語|\.\.\.|……|呵呵)$/.test(text)) return "无语";
  if (/猫条|貓條/.test(text)) return "猫条";
  if (/鱼干|魚乾/.test(text)) return "鱼干";
  return "";
}

async function pickStickerForText(env, groupId, text) {
  const category = stickerCategoryForText(text);
  if (!category) return null;
  return pickSticker(env, groupId, category);
}

function stickerCqMessage(sticker) {
  const file = normalizeStickerSource(sticker?.file);
  return file ? `[CQ:image,file=${file}]` : "";
}

export {
  DEFAULT_STICKER_CATEGORIES,
  STICKER_LIMIT,
  pickSticker,
  pickStickerForText,
  readStickerLibrary,
  removeSticker,
  stickerCategoryForText,
  stickerCqMessage,
  stickerLibraryKey,
  upsertSticker,
  writeStickerLibrary
};
