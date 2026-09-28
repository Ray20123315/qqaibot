import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { createPluginHost } from "./src/plugins/runtime.js";
import { pluginRuntimeViolationFromError } from "./src/plugins/runtime-guard.js";

const explicitError = new Error("blocked");
explicitError.pluginSecurityViolation = {
  code: "PLUGIN_CROSS_TENANT_WRITE",
  severity: "critical",
  impacts: ["cross_tenant", "other_users"],
  summaryZh: "跨租戶測試"
};
const inferred = pluginRuntimeViolationFromError(explicitError);
assert.deepEqual(inferred.impacts, ["cross_tenant", "other_users"]);
assert.equal(pluginRuntimeViolationFromError(new Error("ordinary plugin bug")), null);
assert.ok(pluginRuntimeViolationFromError(new Error("PLUGIN_CORE_SECRET_ACCESS")).impacts.includes("core_secrets"));

const boundaryCalls = [];
const plugin = definePlugin({
  manifest: {
    id: "test.runtime-guard",
    name: "Runtime Guard",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read"]
  },
  async onMessage() {
    const error = new Error("PLUGIN_CROSS_TENANT_WRITE");
    error.pluginSecurityViolation = {
      code: "PLUGIN_CROSS_TENANT_WRITE",
      impacts: ["cross_tenant", "other_users"],
      severity: "critical"
    };
    throw error;
  }
});

const host = createPluginHost({
  runtimeBoundary: async payload => {
    boundaryCalls.push(payload);
    return { blocked: true };
  }
});
host.register(plugin);
await host.start();
assert.equal(host.isActive("test.runtime-guard"), true);
await assert.rejects(
  () => host.dispatch("group_message", {
    schemaVersion: 1,
    scope: "group",
    groupId: "g",
    userId: "u",
    parts: [{ kind: "text", text: "hi" }]
  }, {
    message: {
      schemaVersion: 1,
      scope: "group",
      groupId: "g",
      userId: "u",
      parts: [{ kind: "text", text: "hi" }]
    }
  }),
  /PLUGIN_CROSS_TENANT_WRITE/
);
assert.equal(boundaryCalls.length, 1);
assert.equal(boundaryCalls[0].violation.code, "PLUGIN_CROSS_TENANT_WRITE");
assert.equal(host.isActive("test.runtime-guard"), false, "security violation must force-stop plugin");

console.log("verify-v4-plugin-runtime-guard: ok");
