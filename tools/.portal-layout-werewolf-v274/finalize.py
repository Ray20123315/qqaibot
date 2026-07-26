from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "src/games/werewolf.js"
source = PATH.read_text(encoding="utf-8")
MARKER = "QQAI_WEREWOLF_V274_WIN_ORDER_MARKER"
if MARKER in source:
    print("Werewolf win-order patch already applied")
    raise SystemExit(0)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)

source = replace_once(
    source,
    'const QQAI_WEREWOLF_V274_COMPLETION_MARKER = "QQAI_WEREWOLF_V274_COMPLETION_MARKER";',
    'const QQAI_WEREWOLF_V274_COMPLETION_MARKER = "QQAI_WEREWOLF_V274_COMPLETION_MARKER";\nconst QQAI_WEREWOLF_V274_WIN_ORDER_MARKER = "QQAI_WEREWOLF_V274_WIN_ORDER_MARKER";',
    "win-order marker",
)

source = replace_once(
    source,
    '''  if (await finishIfWon(env, game)) return;
  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  game.day += 1;''',
    '''  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  if (await finishIfWon(env, game)) return;
  game.day += 1;''',
    "night death skills before win",
)
source = replace_once(
    source,
    '''  if (await finishIfWon(env, game)) return;
  const resolvedDead = game.deaths.slice(deathStart).map(item => ({ player: playerById(game, item.userId), cause: item.cause })).filter(item => item.player);
  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  game.night += 1;''',
    '''  const resolvedDead = game.deaths.slice(deathStart).map(item => ({ player: playerById(game, item.userId), cause: item.cause })).filter(item => item.player);
  if (checkPendingDeathSkill(game, resolvedDead)) { await runAiPhase(env, game); return; }
  if (await finishIfWon(env, game)) return;
  game.night += 1;''',
    "day death skills before win",
)

source = replace_once(
    source,
    '''    if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
      resumeAfterDeathSkill(game, resume, resumeIncrement, "死亡技能超时");
      await runAiPhase(env, game);
    } else {
      await runAiPhase(env, game);
    }''',
    '''    if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
      if (!(await finishIfWon(env, game))) {
        resumeAfterDeathSkill(game, resume, resumeIncrement, "死亡技能超时");
        await runAiPhase(env, game);
      }
    } else {
      await runAiPhase(env, game);
    }''',
    "timeout win after death chain",
)

source = replace_once(
    source,
    '''      game.pendingDeathSkill = null;
      if (!activateNextDeathSkill(game, resume, resumeIncrement)) resumeAfterDeathSkill(game, resume, resumeIncrement, "AI 死亡技能无有效目标");
      continue;''',
    '''      game.pendingDeathSkill = null;
      if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
        if (!(await finishIfWon(env, game))) resumeAfterDeathSkill(game, resume, resumeIncrement, "AI 死亡技能无有效目标");
      }
      continue;''',
    "AI no-target win after chain",
)

source = replace_once(
    source,
    '''    if (!(await finishIfWon(env, game)) && checkPendingDeathSkill(game, [{ player: dead, cause }], "day_discussion", false)) await runAiPhase(env, game);
    await saveGame(env, game);''',
    '''    if (checkPendingDeathSkill(game, [{ player: dead, cause }], "day_discussion", false)) await runAiPhase(env, game);
    else await finishIfWon(env, game);
    await saveGame(env, game);''',
    "duel death skill before win",
)

source = replace_once(
    source,
    '''    if (!(await finishIfWon(env, game))) {
      if (!checkPendingDeathSkill(game, [{ player, cause: "白狼王正式牺牲技能" }, { player: target, cause: "白狼王审判带走" }], "night", true)) {
        resumeAfterDeathSkill(game, "night", true, "白狼王审判强制结束白天");
        await runAiPhase(env, game);
      } else {
        await runAiPhase(env, game);
      }
      await saveGame(env, game);
    }''',
    '''    if (!checkPendingDeathSkill(game, [{ player, cause: "白狼王正式牺牲技能" }, { player: target, cause: "白狼王审判带走" }], "night", true)) {
      if (!(await finishIfWon(env, game))) {
        resumeAfterDeathSkill(game, "night", true, "白狼王审判强制结束白天");
        await runAiPhase(env, game);
      }
    } else {
      await runAiPhase(env, game);
    }
    await saveGame(env, game);''',
    "white wolf death skill before win",
)

source = replace_once(
    source,
    '''    if (!(await finishIfWon(env, game))) {
      if (!checkPendingDeathSkill(game, [{ player: target, cause: shotCause }], resume, resumeIncrement)) {
        resumeAfterDeathSkill(game, resume, resumeIncrement);
        await runAiPhase(env, game);
      } else {
        await runAiPhase(env, game);
      }
      await saveGame(env, game);
    }''',
    '''    if (!checkPendingDeathSkill(game, [{ player: target, cause: shotCause }], resume, resumeIncrement)) {
      if (!(await finishIfWon(env, game))) {
        resumeAfterDeathSkill(game, resume, resumeIncrement);
        await runAiPhase(env, game);
      }
    } else {
      await runAiPhase(env, game);
    }
    await saveGame(env, game);''',
    "death shot chain before win",
)

PATH.write_text(source, encoding="utf-8")

test_path = ROOT / "verify-werewolf-gameplay.mjs"
test = test_path.read_text(encoding="utf-8")
extra = r'''
{
  const blackWolf = player("20001", "black_wolf_king"), goodA = player("20002", "villager"), goodB = player("20003", "villager");
  const game = gameWith([blackWolf, goodA, goodB], "day_vote");
  game.dayVotes = { [goodA.id]: blackWolf.id, [goodB.id]: blackWolf.id, [blackWolf.id]: goodA.id };
  await tallyDayVote(null, game);
  assert.equal(game.status, "active", "eliminating the last black wolf king must not end the game before its death skill");
  assert.equal(game.phase, "death_skill");
  assert.equal(game.pendingDeathSkill?.actorId, blackWolf.id);
}
'''
test = replace_once(test, '\nconsole.log("verify-werewolf-gameplay: ok");', extra + '\nconsole.log("verify-werewolf-gameplay: ok");', "append win-order test")
test_path.write_text(test, encoding="utf-8")
print("Werewolf death-skill win ordering fixed")
