import assert from "node:assert/strict";
import fs from "node:fs";
import { listBundledPlugins } from "./src/plugins/bundled/index.js";
import {
  EXTERNAL_PLUGIN_LIMITS,
  PLUGIN_EXECUTION_MODES,
  applyExternalPluginActions,
  executeSandboxedExternalPlugin,
  executeTrustedBundledPlugin,
  pluginExecutionStatus,
  portalPluginCatalog,
  validatePluginManifest,
} from "./src/plugins/runtime.js";

assert.ok(listBundledPlugins().length >= 8, "non-core feature families must be registered as bundled plugins");
const catalog = portalPluginCatalog();
assert.ok(catalog.length >= 8);
assert.ok(catalog.every(item => item.portal?.views?.length), "Portal plugin catalog must expose owned views");
assert.ok(catalog.every(item => item.i18n?.["zh-TW"] && item.i18n?.["zh-CN"] && item.i18n?.en), "every Portal plugin requires zh-TW/zh-CN/en metadata");

for (const plugin of listBundledPlugins()) {
  const checked = validatePluginManifest(plugin?.manifest, { expectedMode: PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED });
  assert.equal(checked.ok, true, `bundled plugin ${plugin?.manifest?.id || "<unknown>"} manifest invalid: ${checked.errors.join(", ")}`);
  assert.equal(typeof plugin?.handler, "function", `bundled plugin ${plugin?.manifest?.id || "<unknown>"} must export handler`);
}

const trustedManifest = {
  id: "owner.example",
  name: "Owner Example",
  version: "1.0.0",
  mode: PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED,
  events: ["message.created"],
};
const trusted = await executeTrustedBundledPlugin({
  manifest: trustedManifest,
  async handler(payload, context) {
    assert.equal(payload.text, "hello");
    assert.equal(context.secretForTrustedCode, "trusted-only");
    return { handled: true, actions: [{ type: "trusted_internal", value: 1 }] };
  },
}, { text: "hello" }, { secretForTrustedCode: "trusted-only" });
assert.equal(trusted.ok, true);
assert.equal(trusted.mode, PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED);

const rejectedCapability = validatePluginManifest({
  id: "market.bad-capability",
  version: "1.0.0",
  mode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL,
  events: ["message.created"],
  capabilities: ["db.raw"],
});
assert.equal(rejectedCapability.ok, false);

let capturedCode = null;
const fakeLoader = {
  get(id, codeCallback) {
    return {
      getEntrypoint(_name, options) {
        return {
          async fetch(request) {
            capturedCode = await codeCallback();
            assert.match(id, /^qqai-plugin:market\.hello:1\.0\.0:/);
            assert.equal(capturedCode.globalOutbound, null);
            assert.deepEqual(Object.keys(capturedCode.env), ["QQAI_PLUGIN"]);
            assert.equal(capturedCode.env.DB, undefined);
            assert.equal(capturedCode.env.AI, undefined);
            assert.equal(capturedCode.env.ONEBOT_HUB, undefined);
            assert.ok(capturedCode.limits.cpuMs <= EXTERNAL_PLUGIN_LIMITS.cpuMs);
            assert.ok(options.limits.cpuMs <= EXTERNAL_PLUGIN_LIMITS.cpuMs);
            const body = await request.json();
            assert.equal(body.text, "sandbox hello");
            return Response.json({
              ok: true,
              result: {
                handled: true,
                actions: [
                  { type: "reply", text: "sandbox reply", targetId: "should-be-dropped" },
                  { type: "db.raw", query: "DROP TABLE kv_store" },
                  { type: "metric", name: "plugin.hit", value: 1 },
                ],
              },
            });
          },
        };
      },
    };
  },
};

const external = await executeSandboxedExternalPlugin({
  manifest: {
    id: "market.hello",
    name: "Marketplace Hello",
    version: "1.0.0",
    mode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL,
    events: ["message.created"],
  },
  code: "export async function onEvent(payload) { return { handled: true, actions: [{ type: 'reply', text: String(payload.text || '') }] }; }",
}, { text: "sandbox hello" }, { PLUGIN_LOADER: fakeLoader, DB: { secret: true }, AI: { secret: true }, ONEBOT_HUB: { secret: true } });

assert.equal(external.ok, true);
assert.equal(external.actions.length, 2, "unsupported external actions must be dropped");
assert.deepEqual(external.actions[0], { type: "reply", text: "sandbox reply", scope: "same_event" });
assert.equal(external.actions.some(action => action.type === "db.raw"), false);
assert.equal(capturedCode.modules["plugin.js"].includes("sandbox hello"), false);

const applied = [];
await applyExternalPluginActions(external, {
  async reply(text, meta) { applied.push(["reply", text, meta.scope]); },
  async metric(name, value) { applied.push(["metric", name, value]); },
});
assert.deepEqual(applied, [["reply", "sandbox reply", "same_event"], ["metric", "plugin.hit", 1]]);

const unavailable = await executeSandboxedExternalPlugin({
  manifest: {
    id: "market.offline",
    version: "1.0.0",
    mode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL,
    events: ["message.created"],
  },
  code: "export default async () => ({ handled: false });",
}, {}, {});
assert.equal(unavailable.code, "PLUGIN_SANDBOX_UNAVAILABLE");
assert.equal(pluginExecutionStatus({}).sandboxedExternal.available, false);
assert.equal(pluginExecutionStatus({ PLUGIN_LOADER: fakeLoader }).sandboxedExternal.available, true);

const runtimeSource = fs.readFileSync("src/plugins/runtime.js", "utf8");
const docs = fs.readFileSync("src/plugins/README.md", "utf8");
for (const forbidden of ["eval(", "new Function", "node:vm", "from \\\"vm\\\""]) {
  assert.equal(runtimeSource.includes(forbidden), false, `external runtime must not contain ${forbidden}`);
}
assert.match(runtimeSource, /globalOutbound:\s*null/);
assert.match(runtimeSource, /PLUGIN_SANDBOX_UNAVAILABLE/);
assert.match(runtimeSource, /HOST_CAPABILITY_NOT_PROVIDED/);
assert.match(docs, /trusted_bundled/);
assert.match(docs, /sandboxed_external/);
assert.match(docs, /PLUGIN_LOADER/);

console.log("verify-plugin-execution-modes: ok");
