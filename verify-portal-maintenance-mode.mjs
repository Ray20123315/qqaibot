import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getPortalMaintenanceState,
  portalMaintenanceViewerCanBypass,
  renderPortalMaintenancePage,
  setPortalMaintenanceState
} from "./src/portal/maintenance.js";

class MemoryD1 {
  constructor() { this.values = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (/SELECT value FROM kv_store WHERE key = \?/i.test(sql)) {
              const value = db.values.get(String(args[0]));
              return value === undefined ? null : { value };
            }
            throw new Error("Unsupported first SQL: " + sql);
          },
          async run() {
            if (/INSERT INTO kv_store/i.test(sql)) {
              db.values.set(String(args[0]), String(args[1]));
              return { success: true, meta: { changes: 1 } };
            }
            if (/DELETE FROM kv_store WHERE key = \?/i.test(sql)) {
              db.values.delete(String(args[0]));
              return { success: true, meta: { changes: 1 } };
            }
            throw new Error("Unsupported run SQL: " + sql);
          }
        };
      }
    };
  }
}

const env = { DB: new MemoryD1(), DEVELOPER_IDS: "42,77" };
let state = await getPortalMaintenanceState(env);
assert.equal(state.enabled, false);

const future = Date.now() + 60 * 60 * 1000;
state = await setPortalMaintenanceState(env, {
  enabled: true,
  title: "升级维护",
  message: "正在升级 QQAIbot。",
  until: future
}, "42");
assert.equal(state.enabled, true);
assert.equal(state.title, "升级维护");
assert.equal(state.message, "正在升级 QQAIbot。");
assert.equal(state.updatedBy, "42");
assert.equal(state.until, future);

const readBack = await getPortalMaintenanceState(env);
assert.equal(readBack.enabled, true);
assert.equal(portalMaintenanceViewerCanBypass(env, { qq: "42", systemAdmin: false }), true, "developer must bypass maintenance");
assert.equal(portalMaintenanceViewerCanBypass(env, { qq: "10000", systemAdmin: true }), true, "system admin must bypass maintenance");
assert.equal(portalMaintenanceViewerCanBypass(env, { qq: "10000", systemAdmin: false }), false, "ordinary users must not bypass maintenance");

const html = renderPortalMaintenancePage(readBack, "https://aibot.example");
assert.match(html, /升级维护/);
assert.match(html, /开发者入口/);
assert.match(html, /\/portal\?developer=1/);
assert.doesNotMatch(html, /token|secret/i);

await assert.rejects(
  () => setPortalMaintenanceState(env, { enabled: true, until: Date.now() - 1000 }, "42"),
  /MAINTENANCE_UNTIL_INVALID/
);

state = await setPortalMaintenanceState(env, { enabled: false, title: "系统维护中", message: "完成" }, "42");
assert.equal(state.enabled, false);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /getPortalMaintenanceState/);
assert.match(worker, /portalMaintenanceHtmlResponse/);
assert.match(worker, /portalMaintenanceJsonResponse/);
assert.match(worker, /portalMaintenanceViewerCanBypass/);
assert.match(worker, /url\.searchParams\.get\("developer"\) === "1"/);
assert.match(worker, /url\.pathname\.startsWith\('\/api\/portal\/'\)/);

const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
assert.match(portal, /id="portalMaintenanceEnabled"/);
assert.match(portal, /savePortalMaintenance/);
assert.match(portal, /只有开发者或系统管理员可以管理系统维护模式/);
assert.doesNotMatch(portal, /id="v-simulator"|data-view="simulator"|runSimulator/);
assert.doesNotMatch(portal, /opsRules','v-maintenance'|opsAppeal','v-maintenance'/);

const members = fs.readFileSync("src/portal/members.js", "utf8");
assert.match(members, /id="memberDataNav"/);
assert.match(members, /群友名册、历史消息、详细资料补全与清人建议集中在同一页/);
assert.doesNotMatch(members, /id="memberConsoleNav"|id="relationshipNav"|id="memberCleanupNav"/);
assert.doesNotMatch(members, /handleNotificationRoutingApi|injectNotificationRoutingClient/);

console.log("Portal cleanup and maintenance mode checks passed.");
