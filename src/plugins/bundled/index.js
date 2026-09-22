// Trusted bundled plugins are intentionally explicit imports.
// Adding a plugin here is a trust decision: the plugin becomes part of the QQAI Worker build.

import { PORTAL_FEATURE_PLUGINS } from "./portal-features.js";

const BUNDLED_PLUGINS = Object.freeze([
  ...PORTAL_FEATURE_PLUGINS
]);

function listBundledPlugins() {
  return [...BUNDLED_PLUGINS];
}

function getBundledPlugin(pluginId) {
  const id = String(pluginId || "").trim().toLowerCase();
  return BUNDLED_PLUGINS.find(plugin => String(plugin?.manifest?.id || "").toLowerCase() === id) || null;
}

export { BUNDLED_PLUGINS, getBundledPlugin, listBundledPlugins };
