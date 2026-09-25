import { createBilibiliLivePlugin } from "./official/bilibili-live.js";
import { normalizePluginPackageDescriptor } from "./package.js";

const BILIBILI_LIVE_SOURCE_SHA256 = "6b0936ce98ddee72b2728028389c0e2ef401b46b6f9a7e0129872f35549f14ed";

function freezeCatalogEntry(value) {
  return Object.freeze({
    ...value,
    descriptor: Object.freeze({ ...value.descriptor }),
    dependencies: Object.freeze({ ...(value.dependencies || {}) }),
    optionalDependencies: Object.freeze({ ...(value.optionalDependencies || {}) })
  });
}

function trustedBundledPluginCatalog() {
  const bilibili = createBilibiliLivePlugin({});
  const descriptor = normalizePluginPackageDescriptor({
    ...bilibili.manifest,
    entry: "dist/index.js",
    integrity: "sha256:" + BILIBILI_LIVE_SOURCE_SHA256,
    dependencies: {},
    optionalDependencies: {}
  });
  return Object.freeze([
    freezeCatalogEntry({
      id: descriptor.id,
      sourcePath: "src/plugins/official/bilibili-live.js",
      sourceSha256: BILIBILI_LIVE_SOURCE_SHA256,
      integrityScope: "bundled-source-build-verified",
      runtimeBinding: "bilibili",
      trustedBundled: true,
      descriptor,
      dependencies: descriptor.dependencies,
      optionalDependencies: descriptor.optionalDependencies
    })
  ]);
}

function trustedBundledPluginIds() {
  return Object.freeze(trustedBundledPluginCatalog().map(entry => entry.id));
}

function trustedBundledPluginById(pluginId) {
  const id = String(pluginId || "").trim().toLowerCase();
  return trustedBundledPluginCatalog().find(entry => entry.id === id) || null;
}

export {
  BILIBILI_LIVE_SOURCE_SHA256,
  trustedBundledPluginById,
  trustedBundledPluginCatalog,
  trustedBundledPluginIds
};
