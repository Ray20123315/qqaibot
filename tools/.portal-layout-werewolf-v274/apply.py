from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, value: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(value, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


layout_module = r'''// Final responsive layout layer for the Portal.
// This is intentionally injected after all feature clients so it owns the final cascade.

function injectPortalLayoutClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-portal-layout-v274")) return source;
  const style = `<style id="qqai-portal-layout-v274">
:root{--qqai-sidebar-width:248px;--qqai-control-height:44px;--qqai-content-width:1440px}
html{scroll-behavior:smooth}body{line-height:1.5}.app,.main,.content,.view,.grid,.card,.item{min-width:0}.sidebar{width:var(--qqai-sidebar-width)!important;padding:16px 13px!important}.main{margin-left:var(--qqai-sidebar-width)!important;width:auto!important}.content{width:100%!important;max-width:var(--qqai-content-width)!important;padding:24px clamp(18px,2.2vw,34px) 36px!important}.topbar{min-height:72px!important;height:auto!important;padding:12px clamp(18px,2.2vw,34px)!important;display:grid!important;grid-template-columns:minmax(220px,1fr) minmax(420px,auto)!important;align-items:center!important;gap:16px!important;position:sticky!important;top:0!important}.topbar>.row{min-width:0!important;flex-wrap:nowrap!important}.topbar h2{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.top-actions{display:grid!important;grid-template-columns:minmax(220px,1fr) auto auto!important;align-items:center!important;gap:9px!important;width:min(680px,100%)!important;justify-self:end!important}.top-actions select,.top-actions>.btn{width:100%!important;max-width:none!important;height:var(--qqai-control-height)!important;margin:0!important}
.view>.section-head,.ops-integrated-block>.section-head{align-items:center!important;margin-bottom:18px!important}.section-head>div{min-width:0}.section-head p{max-width:820px;line-height:1.65}.section-head>.row{justify-content:flex-end}.grid{align-items:start}.card{padding:20px!important;border-radius:16px!important}.list{gap:12px!important}.item{padding:14px 15px!important}.item-head{align-items:center}.field{min-width:0}.field input,.field select,.field textarea,.qqai-modal-input{width:100%;max-width:100%}.field input,.field select,.top-actions select,.suite-batch-controls input,.suite-batch-controls select,.suite-sticker-form input,.suite-decision-filters input,.suite-decision-filters select,.ww-action input,.ww-action select{min-height:var(--qqai-control-height)}.btn{min-height:var(--qqai-control-height);display:inline-flex;align-items:center;justify-content:center;line-height:1.2}.switch,.member-toggle{min-height:36px}.code,pre,.log-details pre,.conversation-detail pre,.suite-decision-detail{max-width:100%;overflow:auto;overflow-wrap:anywhere}.qqai-modal{overflow:auto}.qqai-modal-card{max-height:min(88dvh,900px);overflow:auto}.toast{overflow-wrap:anywhere}
.member-console-toolbar{grid-template-columns:minmax(220px,.9fr) minmax(280px,1.1fr)!important}.member-console-filters{grid-template-columns:repeat(4,minmax(150px,1fr)) auto auto!important}.member-directory-row{grid-template-columns:minmax(220px,1.35fr) minmax(190px,.75fr) auto!important}.member-action-row{grid-template-columns:minmax(220px,1fr) minmax(190px,.7fr) minmax(360px,1.45fr)!important}.member-actions{justify-content:flex-end}.relationship-direct{grid-template-columns:repeat(2,minmax(200px,1fr)) auto auto!important}.relationship-row{grid-template-columns:minmax(240px,1fr) auto!important}
.suite-grid{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important}.suite-batch-controls,.suite-sticker-form,.suite-decision-filters,.suite-profile-flags{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))!important;gap:10px!important;align-items:end!important}.suite-batch-controls>*,.suite-sticker-form>*,.suite-decision-filters>*,.suite-profile-flags>*{min-width:0!important;width:100%!important;margin:0!important}.suite-sticker-row,.suite-policy-row{grid-template-columns:minmax(240px,1fr) auto!important}
.cleanup-summary{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))!important}.cleanup-policy{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))!important}.cleanup-filters,.member-data-toolbar,.cleanup-head-actions{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;gap:10px!important}.cleanup-filters>*,.member-data-toolbar>*,.cleanup-head-actions>*{min-width:0!important;width:100%!important;margin:0!important}.cleanup-row{grid-template-columns:auto minmax(230px,1.15fr) minmax(160px,.55fr) minmax(260px,1.2fr)!important}.member-data-row{grid-template-columns:auto minmax(220px,.85fr) minmax(320px,1.4fr)!important}
.ww-create{margin-bottom:14px}.ww-layout{grid-template-columns:minmax(0,1.2fr) minmax(340px,.8fr)!important;gap:16px!important;align-items:start}.ww-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))!important;align-items:end}.ww-grid label{min-width:0}.ww-role-pool{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;max-height:340px;overflow:auto;padding:4px}.ww-log{max-height:430px!important}.ww-log-row{border-color:var(--line)!important;overflow-wrap:anywhere}.ww-action{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}.ww-action .btn,.ww-action input{grid-column:1/-1}.ww-secret{overflow-wrap:anywhere}
@media(max-width:1180px){.member-console-filters{grid-template-columns:repeat(3,minmax(150px,1fr))!important}.member-action-row{grid-template-columns:minmax(220px,1fr) minmax(180px,.65fr)!important}.member-action-row>.member-actions{grid-column:1/-1;justify-content:flex-start}.ww-layout{grid-template-columns:1fr!important}}
@media(max-width:1024px){body.sidebar-open{overflow:hidden}.sidebar{width:min(88vw,340px)!important}.main{margin-left:0!important;width:100%!important}.topbar{position:relative!important;top:auto!important;grid-template-columns:1fr!important;align-items:stretch!important;padding:12px!important;gap:10px!important}.topbar>.row{display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;gap:10px!important;align-items:center!important}.top-actions{width:100%!important;max-width:none!important;justify-self:stretch!important;grid-template-columns:minmax(0,1fr) minmax(118px,.34fr) minmax(118px,.34fr)!important}.content{max-width:none!important;padding:16px 14px calc(28px + env(safe-area-inset-bottom))!important}.span-3,.span-4,.span-5,.span-6,.span-7,.span-8,.span-12{grid-column:1/-1!important}.card{padding:16px!important}.member-console-toolbar,.member-console-filters{grid-template-columns:repeat(2,minmax(0,1fr))!important}.member-directory-row,.member-action-row,.relationship-direct,.relationship-row,.cleanup-row,.member-data-row{grid-template-columns:1fr!important}.member-actions,.relationship-actions{justify-content:flex-start}.member-actions input[type="number"]{width:min(180px,100%)!important}.cleanup-row>label,.member-data-row>label{justify-self:start}.suite-sticker-row,.suite-policy-row{grid-template-columns:1fr!important}}
@media(max-width:700px){.view>.section-head,.ops-integrated-block>.section-head,.section-head.compact{display:grid!important;grid-template-columns:1fr!important;align-items:start!important;gap:12px!important}.section-head>.row,.section-head>.btn,.section-head.compact>.row{width:100%;justify-content:stretch!important}.section-head>.row>.btn,.section-head>.btn{flex:1 1 160px}.top-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}.top-actions select{grid-column:1/-1!important}.member-console-toolbar,.member-console-filters,.cleanup-filters,.member-data-toolbar,.cleanup-head-actions,.suite-batch-controls,.suite-sticker-form,.suite-decision-filters,.suite-profile-flags{grid-template-columns:1fr!important}.member-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;width:100%}.member-actions>*{width:100%!important;margin:0!important}.relationship-actions{display:grid!important;grid-template-columns:1fr!important}.ww-grid,.ww-action{grid-template-columns:1fr!important}.ww-action>*{grid-column:1!important}.ww-role-pool{grid-template-columns:repeat(2,minmax(0,1fr))!important}.overview-hero-actions,.qqai-modal-actions{display:grid!important;grid-template-columns:1fr!important}.overview-hero-actions .btn,.qqai-modal-actions .btn{width:100%}}
@media(max-width:430px){.top-actions{grid-template-columns:1fr!important}.top-actions select,.top-actions>.btn{grid-column:1!important}.content{padding-left:10px!important;padding-right:10px!important}.card{padding:14px!important}.member-actions{grid-template-columns:1fr!important}.ww-role-pool{grid-template-columns:1fr!important}.status-card{align-items:flex-start}.section-head h2{font-size:21px!important}}
</style>`;
  const script = `<script id="qqai-portal-layout-client-v274">(function(){document.documentElement.dataset.portalLayout="2.7.4";})();</script>`;
  source = source.includes("</head>") ? source.replace("</head>", style + "\n</head>") : style + source;
  source = source.includes("</body>") ? source.replace("</body>", script + "\n</body>") : source + script;
  return source;
}

export { injectPortalLayoutClient };
'''
write("src/portal/layout.js", layout_module)

worker = read("worker.js")
worker = replace_once(
    worker,
    'import { getLiveHtmlPage, getPortalHomePage, handleGeminiLiveUpgrade, handlePortalApi } from "./src/portal/runtime.js";\n',
    'import { getLiveHtmlPage, getPortalHomePage, handleGeminiLiveUpgrade, handlePortalApi } from "./src/portal/runtime.js";\nimport { injectPortalLayoutClient } from "./src/portal/layout.js";\n',
    "worker layout import",
)
worker = replace_once(
    worker,
    'const portalHtml = injectWerewolfPortalClient(injectPortalMembersClient(injectDeploymentPortalClient(toSimplifiedChinese(getPortalHomePage(url.host)))));',
    'const portalHtml = injectPortalLayoutClient(injectWerewolfPortalClient(injectPortalMembersClient(injectDeploymentPortalClient(toSimplifiedChinese(getPortalHomePage(url.host))))));',
    "outermost layout injection",
)
write("worker.js", worker)

for path in ["src/portal/community-suite.js", "src/portal/member-cleanup.js"]:
    text = read(path)
    text = text.replace("var(--border)", "var(--line)")
    write(path, text)

werewolf = read("src/games/werewolf.js")
werewolf = werewolf.replace("var(--border)", "var(--line)")
werewolf = replace_once(
    werewolf,
    'const ACTIVE_PHASES = new Set(["sheriff_nomination", "sheriff_vote", "night", "day_discussion", "day_vote", "death_skill"]);',
    'const ACTIVE_PHASES = new Set(["sheriff_nomination", "sheriff_vote", "night", "day_discussion", "day_vote", "death_skill"]);\nconst COPYABLE_ROLE_ACTIONS = Object.freeze({ seer: "inspect", witch: "witch_poison", ninja: "decoy", shapeshifter_wolf: "disguise", blood_wolf: "blood_moon", mermaid: "redirect", guard: "protect", detective: "track", lecher: "visit", villager: "vigilance", voodoo_girl: "curse", enchanter: "hex" });',
    "copyable actions constant",
)
werewolf = replace_once(
    werewolf,
    '    dayVotes: {}, nightActions: {}, publicLog: [], wolfChat: [], deaths: [], pendingDeathSkill: null,',
    '    dayVotes: {}, nightActions: {}, publicLog: [], wolfChat: [], deaths: [], pendingDeathSkill: null, pendingDeathSkills: [],',
    "death skill queue state",
)
create_role_state = '''function createRoleState(roleId = "villager") {
  return {
    used: false,
    healAvailable: roleId === "witch",
    poisonAvailable: roleId === "witch",
    lastProtectedId: "",
    curseStacks: 0,
    visitedIds: [],
    frenzy: 0,
    disguiseRoleId: "villager",
    copiedRoleId: "",
    copiedRoleState: null,
    copiedSkillUsed: false,
    vigilanceActive: false,
    shieldTargetId: "",
    hexed: false,
    seerBlocked: false,
    deathSkillUsed: false
  };
}


'''
werewolf = replace_once(werewolf, "async function distributeRoles(env, game) {", create_role_state + "async function distributeRoles(env, game) {", "role state helper")
werewolf = replace_once(
    werewolf,
    '''    player.roleState = {
      used: false, healAvailable: player.roleId === "witch", poisonAvailable: player.roleId === "witch",
      lastProtectedId: "", curseStacks: 0, visitedIds: [], frenzy: 0, disguiseRoleId: "villager", copiedRoleId: "",
      vigilanceActive: false, shieldTargetId: "", hexed: false, seerBlocked: false
    };''',
    '    player.roleState = createRoleState(player.roleId);',
    "role state initialization",
)

death_block_pattern = re.compile(r'''function deathSkillEligible\(player, cause\) \{[\s\S]*?\n\}\n\n\nfunction promoteApprentice''')
death_block = '''function deathSkillEligible(player, cause) {
  if (!player || !["hunter", "black_wolf_king"].includes(player.roleId)) return false;
  if (/毒|诅咒/.test(String(cause || ""))) return false;
  return player.roleState?.deathSkillUsed !== true;
}

function deathSkillQueue(game) {
  game.pendingDeathSkills = Array.isArray(game.pendingDeathSkills) ? game.pendingDeathSkills : [];
  return game.pendingDeathSkills;
}

function activateNextDeathSkill(game, fallbackResumePhase = "", fallbackResumeIncrement = true) {
  if (game.pendingDeathSkill) return true;
  const next = deathSkillQueue(game).shift();
  if (!next) return false;
  const player = playerById(game, next.actorId);
  if (!player) return activateNextDeathSkill(game, fallbackResumePhase, fallbackResumeIncrement);
  game.pendingDeathSkill = {
    ...next,
    resumePhase: next.resumePhase || fallbackResumePhase || "night",
    resumeIncrement: next.resumeIncrement !== false && fallbackResumeIncrement !== false,
    expiresAt: nowMs() + phaseDuration(game, "death_skill") * 1000
  };
  setPhase(game, "death_skill", `${player.name} 可发动带走技能`);
  appendPrivate(player, `你可在时限内私讯「!狼人杀技能 ${game.groupId} 带走 目标QQ」。`, "death_skill");
  return true;
}

function checkPendingDeathSkill(game, deadPlayers, resumePhase = "", resumeIncrement = true) {
  const resolvedResumePhase = resumePhase || (game.phase === "night" ? "day_discussion" : "night");
  const queue = deathSkillQueue(game);
  for (const entry of deadPlayers || []) {
    const player = entry?.player;
    const cause = entry?.cause || player?.deathCause || "";
    if (!deathSkillEligible(player, cause)) continue;
    player.roleState = player.roleState || createRoleState(player.roleId);
    player.roleState.deathSkillUsed = true;
    if (game.pendingDeathSkill?.actorId === player.id || queue.some(item => item.actorId === player.id)) continue;
    queue.push({ actorId: player.id, roleId: player.roleId, cause, resumePhase: resolvedResumePhase, resumeIncrement });
  }
  return activateNextDeathSkill(game, resolvedResumePhase, resumeIncrement);
}

function resumeAfterDeathSkill(game, resumePhase, increment = true, reason = "死亡技能结算完成") {
  if (resumePhase === "day_discussion") {
    if (increment) game.day += 1;
    setPhase(game, "day_discussion", `${reason}${increment ? `，进入第 ${game.day} 天` : "，继续白天讨论"}`);
  } else {
    if (increment) game.night += 1;
    setPhase(game, "night", `${reason}${increment ? `，进入第 ${game.night} 夜` : "，继续当前夜晚"}`);
  }
}


function promoteApprentice'''
werewolf, count = death_block_pattern.subn(death_block, werewolf, count=1)
if count != 1:
    raise RuntimeError(f"death skill block: expected one match, got {count}")

werewolf = replace_once(
    werewolf,
    '  const specialVisit = alive.find(player => player.roleId === "lecher" && unique(player.roleState?.visitedIds || []).length >= 3);',
    '  const aliveIds = new Set(alive.map(player => String(player.id)));\n  const specialVisit = alive.find(player => player.roleId === "lecher" && unique(player.roleState?.visitedIds || []).filter(id => id !== player.id && aliveIds.has(String(id))).length >= 3);',
    "living visit win condition",
)
werewolf = replace_once(werewolf, "function resolveWolfTarget(game) {", "function resolveWolfTarget(game, { consumeBoost = true } = {}) {", "wolf target preview")
werewolf = replace_once(
    werewolf,
    '    if (weight > 1) actor.roleState.frenzy = Math.max(0, Number(actor.roleState.frenzy || 0) - 1);',
    '    if (weight > 1 && consumeBoost) actor.roleState.frenzy = Math.max(0, Number(actor.roleState.frenzy || 0) - 1);',
    "frenzy preview consumption",
)
werewolf = replace_once(
    werewolf,
    '  const guardAction = getNightActions(game, "protect").find(action => action.targetId === wolfTarget?.id);',
    '  const guardAction = getNightActions(game, "protect").find(action => action.targetId === wolfTarget?.id && playerById(game, action.playerId)?.alive !== false);',
    "living guard validation",
)
werewolf = replace_once(
    werewolf,
    '  const healAction = getNightActions(game, "witch_heal")[0];',
    '  const healAction = getNightActions(game, "witch_heal").find(action => playerById(game, action.playerId)?.alive !== false);',
    "living witch validation",
)
werewolf = replace_once(
    werewolf,
    '''  for (const action of getNightActions(game, "visit")) {
    const actor = playerById(game, action.playerId);
    if (actor?.alive !== false) actor.roleState.visitedIds = unique([...(actor.roleState?.visitedIds || []), action.targetId]);
  }''',
    '''  for (const action of getNightActions(game, "visit")) {
    const actor = playerById(game, action.playerId);
    const target = playerById(game, action.targetId);
    if (actor?.alive !== false && target?.alive !== false) actor.roleState.visitedIds = unique([...(actor.roleState?.visitedIds || []), action.targetId]);
  }''',
    "successful visit recording",
)

werewolf = replace_once(
    werewolf,
    '''  } else if (game.phase === "death_skill") {
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
  }''',
    '''  } else if (game.phase === "death_skill") {
    const resume = game.pendingDeathSkill?.resumePhase || "night";
    const resumeIncrement = game.pendingDeathSkill?.resumeIncrement !== false;
    game.pendingDeathSkill = null;
    if (!activateNextDeathSkill(game, resume, resumeIncrement)) {
      resumeAfterDeathSkill(game, resume, resumeIncrement, "死亡技能超时");
      await runAiPhase(env, game);
    }
  }''',
    "death skill timeout queue",
)

werewolf = replace_once(
    werewolf,
    '''    const dead = isWolfRole(target.roleId) ? target : player;
    queueDeath(game, dead, isWolfRole(target.roleId) ? `骑士 ${player.name} 决斗命中狼人` : `骑士决斗判断错误`, player.id);
    appendPublic(game, `${player.name} 发起骑士决斗；${dead.name} 死亡。`, "duel");
    await finishIfWon(env, game);
    await saveGame(env, game);''',
    '''    const dead = isWolfRole(target.roleId) ? target : player;
    const cause = isWolfRole(target.roleId) ? `骑士 ${player.name} 决斗命中狼人` : `骑士决斗判断错误`;
    queueDeath(game, dead, cause, player.id);
    appendPublic(game, `${player.name} 发起骑士决斗；${dead.name} 死亡。`, "duel");
    if (!(await finishIfWon(env, game))) checkPendingDeathSkill(game, [{ player: dead, cause }], "day_discussion", false);
    await saveGame(env, game);''',
    "knight death skill chain",
)
werewolf = replace_once(
    werewolf,
    '''    queueDeath(game, player, "白狼王正式牺牲技能", player.id);
    queueDeath(game, target, "白狼王审判带走", player.id);
    appendPublic(game, `白狼王 ${player.name} 发动正式审判并带走 ${target.name}；普通自爆规则仍为禁止。`, "white_judgement");
    if (!(await finishIfWon(env, game))) {
      game.night += 1;
      setPhase(game, "night", `白狼王审判强制结束白天，进入第 ${game.night} 夜`);
      await runAiPhase(env, game);
      await saveGame(env, game);
    }''',
    '''    queueDeath(game, player, "白狼王正式牺牲技能", player.id);
    queueDeath(game, target, "白狼王审判带走", player.id);
    appendPublic(game, `白狼王 ${player.name} 发动正式审判并带走 ${target.name}；普通自爆规则仍为禁止。`, "white_judgement");
    if (!(await finishIfWon(env, game))) {
      if (!checkPendingDeathSkill(game, [{ player, cause: "白狼王正式牺牲技能" }, { player: target, cause: "白狼王审判带走" }], "night", true)) {
        resumeAfterDeathSkill(game, "night", true, "白狼王审判强制结束白天");
        await runAiPhase(env, game);
      }
      await saveGame(env, game);
    }''',
    "white judgement death chain",
)
werewolf = replace_once(
    werewolf,
    '''    queueDeath(game, target, `${roleDef(player.roleId).name} 死亡带走`, player.id);
    const resume = game.pendingDeathSkill.resumePhase || "night";
    game.pendingDeathSkill = null;
    if (!(await finishIfWon(env, game))) {
      if (resume === "day_discussion") { game.day += 1; setPhase(game, "day_discussion", `死亡技能结算后进入第 ${game.day} 天`); }
      else { game.night += 1; setPhase(game, "night", `死亡技能结算后进入第 ${game.night} 夜`); }
      await runAiPhase(env, game);
      await saveGame(env, game);
    }''',
    '''    const shotCause = `${roleDef(player.roleId).name} 死亡带走`;
    queueDeath(game, target, shotCause, player.id);
    const resume = game.pendingDeathSkill.resumePhase || "night";
    const resumeIncrement = game.pendingDeathSkill.resumeIncrement !== false;
    game.pendingDeathSkill = null;
    if (!(await finishIfWon(env, game))) {
      if (!checkPendingDeathSkill(game, [{ player: target, cause: shotCause }], resume, resumeIncrement)) {
        resumeAfterDeathSkill(game, resume, resumeIncrement);
        await runAiPhase(env, game);
      }
      await saveGame(env, game);
    }''',
    "death shot chaining",
)

werewolf = replace_once(
    werewolf,
    '''  const player = playerById(game, actor.userId);
  if (!player) return { ok: false, message: "你不是这局游戏的玩家。" };
  if (player.alive === false && action !== "death_shot") return { ok: false, message: "你已经出局，不能执行该操作。" };
  const target = targetId ? playerById(game, targetId) : null;
  const requireTarget = () => target && target.alive !== false && target.id !== player.id;''',
    '''  const player = playerById(game, actor.userId);
  if (!player) return { ok: false, message: "你不是这局游戏的玩家。" };
  const requestedAction = String(action || "");
  if (player.alive === false && requestedAction !== "death_shot") return { ok: false, message: "你已经出局，不能执行该操作。" };
  let actingRoleId = player.roleId;
  let abilityState = player.roleState || (player.roleState = createRoleState(player.roleId));
  let copiedAction = false;
  if (requestedAction === "copied_action") {
    const copiedRoleId = String(player.roleState?.copiedRoleId || "");
    const copied = COPYABLE_ROLE_ACTIONS[copiedRoleId];
    if (player.roleId !== "gravedigger" || !copied || player.roleState?.copiedSkillUsed) return { ok: false, message: "当前没有可使用的掘墓者复制技能。" };
    action = copied;
    actingRoleId = copiedRoleId;
    abilityState = player.roleState.copiedRoleState || (player.roleState.copiedRoleState = createRoleState(copiedRoleId));
    copiedAction = true;
  } else if (requestedAction === "berserk_vote") {
    if (player.roleId !== "berserk_wolf" || Number(player.roleState?.frenzy || 0) <= 0) return { ok: false, message: "当前没有可消耗的狂暴层数。" };
    action = "wolf_kill";
    extra = { ...extra, boosted: true };
  }
  const target = targetId ? playerById(game, targetId) : null;
  const requireTarget = ({ includeSelf = false, alive = true } = {}) => Boolean(target && (alive ? target.alive !== false : target.alive === false) && (includeSelf || target.id !== player.id));''',
    "action context",
)
werewolf = replace_once(
    werewolf,
    '''  if (game.phase !== "night") return { ok: false, message: "该职业技能只能在夜晚使用。" };
  if (!requireTarget() && !["blood_moon", "vigilance"].includes(action)) return { ok: false, message: "请选择一名仍存活的其他玩家。" };
  const usedKey = `${action}Night${game.night}`;
  if (player.roleState?.[usedKey]) return { ok: false, message: "你本夜已经使用过该技能。" };''',
    '''  if (game.phase !== "night") return { ok: false, message: "该职业技能只能在夜晚使用。" };
  const targetAllowed = action === "copy_dead" ? requireTarget({ alive: false }) : action === "couple" ? requireTarget({ includeSelf: true }) : ["blood_moon", "vigilance", "disguise"].includes(action) ? true : requireTarget();
  if (!targetAllowed) return { ok: false, message: action === "copy_dead" ? "请选择一名已经死亡的玩家。" : "请选择一名有效目标。" };
  const usedKey = `${action}Night${game.night}`;
  const replaceable = ["wolf_kill", "disguise"].includes(action);
  if (abilityState?.[usedKey] && !replaceable) return { ok: false, message: "你本夜已经使用过该技能。" };
  const witchNightKey = `witchPotionNight${game.night}`;
  if (["witch_heal", "witch_poison"].includes(action) && abilityState?.[witchNightKey]) return { ok: false, message: "女巫每晚最多使用一瓶药。" };''',
    "night validation",
)
night_start = werewolf.index('  if (action === "wolf_kill" && isWolfRole(player.roleId)) {')
night_end = werewolf.index('  player.roleState[usedKey] = true;', night_start)
segment = werewolf[night_start:night_end]
segment = segment.replace('isWolfRole(player.roleId)', 'isWolfRole(actingRoleId)')
segment = segment.replace('player.roleId ===', 'actingRoleId ===')
segment = segment.replace('player.roleState?.', 'abilityState?.')
segment = segment.replace('player.roleState.', 'abilityState.')
segment = segment.replace('player.roleState =', 'abilityState =')
segment = replace_once(
    segment,
    '''  if (action === "wolf_kill" && isWolfRole(actingRoleId)) {
    setNightAction(game, player.id, "wolf_kill", { targetId, boosted: extra.boosted === true && actingRoleId === "berserk_wolf" && Number(abilityState?.frenzy || 0) > 0 });''',
    '''  if (action === "wolf_kill" && isWolfRole(actingRoleId)) {
    if (isWolfRole(target?.roleId)) return { ok: false, message: "狼人不能把狼刀提交给狼人阵营目标。" };
    setNightAction(game, player.id, "wolf_kill", { targetId, boosted: extra.boosted === true && actingRoleId === "berserk_wolf" && Number(abilityState?.frenzy || 0) > 0 });''',
    "wolf friendly fire guard",
)
segment = replace_once(
    segment,
    '''  } else if (action === "copy_dead" && actingRoleId === "gravedigger" && !abilityState?.used && target.alive === false) {
    abilityState.used = true; abilityState.copiedRoleId = target.roleId; appendPrivate(player, `你复制了 ${target.name} 的职业：${roleDef(target.roleId).name}。阵营仍为好人。`, "copy");''',
    '''  } else if (action === "copy_dead" && actingRoleId === "gravedigger" && !abilityState?.used && target.alive === false) {
    abilityState.used = true;
    abilityState.copiedRoleId = target.roleId;
    abilityState.copiedRoleState = createRoleState(target.roleId);
    abilityState.copiedSkillUsed = false;
    const copiedActionName = COPYABLE_ROLE_ACTIONS[target.roleId] || "该职业没有可复制的夜间主动技能";
    appendPrivate(player, `你复制了 ${target.name} 的职业：${roleDef(target.roleId).name}。阵营仍为好人；可用技能：${copiedActionName}。`, "copy");''',
    "gravedigger copied state",
)
segment = replace_once(
    segment,
    '''  } else if (action === "swap_role" && actingRoleId === "thief" && !abilityState?.used) {
    abilityState.used = true;
    const roleA = player.roleId, roleB = target.roleId;
    player.roleId = roleB; player.team = roleDef(roleB).team;
    target.roleId = roleA; target.team = roleDef(roleA).team;
    appendPrivate(player, `你与 ${target.name} 交换职业，现在是 ${roleDef(player.roleId).name}。`, "swap");
    appendPrivate(target, `你与 ${player.name} 交换职业，现在是 ${roleDef(target.roleId).name}。`, "swap");''',
    '''  } else if (action === "swap_role" && actingRoleId === "thief" && !abilityState?.used) {
    abilityState.used = true;
    const roleA = player.roleId, roleB = target.roleId;
    const stateA = player.roleState, stateB = target.roleState;
    const diaryA = player.diary, diaryB = target.diary;
    player.roleId = roleB; player.team = roleDef(roleB).team; player.roleState = stateB; player.diary = diaryB;
    target.roleId = roleA; target.team = roleDef(roleA).team; target.roleState = stateA; target.diary = diaryA;
    appendPrivate(player, `你与 ${target.name} 交换职业，现在是 ${roleDef(player.roleId).name}。`, "swap");
    appendPrivate(target, `你与 ${player.name} 交换职业，现在是 ${roleDef(target.roleId).name}。`, "swap");''',
    "thief state swap",
)
werewolf = werewolf[:night_start] + segment + werewolf[night_end:]
werewolf = replace_once(
    werewolf,
    '''  player.roleState[usedKey] = true;
  player.lastActionAt = nowMs();
  await saveGame(env, game);
  return { ok: true, message: `技能已登记：${action}${target ? ` → ${target.name}` : ""}。夜晚结束前可再次提交同类选择覆盖目标。` };''',
    '''  if (!replaceable) abilityState[usedKey] = true;
  if (["witch_heal", "witch_poison"].includes(action)) abilityState[witchNightKey] = true;
  if (copiedAction) player.roleState.copiedSkillUsed = true;
  player.lastActionAt = nowMs();
  await saveGame(env, game);
  return { ok: true, message: replaceable ? `选择已更新：${requestedAction}${target ? ` → ${target.name}` : ""}。阶段结束前可再次覆盖。` : `技能已登记：${requestedAction}${target ? ` → ${target.name}` : ""}。` };''',
    "accurate action response",
)

ai_pattern = re.compile(r'''async function runAiNightAction\(env, game, player\) \{[\s\S]*?\n\}\n\nasync function runAiPhase''')
ai_replacement = '''async function runAiNightAction(env, game, player) {
  const choices = targetablePlayers(game, player.id).map(item => item.id);
  if (player.roleId === "cupid" && !player.roleState?.used && livingPlayers(game).length >= 2) {
    const first = choices[0] || player.id;
    const second = livingPlayers(game).map(item => item.id).find(id => id !== first) || player.id;
    if (first !== second) {
      player.roleState.used = true;
      game.lovers = [first, second];
      for (const loverId of game.lovers) appendPrivate(playerById(game, loverId), `你与 ${playerById(game, game.lovers.find(id => id !== loverId))?.name} 成为恋人。`, "lover");
    }
    return;
  }
  if (player.roleId === "witch") {
    const predicted = resolveWolfTarget(game, { consumeBoost: false });
    if (predicted && player.roleState?.healAvailable && !player.roleState?.[`witchPotionNight${game.night}`]) {
      player.roleState.healAvailable = false;
      player.roleState[`witchPotionNight${game.night}`] = true;
      setNightAction(game, player.id, "witch_heal", { targetId: predicted.id });
      return;
    }
    if (game.night > 1 && player.roleState?.poisonAvailable && !player.roleState?.[`witchPotionNight${game.night}`] && choices.length) {
      const decision = await aiDecision(env, game, player, "witch_poison", choices);
      if (decision?.targetId) {
        player.roleState.poisonAvailable = false;
        player.roleState[`witchPotionNight${game.night}`] = true;
        setNightAction(game, player.id, "witch_poison", { targetId: decision.targetId });
      }
    }
    return;
  }
  const decision = await aiDecision(env, game, player, "night", choices);
  const targetId = decision?.targetId || choices[0];
  if (isWolfRole(player.roleId)) {
    const nonWolfChoices = choices.filter(id => !isWolfRole(playerById(game, id)?.roleId));
    const wolfTargetId = nonWolfChoices.includes(targetId) ? targetId : nonWolfChoices[0];
    if (player.roleId === "shapeshifter_wolf") {
      const disguises = ROLE_IDS.filter(id => !isWolfRole(id) && id !== "wraith");
      const disguiseRoleId = disguises[Math.abs(String(game.id).length + String(player.id).length + game.night) % disguises.length] || "villager";
      player.roleState.disguiseRoleId = disguiseRoleId;
      setNightAction(game, player.id, "disguise", { roleId: disguiseRoleId });
    }
    if (player.roleId === "blood_wolf" && !player.roleState?.used && game.night >= 2) {
      player.roleState.used = true;
      setNightAction(game, player.id, "blood_moon", {});
    }
    if (wolfTargetId) setNightAction(game, player.id, "wolf_kill", { targetId: wolfTargetId, boosted: player.roleId === "berserk_wolf" && Number(player.roleState?.frenzy || 0) > 0 });
    if (decision?.wolfChat) await broadcastWolfChat(env, game, player, decision.wolfChat);
    return;
  }
  if (!targetId) return;
  if (player.roleId === "seer") setNightAction(game, player.id, "inspect", { targetId });
  if (player.roleId === "guard" && player.roleState?.lastProtectedId !== targetId) { player.roleState.lastProtectedId = targetId; setNightAction(game, player.id, "protect", { targetId }); }
  if (player.roleId === "detective") setNightAction(game, player.id, "track", { targetId });
  if (player.roleId === "voodoo_girl") setNightAction(game, player.id, "curse", { targetId });
  if (player.roleId === "enchanter") setNightAction(game, player.id, "hex", { targetId });
  if (player.roleId === "lecher") setNightAction(game, player.id, "visit", { targetId });
  if (player.roleId === "ninja") setNightAction(game, player.id, "decoy", { targetId });
  if (player.roleId === "sadist_leader" && !player.roleState?.used) {
    const cultist = livingPlayers(game).find(item => item.roleId === "masochist_cultist");
    if (cultist) { player.roleState.used = true; setNightAction(game, player.id, "meat_shield", { targetId: cultist.id }); }
  }
  if (player.roleId === "mermaid" && choices.length > 1) {
    const redirectTargetId = choices.find(id => id !== targetId);
    if (redirectTargetId) setNightAction(game, player.id, "redirect", { originalTargetId: targetId, redirectTargetId });
  }
  if (player.roleId === "gravedigger" && !player.roleState?.used) {
    const dead = (game.players || []).find(item => item.alive === false && COPYABLE_ROLE_ACTIONS[item.roleId]);
    if (dead) { player.roleState.used = true; player.roleState.copiedRoleId = dead.roleId; player.roleState.copiedRoleState = createRoleState(dead.roleId); player.roleState.copiedSkillUsed = false; }
  }
  if (player.roleId === "villager" && !player.roleState?.used) { player.roleState.used = true; player.roleState.vigilanceActive = true; }
}

async function runAiPhase'''
werewolf, count = ai_pattern.subn(ai_replacement, werewolf, count=1)
if count != 1:
    raise RuntimeError(f"AI night function: expected one match, got {count}")
werewolf = replace_once(
    werewolf,
    '  const aiPlayers = livingPlayers(game).filter(isAiPlayer);',
    '  const aiPlayers = livingPlayers(game).filter(isAiPlayer).sort((left, right) => Number(isWolfRole(right.roleId)) - Number(isWolfRole(left.roleId)));',
    "AI action ordering",
)

werewolf = replace_once(
    werewolf,
    '    privateNotices: (player.privateNotices || []).slice(-100), visibleWolfIds: visibleWolfIds(game, player),\n    wolfChat: isWolfRole(player.roleId) ? (game.wolfChat || []).slice(-100) : []',
    '    privateNotices: (player.privateNotices || []).slice(-100), visibleWolfIds: visibleWolfIds(game, player),\n    wolfChat: isWolfRole(player.roleId) ? (game.wolfChat || []).slice(-100) : [],\n    canUseDeathSkill: game.phase === "death_skill" && game.pendingDeathSkill?.actorId === player.id,\n    copiedAction: player.roleId === "gravedigger" && player.roleState?.copiedRoleId && !player.roleState?.copiedSkillUsed ? COPYABLE_ROLE_ACTIONS[player.roleState.copiedRoleId] || "" : ""',
    "private action availability",
)

options_pattern = re.compile(r'''    function optionsForOwn\(own\)\{[\s\S]*?\}\n    function render\(\)''')
options_replacement = '''    var actionLabels={wolf_kill:'狼人刀票',berserk_vote:'狂暴双票刀',wolf_chat:'狼人密谈',white_judgement:'白狼王审判',plant_bomb:'秘密植入炸弹',couple:'配对恋人',inspect:'预言家查验',witch_heal:'使用解药',witch_poison:'使用毒药',decoy:'设置替身',disguise:'选择伪装职业',blood_moon:'发动血月',meat_shield:'指定肉盾',redirect:'人鱼引导',copy_dead:'复制死者职业',copied_action:'使用复制技能',duel:'骑士决斗',protect:'守护',track:'追踪',visit:'夜访',swap_role:'交换职业',vigilance:'夜间警戒',curse:'施加诅咒',hex:'施加蛊惑',group_inspect:'分组查验',sheriff_nominate:'竞选警长',sheriff_vote:'警长投票',day_vote:'放逐投票',death_shot:'死亡带走'};
    function optionsForOwn(own){if(!own||!wwState)return[];var phase=wwState.phase,list=[];if(own.canUseDeathSkill)return['death_shot'];if(!own.alive)return[];if(phase==='night'){var map={werewolf:['wolf_kill','wolf_chat'],black_wolf_king:['wolf_kill','wolf_chat'],white_wolf_king:['wolf_kill','wolf_chat'],snow_wolf:['wolf_kill','wolf_chat'],shapeshifter_wolf:['wolf_kill','disguise','wolf_chat'],original_wolf:['wolf_kill','wolf_chat'],berserk_wolf:['wolf_kill','berserk_vote','wolf_chat'],bomb_wolf:['wolf_kill','wolf_chat'],blood_wolf:['wolf_kill','blood_moon','wolf_chat'],cupid:['couple'],seer:['inspect'],witch:['witch_heal','witch_poison'],ninja:['decoy'],sadist_leader:['meat_shield'],mermaid:['redirect'],gravedigger:['copy_dead'],guard:['protect'],detective:['track'],lecher:['visit'],thief:['swap_role'],villager:['vigilance'],voodoo_girl:['curse'],enchanter:['hex']};list=(map[own.roleId]||[]).slice();if(own.copiedAction)list.push('copied_action');if(wwState.config.groupCount>1)list.push('group_inspect')}if(phase==='day_discussion'){if(own.roleId==='white_wolf_king')list.push('white_judgement');if(own.roleId==='bomb_wolf')list.push('plant_bomb');if(own.roleId==='knight')list.push('duel')}if(phase==='sheriff_nomination')list.push('sheriff_nominate');if(phase==='sheriff_vote')list.push('sheriff_vote');if(phase==='day_vote')list.push('day_vote');return list.filter(function(x,i,a){return a.indexOf(x)===i})}
    function targetRowsFor(action,second){var g=wwState,own=g&&g.own;if(!g||!own)return[];if(action==='copy_dead')return(g.players||[]).filter(function(p){return!p.alive});if(action==='couple')return(g.players||[]).filter(function(p){return p.alive});return(g.players||[]).filter(function(p){return p.alive&&p.id!==own.id})}
    function refreshActionInputs(){var own=wwState&&wwState.own,action=e('wwAction')&&e('wwAction').value,target=e('wwTarget'),second=e('wwSecondTarget'),text=e('wwActionText');if(!own||!target||!second)return;function html(rows){return'<option value="">选择目标</option>'+rows.map(function(p){return'<option value="'+s(p.id)+'">'+s(p.name)+'</option>'}).join('')}target.innerHTML=html(targetRowsFor(action,false));second.innerHTML=html(targetRowsFor(action,true));second.classList.toggle('hidden',!['couple','redirect'].includes(action));target.classList.toggle('hidden',['blood_moon','vigilance','disguise','wolf_chat'].includes(action));text.classList.toggle('hidden',!['wolf_chat','disguise'].includes(action));text.placeholder=action==='disguise'?'输入职业 ID，例如 villager':'狼人密谈内容'}
    function render()'''
werewolf, count = options_pattern.subn(options_replacement, werewolf, count=1)
if count != 1:
    raise RuntimeError(f"Portal options function: expected one match, got {count}")
render_targets_pattern = re.compile(r'''var action=e\('wwAction'\);action\.innerHTML=optionsForOwn\(own\)\.map\(function\(x\)\{return '<option value="'\+s\(x\)\+'">'\+s\(x\)\+'</option>'\}\)\.join\(''\);var targets=\(g\.players\|\|\[\]\)\.filter\(function\(p\)\{return p\.alive&&p\.id!==own\.id\}\);var targetHtml='<option value="">选择目标</option>'\+targets\.map\(function\(p\)\{return '<option value="'\+s\(p\.id\)\+'">'\+s\(p\.name\)\+'</option>'\}\)\.join\(''\);e\('wwTarget'\)\.innerHTML=targetHtml;e\('wwSecondTarget'\)\.innerHTML=targetHtml;''')
render_targets_replacement = '''var action=e('wwAction');action.innerHTML=optionsForOwn(own).map(function(x){return '<option value="'+s(x)+'">'+s(actionLabels[x]||x)+'</option>'}).join('');refreshActionInputs();'''
werewolf, count = render_targets_pattern.subn(render_targets_replacement, werewolf, count=1)
if count != 1:
    raise RuntimeError(f"Portal target renderer: expected one match, got {count}")
werewolf = replace_once(
    werewolf,
    "    var group=e('groupSelect');if(group)group.addEventListener('change',function(){var v=document.querySelector('.view.active');if(v&&v.id==='v-werewolf')load()});",
    "    document.addEventListener('change',function(ev){if(ev.target&&ev.target.id==='wwAction')refreshActionInputs()});var group=e('groupSelect');if(group)group.addEventListener('change',function(){var v=document.querySelector('.view.active');if(v&&v.id==='v-werewolf')load()});",
    "Portal action input refresh",
)

werewolf = replace_once(
    werewolf,
    '  ROLE_DEFINITIONS, ROLE_IDS, WEREWOLF_MAX_PLAYERS, WEREWOLF_MIN_PLAYERS,\n  buildBalancedRoleDeck, handleWerewolfOneBotEvent, handleWerewolfPortalApi, injectWerewolfPortalClient,\n  normalizeWerewolfConfig, processWerewolfTimers, publicWerewolfState, resolveWerewolfWin',
    '  ROLE_DEFINITIONS, ROLE_IDS, WEREWOLF_MAX_PLAYERS, WEREWOLF_MIN_PLAYERS,\n  activateNextDeathSkill, buildBalancedRoleDeck, checkPendingDeathSkill, createGame, createRoleState, handlePlayerAction, handleWerewolfOneBotEvent, handleWerewolfPortalApi, injectWerewolfPortalClient, newPlayer,\n  normalizeWerewolfConfig, processWerewolfTimers, publicWerewolfState, resolveWerewolfWin',
    "testable Werewolf exports",
)
write("src/games/werewolf.js", werewolf)

# Version and release metadata.
config = read("src/config/runtime.js")
config = replace_once(config, 'const VERSION = "2.7.3";', 'const VERSION = "2.7.4";', "runtime version")
write("src/config/runtime.js", config)

package = json.loads(read("package.json"))
package["version"] = "2.7.4"
checks = package["scripts"]["check"].split(" && ")
for command in ["node verify-portal-layout.mjs", "node verify-werewolf-gameplay.mjs"]:
    if command not in checks:
        checks.append(command)
package["scripts"]["check"] = " && ".join(checks)
write("package.json", json.dumps(package, ensure_ascii=False, indent=2) + "\n")

notes = json.loads(read("release-notes.json"))
notes["version"] = "2.7.4"
notes.setdefault("added", [])
notes.setdefault("fixed", [])
added = "新增 Portal 最终响应式排版层，统一桌面、平板与手机的侧边栏、顶栏、卡片、表单及功能页面网格"
fixed = "狼人杀补强多死亡技能队列、女巫同夜单药、狼人友军保护、邱比特自选、掘墓者复制技能、暴走狼双票刀与特殊角色 AI 行动"
if added not in notes["added"]:
    notes["added"].insert(0, added)
if fixed not in notes["fixed"]:
    notes["fixed"].insert(0, fixed)
write("release-notes.json", json.dumps(notes, ensure_ascii=False, indent=2) + "\n")

for path in ROOT.glob("verify-*.mjs"):
    text = path.read_text(encoding="utf-8").replace('"2.7.3"', '"2.7.4"')
    path.write_text(text, encoding="utf-8")

portal_test = r'''import fs from "node:fs";
import assert from "node:assert/strict";
import { injectPortalLayoutClient } from "./src/portal/layout.js";

const sample = "<!doctype html><html><head><style id=\"feature\">.x{display:block}</style></head><body><main></main></body></html>";
const injected = injectPortalLayoutClient(sample);
assert.match(injected, /id="qqai-portal-layout-v274"/);
assert.match(injected, /id="qqai-portal-layout-client-v274"/);
assert.ok(injected.indexOf("qqai-portal-layout-v274") > injected.indexOf('id="feature"'), "canonical layout must be the last style layer");
assert.match(injected, /@media\(max-width:1024px\)/);
assert.match(injected, /@media\(max-width:700px\)/);
assert.match(injected, /@media\(max-width:430px\)/);
assert.match(injected, /max-height:min\(88dvh,900px\)/);
assert.match(injected, /\.ww-layout\{grid-template-columns/);
assert.match(injected, /\.member-action-row\{grid-template-columns/);
assert.match(injected, /\.cleanup-summary\{grid-template-columns/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /injectPortalLayoutClient\(injectWerewolfPortalClient\(injectPortalMembersClient/);
for (const path of ["src/portal/community-suite.js", "src/portal/member-cleanup.js", "src/games/werewolf.js"]) {
  const source = fs.readFileSync(path, "utf8");
  assert.ok(!source.includes("var(--border)"), `${path} must use the Portal --line token`);
}
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "2.7.4");
assert.match(pkg.scripts.check, /verify-portal-layout\.mjs/);
console.log("verify-portal-layout: ok");
'''
write("verify-portal-layout.mjs", portal_test)

werewolf_test = r'''import assert from "node:assert/strict";
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
'''
write("verify-werewolf-gameplay.mjs", werewolf_test)

print("v2.7.4 candidate applied")
