import { definePlugin } from "./api.js";
import { PLUGIN_EVENT_HOOKS } from "./constants.js";
import { createPluginStorage } from "./storage.js";

function createScopedLogger(baseLogger, pluginId) {
  const logger = baseLogger || console;
  const wrap = method => (...args) => {
    const target = typeof logger?.[method] === "function" ? logger[method].bind(logger) : console.log.bind(console);
    target(`[plugin:${pluginId}]`, ...args);
  };
  return Object.freeze({ info: wrap("info"), warn: wrap("warn"), error: wrap("error"), debug: wrap("debug") });
}

function createPluginHost({ services = {}, storageAdapter = null, logger = console } = {}) {
  const registry = new Map();
  const commandIndex = new Map();
  let started = false;

  function assertCapability(plugin, capability) {
    if (!plugin.manifest.capabilities.includes(capability)) {
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

    return Object.freeze({
      plugin: plugin.manifest,
      event: Object.freeze({ name: eventName, payload }),
      message: eventContext.message || payload?.message || null,
      groupId: String(eventContext.groupId || payload?.groupId || payload?.group_id || ""),
      userId: String(eventContext.userId || payload?.userId || payload?.user_id || ""),
      logger: scopedLogger,
      storage,
      reply: async message => {
        assertCapability(plugin, "message.send");
        return requireService("message.reply")({ plugin: plugin.manifest, message, payload, eventContext });
      },
      send: async target => {
        assertCapability(plugin, "message.send");
        return requireService("message.send")({ plugin: plugin.manifest, target, payload, eventContext });
      },
      media: Object.freeze({
        send: async target => {
          assertCapability(plugin, "media.send");
          return requireService("media.send")({ plugin: plugin.manifest, target, payload, eventContext });
        }
      }),
      onebot: Object.freeze({
        call: async (action, params = {}, timeoutMs = 15000) => {
          assertCapability(plugin, "onebot.call");
          return requireService("onebot.call")({ plugin: plugin.manifest, action, params, timeoutMs, payload, eventContext });
        }
      }),
      ai: Object.freeze({
        chat: async input => {
          assertCapability(plugin, "ai.chat");
          return requireService("ai.chat")({ plugin: plugin.manifest, input, payload, eventContext });
        },
        vision: async input => {
          assertCapability(plugin, "ai.vision");
          return requireService("ai.vision")({ plugin: plugin.manifest, input, payload, eventContext });
        },
        tts: async input => {
          assertCapability(plugin, "ai.tts");
          return requireService("ai.tts")({ plugin: plugin.manifest, input, payload, eventContext });
        }
      }),
      scheduler: Object.freeze({
        create: async input => {
          assertCapability(plugin, "scheduler");
          return requireService("scheduler.create")({ plugin: plugin.manifest, input, payload, eventContext });
        }
      }),
      network: Object.freeze({
        fetch: async input => {
          assertCapability(plugin, "network");
          return requireService("network.fetch")({ plugin: plugin.manifest, input, payload, eventContext });
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
    const results = [];
    for (const plugin of registry.values()) {
      const ctx = makeContext(plugin, eventName, payload, eventContext);
      if (eventName !== "message" && ["group_message", "private_message"].includes(eventName) && typeof plugin.onMessage === "function") {
        results.push(await plugin.onMessage(ctx, payload));
      }
      if (typeof plugin[specificHook] === "function") results.push(await plugin[specificHook](ctx, payload));
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

export { createPluginHost, createScopedLogger };
