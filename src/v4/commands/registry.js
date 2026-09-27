const COMMAND_SCOPES = Object.freeze(["c2c", "group", "channel", "dm"]);
function text(value) { return String(value ?? "").trim(); }
function normalizeScopes(value) { const rows = Array.isArray(value) ? value : [value]; const out = [...new Set(rows.map(text).filter(Boolean))]; if (!out.length || out.some(scope => !COMMAND_SCOPES.includes(scope))) throw new Error("V4_COMMAND_INVALID_SCOPE"); return Object.freeze(out); }
function defineCommand(spec = {}) {
  const id = text(spec.id); if (!/^[a-z0-9][a-z0-9._-]{1,95}$/i.test(id)) throw new Error("V4_COMMAND_INVALID_ID");
  const aliases = [...new Set((Array.isArray(spec.aliases) ? spec.aliases : [spec.command]).map(text).filter(Boolean))];
  if (!aliases.length) throw new Error(`V4_COMMAND_ALIAS_REQUIRED:${id}`);
  return Object.freeze({ id, aliases: Object.freeze(aliases), scopes: normalizeScopes(spec.scopes || ["c2c", "group"]), permission: text(spec.permission || "member"), description: text(spec.description), category: text(spec.category || "general"), panel: Object.freeze({ enabled: spec.panel?.enabled !== false, onlyAdmin: Boolean(spec.panel?.onlyAdmin), command: text(spec.panel?.command || aliases[0]), desc: text(spec.panel?.desc || spec.description).slice(0, 30) }), menu: Object.freeze({ enabled: Boolean(spec.menu?.enabled), name: text(spec.menu?.name), type: text(spec.menu?.type || "send_message"), value: text(spec.menu?.value || aliases[0]) }), legacy: spec.legacy !== false });
}
function createCommandRegistry(definitions = []) {
  const commands = new Map(); const aliases = new Map();
  for (const raw of definitions) {
    const command = defineCommand(raw); if (commands.has(command.id)) throw new Error(`V4_COMMAND_DUPLICATE_ID:${command.id}`); commands.set(command.id, command);
    for (const alias of command.aliases) { const key = alias.toLowerCase(); if (aliases.has(key)) throw new Error(`V4_COMMAND_DUPLICATE_ALIAS:${alias}`); aliases.set(key, command.id); }
  }
  function get(id) { return commands.get(text(id)) || null; }
  function resolve(input) { const raw = text(input); if (!raw) return null; const exact = aliases.get(raw.toLowerCase()); if (exact) return get(exact); const ordered = [...aliases.keys()].sort((a,b)=>b.length-a.length); const match = ordered.find(alias => raw.toLowerCase() === alias || raw.toLowerCase().startsWith(`${alias} `)); return match ? get(aliases.get(match)) : null; }
  function list({ scope = "", permission = "" } = {}) { return [...commands.values()].filter(command => (!scope || command.scopes.includes(scope)) && (!permission || command.permission === permission)); }
  function buildPanel(scope, { remark = "QQAIBOT V4", maxItems = 20 } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const items = list({ scope }).filter(command => command.panel.enabled).slice(0, Math.max(1, Math.min(20, Number(maxItems) || 20))).map(command => ({ type: "command", name: command.panel.command.slice(0, 14), desc: command.panel.desc.slice(0, 30), ...(command.panel.onlyAdmin ? { only_admin: true } : {}) }));
    return Object.freeze({ scope, target_type: "all", panel: Object.freeze({ items: Object.freeze(items), remark: text(remark).slice(0, 255) }) });
  }
  function buildPanels(scope, { remarkPrefix = "QQAIBOT V4", maxItemsPerPanel = 20 } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const limit = Math.max(1, Math.min(20, Number(maxItemsPerPanel) || 20));
    const rows = list({ scope }).filter(command => command.panel.enabled);
    const panels = [];
    for (let offset = 0; offset < rows.length; offset += limit) {
      const page = rows.slice(offset, offset + limit);
      panels.push(Object.freeze({
        scope,
        target_type: "all",
        panel: Object.freeze({
          items: Object.freeze(page.map(command => ({ type: "command", name: command.panel.command.slice(0, 14), desc: command.panel.desc.slice(0, 30), ...(command.panel.onlyAdmin ? { only_admin: true } : {}) }))),
          remark: `${text(remarkPrefix).slice(0, 220)} ${panels.length + 1}`.trim()
        })
      }));
    }
    return Object.freeze(panels);
  }
  function buildMenu({ maxItems = 10 } = {}) {
    const items = [...commands.values()].filter(command => command.menu.enabled).slice(0, Math.max(1, Math.min(10, Number(maxItems) || 10))).map(command => ({ name: (command.menu.name || command.aliases[0]).slice(0, 10), type: command.menu.type, ...(command.menu.type === "link" ? { link: command.menu.value } : { send_message: command.menu.value }) }));
    return Object.freeze({ items: Object.freeze(items) });
  }
  return Object.freeze({ get, resolve, list, buildPanel, buildPanels, buildMenu, size: commands.size });
}
export { COMMAND_SCOPES, createCommandRegistry, defineCommand };
