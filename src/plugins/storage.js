function normalizePluginStorageKey(value) {
  const key = String(value || "").trim();
  if (!key || key.length > 200 || /[\u0000-\u001f\u007f]/.test(key)) throw new Error("PLUGIN_STORAGE_INVALID_KEY");
  return key;
}

function pluginStorageDatabaseKey(pluginId, key) {
  return `plugin:${pluginId}:data:${encodeURIComponent(normalizePluginStorageKey(key))}`;
}

function createPluginStorage(adapter, pluginId) {
  if (!adapter || typeof adapter.get !== "function" || typeof adapter.put !== "function" || typeof adapter.del !== "function") {
    throw new Error("PLUGIN_STORAGE_ADAPTER_INVALID");
  }
  const id = String(pluginId || "").trim().toLowerCase();
  if (!id) throw new Error("PLUGIN_STORAGE_PLUGIN_ID_REQUIRED");

  return Object.freeze({
    async get(key, fallback = null) {
      const raw = await adapter.get(pluginStorageDatabaseKey(id, key));
      if (raw === null || raw === undefined) return fallback;
      try {
        const parsed = JSON.parse(String(raw));
        return Object.prototype.hasOwnProperty.call(parsed || {}, "value") ? parsed.value : fallback;
      } catch {
        return fallback;
      }
    },
    async set(key, value) {
      await adapter.put(pluginStorageDatabaseKey(id, key), JSON.stringify({ value }));
      return value;
    },
    async delete(key) {
      await adapter.del(pluginStorageDatabaseKey(id, key));
    }
  });
}

export { createPluginStorage, normalizePluginStorageKey, pluginStorageDatabaseKey };
