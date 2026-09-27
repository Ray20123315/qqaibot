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

async function syncQqOpenDiscovery(api, registry, { previousFingerprint = "" } = {}) {
  const menu = registry.buildMenu();
  const panels = [
    ...registry.buildPanels("c2c", { remarkPrefix: "QQAIBOT V4 C2C", maxItemsPerPanel: 20 }),
    ...registry.buildPanels("group", { remarkPrefix: "QQAIBOT V4 GROUP", maxItemsPerPanel: 20 })
  ];
  const nextFingerprint = fingerprint({ menu, panels });
  if (previousFingerprint && previousFingerprint === nextFingerprint) {
    return { ok: true, changed: false, fingerprint: nextFingerprint, menuItems: menu.items.length, panels: panels.length };
  }

  await api.putMenu(menu);
  const listed = await api.listPanels();
  let deleted = 0;
  for (const row of panelRows(listed)) {
    const id = panelId(row);
    const remark = panelRemark(row);
    if (!id || !/^QQAIBOT V4(?:\s|$)/i.test(remark)) continue;
    await api.deletePanel(id);
    deleted += 1;
  }

  const created = [];
  for (const panel of panels) created.push(await api.createPanel(panel));

  return {
    ok: true,
    changed: true,
    fingerprint: nextFingerprint,
    menuItems: menu.items.length,
    panels: panels.length,
    deleted,
    created: created.length
  };
}

export { fingerprint as qqOpenDiscoveryFingerprint, syncQqOpenDiscovery };
