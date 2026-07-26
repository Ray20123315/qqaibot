import assert from "node:assert/strict";
import {
  activateNextDeathSkill,
  checkPendingDeathSkill,
  createGame,
  createRoleState,
  handlePlayerAction,
  newPlayer,
  normalizeWerewolfConfig,
  resolveWerewolfWin
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

console.log("verify-werewolf-gameplay: ok");
