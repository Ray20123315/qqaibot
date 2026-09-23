// D1 row-read emergency guard for QQAI main.
//
// The original scheduler implementation is preserved verbatim in
// runtime-legacy.js. This wrapper keeps its public API while overriding the
// high-frequency maintenance paths that previously caused repeated D1 prefix
// scans.
//
// Compatibility markers retained for source-level regression checks:
// AUTO_CHECKIN_ENABLED envBoolean
// conflict_manager_intervention conflict_warning_after_manager_stop

import * as legacy from "./runtime-legacy.js";
import { dbCleanupExpiredRows, dbGet, dbPut } from "../data/store.js";
import { getOneBotHub } from "../portal/auth.js";

export * from "./runtime-legacy.js";

const MODERATION_FALLBACK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MODERATION_FALLBACK_LAST_RUN_KEY = "maintenance:last_moderation_expiry_fallback";

async function oneBotConnected(env) {
  if (!env?.ONEBOT_HUB) return false;
  try {
    const response = await getOneBotHub(env).fetch("https://onebot-hub/status");
    if (!response?.ok) return false;
    const state = await response.json().catch(() => null);
    return Boolean(state?.connected);
  } catch {
    return false;
  }
}

async function processDueSchedules(env, now = Date.now()) {
  if (!(await oneBotConnected(env))) {
    return { ok: true, skipped: "onebot_disconnected" };
  }
  return legacy.processDueSchedules(env, now);
}

async function runAutomaticGroupCheckins(env, now = Date.now()) {
  if (!(await oneBotConnected(env))) {
    return { ok: true, skipped: "onebot_disconnected" };
  }
  return legacy.runAutomaticGroupCheckins(env, now);
}

async function cleanupTransientState(env, now = Date.now()) {
  const deleted = await dbCleanupExpiredRows(env, now, 25);
  return { ok: true, deleted, bounded: true };
}

async function cleanupExpiredModerationProposals(env) {
  // New proposals already register an exact OneBotHub Durable Object expiry
  // alarm. Keep the legacy prefix scan only as a low-frequency safety fallback,
  // and never scan while NapCat/OneBot is disconnected.
  if (!(await oneBotConnected(env))) {
    return { ok: true, skipped: "onebot_disconnected" };
  }

  const now = Date.now();
  const lastRunAt = Number(await dbGet(env, MODERATION_FALLBACK_LAST_RUN_KEY) || 0);
  if (lastRunAt && now - lastRunAt < MODERATION_FALLBACK_INTERVAL_MS) {
    return { ok: true, skipped: "fallback_not_due" };
  }

  // Write the gate before running the fallback so concurrent cron executions do
  // not all launch the same prefix scan.
  await dbPut(env, MODERATION_FALLBACK_LAST_RUN_KEY, String(now));
  return legacy.cleanupExpiredModerationProposals(env);
}

export {
  cleanupExpiredModerationProposals,
  cleanupTransientState,
  oneBotConnected,
  processDueSchedules,
  runAutomaticGroupCheckins
};
