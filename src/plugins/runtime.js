import { definePlugin } from "./api.js";
import { PLUGIN_EVENT_HOOKS } from "./constants.js";
import { createPluginStorage } from "./storage.js";

const MESSAGE_EVENT_NAMES = new Set(["message", "group_message", "private_message"]);

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
    time: Number.isFinite(Number(message.time)) ? Number(message.time) : null,
    parts: Object.freeze(message.parts.map(part => sanitizePartForPlugin(part, allowMedia)))
  });
}

function createPluginHost({ services = {}, storageAdapter = null, logger = console } = {}) {
  const registry = new Map();
  const commandIndex = new Map();
  let started = false;

  function assertCapability(plugin, capability) {
    if (!pluginHasCapability(plugin, capability)) {
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
    const readableMessage = pluginHasCapability(plugin, "message.read")
      ? sanitizeMessageForPlugin(sourceMessage, { allowMedia: pluginHasCapability(plugin, "media.read") })
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
        tts: async input => {
          assertCapability(plugin, "ai.tts");
          return requireService("ai.tts")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
        }
      }),
      scheduler: Object.freeze({
        create: async input => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.create")({ plugin: plugin.manifest, input, payload: visiblePayload, eventContext: { ...eventContext, message: readableMessage } });
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
    for (const command of plugin.commands) {
      for (const name of [command.name, ...command.aliases]) {
        if (commandIndex.has(name)) throw new Error(`PLUGIN_COMMAND_CONFLICT:${name}`);
        commandIndex.set(name, { plugin, command });
      }
    }
    return plugin;
  }

  async function start() {
    if (started) return;
    started = true;
    for (const plugin of registry.values()) {
      if (typeof plugin.onLoad === "function") await plugin.onLoad(makeContext(plugin, "load", null));
    }
  }

  async function dispatch(eventName, payload, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const specificHook = PLUGIN_EVENT_HOOKS[eventName];
    if (!specificHook) throw new Error(`PLUGIN_EVENT_UNKNOWN:${eventName}`);
    const messageEvent = MESSAGE_EVENT_NAMES.has(eventName);
    const results = [];
    for (const plugin of registry.values()) {
      if (messageEvent && !pluginHasCapability(plugin, "message.read")) continue;
      const ctx = makeContext(plugin, eventName, payload, eventContext);
      const hookPayload = messageEvent ? ctx.message : payload;
      if (eventName !== "message" && ["group_message", "private_message"].includes(eventName) && typeof plugin.onMessage === "function") {
        results.push(await plugin.onMessage(ctx, hookPayload));
      }
      if (typeof plugin[specificHook] === "function") results.push(await plugin[specificHook](ctx, hookPayload));
    }
    return results;
  }

  async function runCommand(name, input = {}, eventContext = {}) {
    if (!started) throw new Error("PLUGIN_HOST_NOT_STARTED");
    const entry = commandIndex.get(String(name || "").trim().toLowerCase());
    if (!entry) return { handled: false };
    const ctx = makeContext(entry.plugin, "command", input, eventContext);
    const result = await entry.command.run(ctx, input);
    return { handled: true, pluginId: entry.plugin.manifest.id, command: entry.command.name, result };
  }

  async function stop() {
    if (!started) return;
    for (const plugin of [...registry.values()].reverse()) {
      if (typeof plugin.onUnload === "function") await plugin.onUnload(makeContext(plugin, "unload", null));
    }
    started = false;
  }

  function listPlugins() {
    return [...registry.values()].map(plugin => ({ ...plugin.manifest, commands: plugin.commands.map(command => command.name) }));
  }

  return Object.freeze({ dispatch, listPlugins, register, runCommand, start, stop });
}

export { createPluginHost, createScopedLogger, pluginHasCapability, sanitizeMessageForPlugin };
