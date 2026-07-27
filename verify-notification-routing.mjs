import assert from "node:assert/strict";
import fs from "node:fs";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  normalizeNotificationRoutingConfig,
  resolveNotificationRecipientIds,
  selectNotificationRecipientIds
} from "./src/notifications/routing.js";

const defaults = normalizeNotificationRoutingConfig(null, "808882936");
assert.equal(defaults.groupId, "808882936");
assert.equal(defaults.ownerEnabled, false, "owner notification must remain globally disabled by default");
assert.equal(defaults.routes.join_request_pending.enabled, true);
assert.equal(defaults.routes.join_request_pending.mode, "managers");
assert.equal(defaults.routes.suggestion_created.enabled, false);
assert.ok(NOTIFICATION_EVENT_DEFINITIONS.some(item => item.id === "join_request_failed"));
assert.ok(NOTIFICATION_EVENT_DEFINITIONS.some(item => item.id === "moderation_proposal"));

const managers = [{ qq: "10001", role: "admin" }, { qq: "10002", role: "admin" }];
const owner = { qq: "10000", role: "owner" };

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "managers", managerIds: ["10002", "99999"] },
  managers,
  owner,
  developer: "90001"
}), ["10002"], "configured managers must be intersected with live QQ admins");

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "managers", managerIds: [] },
  managers,
  owner,
  developer: "90001"
}), ["10001", "10002"], "empty manager selection falls back to all current QQ admins");

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "managers", managerIds: ["99999"] },
  managers,
  owner,
  developer: "90001"
}), [], "a stale explicit manager selection must not silently broaden to every manager");

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "developer", managerIds: [] },
  managers,
  owner,
  developer: "90001"
}), ["90001"]);

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "owner", managerIds: [] },
  ownerEnabled: false,
  managers,
  owner,
  developer: "90001"
}), [], "owner route must not resolve while the global owner opt-in is off");

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "owner", managerIds: [] },
  ownerEnabled: true,
  managers,
  owner,
  developer: "90001"
}), ["10000"]);

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: false, mode: "managers", managerIds: ["10001"] },
  ownerEnabled: true,
  managers,
  owner,
  developer: "90001"
}), []);

assert.deepEqual(selectNotificationRecipientIds({
  route: { enabled: true, mode: "none", managerIds: ["10001"] },
  ownerEnabled: true,
  managers,
  owner,
  developer: "90001"
}), []);

assert.deepEqual(resolveNotificationRecipientIds({
  route: { enabled: true, mode: "managers", managerIds: ["10002"] },
  candidates: { managers: [], owner: null, source: "none" },
  developer: "90001"
}), ["10002"], "configured recipients survive a temporary directory outage");

const routingSource = fs.readFileSync("src/notifications/routing.js", "utf8");
const portalSource = fs.readFileSync("src/portal/notification-routing.js", "utf8");
const moderationSource = fs.readFileSync("src/moderation/runtime.js", "utf8");
const operationsSource = fs.readFileSync("src/operations/runtime.js", "utf8");
assert.match(routingSource, /group_members:/, "D1 member cache must back up live manager discovery");
assert.match(routingSource, /candidates\.source !== "none"/, "saving during a directory outage must preserve configured manager IDs");
assert.match(portalSource, /\/notification-routing/);
assert.match(portalSource, /notificationOwnerEnabled/);
for (const eventId of ["join_request_pending", "join_request_failed", "group_work_request"]) assert.match(moderationSource, new RegExp(eventId));
for (const eventId of ["appeal_created", "suggestion_created", "bug_created", "quality_feedback_created"]) assert.match(operationsSource, new RegExp(eventId));

console.log("verify-notification-routing: ok");
