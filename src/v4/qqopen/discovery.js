function text(value) {
  return String(value == null ? "" : value);
}

function fingerprint(value) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function panelRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.panels)) return value.panels;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function panelId(row = {}) {
  return text(row.panel_id || row.panelId || row.id || row.panel?.id).trim();
}

function panelRemark(row = {}) {
  return text(row.panel?.remark || row.remark || row.data?.panel?.remark).trim();
}

async function listAllPanels(api, scope) {
  const rows = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const result = await api.listPanels({ scope, cursor, limit: 50 });
    rows.push(...panelRows(result));
    const next = text(result?.next_cursor || result?.nextCursor).trim();
    if (result?.is_end === true || !next || next === cursor) break;
    cursor = next;
  }
  return rows;
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).map(v => v.trim()).filter(Boolean))].slice(0, 20);
}

async function syncQqOpenDiscovery(api, registry, {
  previousFingerprint = "",
  developerOpenids = []
} = {}) {
  const developerIds = uniqueIds(developerOpenids);
  const menu = registry.buildMenu({ maxItems: 10, maxSubItems: 5 });

  const globalGroup = registry.buildCategorizedPanels("group", {
    remarkPrefix: "QQAIBOT V4 GROUP",
    maxItemsPerPanel: 20,
    permissions: ["member", "group_ops", "ai_admin", "owner"]
  });
  const developerC2C = developerIds.length
    ? registry.buildCategorizedPanels("c2c", {
        remarkPrefix: "QQAIBOT V4 DEV",
        maxItemsPerPanel: 20,
        permissions: ["member", "developer"],
        targetType: "specific",
        userOpenids: developerIds
      })
    : [];

  const panels = [...globalGroup, ...developerC2C];
  if (panels.length > 20) {
    throw new Error(`QQ_OPEN_DISCOVERY_PANEL_LIMIT:${panels.length}`);
  }

  const nextFingerprint = fingerprint({ menu, panels });
  if (previousFingerprint && previousFingerprint === nextFingerprint) {
    return {
      ok: true,
      changed: false,
      fingerprint: nextFingerprint,
      menuItems: menu.items.length,
      panels: panels.length,
      categories: [...new Set(panels.map(item => item.discovery_category).filter(Boolean))]
    };
  }

  await api.putMenu(menu);
  const listed = [
    ...(await listAllPanels(api, "c2c")),
    ...(await listAllPanels(api, "group"))
  ];
  let deleted = 0;
  for (const row of listed) {
    const id = panelId(row);
    const remark = panelRemark(row);
    if (!id || !/^QQAIBOT V4(?:\s|$)/i.test(remark)) continue;
    await api.deletePanel(id);
    deleted += 1;
  }

  const created = [];
  for (const panel of panels) {
    const { discovery_category, discovery_category_label, ...payload } = panel;
    created.push(await api.createPanel(payload));
  }

  return {
    ok: true,
    changed: true,
    fingerprint: nextFingerprint,
    menuItems: menu.items.length,
    panels: panels.length,
    deleted,
    created: created.length,
    categories: [...new Set(panels.map(item => item.discovery_category).filter(Boolean))],
    developerPanels: developerC2C.length
  };
}

export { fingerprint as qqOpenDiscoveryFingerprint, syncQqOpenDiscovery };
