import fs from "node:fs";

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Ambiguous anchor: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

const path = "src/games/werewolf.js";
let source = fs.readFileSync(path, "utf8");
const oldPrefix = `async function handleWerewolfOneBotEvent(env, body) {
  if (!body || body.post_type !== "message") return null;
  const text = eventText(body);
  if (!/^(?:[!！](?:狼人杀|狼人殺|狼聊|分组查验|分組查驗|自爆|狼人自爆|投票|竞选警长|競選警長|退出竞选|退出競選|警长投票|警長投票|白狼王审判|白狼王審判|骑士决斗|騎士決鬥|炸弹植入|炸彈植入)|[!！]我的狼人杀)/i.test(text)) return null;
  const isGroup = body.message_type === "group";
  const userId = cleanId(body.user_id);
  const groupId = isGroup ? cleanId(body.group_id) : cleanId(commandArgs(text)[1]);
  if (/^[!！](?:自爆|狼人自爆)/i.test(text)) {
    if (isGroup) await sendGroup(env, groupId, "本模式禁止普通自爆。白狼王只能使用有明确目标并记录审计的专属审判技能。").catch(() => null);
    else await sendPrivate(env, userId, "本模式禁止普通自爆。白狼王专属审判不等于自由自爆。").catch(() => null);
    return { handled: true };
  }
  let game = isGroup ? await readGame(env, groupId) : await findPrivateGame(env, userId, groupId);
  const reply = async message => isGroup ? sendGroup(env, groupId, message) : sendPrivate(env, userId, message);
  const args = commandArgs(text);
`;
const newPrefix = `async function handleWerewolfOneBotEvent(env, body) {
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
      appendPublic(activeGame, \`\${speaker.name || userId}：\${text.slice(0, 1200)}\`, "discussion", { actorId: userId, messageId: String(body.message_id || "") });
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
`;
source = replaceOnce(source, oldPrefix, newPrefix, "werewolf handler prefix");
source = replaceOnce(
  source,
  `  if (!game) { await reply("没有找到你参与中的狼人杀；私讯技能时请附群号。"); return { handled: true }; }\n`,
  `  if (!game) {\n    if (/^[!！](?:投票|竞选警长|競選警長|退出竞选|退出競選|警长投票|警長投票|白狼王审判|白狼王審判|骑士决斗|騎士決鬥|炸弹植入|炸彈植入)/i.test(text)) return null;\n    await reply("没有找到你参与中的狼人杀；私讯技能时请附群号。");\n    return { handled: true };\n  }\n`,
  "no game generic command handoff"
);
fs.writeFileSync(path, source);

const verifyPath = "verify-werewolf.mjs";
let verify = fs.readFileSync(verifyPath, "utf8");
verify = replaceOnce(
  verify,
  `assert.match(moduleText, /隐藏分组/);\n`,
  `assert.match(moduleText, /隐藏分组/);\nassert.match(moduleText, /白天普通发言属于公开辩论资料/);\nassert.match(moduleText, /没有对局时必须交回其他指令系统/);\n`,
  "werewolf boundary assertions"
);
fs.writeFileSync(verifyPath, verify);
console.log("Applied werewolf public discussion and command handoff fixes");
