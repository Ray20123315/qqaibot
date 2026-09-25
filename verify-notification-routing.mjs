import assert from "node:assert/strict";
import fs from "node:fs";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  normalizeNotificationRoutingConfig,
  resolveNotificationRecipientIds,
  selectNotificationRecipientIds
} from "./src/notifications/routing.js";

const defaults = normalizeNotificationRoutingConfig(null, "808882936");
assert.equal(defaults.version, 2);
assert.equal(defaults.groupId, "808882936");
assert.equal(defaults.ownerEnabled, false, "owner notification must remain globally disabled by default");
for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
  assert.equal(definition.defaultMode, "developer", `${definition.id} must default to developer-only routing`);
  assert.equal(defaults.routes[definition.id].mode, "developer");
}
assert.equal(defaults.routes.suggestion_created.enabled, false);

const migrated = normalizeNotificationRoutingConfig({
  version: 1,
  routes: {
    join_request_pending: { enabled: true, mode: "managers", managerIds: [] },
    moderation_proposal: { enabled: true, mode: "managers", managerIds: ["10002"] },
    appeal_created: { enabled: true, mode: "owner", managerIds: [] },
    suggestion_created: { enabled: false, mode: "none", managerIds: [] }
  }
}, "808882936");
assert.equal(migrated.version, 2);
assert.equal(migrated.routes.join_request_pending.mode, "developer", "legacy implicit all-manager default must migrate to developer");
assert.deepEqual(migrated.routes.moderation_proposal, { enabled: true, mode: "managers", managerIds: ["10002"] }, "explicit manager choice must survive migration");
assert.equal(migrated.routes.appeal_created.mode, "owner", "explicit owner choice must survive migration");
assert.deepEqual(migrated.routes.suggestion_created, { enabled: false, mode: "none", managerIds: [] });

const v2AllManagers = normalizeNotificationRoutingConfig({
  version: 2,
  routes: { join_request_pending: { enabled: true, mode: "managers", managerIds: [] } }
}, "808882936");
assert.equal(v2AllManagers.routes.join_request_pending.mode, "managers", "an explicit v2 all-manager choice must be preserved");

const managers = [{ qq: "10001", role: "admin" }, { qq: "10002", role: "admin" }];
const owner = { qq: "10000", role: "owner" };
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: ["10002", "99999"] }, managers, owner, developer: "90001" }), ["10002"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: [] }, managers, owner, developer: "90001" }), ["10001", "10002"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "developer", managerIds: [] }, managers, owner, developer: "90001" }), ["90001"]);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "owner", managerIds: [] }, ownerEnabled: false, managers, owner, developer: "90001" }), []);
assert.deepEqual(selectNotificationRecipientIds({ route: { enabled: true, mode: "owner", managerIds: [] }, ownerEnabled: true, managers, owner, developer: "90001" }), ["10000"]);
assert.deepEqual(resolveNotificationRecipientIds({ route: { enabled: true, mode: "managers", managerIds: ["10002"] }, candidates: { managers: [], owner: null, source: "none" }, developer: "90001" }), ["10002"]);

const routingSource = fs.readFileSync("src/notifications/routing.js", "utf8");
const portalSource = fs.readFileSync("src/portal/notification-routing.js", "utf8");
const moderationSource = fs.readFileSync("src/moderation/runtime.js", "utf8");
const operationsSource = fs.readFileSync("src/operations/runtime.js", "utf8");
assert.match(routingSource, /group_members:/);
assert.match(routingSource, /candidates\.source !== "none"/);
assert.match(portalSource, /fetch\('\/api\/portal\/notification-routing'/, "client must call the authenticated Portal API path");
assert.doesNotMatch(portalSource, /fetch\('\/api\/notification-routing'/, "obsolete non-Portal path must be absent");
assert.match(portalSource, /NOTIFICATION_ROUTING_UNAVAILABLE/, "server errors must remain JSON");
assert.match(portalSource, /NON_JSON_RESPONSE/, "client must report non-JSON diagnostics");
assert.match(portalSource, /默认只通知开发者/);
for (const eventId of ["join_request_pending", "join_request_failed", "group_work_request"]) assert.match(moderationSource, new RegExp(eventId));
for (const eventId of ["appeal_created", "suggestion_created", "bug_created", "quality_feedback_created"]) assert.match(operationsSource, new RegExp(eventId));
console.log("verify-notification-routing: ok");
