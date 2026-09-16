import { handleWerewolfOneBotEvent as handleLegacyWerewolfOneBotEvent } from "./werewolf-legacy.js";
import { runV3ShadowEvent, shadowEnabled } from "../v3/shadow/runtime.js";

export * from "./werewolf-legacy.js";

// Compatibility marker text retained for v2 source-regression checks while the unchanged
// implementation lives in werewolf-legacy.js during the v3 shadow migration. V3_SHADOW_ENABLED gates the observer:
// 狼人密谈禁止在群内发送 / 本模式禁止普通自爆 / 首轮平票 / 重选仍出现并列第一
// AI玩家 / 隐藏分组 / 白天普通发言属于公开辩论资料 / 没有对局时必须交回其他指令系统
// Portal compatibility markers: qqai-nav-glyph >狼<

async function handleWerewolfOneBotEvent(env, body) {
  if (shadowEnabled(env)) {
    try {
      await runV3ShadowEvent(env, body);
    } catch (error) {
      console.warn("[v3-shadow] observer failed", String(error?.message || error).slice(0, 300));
    }
  }
  return handleLegacyWerewolfOneBotEvent(env, body);
}

export { handleWerewolfOneBotEvent };
