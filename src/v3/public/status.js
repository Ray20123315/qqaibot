function safePluginMeta(plugin = {}) {
  return Object.freeze({
    id: String(plugin.id || ""),
    name: String(plugin.name || ""),
    version: String(plugin.version || ""),
    official: plugin.official === true
  });
}

function summarizeLiveStatus(entries = []) {
  const providerRows = [];
  for (const entry of entries) {
    const status = entry?.status;
    if (!status || !Array.isArray(status.rows) || !status.provider) continue;
    for (const row of status.rows) providerRows.push(Object.freeze({ pluginId: entry.plugin.id, provider: status.provider, ...row }));
  }
  const active = providerRows.filter(row => row.live === true);
  return Object.freeze({
    active: active.length > 0,
    activeCount: active.length,
    stale: entries.some(entry => entry?.status?.stale === true),
    entries: Object.freeze(active),
    rows: Object.freeze(providerRows)
  });
}

async function buildV3PublicStatus(adapter, { pluginIds = null, now = Date.now() } = {}) {
  if (!adapter || typeof adapter.listPlugins !== "function" || typeof adapter.getPluginPublicStatus !== "function") {
    throw new Error("V3_PUBLIC_STATUS_ADAPTER_REQUIRED");
  }
  const allow = Array.isArray(pluginIds) && pluginIds.length ? new Set(pluginIds.map(String)) : null;
  const candidates = adapter.listPlugins().filter(plugin =>
    plugin.publicStatus === true && plugin.surface?.hasPublicStatus === true && (!allow || allow.has(String(plugin.id)))
  );
  const entries = [];
  for (const plugin of candidates) {
    try {
      const status = await adapter.getPluginPublicStatus(plugin.id);
      entries.push(Object.freeze({ plugin: safePluginMeta(plugin), ok: true, status }));
    } catch {
      entries.push(Object.freeze({
        plugin: safePluginMeta(plugin),
        ok: false,
        status: Object.freeze({ state: "DEGRADED", stale: true, unavailable: true })
      }));
    }
  }
  const frozenEntries = Object.freeze(entries);
  return Object.freeze({
    schemaVersion: 1,
    generatedAt: new Date(Number(now)).toISOString(),
    plugins: frozenEntries,
    live: summarizeLiveStatus(frozenEntries)
  });
}

async function v3PublicStatusResponse(adapter, options = {}) {
  const payload = await buildV3PublicStatus(adapter, options);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

export { buildV3PublicStatus, safePluginMeta, summarizeLiveStatus, v3PublicStatusResponse };
