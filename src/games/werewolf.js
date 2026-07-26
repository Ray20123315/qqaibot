import { callGoogleDecision } from "../ai/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { jsonResponse, readJson } from "../portal/auth.js";
import { numericId } from "../security/network.js";

const WEREWOLF_VERSION = 1;
const WEREWOLF_MAX_PLAYERS = 32;
const WEREWOLF_MIN_PLAYERS = 5;
const WEREWOLF_DEFAULT_PHASE_SECONDS = Object.freeze({ sheriff: 180, night: 180, discussion: 300, vote: 180, deathSkill: 60 });
const WOLF_ROLES = new Set(["werewolf", "black_wolf_king", "white_wolf_king", "snow_wolf", "shapeshifter_wolf", "original_wolf", "berserk_wolf", "bomb_wolf", "blood_wolf"]);
const SEER_ROLES = new Set(["seer", "apprentice_seer"]);
const ACTIVE_PHASES = new Set(["sheriff_nomination", "sheriff_vote", "night", "day_discussion", "day_vote", "death_skill"]);

const ROLE_DEFINITIONS = Object.freeze({
  werewolf: { id: "werewolf", name: "狼人", team: "wolf", summary: "每晚与狼队共同选择一名非狼人玩家袭击。", action: "wolf_kill" },
  black_wolf_king: { id: "black_wolf_king", name: "黑狼王", team: "wolf", summary: "死亡后若符合条件，可带走一名仍存活玩家。", action: "wolf_kill", deathSkill: "shoot" },
  white_wolf_king: { id: "white_wolf_king", name: "白狼王", team: "wolf", summary: "白天可发动一次正式审判：公开牺牲自己、结束讨论并带走一人；普通自爆禁止。", action: "white_judgement" },
  snow_wolf: { id: "snow_wolf", name: "雪狼", team: "wolf", summary: "被预言家查验时显示为好人阵营。", action: "wolf_kill", passive: "seer_good" },
  shapeshifter_wolf: { id: "shapeshifter_wolf", name: "百变狼", team: "wolf", summary: "每晚选择一个伪装职业，影响预言家的查验结果。", action: "disguise" },
  original_wolf: { id: "original_wolf", name: "原初狼", team: "wolf", summary: "知道狼群成员，但普通狼人初始看到的同伴名单会被混淆。", action: "wolf_kill", passive: "traitor" },
  berserk_wolf: { id: "berserk_wolf", name: "暴走狼", team: "wolf", summary: "狼队成功击杀会积累狂暴；可消耗狂暴使自己的夜间刀票计为两票。", action: "berserk_vote" },
  bomb_wolf: { id: "bomb_wolf", name: "炸弹狼", team: "wolf", summary: "白天秘密植入炸弹；炸弹沿投票目标传递，最终持有者的当日票无效。", action: "plant_bomb" },
  blood_wolf: { id: "blood_wolf", name: "血狼", team: "wolf", summary: "每局一次发动血月，使当夜狼刀无视守卫保护。", action: "blood_moon" },

  cupid: { id: "cupid", name: "邱比特", team: "good", summary: "首夜前配对两名玩家成为恋人，也可选择自己。", action: "couple" },
  seer: { id: "seer", name: "预言家", team: "good", summary: "每晚查验一人的阵营，并写入可传承日记。", action: "inspect" },
  apprentice_seer: { id: "apprentice_seer", name: "见习预言家", team: "good", summary: "预言家死亡后晋升并继承日记。", action: "inactive" },
  witch: { id: "witch", name: "女巫", team: "good", summary: "拥有一瓶解药与一瓶毒药；每晚最多使用一种。", action: "witch" },
  hunter: { id: "hunter", name: "猎人", team: "good", summary: "符合条件死亡后可带走一名玩家。", action: "none", deathSkill: "shoot" },
  ninja: { id: "ninja", name: "忍者", team: "good", summary: "每晚选择替身；首次遭受夜间致死效果时转移给替身。", action: "decoy" },
  fraudster: { id: "fraudster", name: "诈欺师", team: "good", summary: "预言家查验时显示为狼人；每夜获得一条经过隐去身份的狼聊摘要。", action: "infiltrate", passive: "seer_wolf" },
  masochist_cultist: { id: "masochist_cultist", name: "抖M教徒", team: "good", summary: "白天可以投票但票无效；若成为白天唯一最高票者则触发个人胜利。", action: "invalid_vote", specialWin: "top_vote" },
  sadist_leader: { id: "sadist_leader", name: "抖S教主", team: "good", summary: "每局一次指定仍存活的抖M教徒作为下一次夜袭肉盾。", action: "meat_shield" },
  mermaid: { id: "mermaid", name: "人鱼", team: "good", summary: "每晚选择原目标与引导目标；若狼刀命中原目标则转向引导目标。", action: "redirect" },
  gravedigger: { id: "gravedigger", name: "掘墓者", team: "good", summary: "每局一次复制一名死者的职业技能，但阵营仍为好人。", action: "copy_dead" },
  knight: { id: "knight", name: "骑士", team: "good", summary: "白天每局一次决斗：目标为狼人则目标死亡，否则骑士死亡。", action: "duel" },
  guard: { id: "guard", name: "守卫", team: "good", summary: "每晚守护一人，不能连续守护同一人；守护预言家时可解除蛊惑。", action: "protect" },
  detective: { id: "detective", name: "侦探", team: "good", summary: "每晚追踪一人，获知其是否使用主动技能及目标类别，可识破伪装。", action: "track" },
  lecher: { id: "lecher", name: "色狼", team: "good", safeName: "夜访者", summary: "每晚拜访一名不同玩家；成功拜访三名仍存活玩家可触发个人胜利。全程仅为游戏标记，不产生性内容。", action: "visit", specialWin: "visit_three" },
  thief: { id: "thief", name: "盗贼", team: "good", summary: "每局一次与一名玩家交换职业；双方私讯获知新职业。", action: "swap_role" },
  villager: { id: "villager", name: "村民", team: "good", summary: "每局一次夜间警戒；当夜若被狼刀命中则击退攻击并在天亮公开自己发动过警戒。", action: "vigilance" },

  wraith: { id: "wraith", name: "怨灵", team: "spirit", summary: "夜间免疫狼刀；普通模式中狼人死光且怨灵仍存活时，怨灵独自获胜。", action: "none", passive: "night_immune" },
  voodoo_girl: { id: "voodoo_girl", name: "巫毒女孩", team: "spirit", summary: "每晚诅咒一人，累计三层时目标死亡。", action: "curse" },
  enchanter: { id: "enchanter", name: "蛊惑师", team: "spirit", summary: "每晚蛊惑一人；若目标为预言家系，则下一次查验失效，守卫可解除。", action: "hex" }
});

const ROLE_IDS = Object.freeze(Object.keys(ROLE_DEFINITIONS));

function cleanId(value) {
  const source = String(value || "").trim();
  if (/^ai:\d+$/.test(source)) return source;
  return source.replace(/\D/g, "");
}

function nowMs() { return Date.now(); }
function unique(list) { return [...new Set((list || []).filter(Boolean))]; }
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function roleDef(roleId) { return ROLE_DEFINITIONS[String(roleId || "")] || ROLE_DEFINITIONS.villager; }
function isWolfRole(roleId) { return WOLF_ROLES.has(String(roleId || "")); }
function isAiPlayer(player) { return Boolean(player?.isAi || /^ai:\d+$/.test(String(player?.id || ""))); }
function livingPlayers(game) { return (game.players || []).filter(player => player.alive !== false); }
function playerById(game, userId) { return (game.players || []).find(player => String(player.id) === String(userId)) || null; }
function gameKey(groupId) { return `werewolf:game:${cleanId(groupId)}`; }
function activeIndexKey() { return "werewolf:active_groups"; }
function userGameIndexKey(userId) { return `werewolf:user_games:${cleanId(userId)}`; }

function normalizePhaseSeconds(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    sheriff: Math.max(30, Math.min(1800, Number(source.sheriff || WEREWOLF_DEFAULT_PHASE_SECONDS.sheriff))),
    night: Math.max(30, Math.min(1800, Number(source.night || WEREWOLF_DEFAULT_PHASE_SECONDS.night))),
    discussion: Math.max(60, Math.min(3600, Number(source.discussion || WEREWOLF_DEFAULT_PHASE_SECONDS.discussion))),
    vote: Math.max(30, Math.min(1800, Number(source.vote || WEREWOLF_DEFAULT_PHASE_SECONDS.vote))),
    deathSkill: Math.max(20, Math.min(300, Number(source.deathSkill || WEREWOLF_DEFAULT_PHASE_SECONDS.deathSkill)))
  };
}

function normalizeWerewolfConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    maxPlayers: Math.max(WEREWOLF_MIN_PLAYERS, Math.min(WEREWOLF_MAX_PLAYERS, Math.trunc(Number(source.maxPlayers || 12)))),
    aiCount: Math.max(0, Math.min(12, Math.trunc(Number(source.aiCount || 0)))),
    sheriffEnabled: source.sheriffEnabled !== false,
    groupCount: Math.max(0, Math.min(8, Math.trunc(Number(source.groupCount || 0)))),
    selectedRoles: unique((Array.isArray(source.selectedRoles) ? source.selectedRoles : []).map(String).filter(id => ROLE_DEFINITIONS[id])).slice(0, WEREWOLF_MAX_PLAYERS),
    phaseSeconds: normalizePhaseSeconds(source.phaseSeconds),
    publicDayDiscussion: true,
    wolfChatPrivateOnly: true,
    selfExplosionAllowed: false
  };
}

function buildBalancedRoleDeck(playerCount, selectedRoles = []) {
  const count = Math.max(WEREWOLF_MIN_PLAYERS, Math.min(WEREWOLF_MAX_PLAYERS, Math.trunc(Number(playerCount || 0))));
  const chosen = unique((selectedRoles || []).filter(id => ROLE_DEFINITIONS[id])).slice(0, count);
  const deck = [...chosen];
  const wolfTarget = Math.max(1, Math.round(count / 4));
  const currentWolves = deck.filter(isWolfRole).length;
  const defaultWolves = ["werewolf", "snow_wolf", "black_wolf_king", "shapeshifter_wolf", "blood_wolf", "original_wolf", "berserk_wolf", "bomb_wolf", "white_wolf_king"];
  for (const id of defaultWolves) {
    if (deck.length >= count || deck.filter(isWolfRole).length >= wolfTarget) break;
    if (!deck.includes(id)) deck.push(id);
  }
  while (deck.filter(isWolfRole).length < wolfTarget && deck.length < count) deck.push("werewolf");
  const goodDefaults = ["seer", "witch", "hunter", "guard", "apprentice_seer", "cupid", "knight", "detective", "ninja", "mermaid", "gravedigger", "thief", "sadist_leader", "masochist_cultist", "fraudster", "lecher"];
  for (const id of goodDefaults) {
    if (deck.length >= count) break;
    if (!deck.includes(id)) deck.push(id);
  }
  if (count >= 11 && deck.length < count && !deck.includes("wraith")) deck.push("wraith");
  if (count >= 14 && deck.length < count && !deck.includes("voodoo_girl")) deck.push("voodoo_girl");
  if (count >= 16 && deck.length < count && !deck.includes("enchanter")) deck.push("enchanter");
  while (deck.length < count) deck.push("villager");
  return shuffle(deck.slice(0, count));
}

function newPlayer({ id, name, isAi = false, joinedAt = nowMs() }) {
  return {
    id: cleanId(id), name: String(name || id || "玩家").slice(0, 80), isAi: Boolean(isAi), joinedAt,
    alive: true, roleId: "", originalRoleId: "", team: "", groupTeam: 0, sheriffCandidate: false,
    roleState: {}, diary: [], privateNotices: [], lastActionAt: 0
  };
}

function createGame({ groupId, creatorId, creatorName, config }) {
  const normalized = normalizeWerewolfConfig(config);
  return {
    version: WEREWOLF_VERSION,
    id: `ww_${cleanId(groupId)}_${nowMs().toString(36)}`,
    groupId: cleanId(groupId), creatorId: cleanId(creatorId), creatorName: String(creatorName || creatorId || "房主").slice(0, 80),
    status: "lobby", phase: "lobby", phaseRound: 0, phaseEndsAt: 0, day: 0, night: 0,
    config: normalized,
    players: [],
    sheriff: { enabled: normalized.sheriffEnabled, holderId: "", candidates: [], alternates: [], voteRound: 0, votes: {} },
    dayVotes: {}, nightActions: {}, publicLog: [], wolfChat: [], deaths: [], pendingDeathSkill: null,
    lovers: [], bloodMoonActive: false, bomb: null, winner: null, pausedAt: 0,
    createdAt: nowMs(), updatedAt: nowMs(), startedAt: 0, endedAt: 0
  };
}

async function readGame(env, groupId) {
  const raw = await dbGet(env, gameKey(groupId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveGame(env, game) {
  game.updatedAt = nowMs();
  await dbPut(env, gameKey(game.groupId), JSON.stringify(game));
  const active = await readJson(env, activeIndexKey(), []);
  const next = game.status === "ended" || game.status === "aborted"
    ? active.map(String).filter(id => id !== String(game.groupId))
    : unique([...active.map(String), String(game.groupId)]);
  await dbPut(env, activeIndexKey(), JSON.stringify(next));
  for (const player of game.players || []) {
    if (isAiPlayer(player)) continue;
    const groups = await readJson(env, userGameIndexKey(player.id), []);
    const userNext = game.status === "ended" || game.status === "aborted"
      ? groups.map(String).filter(id => id !== String(game.groupId))
      : unique([...groups.map(String), String(game.groupId)]);
    await dbPut(env, userGameIndexKey(player.id), JSON.stringify(userNext));
  }
  return game;
}

async function sendGroup(env, groupId, message) {
  return callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000);
}

async function sendPrivate(env, userId, message) {
  if (!/^\d{5,}$/.test(String(userId || ""))) return null;
  return callOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(userId), message, auto_escape: false } }, 15000);
}

function appendPublic(game, text, type = "system", extra = {}) {
  game.publicLog.push({ id: crypto.randomUUID(), at: nowMs(), type, text: String(text || "").slice(0, 4000), ...extra });
  if (game.publicLog.length > 500) game.publicLog = game.publicLog.slice(-500);
}

function appendPrivate(player, text, type = "system", extra = {}) {
  player.privateNotices = Array.isArray(player.privateNotices) ? player.privateNotices : [];
  player.privateNotices.push({ id: crypto.randomUUID(), at: nowMs(), type, text: String(text || "").slice(0, 4000), ...extra });
  if (player.privateNotices.length > 200) player.privateNotices = player.privateNotices.slice(-200);
}

function visibleWolfIds(game, viewer) {
  if (!viewer || !isWolfRole(viewer.roleId)) return [];
  const wolves = livingPlayers(game).filter(player => isWolfRole(player.roleId));
  if (viewer.roleId === "original_wolf") return wolves.map(player => player.id);
  const original = wolves.find(player => player.roleId === "original_wolf");
  if (!original || original.alive === false) return wolves.map(player => player.id);
  const nonWolf = livingPlayers(game).filter(player => !isWolfRole(player.roleId) && player.roleId !== "fraudster");
  const fake = nonWolf.length ? nonWolf[Math.abs(String(game.id).length + String(viewer.id).length) % nonWolf.length] : null;
  return unique(wolves.filter(player => player.id !== original.id).map(player => player.id).concat(fake ? [fake.id] : []));
}

function rolePrivateText(game, player) {
  const def = roleDef(player.roleId);
  const lines = [
    `【狼人杀身份】${def.name}`,
    `阵营：${def.team === "wolf" ? "狼人阵营" : def.team === "spirit" ? "怨灵阵营" : "好人阵营"}`,
    `能力：${def.summary}`,
    `群号：${game.groupId}`,
    "夜间技能必须私讯机器人或使用 Portal；白天讨论与投票在群内公开。普通自爆禁止。"
  ];
  if (isWolfRole(player.roleId)) {
    const visible = visibleWolfIds(game, player).map(id => playerById(game, id)?.name || id);
    lines.push(`你目前能辨认的狼队成员：${visible.length ? visible.join("、") : "仅自己"}`);
    lines.push(`狼人密谈：私讯「!狼聊 ${game.groupId} 内容」，只会发送给存活狼人。`);
  }
  if (game.config.groupCount > 1) lines.push(`隐藏分组：第 ${player.groupTeam} 组。每晚可私讯「!分组查验 ${game.groupId} QQ」查询同组或异组。`);
  lines.push(`查看身份：私讯「!狼人杀身份 ${game.groupId}」`);
  return lines.join("\n");
}

function phaseDuration(game, phase) {
  const map = game.config.phaseSeconds || WEREWOLF_DEFAULT_PHASE_SECONDS;
  if (phase.startsWith("sheriff")) return map.sheriff;
  if (phase === "night") return map.night;
  if (phase === "day_discussion") return map.discussion;
  if (phase === "day_vote") return map.vote;
  if (phase === "death_skill") return map.deathSkill;
  return 0;
}

function setPhase(game, phase, reason = "") {
  game.phase = phase;
  game.phaseRound = Number(game.phaseRound || 0) + 1;
  const duration = phaseDuration(game, phase);
  game.phaseEndsAt = duration ? nowMs() + duration * 1000 : 0;
  appendPublic(game, `阶段进入：${phaseLabel(phase)}${reason ? `｜${reason}` : ""}`, "phase", { phase });
}

function phaseLabel(phase) {
  return ({ lobby: "等待加入", sheriff_nomination: "警长候选报名", sheriff_vote: "警长投票", night: "夜晚行动", day_discussion: "白天公开讨论", day_vote: "白天放逐投票", death_skill: "死亡技能结算", ended: "游戏结束", paused: "暂停" })[phase] || phase;
}

function assignGroups(players, groupCount) {
  if (groupCount <= 1) return players.map(player => ({ ...player, groupTeam: 0 }));
  const shuffled = shuffle(players.map(player => player.id));
  const map = new Map(shuffled.map((id, index) => [id, index % groupCount + 1]));
  return players.map(player => ({ ...player, groupTeam: map.get(player.id) || 1 }));
}

async function distributeRoles(env, game) {
  const deck = buildBalancedRoleDeck(game.players.length, game.config.selectedRoles);
  const shuffledPlayers = shuffle(game.players);
  for (let index = 0; index < shuffledPlayers.length; index++) {
    const player = shuffledPlayers[index];
    player.roleId = deck[index] || "villager";
    player.originalRoleId = player.roleId;
    player.team = roleDef(player.roleId).team;
    player.roleState = {
      used: false, healAvailable: player.roleId === "witch", poisonAvailable: player.roleId === "witch",
      lastProtectedId: "", curseStacks: 0, visitedIds: [], frenzy: 0, disguiseRoleId: "villager", copiedRoleId: "",
      vigilanceActive: false, shieldTargetId: "", hexed: false, seerBlocked: false
    };
  }
  game.players = assignGroups(game.players, game.config.groupCount);
  for (const player of game.players) {
    appendPrivate(player, rolePrivateText(game, player), "role");
    if (!isAiPlayer(player)) await sendPrivate(env, player.id, rolePrivateText(game, player)).catch(async error => {
      await writeSystemAudit(env, { type: "werewolf_role_dm_failed", groupId: game.groupId, actorId: "system", targetId: player.id, action: "send_role", error: String(error?.message || error).slice(0, 300) }).catch(() => {});
    });
  }
}

function targetablePlayers(game, actorId, { includeSelf = false, aliveOnly = true } = {}) {
  return (game.players || []).filter(player => (!aliveOnly || player.alive !== false) && (includeSelf || player.id !== actorId));
}

function inspectResult(game, target) {
  if (!target) return "查验失败：目标不存在。";
  if (target.roleId === "snow_wolf") return `${target.name} 的阵营显示为：好人阵营。`;
  if (target.roleId === "fraudster") return `${target.name} 的阵营显示为：狼人阵营。`;
  if (target.roleId === "shapeshifter_wolf") {
    const disguise = roleDef(target.roleState?.disguiseRoleId || "villager");
    return `${target.name} 的查验结果显示为：${disguise.name}／${disguise.team === "wolf" ? "狼人阵营" : disguise.team === "spirit" ? "怨灵阵营" : "好人阵营"}。`;
  }
  return `${target.name} 的阵营显示为：${target.team === "wolf" ? "狼人阵营" : target.team === "spirit" ? "怨灵阵营" : "好人阵营"}。`;
}

function normalizeTargetId(game, raw) {
  const id = cleanId(raw);
  if (id && playerById(game, id)) return id;
  const text = String(raw || "").trim().toLowerCase();
  const matches = (game.players || []).filter(player => String(player.name || "").toLowerCase().includes(text));
  return matches.length === 1 ? matches[0].id : "";
}

function actionKey(playerId, kind) { return `${String(playerId)}:${String(kind)}`; }
function setNightAction(game, playerId, kind, payload = {}) {
  game.nightActions = game.nightActions && typeof game.nightActions === "object" ? game.nightActions : {};
  game.nightActions[actionKey(playerId, kind)] = { playerId: String(playerId), kind, at: nowMs(), ...payload };
}
function getNightActions(game, kind) { return Object.values(game.nightActions || {}).filter(action => action.kind === kind); }

function voteCounts(game, votes, { sheriffWeight = false, invalidMasochist = false } = {}) {
  const counts = {};
  for (const [voterId, targetId] of Object.entries(votes || {})) {
    const voter = playerById(game, voterId);
    if (!voter || voter.alive === false) continue;
    if (invalidMasochist && voter.roleId === "masochist_cultist") continue;
    let weight = sheriffWeight && game.sheriff?.holderId === voterId ? 1.5 : 1;
    counts[targetId] = Number(counts[targetId] || 0) + weight;
  }
  return counts;
}

function highestTargets(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!entries.length) return [];
  const top = Number(entries[0][1]);
  return entries.filter(([, value]) => Number(value) === top).map(([id]) => id);
}

function sheriffCandidatesFromVotes(game, counts) {
  return Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1])).map(([id]) => id).filter(id => playerById(game, id)?.alive !== false);
}

function nextSheriff(game) {
  if (game.sheriff?.holderId && playerById(game, game.sheriff.holderId)?.alive !== false) return;
  const next = (game.sheriff?.alternates || []).find(id => playerById(game, id)?.alive !== false) || "";
  game.sheriff.holderId = next;
  if (next) appendPublic(game, `${playerById(game, next)?.name || next} 继任警长。`, "sheriff");
}

function queueDeath(game, player, cause, killerId = "") {
  if (!player || player.alive === false) return false;
  player.alive = false;
  player.diedAt = nowMs();
  player.deathCause = cause;
  game.deaths.push({ userId: player.id, name: player.name, roleId: player.roleId, cause, killerId, at: nowMs() });
  appendPublic(game, `${player.name} 死亡。原因：${cause}。`, "death", { userId: player.id, cause });
  if (game.sheriff?.holderId === player.id) nextSheriff(game);
  return true;
}

function deathSkillEligible(player, cause) {
  if (!player || !["hunter", "black_wolf_king"].includes(player.roleId)) return false;
  if (/毒|诅咒/.test(String(cause || ""))) return false;
  return player.roleState?.used !== true;
}

function checkPendingDeathSkill(game, deadPlayers) {
  const eligible = (deadPlayers || []).find(({ player, cause }) => deathSkillEligible(player, cause));
  if (!eligible) return false;
  eligible.player.roleState.used = true;
  game.pendingDeathSkill = { actorId: eligible.player.id, roleId: eligible.player.roleId, cause: eligible.cause, expiresAt: nowMs() + phaseDuration(game, "death_skill") * 1000, resumePhase: game.phase === "night" ? "day_discussion" : "night" };
  setPhase(game, "death_skill", `${eligible.player.name} 可发动带走技能`);
  appendPrivate(eligible.player, `你可在时限内私讯「!狼人杀技能 ${game.groupId} 带走 目标QQ」。`, "death_skill");
  return true;
}

function promoteApprentice(game) {
  const seerAlive = livingPlayers(game).some(player => player.roleId === "seer");
  if (seerAlive) return;
  const apprentice = livingPlayers(game).find(player => player.roleId === "apprentice_seer");
  if (!apprentice || apprentice.roleState?.promoted) return;
  apprentice.roleId = "seer";
  apprentice.team = "good";
  apprentice.roleState.promoted = true;
  const diary = (game.players || []).find(player => player.originalRoleId === "seer")?.diary || [];
  apprentice.diary = [...diary];
  appendPrivate(apprentice, `预言家已经死亡，你晋升为预言家并继承日记：\n${diary.map(item => item.text).join("\n") || "暂无记录"}`, "promotion");
}

function loversWinState(game) {
  const ids = game.lovers || [];
  if (ids.length !== 2) return null;
  const alive = ids.map(id => playerById(game, id)).filter(player => player?.alive !== false);
  if (alive.length === 2 && livingPlayers(game).length === 2) return { team: "lovers", playerIds: ids, text: "恋人存活到最后，恋人阵营获胜。" };
  return null;
}

function resolveWerewolfWin(game) {
  if (!game || game.status !== "active") return game?.winner || null;
  const alive = livingPlayers(game);
  if (game.config.groupCount > 1) {
    const groups = unique(alive.map(player => player.groupTeam).filter(Boolean));
    return groups.length === 1 ? { team: `group_${groups[0]}`, playerIds: alive.map(player => player.id), text: `隐藏分组第 ${groups[0]} 组成为最后存活组，分组模式获胜。` } : null;
  }
  const specialVisit = alive.find(player => player.roleId === "lecher" && unique(player.roleState?.visitedIds || []).length >= 3);
  if (specialVisit) return { team: "lecher", playerIds: [specialVisit.id], text: `${specialVisit.name} 已完成三次不同夜访，触发个人胜利。` };
  const lovers = loversWinState(game);
  if (lovers) return lovers;
  const wolves = alive.filter(player => isWolfRole(player.roleId));
  const nonWolves = alive.filter(player => !isWolfRole(player.roleId));
  if (!wolves.length) {
    const wraith = alive.find(player => player.roleId === "wraith");
    if (wraith) return { team: "spirit", playerIds: [wraith.id], text: `狼人已经全灭，但怨灵 ${wraith.name} 仍潜伏在人群中，怨灵阵营获胜。` };
    return { team: "good", playerIds: nonWolves.map(player => player.id), text: "狼人已经全灭，好人阵营获胜。" };
  }
  if (wolves.length >= nonWolves.length) return { team: "wolf", playerIds: wolves.map(player => player.id), text: "狼人数量已不低于其他存活玩家，狼人阵营获胜。" };
  return null;
}

async function finishIfWon(env, game) {
  const winner = resolveWerewolfWin(game);
  if (!winner) return false;
  game.winner = winner;
  game.status = "ended";
  game.phase = "ended";
  game.phaseEndsAt = 0;
  game.endedAt = nowMs();
  appendPublic(game, winner.text, "winner", { winner });
  await saveGame(env, game);
  await sendGroup(env, game.groupId, `【狼人杀结束】${winner.text}\n身份公开：\n${game.players.map(player => `${player.name}：${roleDef(player.roleId).name}`).join("\n")}`).catch(() => null);
  return true;
}

function resolveBombVote(game, votes) {
  if (!game.bomb?.holderId) return { votes, invalidVoterId: "" };
  let holderId = String(game.bomb.holderId);
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    if (!holderId || seen.has(holderId)) break;
    seen.add(holderId);
    const next = votes[holderId];
    if (!next || !playerById(game, next)?.alive) break;
    holderId = String(next);
  }
  const nextVotes = { ...votes };
  delete nextVotes[holderId];
  game.bomb = null;
  return { votes: nextVotes, invalidVoterId: holderId };
}

function resolveWolfTarget(game) {
  const votes = getNightActions(game, "wolf_kill");
  const counts = {};
  for (const vote of votes) {
    const actor = playerById(game, vote.playerId);
    if (!actor || actor.alive === false || !isWolfRole(actor.roleId)) continue;
    const weight = vote.boosted === true && actor.roleId === "berserk_wolf" && Number(actor.roleState?.frenzy || 0) > 0 ? 2 : 1;
    counts[vote.targetId] = Number(counts[vote.targetId] || 0) + weight;
    if (weight > 1) actor.roleState.frenzy = Math.max(0, Number(actor.roleState.frenzy || 0) - 1);
  }
  const top = highestTargets(counts);
  return top.length ? playerById(game, top[Math.floor(Math.random() * top.length)]) : null;
}

async function resolveNight(env, game) {
  const dead = [];
  let wolfTarget = resolveWolfTarget(game);
  const bloodMoon = getNightActions(game, "blood_moon").some(action => playerById(game, action.playerId)?.alive !== false);
  game.bloodMoonActive = bloodMoon;
  const mermaid = getNightActions(game, "redirect").find(action => action.originalTargetId === wolfTarget?.id);
  if (mermaid) wolfTarget = playerById(game, mermaid.redirectTargetId) || wolfTarget;
  const shield = getNightActions(game, "meat_shield").find(action => action.targetId && playerById(game, action.playerId)?.alive !== false);
  if (shield && wolfTarget?.id === shield.playerId) wolfTarget = playerById(game, shield.targetId) || wolfTarget;
  const ninja = wolfTarget?.roleId === "ninja" ? getNightActions(game, "decoy").find(action => action.playerId === wolfTarget.id) : null;
  if (ninja && wolfTarget.roleState?.used !== true) {
    wolfTarget.roleState.used = true;
    wolfTarget = playerById(game, ninja.targetId) || wolfTarget;
  }
  const guardAction = getNightActions(game, "protect").find(action => action.targetId === wolfTarget?.id);
  const villageGuard = wolfTarget?.roleId === "villager" && wolfTarget.roleState?.vigilanceActive;
  const nightImmune = wolfTarget?.roleId === "wraith";
  const protectedFromWolf = Boolean(guardAction && !bloodMoon) || villageGuard || nightImmune;
  const healAction = getNightActions(game, "witch_heal")[0];
  if (wolfTarget && !protectedFromWolf && !(healAction && healAction.targetId === wolfTarget.id)) {
    if (queueDeath(game, wolfTarget, bloodMoon ? "血月狼袭" : "狼人夜袭", "wolf_team")) dead.push({ player: wolfTarget, cause: "狼人夜袭" });
    for (const player of livingPlayers(game).filter(player => isWolfRole(player.roleId))) player.roleState.frenzy = Number(player.roleState?.frenzy || 0) + 1;
  } else if (wolfTarget && villageGuard) {
    wolfTarget.roleState.vigilanceActive = false;
    appendPublic(game, `${wolfTarget.name} 的警戒击退了当夜袭击。`, "night_result");
  }
  const poisonAction = getNightActions(game, "witch_poison")[0];
  if (poisonAction) {
    const target = playerById(game, poisonAction.targetId);
    if (target && queueDeath(game, target, "女巫毒药", poisonAction.playerId)) dead.push({ player: target, cause: "女巫毒药" });
  }
  for (const action of getNightActions(game, "curse")) {
    const target = playerById(game, action.targetId);
    if (!target || target.alive === false) continue;
    target.roleState.curseStacks = Number(target.roleState?.curseStacks || 0) + 1;
    if (target.roleState.curseStacks >= 3 && queueDeath(game, target, "巫毒诅咒达到三层", action.playerId)) dead.push({ player: target, cause: "巫毒诅咒" });
  }
  for (const action of getNightActions(game, "hex")) {
    const target = playerById(game, action.targetId);
    if (target && SEER_ROLES.has(target.roleId)) target.roleState.seerBlocked = true;
  }
  for (const action of getNightActions(game, "protect")) {
    const target = playerById(game, action.targetId);
    if (target && SEER_ROLES.has(target.roleId)) target.roleState.seerBlocked = false;
  }
  for (const action of getNightActions(game, "visit")) {
    const actor = playerById(game, action.playerId);
    if (actor?.alive !== false) actor.roleState.visitedIds = unique([...(actor.roleState?.visitedIds || []), action.targetId]);
  }
  for (const player of game.players) player.roleState.vigilanceActive = false;
  promoteApprentice(game);
  game.nightActions = {};
  game.bloodMoonActive = false;
  appendPublic(game, dead.length ? `天亮了，本夜死亡：${dead.map(item => item.player.name).join("、")}。` : "天亮了，本夜无人死亡。", "dawn");
  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, dead)) return;
  game.day += 1;
  setPhase(game, "day_discussion", `第 ${game.day} 天公开讨论`);
  await runAiPhase(env, game);
}

async function tallySheriff(env, game) {
  const counts = voteCounts(game, game.sheriff.votes || {});
  const top = highestTargets(counts);
  if (!top.length) {
    game.sheriff.holderId = "";
    game.sheriff.alternates = [];
    appendPublic(game, "警长投票无人得票，本局没有警长。", "sheriff");
    game.night = 1;
    setPhase(game, "night", "第 1 夜");
    await runAiPhase(env, game);
    return;
  }
  if (top.length > 1 && Number(game.sheriff.voteRound || 1) === 1) {
    game.sheriff.voteRound = 2;
    game.sheriff.candidates = top;
    game.sheriff.votes = {};
    setPhase(game, "sheriff_vote", `首轮平票，候选人 ${top.map(id => playerById(game, id)?.name || id).join("、")} 重新投票`);
    await runAiPhase(env, game);
    return;
  }
  if (top.length > 1) {
    game.sheriff.holderId = "";
    game.sheriff.alternates = [];
    appendPublic(game, "警长重选仍出现并列第一，本局不设警长。", "sheriff");
  } else {
    const ranking = sheriffCandidatesFromVotes(game, counts);
    game.sheriff.holderId = top[0];
    game.sheriff.alternates = ranking.filter(id => id !== top[0]);
    appendPublic(game, `${playerById(game, top[0])?.name || top[0]} 当选警长；候补顺序：${game.sheriff.alternates.map(id => playerById(game, id)?.name || id).join("、") || "无"}。`, "sheriff");
  }
  game.night = 1;
  setPhase(game, "night", "第 1 夜");
  await runAiPhase(env, game);
}

async function tallyDayVote(env, game) {
  const bomb = resolveBombVote(game, game.dayVotes || {});
  const counts = voteCounts(game, bomb.votes, { sheriffWeight: true, invalidMasochist: true });
  const rawCounts = voteCounts(game, game.dayVotes || {}, { sheriffWeight: true, invalidMasochist: false });
  const topRaw = highestTargets(rawCounts);
  const cultist = topRaw.length === 1 ? playerById(game, topRaw[0]) : null;
  if (cultist?.roleId === "masochist_cultist" && game.config.groupCount <= 1) {
    game.winner = { team: "masochist_cultist", playerIds: [cultist.id], text: `${cultist.name} 成为白天唯一最高得票者，抖M教徒个人胜利。` };
    game.status = "ended"; game.phase = "ended"; game.endedAt = nowMs();
    appendPublic(game, game.winner.text, "winner", { winner: game.winner });
    await saveGame(env, game);
    await sendGroup(env, game.groupId, `【狼人杀结束】${game.winner.text}`).catch(() => null);
    return;
  }
  const top = highestTargets(counts);
  if (bomb.invalidVoterId) appendPublic(game, `炸弹最终停在 ${playerById(game, bomb.invalidVoterId)?.name || bomb.invalidVoterId}，该玩家本日投票无效。`, "bomb");
  const dead = [];
  if (top.length === 1) {
    const target = playerById(game, top[0]);
    if (target && queueDeath(game, target, "白天放逐投票", "group_vote")) dead.push({ player: target, cause: "白天放逐投票" });
  } else if (top.length > 1) {
    appendPublic(game, `本轮最高票平票：${top.map(id => playerById(game, id)?.name || id).join("、")}，无人被放逐。`, "vote_result");
  } else {
    appendPublic(game, "本轮没有有效投票，无人被放逐。", "vote_result");
  }
  game.dayVotes = {};
  promoteApprentice(game);
  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, dead)) return;
  game.night += 1;
  setPhase(game, "night", `第 ${game.night} 夜`);
  await runAiPhase(env, game);
}

async function advanceGame(env, game, reason = "manual") {
  if (!game || game.status !== "active") return { ok: false, message: "当前没有进行中的游戏。" };
  if (game.phase === "sheriff_nomination") {
    game.sheriff.candidates = livingPlayers(game).filter(player => player.sheriffCandidate).map(player => player.id);
    game.sheriff.voteRound = 1;
    game.sheriff.votes = {};
    if (!game.sheriff.candidates.length) {
      appendPublic(game, "无人竞选警长，本局没有警长。", "sheriff");
      game.night = 1;
      setPhase(game, "night", "第 1 夜");
      await runAiPhase(env, game);
    } else {
      setPhase(game, "sheriff_vote", `候选人：${game.sheriff.candidates.map(id => playerById(game, id)?.name || id).join("、")}`);
      await runAiPhase(env, game);
    }
  } else if (game.phase === "sheriff_vote") {
    await tallySheriff(env, game);
  } else if (game.phase === "night") {
    await resolveNight(env, game);
  } else if (game.phase === "day_discussion") {
    setPhase(game, "day_vote", `第 ${game.day} 天放逐投票`);
    game.dayVotes = {};
    await runAiPhase(env, game);
  } else if (game.phase === "day_vote") {
    await tallyDayVote(env, game);
  } else if (game.phase === "death_skill") {
    const resume = game.pendingDeathSkill?.resumePhase || "night";
    game.pendingDeathSkill = null;
    if (resume === "day_discussion") {
      game.day += 1;
      setPhase(game, "day_discussion", `死亡技能超时，进入第 ${game.day} 天`);
    } else {
      game.night += 1;
      setPhase(game, "night", `死亡技能超时，进入第 ${game.night} 夜`);
    }
    await runAiPhase(env, game);
  }
  appendPublic(game, `阶段推进来源：${reason}`, "audit");
  await saveGame(env, game);
  return { ok: true, message: `已进入${phaseLabel(game.phase)}。`, game };
}

function actorCanManage(game, actor = {}) {
  return Boolean(
    String(game.creatorId || "") === String(actor.userId || actor.qq || "")
    || actor.isDeveloper
    || actor.permissions?.developer
    || actor.permissions?.nativeAdmin
    || actor.permissions?.groupOps
    || ["owner", "admin", "developer"].includes(String(actor.role || ""))
  );
}

async function startGame(env, game, actor) {
  if (!game || game.status !== "lobby") return { ok: false, message: "只有等待加入中的房间可以开始。" };
  if (!actorCanManage(game, actor)) return { ok: false, message: "只有房主或管理层可以开始游戏。" };
  while (game.players.length < game.config.maxPlayers && game.players.filter(isAiPlayer).length < game.config.aiCount) {
    const index = game.players.filter(isAiPlayer).length + 1;
    game.players.push(newPlayer({ id: `ai:${index}`, name: `AI玩家${index}`, isAi: true }));
  }
  if (game.players.length < WEREWOLF_MIN_PLAYERS) return { ok: false, message: `至少需要 ${WEREWOLF_MIN_PLAYERS} 名玩家（可包含 AI）。` };
  await distributeRoles(env, game);
  game.status = "active";
  game.startedAt = nowMs();
  game.day = 0;
  game.night = 0;
  appendPublic(game, `游戏开始，共 ${game.players.length} 名玩家。普通自爆禁止；白天公开讨论，狼人密谈仅限狼人私讯频道。`, "start");
  if (game.config.sheriffEnabled) {
    setPhase(game, "sheriff_nomination", "第一夜前进行警长选举");
  } else {
    game.night = 1;
    setPhase(game, "night", "第 1 夜");
  }
  await runAiPhase(env, game);
  await saveGame(env, game);
  await sendGroup(env, game.groupId, `【狼人杀开始】共 ${game.players.length} 人。${game.config.sheriffEnabled ? "先进行警长候选报名。" : "直接进入第一夜。"}\n白天公开讨论；狼人密谈必须私讯「!狼聊 ${game.groupId} 内容」。普通自爆禁止。`).catch(() => null);
  return { ok: true, message: "狼人杀已开始，角色已私讯。", game };
}

async function aiDecision(env, game, player, kind, choices = []) {
  const living = livingPlayers(game);
  const safeChoices = choices.filter(id => playerById(game, id)?.alive !== false && id !== player.id);
  if (!safeChoices.length) return "";
  try {
    const publicContext = (game.publicLog || []).slice(-20).map(item => item.text).join("\n").slice(-5000);
    const result = await callGoogleDecision(env, {
      system: `你是狼人杀 AI 玩家决策器。你扮演 ${roleDef(player.roleId).name}，阵营 ${player.team}。不得泄露隐藏身份，只输出 JSON：{"targetId":"候选ID","speech":"不超过80字的公开发言或空字串","wolfChat":"不超过60字的狼人密谈或空字串"}。`,
      prompt: JSON.stringify({ kind, self: { id: player.id, name: player.name, roleId: player.roleId, team: player.team }, choices: safeChoices.map(id => ({ id, name: playerById(game, id)?.name })), publicContext }).slice(0, 8000),
      maxOutputTokens: 180,
      maxAttempts: 1
    });
    const parsed = JSON.parse(String(result.text || "").match(/\{[\s\S]*\}/)?.[0] || "{}");
    return { targetId: safeChoices.includes(String(parsed.targetId || "")) ? String(parsed.targetId) : safeChoices[Math.floor(Math.random() * safeChoices.length)], speech: String(parsed.speech || "").slice(0, 100), wolfChat: String(parsed.wolfChat || "").slice(0, 80) };
  } catch {
    return { targetId: safeChoices[Math.floor(Math.random() * safeChoices.length)], speech: "我先听大家发言，暂时保留判断。", wolfChat: "先分散票型，别把身份聊得太明显。" };
  }
}

async function broadcastWolfChat(env, game, sender, text) {
  const message = String(text || "").trim().slice(0, 1000);
  if (!message) return;
  const row = { id: crypto.randomUUID(), at: nowMs(), senderId: sender.id, senderName: sender.name, text: message };
  game.wolfChat.push(row);
  if (game.wolfChat.length > 200) game.wolfChat = game.wolfChat.slice(-200);
  for (const wolf of livingPlayers(game).filter(player => isWolfRole(player.roleId))) {
    appendPrivate(wolf, `【狼人密谈】${sender.name}：${message}`, "wolf_chat", { senderId: sender.id });
    if (!isAiPlayer(wolf)) await sendPrivate(env, wolf.id, `【狼人密谈｜群 ${game.groupId}】${sender.name}：${message}`).catch(() => null);
  }
  for (const fraudster of livingPlayers(game).filter(player => player.roleId === "fraudster")) {
    appendPrivate(fraudster, `【卧底摘要】狼群正在讨论：${message.replace(/@?\d{5,}/g, "某位玩家").slice(0, 120)}`, "infiltrate");
  }
}

async function runAiNightAction(env, game, player) {
  const choices = targetablePlayers(game, player.id).map(item => item.id);
  const decision = await aiDecision(env, game, player, "night", choices);
  const targetId = decision?.targetId || choices[0];
  if (!targetId) return;
  if (isWolfRole(player.roleId)) {
    setNightAction(game, player.id, "wolf_kill", { targetId, boosted: player.roleId === "berserk_wolf" && Number(player.roleState?.frenzy || 0) > 0 });
    if (decision?.wolfChat) await broadcastWolfChat(env, game, player, decision.wolfChat);
  }
  if (player.roleId === "seer") setNightAction(game, player.id, "inspect", { targetId });
  if (player.roleId === "guard") setNightAction(game, player.id, "protect", { targetId });
  if (player.roleId === "detective") setNightAction(game, player.id, "track", { targetId });
  if (player.roleId === "voodoo_girl") setNightAction(game, player.id, "curse", { targetId });
  if (player.roleId === "enchanter") setNightAction(game, player.id, "hex", { targetId });
  if (player.roleId === "lecher") setNightAction(game, player.id, "visit", { targetId });
  if (player.roleId === "villager" && !player.roleState?.used) { player.roleState.used = true; player.roleState.vigilanceActive = true; }
}

async function runAiPhase(env, game) {
  const aiPlayers = livingPlayers(game).filter(isAiPlayer);
  if (!aiPlayers.length) return;
  if (game.phase === "sheriff_nomination") {
    for (const player of aiPlayers) player.sheriffCandidate = Math.random() < 0.35;
  } else if (game.phase === "sheriff_vote") {
    const candidates = game.sheriff.candidates || [];
    for (const player of aiPlayers) {
      const choices = candidates.filter(id => id !== player.id);
      const decision = await aiDecision(env, game, player, "sheriff_vote", choices.length ? choices : candidates);
      if (decision?.targetId) game.sheriff.votes[player.id] = decision.targetId;
    }
  } else if (game.phase === "night") {
    for (const player of aiPlayers) await runAiNightAction(env, game, player);
  } else if (game.phase === "day_discussion") {
    for (const player of aiPlayers) {
      const decision = await aiDecision(env, game, player, "day_speech", targetablePlayers(game, player.id).map(item => item.id));
      const speech = String(decision?.speech || "我先听大家发言，暂时保留判断。").slice(0, 100);
      appendPublic(game, `${player.name}：${speech}`, "ai_speech", { userId: player.id });
      await sendGroup(env, game.groupId, `${player.name}：${speech}`).catch(() => null);
    }
  } else if (game.phase === "day_vote") {
    for (const player of aiPlayers) {
      const choices = targetablePlayers(game, player.id).map(item => item.id);
      const decision = await aiDecision(env, game, player, "day_vote", choices);
      if (decision?.targetId) game.dayVotes[player.id] = decision.targetId;
    }
  }
}

function eventText(body) {
  if (Array.isArray(body?.message)) return body.message.map(part => String(part?.type || "").toLowerCase() === "text" ? String(part?.data?.text || "") : "").join("").trim();
  return String(body?.raw_message || body?.message || "").replace(/\[CQ:[^\]]+\]/g, " ").trim();
}

function eventMentions(body) {
  const ids = [];
  if (Array.isArray(body?.message)) for (const part of body.message) if (String(part?.type || "").toLowerCase() === "at") ids.push(cleanId(part?.data?.qq));
  const raw = String(body?.raw_message || "");
  for (const match of raw.matchAll(/\[CQ:at,[^\]]*qq=([^,\]]+)/gi)) ids.push(cleanId(match[1]));
  return unique(ids);
}

function commandTarget(game, body, fallbackText = "") {
  const mentioned = eventMentions(body).filter(id => id !== String(body?.self_id || ""));
  if (mentioned.length === 1 && playerById(game, mentioned[0])) return mentioned[0];
  return normalizeTargetId(game, fallbackText);
}

function commandArgs(text) { return String(text || "").trim().split(/\s+/).filter(Boolean); }

async function findPrivateGame(env, userId, groupId = "") {
  const requested = cleanId(groupId);
  if (requested) {
    const game = await readGame(env, requested);
    return game && playerById(game, userId) ? game : null;
  }
  const groups = await readJson(env, userGameIndexKey(userId), []);
  const active = [];
  for (const id of groups.slice(-20).reverse()) {
    const game = await readGame(env, id);
    if (game && game.status !== "ended" && game.status !== "aborted" && playerById(game, userId)) active.push(game);
  }
  return active.length === 1 ? active[0] : null;
}

async function handlePlayerAction(env, game, actor, action, targetId = "", extra = {}) {
  const player = playerById(game, actor.userId);
  if (!player) return { ok: false, message: "你不是这局游戏的玩家。" };
  if (player.alive === false && action !== "death_shot") return { ok: false, message: "你已经出局，不能执行该操作。" };
  const target = targetId ? playerById(game, targetId) : null;
  const requireTarget = () => target && target.alive !== false && target.id !== player.id;
  if (action === "wolf_chat") {
    if (!isWolfRole(player.roleId) || game.phase !== "night") return { ok: false, message: "只有存活狼人能在夜晚使用狼人密谈。" };
    await broadcastWolfChat(env, game, player, extra.text);
    await saveGame(env, game);
    return { ok: true, message: "狼人密谈已发送，仅存活狼人可见。" };
  }
  if (action === "group_inspect") {
    if (game.config.groupCount <= 1 || game.phase !== "night") return { ok: false, message: "当前不是分组模式夜晚。" };
    if (!requireTarget()) return { ok: false, message: "请选择一名仍存活的其他玩家。" };
    const key = `groupInspectNight${game.night}`;
    if (player.roleState?.[key]) return { ok: false, message: "你本夜已经使用过分组查验书。" };
    player.roleState[key] = target.id;
    const text = `${target.name} 与你${target.groupTeam === player.groupTeam ? "属于同一组" : "属于不同组"}。`;
    appendPrivate(player, text, "group_inspect");
    await saveGame(env, game);
    return { ok: true, message: text };
  }
  if (action === "sheriff_nominate") {
    if (game.phase !== "sheriff_nomination") return { ok: false, message: "当前不是警长候选报名阶段。" };
    player.sheriffCandidate = extra.enabled !== false;
    await saveGame(env, game);
    return { ok: true, message: player.sheriffCandidate ? "你已报名竞选警长。" : "你已退出警长竞选。" };
  }
  if (action === "sheriff_vote") {
    if (game.phase !== "sheriff_vote" || !game.sheriff.candidates.includes(targetId)) return { ok: false, message: "当前不能投给该警长候选人。" };
    game.sheriff.votes[player.id] = targetId;
    await saveGame(env, game);
    return { ok: true, message: `警长票已投给 ${target.name}。` };
  }
  if (action === "day_vote") {
    if (game.phase !== "day_vote" || !requireTarget()) return { ok: false, message: "当前不是白天投票阶段，或目标无效。" };
    game.dayVotes[player.id] = targetId;
    await saveGame(env, game);
    return { ok: true, message: `你已投票给 ${target.name}${player.roleId === "masochist_cultist" ? "（你的票不会计入放逐票数）" : ""}。` };
  }
  if (action === "duel") {
    if (game.phase !== "day_discussion" || player.roleId !== "knight" || player.roleState?.used || !requireTarget()) return { ok: false, message: "骑士决斗当前不可用。" };
    player.roleState.used = true;
    const dead = isWolfRole(target.roleId) ? target : player;
    queueDeath(game, dead, isWolfRole(target.roleId) ? `骑士 ${player.name} 决斗命中狼人` : `骑士决斗判断错误`, player.id);
    appendPublic(game, `${player.name} 发起骑士决斗；${dead.name} 死亡。`, "duel");
    await finishIfWon(env, game);
    await saveGame(env, game);
    return { ok: true, message: "骑士决斗已结算。" };
  }
  if (action === "white_judgement") {
    if (game.phase !== "day_discussion" || player.roleId !== "white_wolf_king" || player.roleState?.used || !requireTarget()) return { ok: false, message: "白狼王审判当前不可用。" };
    player.roleState.used = true;
    queueDeath(game, player, "白狼王正式牺牲技能", player.id);
    queueDeath(game, target, "白狼王审判带走", player.id);
    appendPublic(game, `白狼王 ${player.name} 发动正式审判并带走 ${target.name}；普通自爆规则仍为禁止。`, "white_judgement");
    if (!(await finishIfWon(env, game))) {
      game.night += 1;
      setPhase(game, "night", `白狼王审判强制结束白天，进入第 ${game.night} 夜`);
      await runAiPhase(env, game);
      await saveGame(env, game);
    }
    return { ok: true, message: "白狼王审判已结算。" };
  }
  if (action === "plant_bomb") {
    if (game.phase !== "day_discussion" || player.roleId !== "bomb_wolf" || player.roleState?.[`bombDay${game.day}`] || !requireTarget()) return { ok: false, message: "炸弹狼本日无法再次植入炸弹。" };
    player.roleState[`bombDay${game.day}`] = target.id;
    game.bomb = { holderId: target.id, plantedBy: player.id, day: game.day };
    await saveGame(env, game);
    return { ok: true, message: `炸弹已秘密植入 ${target.name}。` };
  }
  if (action === "death_shot") {
    if (game.phase !== "death_skill" || game.pendingDeathSkill?.actorId !== player.id || !target || target.alive === false) return { ok: false, message: "当前没有可用的带走技能或目标无效。" };
    queueDeath(game, target, `${roleDef(player.roleId).name} 死亡带走`, player.id);
    const resume = game.pendingDeathSkill.resumePhase || "night";
    game.pendingDeathSkill = null;
    if (!(await finishIfWon(env, game))) {
      if (resume === "day_discussion") { game.day += 1; setPhase(game, "day_discussion", `死亡技能结算后进入第 ${game.day} 天`); }
      else { game.night += 1; setPhase(game, "night", `死亡技能结算后进入第 ${game.night} 夜`); }
      await runAiPhase(env, game);
      await saveGame(env, game);
    }
    return { ok: true, message: `已带走 ${target.name}。` };
  }
  if (game.phase !== "night") return { ok: false, message: "该职业技能只能在夜晚使用。" };
  if (!requireTarget() && !["blood_moon", "vigilance"].includes(action)) return { ok: false, message: "请选择一名仍存活的其他玩家。" };
  const usedKey = `${action}Night${game.night}`;
  if (player.roleState?.[usedKey]) return { ok: false, message: "你本夜已经使用过该技能。" };

  if (action === "wolf_kill" && isWolfRole(player.roleId)) {
    setNightAction(game, player.id, "wolf_kill", { targetId, boosted: extra.boosted === true && player.roleId === "berserk_wolf" && Number(player.roleState?.frenzy || 0) > 0 });
  } else if (action === "inspect" && player.roleId === "seer") {
    if (player.roleState?.seerBlocked) {
      player.roleState.seerBlocked = false;
      appendPrivate(player, "你的查验受到蛊惑，本夜没有得到结果。", "inspect");
      player.roleState[usedKey] = true;
      await saveGame(env, game);
      return { ok: true, message: "查验受到蛊惑，本夜无结果。" };
    }
    const text = inspectResult(game, target);
    player.diary.push({ night: game.night, targetId, text, at: nowMs() });
    appendPrivate(player, text, "inspect");
    setNightAction(game, player.id, "inspect", { targetId });
  } else if (action === "witch_heal" && player.roleId === "witch" && player.roleState?.healAvailable) {
    player.roleState.healAvailable = false; setNightAction(game, player.id, "witch_heal", { targetId });
  } else if (action === "witch_poison" && player.roleId === "witch" && player.roleState?.poisonAvailable) {
    player.roleState.poisonAvailable = false; setNightAction(game, player.id, "witch_poison", { targetId });
  } else if (action === "protect" && player.roleId === "guard" && player.roleState?.lastProtectedId !== targetId) {
    player.roleState.lastProtectedId = targetId; setNightAction(game, player.id, "protect", { targetId });
  } else if (action === "decoy" && player.roleId === "ninja") {
    setNightAction(game, player.id, "decoy", { targetId });
  } else if (action === "disguise" && player.roleId === "shapeshifter_wolf") {
    const disguiseRoleId = ROLE_DEFINITIONS[extra.roleId] ? extra.roleId : "villager";
    player.roleState.disguiseRoleId = disguiseRoleId; setNightAction(game, player.id, "disguise", { roleId: disguiseRoleId });
  } else if (action === "blood_moon" && player.roleId === "blood_wolf" && !player.roleState?.used) {
    player.roleState.used = true; setNightAction(game, player.id, "blood_moon", {});
  } else if (action === "couple" && player.roleId === "cupid" && !player.roleState?.used) {
    const second = playerById(game, extra.secondTargetId);
    if (!second || second.alive === false || second.id === targetId) return { ok: false, message: "请选择两名不同的存活玩家。" };
    player.roleState.used = true; game.lovers = [targetId, second.id];
    for (const loverId of game.lovers) appendPrivate(playerById(game, loverId), `你与 ${playerById(game, game.lovers.find(id => id !== loverId))?.name} 成为恋人。`, "lover");
  } else if (action === "meat_shield" && player.roleId === "sadist_leader" && !player.roleState?.used && target.roleId === "masochist_cultist") {
    player.roleState.used = true; setNightAction(game, player.id, "meat_shield", { targetId });
  } else if (action === "redirect" && player.roleId === "mermaid") {
    const redirectTarget = playerById(game, extra.secondTargetId);
    if (!redirectTarget || redirectTarget.alive === false || redirectTarget.id === targetId) return { ok: false, message: "请选择不同的原目标与引导目标。" };
    setNightAction(game, player.id, "redirect", { originalTargetId: targetId, redirectTargetId: redirectTarget.id });
  } else if (action === "copy_dead" && player.roleId === "gravedigger" && !player.roleState?.used && target.alive === false) {
    player.roleState.used = true; player.roleState.copiedRoleId = target.roleId; appendPrivate(player, `你复制了 ${target.name} 的职业：${roleDef(target.roleId).name}。阵营仍为好人。`, "copy");
  } else if (action === "track" && player.roleId === "detective") {
    const actionRows = Object.values(game.nightActions || {}).filter(row => row.playerId === targetId);
    const text = actionRows.length ? `${target.name} 本夜使用了主动技能，目标类别：${actionRows.some(row => row.targetId) ? "其他玩家" : "全局效果"}。真实职业线索：${roleDef(target.roleId).name}。` : `${target.name} 本夜尚未记录主动技能。`;
    appendPrivate(player, text, "track"); setNightAction(game, player.id, "track", { targetId });
  } else if (action === "visit" && player.roleId === "lecher") {
    setNightAction(game, player.id, "visit", { targetId });
  } else if (action === "swap_role" && player.roleId === "thief" && !player.roleState?.used) {
    player.roleState.used = true;
    const roleA = player.roleId, roleB = target.roleId;
    player.roleId = roleB; player.team = roleDef(roleB).team;
    target.roleId = roleA; target.team = roleDef(roleA).team;
    appendPrivate(player, `你与 ${target.name} 交换职业，现在是 ${roleDef(player.roleId).name}。`, "swap");
    appendPrivate(target, `你与 ${player.name} 交换职业，现在是 ${roleDef(target.roleId).name}。`, "swap");
  } else if (action === "vigilance" && player.roleId === "villager" && !player.roleState?.used) {
    player.roleState.used = true; player.roleState.vigilanceActive = true;
  } else if (action === "curse" && player.roleId === "voodoo_girl") {
    setNightAction(game, player.id, "curse", { targetId });
  } else if (action === "hex" && player.roleId === "enchanter") {
    setNightAction(game, player.id, "hex", { targetId });
  } else {
    return { ok: false, message: "你的职业不能执行该技能，或技能次数已经用完。" };
  }
  player.roleState[usedKey] = true;
  player.lastActionAt = nowMs();
  await saveGame(env, game);
  return { ok: true, message: `技能已登记：${action}${target ? ` → ${target.name}` : ""}。夜晚结束前可再次提交同类选择覆盖目标。` };
}

function privateStateFor(game, viewerId, canManage = false) {
  const player = playerById(game, viewerId);
  const publicPlayers = (game.players || []).map(item => ({
    id: item.id, name: item.name, isAi: item.isAi, alive: item.alive !== false, sheriffCandidate: Boolean(item.sheriffCandidate),
    isSheriff: game.sheriff?.holderId === item.id, diedAt: item.diedAt || 0, deathCause: item.alive === false ? String(item.deathCause || "") : "",
    roleId: game.status === "ended" ? item.roleId : undefined,
    roleName: game.status === "ended" ? roleDef(item.roleId).name : undefined,
    groupTeam: game.status === "ended" ? item.groupTeam : undefined
  }));
  const own = player ? {
    id: player.id, name: player.name, alive: player.alive !== false, roleId: player.roleId, roleName: roleDef(player.roleId).name,
    team: player.team, summary: roleDef(player.roleId).summary, diary: player.diary || [], roleState: player.roleState || {}, groupTeam: player.groupTeam,
    privateNotices: (player.privateNotices || []).slice(-100), visibleWolfIds: visibleWolfIds(game, player),
    wolfChat: isWolfRole(player.roleId) ? (game.wolfChat || []).slice(-100) : []
  } : null;
  return {
    id: game.id, groupId: game.groupId, status: game.status, phase: game.phase, phaseLabel: phaseLabel(game.phase), phaseEndsAt: game.phaseEndsAt,
    day: game.day, night: game.night, config: game.config, players: publicPlayers, publicLog: (game.publicLog || []).slice(-200),
    sheriff: game.sheriff, lovers: game.status === "ended" ? game.lovers : undefined, winner: game.winner,
    own, canManage, roleDefinitions: ROLE_DEFINITIONS
  };
}

function publicWerewolfState(game, viewer = {}) {
  if (!game) return null;
  const userId = cleanId(viewer.userId || viewer.qq);
  const canManage = Boolean(viewer.canManage || actorCanManage(game, { userId, role: viewer.role, permissions: viewer.permissions, isDeveloper: viewer.isDeveloper }));
  return privateStateFor(game, userId, canManage);
}

async function handleWerewolfPortalApi(request, env, url, path, body, authed) {
  if (!path.startsWith("/werewolf")) return null;
  const groupId = cleanId(authed?.groupId);
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  const actor = { userId: cleanId(authed.qq), qq: cleanId(authed.qq), role: authed.role, permissions: authed.permissions || {}, isDeveloper: isDeveloperId(env, authed.qq) };
  let game = await readGame(env, groupId);
  if (request.method === "GET" && path === "/werewolf/state") return jsonResponse({ ok: true, game: game ? publicWerewolfState(game, actor) : null, roles: ROLE_DEFINITIONS, limits: { minPlayers: WEREWOLF_MIN_PLAYERS, maxPlayers: WEREWOLF_MAX_PLAYERS } });
  if (request.method !== "POST") return jsonResponse({ ok: false, message: "不支持的狼人杀接口。" }, 405);
  if (path === "/werewolf/create") {
    if (game && !["ended", "aborted"].includes(game.status)) return jsonResponse({ ok: false, message: "当前群已有未结束的狼人杀。" }, 409);
    game = createGame({ groupId, creatorId: actor.userId, creatorName: body?.creatorName || actor.userId, config: body?.config || body });
    game.players.push(newPlayer({ id: actor.userId, name: body?.creatorName || actor.userId }));
    await saveGame(env, game);
    await writeSystemAudit(env, { type: "werewolf_create", groupId, actorId: actor.userId, action: "create", gameId: game.id }).catch(() => {});
    return jsonResponse({ ok: true, message: "狼人杀房间已建立。", game: publicWerewolfState(game, actor) });
  }
  if (!game) return jsonResponse({ ok: false, message: "当前群没有狼人杀房间。" }, 404);
  if (path === "/werewolf/join") {
    if (game.status !== "lobby") return jsonResponse({ ok: false, message: "游戏已经开始，不能加入。" }, 409);
    if (!playerById(game, actor.userId)) {
      if (game.players.length >= game.config.maxPlayers) return jsonResponse({ ok: false, message: "房间人数已满。" }, 409);
      game.players.push(newPlayer({ id: actor.userId, name: body?.name || actor.userId }));
      appendPublic(game, `${body?.name || actor.userId} 加入游戏。`, "join", { userId: actor.userId });
      await saveGame(env, game);
    }
    return jsonResponse({ ok: true, message: "已加入狼人杀。", game: publicWerewolfState(game, actor) });
  }
  if (path === "/werewolf/leave") {
    if (game.status !== "lobby") return jsonResponse({ ok: false, message: "游戏开始后不能直接退出，请由房主中止。" }, 409);
    game.players = game.players.filter(player => player.id !== actor.userId);
    await saveGame(env, game);
    return jsonResponse({ ok: true, message: "已退出狼人杀。", game: publicWerewolfState(game, actor) });
  }
  if (path === "/werewolf/start") {
    const result = await startGame(env, game, actor);
    return jsonResponse({ ...result, game: result.game ? publicWerewolfState(result.game, actor) : undefined }, result.ok ? 200 : 403);
  }
  if (path === "/werewolf/advance") {
    if (!actorCanManage(game, actor)) return jsonResponse({ ok: false, message: "只有房主或管理层可以推进阶段。" }, 403);
    const result = await advanceGame(env, game, "portal");
    return jsonResponse({ ...result, game: result.game ? publicWerewolfState(result.game, actor) : undefined }, result.ok ? 200 : 400);
  }
  if (path === "/werewolf/abort") {
    if (!actorCanManage(game, actor)) return jsonResponse({ ok: false, message: "只有房主或管理层可以中止游戏。" }, 403);
    game.status = "aborted"; game.phase = "ended"; game.endedAt = nowMs(); game.phaseEndsAt = 0;
    appendPublic(game, `游戏由 ${actor.userId} 中止。`, "abort");
    await saveGame(env, game);
    await sendGroup(env, groupId, "【狼人杀】本局已由房主或管理层中止。").catch(() => null);
    return jsonResponse({ ok: true, message: "游戏已中止。", game: publicWerewolfState(game, actor) });
  }
  if (path === "/werewolf/action") {
    const targetId = normalizeTargetId(game, body?.targetId || body?.target || "");
    const result = await handlePlayerAction(env, game, actor, String(body?.action || ""), targetId, { ...body, secondTargetId: normalizeTargetId(game, body?.secondTargetId || "") });
    return jsonResponse({ ...result, game: publicWerewolfState(game, actor) }, result.ok ? 200 : 400);
  }
  return jsonResponse({ ok: false, message: "未知狼人杀操作。" }, 404);
}

async function handleWerewolfOneBotEvent(env, body) {
  if (!body || body.post_type !== "message") return null;
  const text = eventText(body);
  const isGroup = body.message_type === "group";
  const userId = cleanId(body.user_id);
  const groupId = isGroup ? cleanId(body.group_id) : cleanId(commandArgs(text)[1]);

  // 白天普通发言属于公开辩论资料。只有存活玩家的消息会写入本局公开记录，
  // 让 AI 玩家能够基于真实讨论发言与投票；这不会阻止消息继续进入原聊天流程。
  if (isGroup && text && !/^[!！/]/.test(text)) {
    const activeGame = await readGame(env, groupId);
    const speaker = activeGame && playerById(activeGame, userId);
    if (activeGame?.status === "active" && activeGame.phase === "day_discussion" && speaker?.alive) {
      appendPublic(activeGame, `${speaker.name || userId}：${text.slice(0, 1200)}`, "discussion", { actorId: userId, messageId: String(body.message_id || "") });
      await saveGame(env, activeGame);
    }
    return null;
  }

  if (!/^(?:[!！](?:狼人杀|狼人殺|狼聊|分组查验|分組查驗|自爆|狼人自爆|投票|竞选警长|競選警長|退出竞选|退出競選|警长投票|警長投票|白狼王审判|白狼王審判|骑士决斗|騎士決鬥|炸弹植入|炸彈植入)|[!！]我的狼人杀)/i.test(text)) return null;
  let game = isGroup ? await readGame(env, groupId) : await findPrivateGame(env, userId, groupId);
  const reply = async message => isGroup ? sendGroup(env, groupId, message) : sendPrivate(env, userId, message);
  const args = commandArgs(text);

  // “自爆”和通用“投票”只在存在狼人杀对局时接管；没有对局时必须交回其他指令系统。
  if (/^[!！](?:自爆|狼人自爆)/i.test(text)) {
    if (!game) return null;
    if (isGroup) await sendGroup(env, groupId, "本模式禁止普通自爆。白狼王只能使用有明确目标并记录审计的专属审判技能。").catch(() => null);
    else await sendPrivate(env, userId, "本模式禁止普通自爆。白狼王专属审判不等于自由自爆。").catch(() => null);
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*(?:创建|建立)/i.test(text)) {
    if (!isGroup) { await reply("请在目标群内建立狼人杀房间。"); return { handled: true }; }
    if (game && !["ended", "aborted"].includes(game.status)) { await reply("当前群已有未结束的狼人杀。"); return { handled: true }; }
    const maxPlayers = Math.max(WEREWOLF_MIN_PLAYERS, Math.min(WEREWOLF_MAX_PLAYERS, Number(text.match(/(?:人数|玩家)?\s*(\d{1,2})/)?.[1] || 12)));
    const aiCount = Math.max(0, Math.min(12, Number(text.match(/AI\s*(\d{1,2})/i)?.[1] || 0)));
    const groupCount = Math.max(0, Math.min(8, Number(text.match(/(?:分组|分組)\s*(\d)/)?.[1] || 0)));
    game = createGame({ groupId, creatorId: userId, creatorName: body.sender?.card || body.sender?.nickname || userId, config: { maxPlayers, aiCount, groupCount, sheriffEnabled: !/无警长|無警長/.test(text) } });
    game.players.push(newPlayer({ id: userId, name: body.sender?.card || body.sender?.nickname || userId }));
    await saveGame(env, game);
    await reply(`【狼人杀】房间已建立：上限 ${maxPlayers} 人，AI ${aiCount}，${groupCount > 1 ? `隐藏分组 ${groupCount} 组` : "普通阵营结局"}。\n加入：!狼人杀加入\n开始：!狼人杀开始\nPortal 可选择角色与阶段时间。`);
    return { handled: true };
  }
  if (!game) {
    if (/^[!！](?:投票|竞选警长|競選警長|退出竞选|退出競選|警长投票|警長投票|白狼王审判|白狼王審判|骑士决斗|騎士決鬥|炸弹植入|炸彈植入)/i.test(text)) return null;
    await reply("没有找到你参与中的狼人杀；私讯技能时请附群号。");
    return { handled: true };
  }
  const actor = { userId, role: String(body.sender?.role || "member"), permissions: {}, isDeveloper: isDeveloperId(env, userId) };
  const player = playerById(game, userId);
  if (/^[!！](?:狼人杀|狼人殺)\s*加入/i.test(text)) {
    if (!isGroup || game.status !== "lobby") { await reply("只能在等待加入阶段从群内加入。"); return { handled: true }; }
    if (!player) {
      if (game.players.length >= game.config.maxPlayers) await reply("房间人数已满。");
      else { game.players.push(newPlayer({ id: userId, name: body.sender?.card || body.sender?.nickname || userId })); appendPublic(game, `${body.sender?.card || body.sender?.nickname || userId} 加入游戏。`, "join"); await saveGame(env, game); await reply(`已加入，当前 ${game.players.length}/${game.config.maxPlayers} 人。`); }
    } else await reply("你已经在房间中。");
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*开始/i.test(text)) {
    const result = await startGame(env, game, actor);
    await reply(result.message);
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*(?:下一阶段|下一階段|推进|推進)/i.test(text)) {
    if (!actorCanManage(game, actor)) await reply("只有房主或群管理层可以推进阶段。");
    else { const result = await advanceGame(env, game, "group_command"); await reply(result.message); }
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*(?:状态|狀態|查看)/i.test(text)) {
    const alive = livingPlayers(game);
    await reply(`【狼人杀】${phaseLabel(game.phase)}｜第 ${game.day} 天／第 ${game.night} 夜｜存活 ${alive.length}/${game.players.length}\n${alive.map(item => `${item.name}${game.sheriff?.holderId === item.id ? "（警长）" : ""}`).join("、")}`);
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*(?:身份|角色)/i.test(text) || /^[!！]我的狼人杀/i.test(text)) {
    if (!player) await reply("你不是这局玩家。"); else await reply(rolePrivateText(game, player));
    return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*(?:中止|结束|結束)/i.test(text)) {
    if (!actorCanManage(game, actor)) await reply("只有房主或管理层可以中止游戏。");
    else { game.status = "aborted"; game.phase = "ended"; game.endedAt = nowMs(); game.phaseEndsAt = 0; await saveGame(env, game); await reply("本局狼人杀已中止。"); }
    return { handled: true };
  }
  if (/^[!！](?:竞选警长|競選警長)/i.test(text)) {
    const result = await handlePlayerAction(env, game, actor, "sheriff_nominate", "", { enabled: true }); await reply(result.message); return { handled: true };
  }
  if (/^[!！](?:退出竞选|退出競選)/i.test(text)) {
    const result = await handlePlayerAction(env, game, actor, "sheriff_nominate", "", { enabled: false }); await reply(result.message); return { handled: true };
  }
  if (/^[!！](?:警长投票|警長投票)/i.test(text)) {
    const targetId = commandTarget(game, body, args.slice(1).join(" ")); const result = await handlePlayerAction(env, game, actor, "sheriff_vote", targetId); await reply(result.message); return { handled: true };
  }
  if (/^[!！]投票/i.test(text)) {
    const targetId = commandTarget(game, body, args.slice(1).join(" ")); const result = await handlePlayerAction(env, game, actor, "day_vote", targetId); await reply(result.message); return { handled: true };
  }
  if (/^[!！]狼聊/i.test(text)) {
    if (isGroup) { await reply("狼人密谈禁止在群内发送，请私讯机器人使用「!狼聊 群号 内容」。"); return { handled: true }; }
    const content = args.slice(2).join(" "); const result = await handlePlayerAction(env, game, actor, "wolf_chat", "", { text: content }); await reply(result.message); return { handled: true };
  }
  if (/^[!！](?:分组查验|分組查驗)/i.test(text)) {
    if (isGroup) { await reply("分组查验结果属于秘密，请私讯机器人。"); return { handled: true }; }
    const targetId = normalizeTargetId(game, args.slice(2).join(" ")); const result = await handlePlayerAction(env, game, actor, "group_inspect", targetId); await reply(result.message); return { handled: true };
  }
  if (/^[!！](?:狼人杀|狼人殺)\s*技能/i.test(text)) {
    if (isGroup) { await reply("职业技能必须私讯机器人或使用 Portal，避免公开身份。只有骑士决斗、白狼王审判与炸弹植入可在白天从 Portal 发起。 "); return { handled: true }; }
    const actionAlias = { "刀": "wolf_kill", "袭击": "wolf_kill", "襲擊": "wolf_kill", "查验": "inspect", "查驗": "inspect", "守护": "protect", "守護": "protect", "解药": "witch_heal", "解藥": "witch_heal", "毒药": "witch_poison", "毒藥": "witch_poison", "替身": "decoy", "血月": "blood_moon", "诅咒": "curse", "詛咒": "curse", "蛊惑": "hex", "蠱惑": "hex", "追踪": "track", "追蹤": "track", "夜访": "visit", "夜訪": "visit", "警戒": "vigilance", "带走": "death_shot", "帶走": "death_shot" };
    const action = actionAlias[args[2]] || args[2] || "";
    const targetId = normalizeTargetId(game, args.slice(3).join(" "));
    const result = await handlePlayerAction(env, game, actor, action, targetId, {});
    await reply(result.message);
    return { handled: true };
  }
  await reply("狼人杀指令：创建／加入／开始／状态／下一阶段／竞选警长／警长投票／投票。秘密技能请私讯「!狼人杀技能 群号 技能 目标」。");
  return { handled: true };
}

async function processWerewolfTimers(env, now = nowMs()) {
  const groups = await readJson(env, activeIndexKey(), []);
  for (const groupId of groups.slice(0, 200)) {
    const game = await readGame(env, groupId);
    if (!game || game.status !== "active" || !ACTIVE_PHASES.has(game.phase) || !Number(game.phaseEndsAt || 0) || Number(game.phaseEndsAt) > now) continue;
    await advanceGame(env, game, "timer").catch(async error => {
      await writeSystemAudit(env, { type: "werewolf_timer_failed", groupId, actorId: "system", action: game.phase, error: String(error?.message || error).slice(0, 500) }).catch(() => {});
    });
  }
}

function injectWerewolfPortalClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-werewolf-client")) return source;
  const nav = '<button data-view="werewolf" id="werewolfNav">狼人杀</button>';
  if (!source.includes('id="werewolfNav"')) {
    if (source.includes('<button data-view="members" id="memberConsoleNav">群友列表</button>')) source = source.replace('<button data-view="members" id="memberConsoleNav">群友列表</button>', '<button data-view="members" id="memberConsoleNav">群友列表</button>' + nav);
    else if (source.includes('</nav>')) source = source.replace('</nav>', nav + '</nav>');
    else source = nav + source;
  }
  const section = `
<section id="v-werewolf" class="view">
  <div class="section-head"><div><h2>狼人杀</h2><p>辩论式狼人杀：白天公开讨论；狼人密谈、角色与夜间技能只向对应玩家显示。普通自爆禁止，AI 可参与。</p></div><button id="wwRefresh" class="btn">刷新</button></div>
  <div class="card ww-create" id="wwCreatePanel"><h3>建立房间</h3><div class="ww-grid"><label>人数上限<input id="wwMaxPlayers" type="number" min="5" max="32" value="12"></label><label>AI 玩家<input id="wwAiCount" type="number" min="0" max="12" value="0"></label><label>隐藏分组 N<input id="wwGroupCount" type="number" min="0" max="8" value="0"></label><label><input id="wwSheriff" type="checkbox" checked>启用警长选举</label></div><details><summary>选择职业（不选时自动平衡）</summary><div id="wwRolePool" class="ww-role-pool"></div></details><button id="wwCreate" class="btn primary">建立狼人杀</button></div>
  <div id="wwStatus" class="notice">尚未读取游戏。</div>
  <div class="ww-layout">
    <div class="card"><div class="section-head compact"><div><h3>公开游戏面板</h3><p id="wwPhaseText"></p></div><div class="row"><button id="wwJoin" class="btn">加入</button><button id="wwLeave" class="btn ghost">退出</button><button id="wwStart" class="btn primary">开始</button><button id="wwAdvance" class="btn">下一阶段</button><button id="wwAbort" class="btn danger">中止</button></div></div><div id="wwPlayers" class="list"></div><div id="wwPublicLog" class="ww-log"></div></div>
    <div class="card"><h3>我的秘密身份</h3><div id="wwOwn" class="empty">加入并开始后显示。</div><div class="ww-action"><select id="wwAction"></select><select id="wwTarget"></select><select id="wwSecondTarget"></select><input id="wwActionText" placeholder="狼人密谈内容或伪装职业"><button id="wwSubmitAction" class="btn primary">提交秘密行动</button></div><div id="wwPrivateLog" class="ww-log"></div></div>
  </div>
</section>`;
  const membersIndex = source.indexOf('<section id="v-members"');
  if (membersIndex >= 0) source = source.slice(0, membersIndex) + section + source.slice(membersIndex);
  else if (source.includes('</main>')) source = source.replace('</main>', section + '</main>');
  else source += section;
  const style = `<style id="qqai-werewolf-style">.ww-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:14px}.ww-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px}.ww-grid label,.ww-action{display:flex;flex-direction:column;gap:6px}.ww-role-pool{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;margin:10px 0}.ww-role-pool label{display:flex;gap:6px;align-items:center}.ww-player{display:grid;grid-template-columns:1fr auto;gap:8px}.ww-log{max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:8px;margin-top:10px}.ww-log-row{padding:8px 10px;border:1px solid var(--border);border-radius:10px;white-space:pre-wrap}.ww-action{margin-top:12px}.ww-secret{padding:12px;border:1px solid #7c3aed;border-radius:12px}.ww-dead{opacity:.6;text-decoration:line-through}@media(max-width:900px){.ww-layout,.ww-grid{grid-template-columns:1fr}.ww-layout>.card,.ww-create{padding:12px}.ww-action{display:grid;grid-template-columns:1fr}.ww-role-pool{grid-template-columns:1fr 1fr}}</style>`;
  source = source.includes('</head>') ? source.replace('</head>', style + '</head>') : style + source;
  const script = `<script id="qqai-werewolf-client">(function(){
    var wwState=null,roles={};function e(id){return document.getElementById(id)}function s(v){return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}function n(m){if(typeof toast==='function')toast(m);else alert(m)}
    async function c(path,method,body){if(typeof api==='function')return api(path,method||'GET',body);var r=await fetch('/api/portal'+path,{method:method||'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});var t=await r.text(),d={};try{d=t?JSON.parse(t):{}}catch{}if(!r.ok){d.ok=false;d.message=d.message||('HTTP '+r.status)}return d}
    function rolePool(){var root=e('wwRolePool');if(!root)return;root.innerHTML=Object.keys(roles).map(function(id){var r=roles[id];return '<label><input type="checkbox" value="'+s(id)+'">'+s(r.name)+'｜'+s(r.team)+'</label>'}).join('')}
    function optionsForOwn(own){var map={werewolf:['wolf_kill','wolf_chat'],black_wolf_king:['wolf_kill','death_shot'],white_wolf_king:['wolf_kill','white_judgement'],snow_wolf:['wolf_kill'],shapeshifter_wolf:['wolf_kill','disguise'],original_wolf:['wolf_kill'],berserk_wolf:['wolf_kill'],bomb_wolf:['wolf_kill','plant_bomb'],blood_wolf:['wolf_kill','blood_moon'],cupid:['couple'],seer:['inspect'],witch:['witch_heal','witch_poison'],hunter:['death_shot'],ninja:['decoy'],sadist_leader:['meat_shield'],mermaid:['redirect'],gravedigger:['copy_dead'],knight:['duel'],guard:['protect'],detective:['track'],lecher:['visit'],thief:['swap_role'],villager:['vigilance'],voodoo_girl:['curse'],enchanter:['hex']};return (map[own&&own.roleId]||[]).concat(wwState&&wwState.config.groupCount>1?['group_inspect']:[]).concat(wwState&&wwState.phase==='sheriff_nomination'?['sheriff_nominate']:[]).concat(wwState&&wwState.phase==='sheriff_vote'?['sheriff_vote']:[]).concat(wwState&&wwState.phase==='day_vote'?['day_vote']:[])}
    function render(){var g=wwState;if(e('wwCreatePanel'))e('wwCreatePanel').classList.toggle('hidden',!!(g&&g.status!=='ended'&&g.status!=='aborted'));if(!g){e('wwStatus').textContent='当前群没有狼人杀房间。';e('wwPlayers').innerHTML='';e('wwPublicLog').innerHTML='';e('wwOwn').innerHTML='<div class="empty">尚未加入游戏。</div>';return}e('wwStatus').textContent=g.phaseLabel+'｜第 '+g.day+' 天／第 '+g.night+' 夜｜'+(g.phaseEndsAt?('截止 '+new Date(g.phaseEndsAt).toLocaleTimeString()):'无倒计时');e('wwPhaseText').textContent=g.status+'｜'+g.phaseLabel;e('wwPlayers').innerHTML=(g.players||[]).map(function(p){return '<div class="item ww-player '+(p.alive?'':'ww-dead')+'"><div><b>'+s(p.name)+'</b><div class="item-meta">'+s(p.id)+(p.isSheriff?'｜警长':'')+(p.sheriffCandidate?'｜候选':'')+'</div></div><span>'+s(p.alive?'存活':'死亡')+(p.roleName?'｜'+s(p.roleName):'')+'</span></div>'}).join('');e('wwPublicLog').innerHTML=(g.publicLog||[]).slice().reverse().map(function(x){return '<div class="ww-log-row"><small>'+new Date(x.at).toLocaleTimeString()+'｜'+s(x.type)+'</small><div>'+s(x.text)+'</div></div>'}).join('');var own=g.own;if(!own){e('wwOwn').innerHTML='<div class="empty">你尚未加入这局。</div>';e('wwPrivateLog').innerHTML='';return}e('wwOwn').innerHTML='<div class="ww-secret"><b>'+s(own.roleName)+'</b><div>'+s(own.summary)+'</div><div>阵营：'+s(own.team)+(g.config.groupCount>1?'｜隐藏组 '+s(own.groupTeam):'')+'</div></div>';var action=e('wwAction');action.innerHTML=optionsForOwn(own).map(function(x){return '<option value="'+s(x)+'">'+s(x)+'</option>'}).join('');var targets=(g.players||[]).filter(function(p){return p.alive&&p.id!==own.id});var targetHtml='<option value="">选择目标</option>'+targets.map(function(p){return '<option value="'+s(p.id)+'">'+s(p.name)+'</option>'}).join('');e('wwTarget').innerHTML=targetHtml;e('wwSecondTarget').innerHTML=targetHtml;e('wwPrivateLog').innerHTML=(own.privateNotices||[]).slice().reverse().map(function(x){return '<div class="ww-log-row"><small>'+new Date(x.at).toLocaleTimeString()+'｜'+s(x.type)+'</small><div>'+s(x.text)+'</div></div>'}).join('')}
    async function load(){var r=await c('/werewolf/state');if(!r.ok){n(r.message||'读取狼人杀失败');return}wwState=r.game;roles=r.roles||{};rolePool();render()}async function post(path,data){var r=await c(path,'POST',data||{});n(r.message||'完成');if(r.game)wwState=r.game;else await load();render()}
    document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('button');if(!b)return;if(b.id==='werewolfNav'||b.dataset.view==='werewolf')setTimeout(load,0);else if(b.id==='wwRefresh')load();else if(b.id==='wwCreate'){var selected=[].slice.call(e('wwRolePool').querySelectorAll('input:checked')).map(function(x){return x.value});post('/werewolf/create',{config:{maxPlayers:Number(e('wwMaxPlayers').value||12),aiCount:Number(e('wwAiCount').value||0),groupCount:Number(e('wwGroupCount').value||0),sheriffEnabled:e('wwSheriff').checked,selectedRoles:selected}})}else if(b.id==='wwJoin')post('/werewolf/join',{});else if(b.id==='wwLeave')post('/werewolf/leave',{});else if(b.id==='wwStart')post('/werewolf/start',{});else if(b.id==='wwAdvance')post('/werewolf/advance',{});else if(b.id==='wwAbort')post('/werewolf/abort',{});else if(b.id==='wwSubmitAction')post('/werewolf/action',{action:e('wwAction').value,targetId:e('wwTarget').value,secondTargetId:e('wwSecondTarget').value,text:e('wwActionText').value,roleId:e('wwActionText').value})});
    var group=e('groupSelect');if(group)group.addEventListener('change',function(){var v=document.querySelector('.view.active');if(v&&v.id==='v-werewolf')load()});
  })();</script>`;
  source = source.includes('</body>') ? source.replace('</body>', script + '</body>') : source + script;
  return source;
}

export {
  ROLE_DEFINITIONS, ROLE_IDS, WEREWOLF_MAX_PLAYERS, WEREWOLF_MIN_PLAYERS,
  buildBalancedRoleDeck, handleWerewolfOneBotEvent, handleWerewolfPortalApi, injectWerewolfPortalClient,
  normalizeWerewolfConfig, processWerewolfTimers, publicWerewolfState, resolveWerewolfWin
};