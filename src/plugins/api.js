import { PLUGIN_EVENT_HOOKS } from "./constants.js";
import { normalizePluginManifest } from "./manifest.js";

function normalizePluginCommand(command) {
  const source = command && typeof command === "object" ? command : {};
  const name = String(source.name || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) throw new Error("PLUGIN_COMMAND_INVALID_NAME");
  if (typeof source.run !== "function") throw new Error(`PLUGIN_COMMAND_MISSING_RUN:${name}`);
  return Object.freeze({
    name,
    aliases: Object.freeze([...new Set((Array.isArray(source.aliases) ? source.aliases : [])
      .map(value => String(value || "").trim().toLowerCase())
      .filter(value => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)))]),
    description: String(source.description || "").trim().slice(0, 240),
    run: source.run
  });
}

function definePlugin(definition) {
  const source = definition && typeof definition === "object" ? definition : {};
  const manifest = normalizePluginManifest(source.manifest || source);
  const commands = Object.freeze((Array.isArray(source.commands) ? source.commands : []).map(normalizePluginCommand));
  const names = new Set();
  for (const command of commands) {
    for (const name of [command.name, ...command.aliases]) {
      if (names.has(name)) throw new Error(`PLUGIN_COMMAND_DUPLICATE:${name}`);
      names.add(name);
    }
  }

  const hooks = {};
  for (const hook of Object.values(PLUGIN_EVENT_HOOKS)) {
    if (source[hook] === undefined) continue;
    if (typeof source[hook] !== "function") throw new Error(`PLUGIN_HOOK_INVALID:${hook}`);
    hooks[hook] = source[hook];
  }

  return Object.freeze({
    manifest,
    commands,
    ...hooks
  });
}

export { definePlugin, normalizePluginCommand };
