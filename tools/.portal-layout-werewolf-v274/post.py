from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "src/games/werewolf.js"
source = PATH.read_text(encoding="utf-8")
MARKER = "QQAI_WEREWOLF_V274_COMPLETION_MARKER"
if MARKER in source:
    print("Werewolf completion patch already applied")
    raise SystemExit(0)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)

source = replace_once(
    source,
    'const COPYABLE_ROLE_ACTIONS = Object.freeze({ seer: "inspect", witch: "witch_poison", ninja: "decoy", shapeshifter_wolf: "disguise", blood_wolf: "blood_moon", mermaid: "redirect", guard: "protect", detective: "track", lecher: "visit", villager: "vigilance", voodoo_girl: "curse", enchanter: "hex" });',
    'const COPYABLE_ROLE_ACTIONS = Object.freeze({ seer: "inspect", witch: "witch_poison", ninja: "decoy", shapeshifter_wolf: "disguise", blood_wolf: "blood_moon", mermaid: "redirect", guard: "protect", detective: "track", lecher: "visit", villager: "vigilance", voodoo_girl: "curse", enchanter: "hex" });\nconst QQAI_WEREWOLF_V274_COMPLETION_MARKER = "QQAI_WEREWOLF_V274_COMPLETION_MARKER";',
    "completion marker",
)

source = replace_once(
    source,
    '''function queueDeath(game, player, cause, killerId = "") {
  if (!player || player.alive === false) return false;
  player.alive = false;
  player.diedAt = nowMs();
  player.deathCause = cause;
  game.deaths.push({ userId: player.id, name: player.name, roleId: player.roleId, cause, killerId, at: nowMs() });
  appendPublic(game, `${player.name} 死亡。原因：${cause}。`, "death", { userId: player.id, cause });
  if (game.sheriff?.holderId === player.id) nextSheriff(game);
  return true;
}''',
    '''function queueDeath(game, player, cause, killerId = "", chainLover = true) {
  if (!player || player.alive === false) return false;
  player.alive = false;
  player.diedAt = nowMs();
  player.deathCause = cause;
  game.deaths.push({ userId: player.id, name: player.name, roleId: player.roleId, cause, killerId, at: nowMs() });
  appendPublic(game, `${player.name} 死亡。原因：${cause}。`, "death", { userId: player.id, cause });
  if (game.sheriff?.holderId === player.id) nextSheriff(game);
  if (chainLover && Array.isArray(game.lovers) && game.lovers.includes(player.id)) {
    const loverId = game.lovers.find(id => id !== player.id);
    const lover = playerById(game, loverId);
    if (lover?.alive !== false) queueDeath(game, lover, `恋人 ${player.name} 死亡，随之殉情`, player.id, false);
  }
  return true;
}''',
    "lover death cascade",
)

source = replace_once(
    source,
    '''  const resolvedResumePhase = resumePhase || (game.phase === "night" ? "day_discussion" : "night");
  const queue = deathSkillQueue(game);
  for (const entry of deadPlayers || []) {''',
    '''  const resolvedResumePhase = resumePhase || (game.phase === "night" ? "day_discussion" : "night");
  const queue = deathSkillQueue(game);
  const entries = [];
  const seen = new Set();
  for (const entry of [
    ...(Array.isArray(deadPlayers) ? deadPlayers : []),
    ...(game.players || []).filter(player => player.alive === false).map(player => ({ player, cause: player.deathCause || "" }))
  ]) {
    const id = String(entry?.player?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push(entry);
  }
  for (const entry of entries) {''',
    "death skill cascade scan",
)

source = replace_once(
    source,
    '''  const wolves = alive.filter(player => isWolfRole(player.roleId));
  const nonWolves = alive.filter(player => !isWolfRole(player.roleId));
  if (!wolves.length) {
    const wraith = alive.find(player => player.roleId === "wraith");
    if (wraith) return { team: "spirit", playerIds: [wraith.id], text: `狼人已经全灭，但怨灵 ${wraith.name} 仍潜伏在人群中，怨灵阵营获胜。` };
    return { team: "good", playerIds: nonWolves.map(player => player.id), text: "狼人已经全灭，好人阵营获胜。" };
  }
  if (wolves.length >= nonWolves.length) return { team: "wolf", playerIds: wolves.map(player => player.id), text: "狼人数量已不低于其他存活玩家，狼人阵营获胜。" };''',
    '''  const wolves = alive.filter(player => isWolfRole(player.roleId));
  const spirits = alive.filter(player => player.team === "spirit");
  const good = alive.filter(player => player.team === "good");
  const nonWolves = alive.filter(player => !isWolfRole(player.roleId));
  if (!wolves.length) {
    if (spirits.length) return { team: "spirit", playerIds: spirits.map(player => player.id), text: `狼人已经全灭，仍存活的怨灵阵营成员（${spirits.map(player => player.name).join("、")}）获胜。` };
    return { team: "good", playerIds: good.map(player => player.id), text: "狼人和怨灵阵营均已全灭，好人阵营获胜。" };
  }
  if (wolves.length >= nonWolves.length) return { team: "wolf", playerIds: wolves.map(player => player.id), text: "狼人数量已不低于其他存活玩家，狼人阵营获胜。" };''',
    "spirit team win",
)

source = replace_once(source, 'async function resolveNight(env, game) {\n  const dead = [];', 'async function resolveNight(env, game) {\n  const dead = [];\n  const deathStart = game.deaths.length;', "night death cursor")
source = replace_once(
    source,
    '''  appendPublic(game, dead.length ? `天亮了，本夜死亡：${dead.map(item => item.player.name).join("、")}。` : "天亮了，本夜无人死亡。", "dawn");
  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, dead)) return;
  game.day += 1;''',
    '''  const resolvedDead = game.deaths.slice(deathStart).map(item => ({ player: playerById(game, item.userId), cause: item.cause })).filter(item => item.player);
  appendPublic(game, resolvedDead.length ? `天亮了，本夜死亡：${resolvedDead.map(item => item.player.name).join("、")}。` : "天亮了，本夜无人死亡。", "dawn");
  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  game.day += 1;''',
    "night cascade result",
)

source = replace_once(
    source,
    '''  const counts = voteCounts(game, bomb.votes, { sheriffWeight: true, invalidMasochist: true });
  const rawCounts = voteCounts(game, game.dayVotes || {}, { sheriffWeight: true, invalidMasochist: false });
  const topRaw = highestTargets(rawCounts);
  const cultist = topRaw.length === 1 ? playerById(game, topRaw[0]) : null;''',
    '''  const counts = voteCounts(game, bomb.votes, { sheriffWeight: true, invalidMasochist: true });
  const top = highestTargets(counts);
  const cultist = top.length === 1 ? playerById(game, top[0]) : null;''',
    "cultist actual votes",
)
source = replace_once(source, '  const top = highestTargets(counts);\n  if (bomb.invalidVoterId)', '  if (bomb.invalidVoterId)', "remove duplicate day top")
source = replace_once(source, '  const dead = [];\n  if (top.length === 1) {', '  const deathStart = game.deaths.length;\n  const dead = [];\n  if (top.length === 1) {', "day death cursor")
source = replace_once(
    source,
    '''  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, dead)) return;
  game.night += 1;''',
    '''  if (await finishIfWon(env, game)) return;
  const resolvedDead = game.deaths.slice(deathStart).map(item => ({ player: playerById(game, item.userId), cause: item.cause })).filter(item => item.player);
  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  game.night += 1;''',
    "day cascade result",
)

source = replace_once(
    source,
    '''  } else if (game.phase === "death_skill") {
    const resume = game.pendingDeathSkill?.resumePhase || "night";
    const resumeIncrement = game.pendingDeathSkill?.resumeIncrement !== false;
    game.pendingDeathSkill = null;
    if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
      resumeAfterDeathSkill(game, resume, resumeIncrement, "死亡技能超时");
      await runAiPhase(env, game);
    }
  }''',
    '''  } else if (game.phase === "death_skill") {
    const resume = game.pendingDeathSkill?.resumePhase || "night";
    const resumeIncrement = game.pendingDeathSkill?.resumeIncrement !== false;
    game.pendingDeathSkill = null;
    if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
      resumeAfterDeathSkill(game, resume, resumeIncrement, "死亡技能超时");
      await runAiPhase(env, game);
    } else {
      await runAiPhase(env, game);
    }
  }''',
    "AI next queued timeout",
)

source = replace_once(
    source,
    '''async function runAiPhase(env, game) {
  const aiPlayers = livingPlayers(game).filter(isAiPlayer).sort((left, right) => Number(isWolfRole(right.roleId)) - Number(isWolfRole(left.roleId)));''',
    '''async function runAiDeathSkill(env, game) {
  let safety = 0;
  while (game.phase === "death_skill" && game.pendingDeathSkill && safety++ < WEREWOLF_MAX_PLAYERS) {
    const actor = playerById(game, game.pendingDeathSkill.actorId);
    if (!actor || !isAiPlayer(actor)) return;
    const choices = livingPlayers(game).filter(player => player.id !== actor.id).map(player => player.id);
    const decision = await aiDecision(env, game, actor, "death_shot", choices);
    const targetId = decision?.targetId || choices[0];
    if (!targetId) {
      const resume = game.pendingDeathSkill.resumePhase || "night";
      const resumeIncrement = game.pendingDeathSkill.resumeIncrement !== false;
      game.pendingDeathSkill = null;
      if (!activateNextDeathSkill(game, resume, resumeIncrement)) resumeAfterDeathSkill(game, resume, resumeIncrement, "AI 死亡技能无有效目标");
      continue;
    }
    const result = await handlePlayerAction(env, game, { userId: actor.id }, "death_shot", targetId, {});
    if (!result.ok) return;
  }
}

async function runAiPhase(env, game) {
  if (game.phase === "death_skill") { await runAiDeathSkill(env, game); return; }
  const aiPlayers = livingPlayers(game).filter(isAiPlayer).sort((left, right) => Number(isWolfRole(right.roleId)) - Number(isWolfRole(left.roleId)));''',
    "AI death skill runner",
)

source = replace_once(
    source,
    '''  } else if (game.phase === "day_discussion") {
    for (const player of aiPlayers) {
      const decision = await aiDecision(env, game, player, "day_speech", targetablePlayers(game, player.id).map(item => item.id));
      const speech = String(decision?.speech || "我先听大家发言，暂时保留判断。").slice(0, 100);
      appendPublic(game, `${player.name}：${speech}`, "ai_speech", { userId: player.id });
      await sendGroup(env, game.groupId, `${player.name}：${speech}`).catch(() => null);
    }
  }''',
    '''  } else if (game.phase === "day_discussion") {
    for (const player of aiPlayers) {
      if (player.alive === false || game.phase !== "day_discussion") break;
      const choices = targetablePlayers(game, player.id).map(item => item.id);
      if (player.roleId === "bomb_wolf" && !player.roleState?.[`bombDay${game.day}`] && choices.length) {
        const decision = await aiDecision(env, game, player, "plant_bomb", choices);
        if (decision?.targetId) await handlePlayerAction(env, game, { userId: player.id }, "plant_bomb", decision.targetId, {});
      }
      if (game.day >= 2 && player.roleId === "knight" && !player.roleState?.used && choices.length) {
        const decision = await aiDecision(env, game, player, "duel", choices);
        if (decision?.targetId) await handlePlayerAction(env, game, { userId: player.id }, "duel", decision.targetId, {});
        if (game.phase !== "day_discussion") return;
      }
      if (game.day >= 2 && player.roleId === "white_wolf_king" && !player.roleState?.used && choices.length) {
        const decision = await aiDecision(env, game, player, "white_judgement", choices);
        if (decision?.targetId) await handlePlayerAction(env, game, { userId: player.id }, "white_judgement", decision.targetId, {});
        if (game.phase !== "day_discussion") return;
      }
      if (player.alive === false || game.phase !== "day_discussion") continue;
      const decision = await aiDecision(env, game, player, "day_speech", choices);
      const speech = String(decision?.speech || "我先听大家发言，暂时保留判断。").slice(0, 100);
      appendPublic(game, `${player.name}：${speech}`, "ai_speech", { userId: player.id });
      await sendGroup(env, game.groupId, `${player.name}：${speech}`).catch(() => null);
    }
  }''',
    "AI day role actions",
)

source = replace_once(
    source,
    '''    if (!(await finishIfWon(env, game))) checkPendingDeathSkill(game, [{ player: dead, cause }], "day_discussion", false);
    await saveGame(env, game);''',
    '''    if (!(await finishIfWon(env, game)) && checkPendingDeathSkill(game, [{ player: dead, cause }], "day_discussion", false)) await runAiPhase(env, game);
    await saveGame(env, game);''',
    "duel AI death continuation",
)
source = replace_once(
    source,
    '''      if (!checkPendingDeathSkill(game, [{ player, cause: "白狼王正式牺牲技能" }, { player: target, cause: "白狼王审判带走" }], "night", true)) {
        resumeAfterDeathSkill(game, "night", true, "白狼王审判强制结束白天");
        await runAiPhase(env, game);
      }
      await saveGame(env, game);''',
    '''      if (!checkPendingDeathSkill(game, [{ player, cause: "白狼王正式牺牲技能" }, { player: target, cause: "白狼王审判带走" }], "night", true)) {
        resumeAfterDeathSkill(game, "night", true, "白狼王审判强制结束白天");
        await runAiPhase(env, game);
      } else {
        await runAiPhase(env, game);
      }
      await saveGame(env, game);''',
    "white wolf AI death continuation",
)
source = replace_once(
    source,
    '''      if (!checkPendingDeathSkill(game, [{ player: target, cause: shotCause }], resume, resumeIncrement)) {
        resumeAfterDeathSkill(game, resume, resumeIncrement);
        await runAiPhase(env, game);
      }
      await saveGame(env, game);''',
    '''      if (!checkPendingDeathSkill(game, [{ player: target, cause: shotCause }], resume, resumeIncrement)) {
        resumeAfterDeathSkill(game, resume, resumeIncrement);
        await runAiPhase(env, game);
      } else {
        await runAiPhase(env, game);
      }
      await saveGame(env, game);''',
    "chained AI death continuation",
)

source = replace_once(
    source,
    '''  const decision = await aiDecision(env, game, player, "night", choices);
  const targetId = decision?.targetId || choices[0];
  if (isWolfRole(player.roleId)) {''',
    '''  const decision = await aiDecision(env, game, player, "night", choices);
  const targetId = decision?.targetId || choices[0];
  if (player.roleId === "gravedigger" && player.roleState?.copiedRoleId && !player.roleState?.copiedSkillUsed) {
    const secondTargetId = choices.find(id => id !== targetId) || "";
    await handlePlayerAction(env, game, { userId: player.id }, "copied_action", targetId, { secondTargetId, roleId: "villager" });
    return;
  }
  if (player.roleId === "thief" && !player.roleState?.used && targetId) {
    await handlePlayerAction(env, game, { userId: player.id }, "swap_role", targetId, {});
    return;
  }
  if (isWolfRole(player.roleId)) {''',
    "AI copied and thief actions",
)

source = replace_once(
    source,
    '''  ROLE_DEFINITIONS, ROLE_IDS, WEREWOLF_MAX_PLAYERS, WEREWOLF_MIN_PLAYERS,
  activateNextDeathSkill, buildBalancedRoleDeck, checkPendingDeathSkill, createGame, createRoleState, handlePlayerAction, handleWerewolfOneBotEvent, handleWerewolfPortalApi, injectWerewolfPortalClient, newPlayer,
  normalizeWerewolfConfig, processWerewolfTimers, publicWerewolfState, resolveWerewolfWin''',
    '''  ROLE_DEFINITIONS, ROLE_IDS, WEREWOLF_MAX_PLAYERS, WEREWOLF_MIN_PLAYERS,
  activateNextDeathSkill, buildBalancedRoleDeck, checkPendingDeathSkill, createGame, createRoleState, handlePlayerAction, handleWerewolfOneBotEvent, handleWerewolfPortalApi, injectWerewolfPortalClient, newPlayer, queueDeath, runAiPhase, tallyDayVote,
  normalizeWerewolfConfig, processWerewolfTimers, publicWerewolfState, resolveWerewolfWin''',
    "completion test exports",
)

PATH.write_text(source, encoding="utf-8")

test_path = ROOT / "verify-werewolf-gameplay.mjs"
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    '''  newPlayer,
  normalizeWerewolfConfig,
  resolveWerewolfWin''',
    '''  newPlayer,
  normalizeWerewolfConfig,
  queueDeath,
  resolveWerewolfWin,
  runAiPhase,
  tallyDayVote''',
    "test imports",
)
extra_tests = r'''
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
'''
test = replace_once(test, '\nconsole.log("verify-werewolf-gameplay: ok");', extra_tests + '\nconsole.log("verify-werewolf-gameplay: ok");', "append completion tests")
test_path.write_text(test, encoding="utf-8")
print("final Werewolf completion patch applied")
