import assert from "node:assert/strict";
import fs from "node:fs";
import { PLATFORM_FEATURES, PLATFORM_FEATURE_COUNT } from "./src/config/runtime.js";
import { listPlatformFeatures, setPlatformFeature } from "./src/platform/runtime.js";

assert.equal(PLATFORM_FEATURE_COUNT, 0, "legacy fake 300-item feature catalog must stay removed");
assert.deepEqual(PLATFORM_FEATURES, []);
assert.deepEqual(await listPlatformFeatures({}, { role: "developer", includeHidden: true }), []);
const result = await setPlatformFeature({}, { feature: null });
assert.equal(result.ok, false);
assert.equal(result.code, "LEGACY_FEATURE_CATALOG_REMOVED");
const portalSource = fs.readFileSync("src/portal/runtime.js", "utf8");
const pluginManagerSource = fs.readFileSync("src/v3/portal/plugin-manager.js", "utf8");
assert.match(pluginManagerSource, /setPluginEnabled|enabled/i);
assert.doesNotMatch(portalSource, /目录共\s*300\s*项|目錄共\s*300\s*項/);
console.log("verify-platform-feature-catalog: ok");
