import assert from "node:assert/strict";
import {
  activateNextDeathSkill,
  checkPendingDeathSkill,
  createGame,
  createRoleState,
  handlePlayerAction,
  newPlayer,
  normalizeWerewolfConfig,
  queueDeath,
  resolveWerewolfWin,
  runAiPhase,
  tallyDayVote
} from "./src/games/werewolf.js";

function player(id, roleId, alive = true) {
  const item = newPlayer({ id, name: id });
  item.roleId = roleId;
  item.originalRoleId = roleId;
  item.team = ["werewolf","black_wolf_king","white_wolf_king","snow_wolf","shapeshifter_wolf","original_wolf","berserk_wolf","bomb_wolf","blood_wolf"].includes(roleId) ? "wolf" : ["wraith","voodoo_girl","enchanter"].includes(roleId) ? "spirit" : "good";
  item.alive = alive;
  item.roleState = createRoleState(roleId);
  return item;
}
function gameWith(players, phase = "night") {
  const game = createGame({ groupId: "123456", creatorId: players[0].id, creatorName: "host", config: normalizeWerewolfConfig({ maxPlayers: players.length, sheriffEnabled: false }) });
  game.status = "active";
  game.phase = phase;
  game.night = 1;
  game.day = 1;
  game.players = players;
  return game;
}

{
  const wolf = player("10001", "werewolf"), ally = player("10002", "snow_wolf"), villager = player("10003", "villager");
  const game = gameWith([wolf, ally, villager]);
  const rejected = await handlePlayerAction(null, game, { userId: wolf.id }, "wolf_kill", ally.id, {});
  assert.equal(rejected.ok, false, "wolves must not submit a wolf target");
  const accepted = await handlePlayerAction(null, game, { userId: wolf.id }, "wolf_kill", villager.id, {});
  assert.equal(accepted.ok, true);
  const overwritten = await handlePlayerAction(null, game, { userId: wolf.id }, "wolf_kill", villager.id, {});
  assert.equal(overwritten.ok, true, "wolf vote may be replaced before night ends");
}

{
  const witch = player("11001", "witch"), a = player("11002", "villager"), b = player("11003", "villager");
  const game = gameWith([witch, a, b]);
  assert.equal((await handlePlayerAction(null, game, { userId: witch.id }, "witch_heal", a.id, {})).ok, true);
  const secondPotion = await handlePlayerAction(null, game, { userId: witch.id }, "witch_poison", b.id, {});
  assert.equal(secondPotion.ok, false);
  assert.match(secondPotion.message, /每晚最多使用一瓶药/);
}

{
  const cupid = player("12001", "cupid"), other = player("12002", "villager"), third = player("12003", "werewolf");
  const game = gameWith([cupid, other, third]);
  const result = await handlePlayerAction(null, game, { userId: cupid.id }, "couple", cupid.id, { secondTargetId: other.id });
  assert.equal(result.ok, true, "Cupid may include self in the pair");
  assert.deepEqual(game.lovers, [cupid.id, other.id]);
}

{
  const digger = player("13001", "gravedigger"), deadSeer = player("13002", "seer", false), wolf = player("13003", "werewolf"), villager = player("13004", "villager");
  const game = gameWith([digger, deadSeer, wolf, villager]);
  const copied = await handlePlayerAction(null, game, { userId: digger.id }, "copy_dead", deadSeer.id, {});
  assert.equal(copied.ok, true, "gravedigger must be able to select a dead player");
  assert.equal(digger.roleState.copiedRoleId, "seer");
  const used = await handlePlayerAction(null, game, { userId: digger.id }, "copied_action", wolf.id, {});
  assert.equal(used.ok, true, "copied active skill must be usable once");
  assert.equal(digger.roleState.copiedSkillUsed, true);
}

{
  const first = player("14001", "hunter", false), second = player("14002", "black_wolf_king", false), survivor = player("14003", "villager"), wolf = player("14004", "werewolf");
  const game = gameWith([first, second, survivor, wolf]);
  const activated = checkPendingDeathSkill(game, [{ player: first, cause: "夜袭" }, { player: second, cause: "放逐" }], "day_discussion", true);
  assert.equal(activated, true);
  assert.equal(game.pendingDeathSkill.actorId, first.id);
  assert.equal(game.pendingDeathSkills.length, 1, "second death skill must remain queued");
  game.pendingDeathSkill = null;
  assert.equal(activateNextDeathSkill(game, "day_discussion", true), true);
  assert.equal(game.pendingDeathSkill.actorId, second.id);
}

{
  const lecher = player("15001", "lecher"), wolf = player("15002", "werewolf"), a = player("15003", "villager"), b = player("15004", "villager"), c = player("15005", "villager"), dead = player("15006", "villager", false);
  const game = gameWith([lecher, wolf, a, b, c, dead], "day_vote");
  lecher.roleState.visitedIds = [a.id, b.id, dead.id];
  assert.notEqual(resolveWerewolfWin(game)?.team, "lecher", "dead visited targets must not count toward the personal win");
  lecher.roleState.visitedIds = [a.id, b.id, c.id];
  assert.equal(resolveWerewolfWin(game)?.team, "lecher");
}

{
  const loverA = player("16001", "hunter"), loverB = player("16002", "villager"), wolf = player("16003", "werewolf"), spare = player("16004", "villager");
  const game = gameWith([loverA, loverB, wolf, spare]);
  game.lovers = [loverA.id, loverB.id];
  assert.equal(queueDeath(game, loverA, "测试死亡", wolf.id), true);
  assert.equal(loverB.alive, false, "the surviving lover must die with the first lover");
  assert.match(loverB.deathCause, /殉情/);
  assert.equal(checkPendingDeathSkill(game, [{ player: loverA, cause: loverA.deathCause }], "day_discussion", false), true, "lover cascade must still queue a hunter death skill");
}

{
  const spirit = player("17001", "voodoo_girl"), good = player("17002", "villager"), deadWolf = player("17003", "werewolf", false);
  const game = gameWith([spirit, good, deadWolf], "day_vote");
  const winner = resolveWerewolfWin(game);
  assert.equal(winner?.team, "spirit", "all living spirit roles share the spirit-team win when wolves are gone");
  assert.deepEqual(winner?.playerIds, [spirit.id]);
}

{
  const cultist = player("18001", "masochist_cultist"), a = player("18002", "villager"), b = player("18003", "villager"), c = player("18004", "villager"), wolf = player("18005", "werewolf");
  const game = gameWith([cultist, a, b, c, wolf], "day_vote");
  game.dayVotes = { [a.id]: cultist.id, [b.id]: cultist.id, [c.id]: a.id, [cultist.id]: a.id };
  await tallyDayVote(null, game);
  assert.equal(game.winner?.team, "masochist_cultist", "cultist personal win must use the actual effective vote counts");
}

{
  const aiHunter = player("ai:1", "hunter", false), wolf = player("19002", "werewolf"), goodA = player("19003", "villager"), goodB = player("19004", "villager");
  aiHunter.isAi = true;
  const game = gameWith([aiHunter, wolf, goodA, goodB], "night");
  assert.equal(checkPendingDeathSkill(game, [{ player: aiHunter, cause: "夜袭" }], "day_discussion", true), true);
  const aliveBefore = game.players.filter(item => item.alive).length;
  await runAiPhase(null, game);
  assert.ok(game.players.filter(item => item.alive).length < aliveBefore, "AI hunter or black wolf king must execute a valid death shot");
  assert.notEqual(game.phase, "death_skill", "AI death skills must not leave the game stuck");
}

{
  const blackWolf = player("20001", "black_wolf_king"), goodA = player("20002", "villager"), goodB = player("20003", "villager");
  const game = gameWith([blackWolf, goodA, goodB], "day_vote");
  game.dayVotes = { [goodA.id]: blackWolf.id, [goodB.id]: blackWolf.id, [blackWolf.id]: goodA.id };
  await tallyDayVote(null, game);
  assert.equal(game.status, "active", "eliminating the last black wolf king must not end the game before its death skill");
  assert.equal(game.phase, "death_skill");
  assert.equal(game.pendingDeathSkill?.actorId, blackWolf.id);
}

console.log("verify-werewolf-gameplay: ok");
