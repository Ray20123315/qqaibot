import { definePlugin } from "./api.js";
import { PLUGIN_EVENT_HOOKS } from "./constants.js";
import { createPluginStorage } from "./storage.js";

const MESSAGE_EVENT_NAMES = new Set(["message", "group_message", "private_message"]);
const PLUGIN_SURFACE_MAX_BYTES = 64 * 1024;

function pluginHasCapability(plugin, capability) {
  return plugin?.manifest?.capabilities?.includes(capability) === true;
}

function createScopedLogger(baseLogger, pluginId) {
  const logger = baseLogger || console;
  const wrap = method => (...args) => {
    const target = typeof logger?.[method] === "function" ? logger[method].bind(logger) : console.log.bind(console);
    target(`[plugin:${pluginId}]`, ...args);
  };
  return Object.freeze({ info: wrap("info"), warn: wrap("warn"), error: wrap("error"), debug: wrap("debug") });
}

function redactMediaRef(media = {}) {
  return Object.freeze({
    file: "",
    fileId: "",
    url: "",
    path: "",
    base64: "",
    name: String(media?.name || ""),
    mimeType: String(media?.mimeType || ""),
    size: Number.isFinite(Number(media?.size)) ? Number(media.size) : null
  });
}

function sanitizePartForPlugin(part, allowMedia) {
  if (!part || typeof part !== "object") return part;
  if (part.kind === "forward") {
    const nodes = Array.isArray(part.nodes) ? part.nodes.map(node => Object.freeze({
      ...node,
      parts: Object.freeze((Array.isArray(node?.parts) ? node.parts : []).map(child => sanitizePartForPlugin(child, allowMedia)))
    })) : [];
    return Object.freeze({ ...part, nodes: Object.freeze(nodes) });
  }
  if (allowMedia) return part;
  if (["image", "audio", "video", "file"].includes(part.kind)) return Object.freeze({ ...part, media: redactMediaRef(part.media) });
  if (part.kind === "mface") return Object.freeze({
    kind: "mface",
    emojiId: "",
    packageId: "",
    key: "",
    summary: String(part.summary || ""),
    media: redactMediaRef(part.media)
  });
  return part;
}

function sanitizeMessageForPlugin(message, { allowMedia = false } = {}) {
  if (!message || typeof message !== "object" || !Array.isArray(message.parts)) return null;
  return Object.freeze({
    schemaVersion: message.schemaVersion,
    platform: String(message.platform || "onebot"),
    messageId: String(message.messageId || ""),
    scope: String(message.scope || "unknown"),
    groupId: String(message.groupId || ""),
    userId: String(message.userId || ""),
    selfId: String(message.selfId || ""),
    senderRole: String(message.senderRole || "member"),
    senderName: String(message.senderName || ""),
    time: Number.isFinite(Number(message.time)) ? Number(message.time) : null,
    parts: Object.freeze(message.parts.map(part => sanitizePartForPlugin(part, allowMedia)))
  });
}

function boundedSurfaceValue(value, label = "value") {
  let json;
  try { json = JSON.stringify(value === undefined ? null : value); }
  catch (error) { throw new Error("PLUGIN_SURFACE_NOT_SERIALIZABLE:" + label + ":" + String(error?.message || error).slice(0, 160)); }
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > PLUGIN_SURFACE_MAX_BYTES) throw new Error("PLUGIN_SURFACE_TOO_LARGE:" + label + ":" + bytes);
  return JSON.parse(json);
}

function redactSecretSettings(schema = {}, settings = null) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return settings;
  const result = { ...settings };
  for (const [key, descriptor] of Object.entries(schema || {})) {
    if (descriptor?.secret !== true || !Object.prototype.hasOwnProperty.call(result, key)) continue;
    const value = result[key];
    result[key] = value === null || value === undefined || value === "" ? null : "[redacted]";
  }
  return result;
}

function pluginSurfaceDescriptor(plugin) {
  const surface = plugin?.surface || {};
  return Object.freeze({
    settings: plugin?.manifest?.settings || Object.freeze({}),
    readableSettings: typeof surface.readSettings === "function",
    writableSettings: typeof surface.updateSettings === "function",
    hasStatus: typeof surface.status === "function",
    hasPublicStatus: plugin?.manifest?.publicStatus === true && typeof surface.publicStatus === "function"
  });
}

function createPluginHost({ services = {}, storageAdapter = null, logger = console, capabilityGrants = null } = {}) {
  const registry = new Map();
  const commandIndex = new Map();
  const activePluginIds = new Set();
  const grantMap = new Map();
  let started = false;

  if (capabilityGrants instanceof Map) {
    for (const [id, values] of capabilityGrants.entries()) grantMap.set(String(id || ""), new Set(Array.isArray(values) ? values.map(String) : []));
  } else if (capabilityGrants && typeof capabilityGrants === "object") {
    for (const [id, values] of Object.entries(capabilityGrants)) grantMap.set(String(id || ""), new Set(Array.isArray(values) ? values.map(String) : []));
  }

  function grantedCapabilities(plugin) {
    const requested = new Set(plugin?.manifest?.capabilities || []);
    const configured = grantMap.get(plugin?.manifest?.id);
    if (!configured) return requested;
    return new Set([...configured].filter(value => requested.has(value)));
  }

  function hasCapability(plugin, capability) {
    return pluginHasCapability(plugin, capability) && grantedCapabilities(plugin).has(capability);
  }

  function assertCapability(plugin, capability) {
    if (!hasCapability(plugin, capability)) {
      throw new Error(`PLUGIN_CAPABILITY_DENIED:${plugin.manifest.id}:${capability}`);
    }
  }

  function requireService(name) {
    const fn = services?.[name];
    if (typeof fn !== "function") throw new Error(`PLUGIN_SERVICE_UNAVAILABLE:${name}`);
    return fn;
  }

  function makeContext(plugin, eventName, payload, eventContext = {}) {
    const scopedLogger = createScopedLogger(logger, plugin.manifest.id);
    const storage = Object.freeze({
      get: async (...args) => {
        assertCapability(plugin, "storage");
        if (!storageAdapter) throw new Error("PLUGIN_SERVICE_UNAVAILABLE:storage");
        return createPluginStorage(storageAdapter, plugin.manifest.id).get(...args);
      },
      set: async (...args) => {
        assertCapability(plugin, "storage");
        if (!storageAdapter) throw new Error("PLUGIN_SERVICE_UNAVAILABLE:storage");
        return createPluginStorage(storageAdapter, plugin.manifest.id).set(...args);
      },
      delete: async (...args) => {
        assertCapability(plugin, "storage");
        if (!storageAdapter) throw new Error("PLUGIN_SERVICE_UNAVAILABLE:storage");
        return createPluginStorage(storageAdapter, plugin.manifest.id).delete(...args);
      }
    });
    const messageEvent = MESSAGE_EVENT_NAMES.has(eventName);
    const sourceMessage = eventContext.message || (payload?.schemaVersion === 1 && Array.isArray(payload?.parts) ? payload : null);
    const readableMessage = hasCapability(plugin, "message.read")
      ? sanitizeMessageForPlugin(sourceMessage, { allowMedia: hasCapability(plugin, "media.read") })
      : null;
    const visiblePayload = messageEvent ? readableMessage : payload;

    return Object.freeze({
      plugin: plugin.manifest,
      event: Object.freeze({ name: eventName, payload: visiblePayload }),
      message: readableMessage,
      groupId: String(readableMessage?.groupId || eventContext.groupId || payload?.groupId || payload?.group_id || ""),
      userId: String(readableMessage?.userId || eventContext.userId || payload?.userId || payload?.user_id || ""),
      logger: scopedLogger,
      storage,
      reply: async message => {
        assertCapability(plugin, "message.send");
        return requireService("message.reply")({ plugin: plugin.manifest, message, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
      },
      send: async target => {
        assertCapability(plugin, "message.send");
        return requireService("message.send")({ plugin: plugin.manifest, target, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
      },
      media: Object.freeze({
        send: async target => {
          assertCapability(plugin, "media.send");
          return requireService("media.send")({ plugin: plugin.manifest, target, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        resolve: async index => {
          assertCapability(plugin, "media.read");
          const partIndex = Number(index);
          if (!Number.isInteger(partIndex) || partIndex < 0) throw new Error("PLUGIN_MEDIA_INDEX_INVALID");
          return requireService("media.resolve")({ plugin: plugin.manifest, index: partIndex, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      onebot: Object.freeze({
        call: async (action, params = {}, timeoutMs = 15000) => {
          assertCapability(plugin, "onebot.call");
          return requireService("onebot.call")({ plugin: plugin.manifest, action, params, timeoutMs, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      ai: Object.freeze({
        chat: async input => {
          assertCapability(plugin, "ai.chat");
          return requireService("ai.chat")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        vision: async input => {
          assertCapability(plugin, "ai.vision");
          return requireService("ai.vision")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        multimodal: async input => {
          assertCapability(plugin, "ai.multimodal");
          assertCapability(plugin, "media.read");
          return requireService("ai.multimodal")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        tts: async input => {
          assertCapability(plugin, "ai.tts");
          return requireService("ai.tts")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      scheduler: Object.freeze({
        create: async input => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.create")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        list: async query => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.list")({ plugin: plugin.manifest, input: query || {}, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        get: async id => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.get")({ plugin: plugin.manifest, id: String(id || ""), payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        },
        cancel: async id => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.cancel")({ plugin: plugin.manifest, id: String(id || ""), payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      member: Object.freeze({
        recentMessages: async input => {
          assertCapability(plugin, "member.read");
          return requireService("member.recent_messages")({ plugin: plugin.manifest, input: input || {}, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      network: Object.freeze({
        fetch: async input => {
          assertCapability(plugin, "network");
          return requireService("network.fetch")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      })
    });
  }

  function register(definition) {
    if (started) throw new Error("PLUGIN_HOST_ALREADY_STARTED");
    const plugin = definition?.manifest && Object.isFrozen(definition) ? definition : definePlugin(definition);
    const id = plugin.manifest.id;
    if (registry.has(id)) throw new Error(`PLUGIN_DUPLICATE:${id}`);
    registry.set(id, plugin);
    if (!grantMap.has(id)) grantMap.set(id, new Set(plugin.manifest.capabilities || []));
    for (const command of plugin.commands) {
      for (const name of [command.name, ...command.aliases]) {
        if (commandIndex.has(name)) throw new Error(`PLUGIN_COMMAND_CONFLICT:${name}`);
        commandIndex.set(name, { plugin, command });
      }
    }
    return plugin;
  }

  function setCapabilityGrants(pluginId, values = []) {
    const id = String(pluginId || "");
    const plugin = registry.get(id);
    if (!plugin) throw new Error(`PLUGIN_NOT_FOUND:${id}`);
    const requested = new Set(plugin.manifest.capabilities || []);
    const grants = new Set((Array.isArray(values) ? values : []).map(String).filter(value => requested.has(value)));
    grantMap.set(id, grants);
    return Object.freeze([...grants].sort());
  }

  function isActive(pluginId) {
    return activePluginIds.has(String(pluginId || ""));
  }

  async function activate(pluginId) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const id = String(pluginId || "");
    const plugin = registry.get(id);
    if (!plugin) throw new Error(`PLUGIN_NOT_FOUND:${id}`);
    if (activePluginIds.has(id)) return false;
    if (typeof plugin.onLoad === "function") await plugin.onLoad(makeContext(plugin, "load", null));
    activePluginIds.add(id);
    return true;
  }

  async function deactivate(pluginId) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const id = String(pluginId || "");
    const plugin = registry.get(id);
    if (!plugin) throw new Error(`PLUGIN_NOT_FOUND:${id}`);
    if (!activePluginIds.has(id)) return false;
    try {
      if (typeof plugin.onUnload === "function") await plugin.onUnload(makeContext(plugin, "unload", null));
    } finally {
      activePluginIds.delete(id);
    }
    return true;
  }

  async function start(options = {}) {
    if (started) return;
    started = true;
    const explicit = Array.isArray(options?.enabledPluginIds) ? new Set(options.enabledPluginIds.map(String)) : null;
    try {
      for (const plugin of registry.values()) {
        if (!explicit || explicit.has(plugin.manifest.id)) await activate(plugin.manifest.id);
      }
    } catch (error) {
      for (const id of [...activePluginIds].reverse()) {
        try { await deactivate(id); } catch {}
      }
      started = false;
      throw error;
    }
  }

  async function dispatchTo(pluginId, eventName, payload, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const plugin = registry.get(String(pluginId || ""));
    if (!plugin) throw new Error(`PLUGIN_NOT_FOUND:${String(pluginId || "")}`);
    if (!activePluginIds.has(plugin.manifest.id)) {
      return { handled: false, inactive: true, pluginId: plugin.manifest.id, eventName, results: [] };
    }
    const specificHook = PLUGIN_EVENT_HOOKS[eventName];
    if (!specificHook) throw new Error(`PLUGIN_EVENT_UNKNOWN:${eventName}`);
    const messageEvent = MESSAGE_EVENT_NAMES.has(eventName);
    if (messageEvent && !hasCapability(plugin, "message.read")) {
      return { handled: false, pluginId: plugin.manifest.id, eventName, results: [] };
    }
    const ctx = makeContext(plugin, eventName, payload, eventContext);
    const hookPayload = messageEvent ? ctx.message : payload;
    const results = [];
    if (eventName !== "message" && ["group_message", "private_message"].includes(eventName) && typeof plugin.onMessage === "function") {
      results.push(await plugin.onMessage(ctx, hookPayload));
    }
    if (typeof plugin[specificHook] === "function") results.push(await plugin[specificHook](ctx, hookPayload));
    return { handled: results.length > 0, pluginId: plugin.manifest.id, eventName, results };
  }

  async function dispatch(eventName, payload, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    if (!PLUGIN_EVENT_HOOKS[eventName]) throw new Error(`PLUGIN_EVENT_UNKNOWN:${eventName}`);
    const results = [];
    for (const plugin of registry.values()) {
      if (!activePluginIds.has(plugin.manifest.id)) continue;
      const dispatched = await dispatchTo(plugin.manifest.id, eventName, payload, eventContext);
      results.push(...dispatched.results);
    }
    return results;
  }

  async function runCommand(name, input = {}, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const entry = commandIndex.get(String(name || "").trim().toLowerCase());
    if (!entry) return { handled: false };
    if (!activePluginIds.has(entry.plugin.manifest.id)) return { handled: false, inactive: true, pluginId: entry.plugin.manifest.id };
    const ctx = makeContext(entry.plugin, "command", input, eventContext);
    const result = await entry.command.run(ctx, input);
    return { handled: true, pluginId: entry.plugin.manifest.id, command: entry.command.name, result };
  }

  async function stop() {
    if (!started) return;
    for (const id of [...activePluginIds].reverse()) {
      try { await deactivate(id); } catch (error) { logger?.warn?.("[plugin-host] unload failed", id, String(error?.message || error).slice(0, 240)); }
    }
    started = false;
  }

  function listPlugins() {
    return [...registry.values()].map(plugin => ({
      ...plugin.manifest,
      commands: plugin.commands.map(command => command.name),
      surface: pluginSurfaceDescriptor(plugin),
      active: activePluginIds.has(plugin.manifest.id),
      requestedCapabilities: Object.freeze([...(plugin.manifest.capabilities || [])]),
      grantedCapabilities: Object.freeze([...grantedCapabilities(plugin)].sort())
    }));
  }

  async function getPluginSurface(pluginId, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const plugin = registry.get(String(pluginId || ""));
    if (!plugin) throw new Error("PLUGIN_NOT_FOUND:" + String(pluginId || ""));
    const surface = plugin.surface || {};
    const ctx = makeContext(plugin, "surface", null, eventContext);
    const rawSettings = typeof surface.readSettings === "function"
      ? boundedSurfaceValue(await surface.readSettings(ctx), "settings")
      : null;
    const status = typeof surface.status === "function"
      ? boundedSurfaceValue(await surface.status(ctx), "status")
      : null;
    const settings = rawSettings === null ? null : redactSecretSettings(plugin.manifest.settings, rawSettings);
    return Object.freeze({
      plugin: Object.freeze({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        apiVersion: plugin.manifest.apiVersion,
        official: plugin.manifest.official === true
      }),
      descriptor: pluginSurfaceDescriptor(plugin),
      settings: settings === null ? null : Object.freeze(settings),
      status: status === null ? null : Object.freeze(status)
    });
  }

  async function getPluginPublicStatus(pluginId) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const plugin = registry.get(String(pluginId || ""));
    if (!plugin) throw new Error("PLUGIN_NOT_FOUND:" + String(pluginId || ""));
    if (!activePluginIds.has(plugin.manifest.id)) throw new Error("PLUGIN_INACTIVE:" + plugin.manifest.id);
    if (plugin.manifest.publicStatus !== true) throw new Error("PLUGIN_PUBLIC_STATUS_DISABLED:" + plugin.manifest.id);
    if (typeof plugin.surface?.publicStatus !== "function") throw new Error("PLUGIN_PUBLIC_STATUS_MISSING:" + plugin.manifest.id);
    const ctx = makeContext(plugin, "public_status", null, {});
    return Object.freeze(boundedSurfaceValue(await plugin.surface.publicStatus(ctx), "public_status"));
  }

  async function updatePluginSettings(pluginId, input = {}, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const plugin = registry.get(String(pluginId || ""));
    if (!plugin) throw new Error("PLUGIN_NOT_FOUND:" + String(pluginId || ""));
    if (typeof plugin.surface?.updateSettings !== "function") throw new Error("PLUGIN_SETTINGS_READ_ONLY:" + plugin.manifest.id);
    const payload = boundedSurfaceValue(input, "settings_update");
    const ctx = makeContext(plugin, "surface", payload, eventContext);
    await plugin.surface.updateSettings(ctx, payload);
    return getPluginSurface(plugin.manifest.id, eventContext);
  }

  return Object.freeze({ activate, deactivate, dispatch, dispatchTo, getPluginPublicStatus, getPluginSurface, isActive, listPlugins, register, runCommand, setCapabilityGrants, start, stop, updatePluginSettings });
}

export { PLUGIN_SURFACE_MAX_BYTES, boundedSurfaceValue, createPluginHost, createScopedLogger, pluginHasCapability, pluginSurfaceDescriptor, redactSecretSettings, sanitizeMessageForPlugin };
