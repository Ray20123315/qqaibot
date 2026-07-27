import fs from "node:fs";
import assert from "node:assert/strict";
import {
  ROLE_DEFINITIONS,
  buildBalancedRoleDeck,
  normalizeWerewolfConfig,
  publicWerewolfState,
  resolveWerewolfWin
} from "./src/games/werewolf.js";

const requiredRoles = [
  "werewolf","black_wolf_king","white_wolf_king","snow_wolf","shapeshifter_wolf","original_wolf","berserk_wolf","bomb_wolf","blood_wolf",
  "cupid","seer","apprentice_seer","witch","hunter","ninja","fraudster","masochist_cultist","sadist_leader","mermaid","gravedigger","knight","guard","detective","lecher","thief","villager",
  "wraith","voodoo_girl","enchanter"
];
for (const id of requiredRoles) assert.ok(ROLE_DEFINITIONS[id], `missing role ${id}`);
assert.equal(ROLE_DEFINITIONS.white_wolf_king.action, "white_judgement");
assert.match(ROLE_DEFINITIONS.lecher.summary, /不产生性内容/);

const config = normalizeWerewolfConfig({ maxPlayers: 99, aiCount: 99, groupCount: 99, sheriffEnabled: true });
assert.equal(config.maxPlayers, 32);
assert.equal(config.aiCount, 12);
assert.equal(config.groupCount, 8);
assert.equal(config.selfExplosionAllowed, false);
assert.equal(config.wolfChatPrivateOnly, true);

for (const count of [5, 6, 8, 10, 12, 16, 24, 32]) {
  const deck = buildBalancedRoleDeck(count);
  assert.equal(deck.length, count);
  assert.ok(deck.some(id => ROLE_DEFINITIONS[id].team === "wolf"));
  assert.ok(deck.some(id => ROLE_DEFINITIONS[id].team === "good"));
}

const activeGame = {
  id: "ww_test", groupId: "123456", creatorId: "1", status: "active", phase: "night", phaseEndsAt: 0, day: 1, night: 1,
  config: normalizeWerewolfConfig({ groupCount: 0 }), sheriff: { holderId: "", candidates: [], alternates: [], votes: {} }, publicLog: [], wolfChat: [], lovers: [],
  players: [
    { id: "10001", name: "A", alive: true, roleId: "werewolf", team: "wolf", roleState: {}, diary: [], privateNotices: [], groupTeam: 0 },
    { id: "10002", name: "B", alive: true, roleId: "seer", team: "good", roleState: {}, diary: [], privateNotices: [], groupTeam: 0 },
    { id: "10003", name: "C", alive: true, roleId: "villager", team: "good", roleState: {}, diary: [], privateNotices: [], groupTeam: 0 }
  ]
};
const managerView = publicWerewolfState(activeGame, { userId: "99999", role: "owner", canManage: true });
assert.equal(managerView.players[0].roleId, undefined, "management view must not leak active roles");
const ownView = publicWerewolfState(activeGame, { userId: "10001", role: "member" });
assert.equal(ownView.own.roleId, "werewolf");
assert.ok(Array.isArray(ownView.own.wolfChat));

const goodWinGame = structuredClone(activeGame);
goodWinGame.players[0].alive = false;
assert.equal(resolveWerewolfWin(goodWinGame).team, "good");
const spiritWinGame = structuredClone(goodWinGame);
spiritWinGame.players[2].roleId = "wraith";
spiritWinGame.players[2].team = "spirit";
assert.equal(resolveWerewolfWin(spiritWinGame).team, "spirit");
const grouped = structuredClone(activeGame);
grouped.config.groupCount = 2;
grouped.players[0].groupTeam = 1;
grouped.players[1].groupTeam = 1;
grouped.players[2].groupTeam = 2;
grouped.players[2].alive = false;
assert.equal(resolveWerewolfWin(grouped).team, "group_1");

const worker = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const moduleText = fs.readFileSync("src/games/werewolf.js", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releaseNotes = JSON.parse(fs.readFileSync("release-notes.json", "utf8"));
assert.match(worker, /handleWerewolfOneBotEvent/);
assert.match(worker, /processWerewolfTimers/);
assert.match(worker, /injectWerewolfPortalClient/);
assert.match(portal, /handleWerewolfPortalApi/);
assert.match(moduleText, /狼人密谈禁止在群内发送/);
assert.match(moduleText, /本模式禁止普通自爆/);
assert.match(moduleText, /首轮平票/);
assert.match(moduleText, /重选仍出现并列第一/);
assert.match(moduleText, /AI玩家/);
assert.match(moduleText, /隐藏分组/);
assert.match(moduleText, /白天普通发言属于公开辩论资料/);
assert.match(moduleText, /没有对局时必须交回其他指令系统/);
assert.equal(packageJson.version, "2.7.8");
assert.match(packageJson.scripts.check, /verify-werewolf\.mjs/);
assert.equal(releaseNotes.version, "2.7.8");
console.log("werewolf verification passed");