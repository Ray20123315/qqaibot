import assert from "node:assert/strict";
import fs from "node:fs";
import { PLATFORM_FEATURES } from "./src/config/runtime.js";
import { listPlatformFeatures, platformFeatureKey, setPlatformFeature } from "./src/platform/runtime.js";

const writes = [];
const values = new Map();
const env = {
  DB: {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              assert.match(sql, /SELECT value FROM kv_store/);
              return values.has(args[0]) ? { value: values.get(args[0]) } : null;
            },
            async run() {
              writes.push({ sql, args });
              return { success: true, meta: { changes: 1 } };
            }
          };
        }
      };
    }
  }
};

const feature = PLATFORM_FEATURES[0];
values.set(platformFeatureKey(feature, "12345"), "false");
const catalog = await listPlatformFeatures(env, { groupId: "12345", role: "developer", includeHidden: true });
assert.equal(catalog.length, PLATFORM_FEATURES.length);
assert.equal(catalog.find(item => item.id === feature.id).configuredEnabled, false);
assert.equal(catalog.find(item => item.id === feature.id).enforced, false);
const result = await setPlatformFeature(env, { feature, groupId: "12345", enabled: true, actorRole: "developer" });
assert.equal(result.ok, false);
assert.equal(result.code, "FEATURE_NOT_ENFORCED");
assert.equal(writes.length, 0, "catalog entries must not be writable as if they controlled runtime behavior");

const portalSource = fs.readFileSync("src/portal/runtime.js", "utf8");
const catalogUi = portalSource.slice(portalSource.indexOf("async function loadPlatformFeatures"), portalSource.indexOf("function showView", portalSource.indexOf("async function loadPlatformFeatures")));
assert.match(portalSource, /尚未接入机器人执行路径/);
assert.match(catalogUi, /执行控制：未接入/);
assert.doesNotMatch(catalogUi, /type\s*=\s*['"]checkbox['"]/);

console.log("verify-platform-feature-catalog: ok");
