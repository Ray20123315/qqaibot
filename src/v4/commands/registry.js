const COMMAND_SCOPES = Object.freeze(["c2c", "group", "channel", "dm"]);
const DISCOVERY_CATEGORY_META = Object.freeze({
  core: Object.freeze({ key:"basic-ai", label:"基础与 AI" }),
  ai: Object.freeze({ key:"basic-ai", label:"基础与 AI" }),
  tool: Object.freeze({ key:"basic-ai", label:"基础与 AI" }),
  multimodal: Object.freeze({ key:"basic-ai", label:"基础与 AI" }),
  group: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  member: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  memory: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  persona: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  user: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  message: Object.freeze({ key:"chat-personal", label:"群聊与个人" }),
  event: Object.freeze({ key:"collab", label:"活动排程与群规" }),
  schedule: Object.freeze({ key:"collab", label:"活动排程与群规" }),
  appeal: Object.freeze({ key:"collab", label:"活动排程与群规" }),
  rules: Object.freeze({ key:"collab", label:"活动排程与群规" }),
  ai_admin: Object.freeze({ key:"management", label:"管理操作" }),
  moderation: Object.freeze({ key:"management", label:"管理操作" }),
  owner: Object.freeze({ key:"owner", label:"群主设置" }),
  developer: Object.freeze({ key:"developer", label:"开发者" }),
  general: Object.freeze({ key:"other", label:"其他" })
});
const DEFAULT_GLOBAL_DISCOVERY_PERMISSIONS = Object.freeze(["member", "group_ops", "ai_admin", "owner"]);

function text(value) { return String(value ?? "").trim(); }
function normalizeScopes(value) {
  const rows = Array.isArray(value) ? value : [value];
  const out = [...new Set(rows.map(text).filter(Boolean))];
  if (!out.length || out.some(scope => !COMMAND_SCOPES.includes(scope))) throw new Error("V4_COMMAND_INVALID_SCOPE");
  return Object.freeze(out);
}
function discoveryCategory(raw) {
  const key = text(raw || "general");
  return DISCOVERY_CATEGORY_META[key] || Object.freeze({ key, label:key || "其他" });
}
function defineCommand(spec = {}) {
  const id = text(spec.id);
  if (!/^[a-z0-9][a-z0-9._-]{1,95}$/i.test(id)) throw new Error("V4_COMMAND_INVALID_ID");
  const aliases = [...new Set((Array.isArray(spec.aliases) ? spec.aliases : [spec.command]).map(text).filter(Boolean))];
  if (!aliases.length) throw new Error(`V4_COMMAND_ALIAS_REQUIRED:${id}`);
  const category = text(spec.category || "general");
  const categoryMeta = discoveryCategory(spec.panel?.category || category);
  return Object.freeze({
    id,
    aliases: Object.freeze(aliases),
    scopes: normalizeScopes(spec.scopes || ["c2c", "group"]),
    permission: text(spec.permission || "member"),
    description: text(spec.description),
    category,
    discoveryCategory: categoryMeta.key,
    discoveryCategoryLabel: categoryMeta.label,
    panel: Object.freeze({
      enabled: spec.panel?.enabled !== false,
      onlyAdmin: Boolean(spec.panel?.onlyAdmin),
      command: text(spec.panel?.command || aliases[0]),
      desc: text(spec.panel?.desc || spec.description).slice(0, 30)
    }),
    menu: Object.freeze({
      enabled: spec.menu?.enabled !== false,
      name: text(spec.menu?.name || spec.panel?.command || aliases[0]),
      type: text(spec.menu?.type || "send_message"),
      value: text(spec.menu?.value || spec.panel?.command || aliases[0])
    }),
    legacy: spec.legacy !== false
  });
}

function createCommandRegistry(definitions = []) {
  const commands = new Map();
  const aliases = new Map();
  for (const raw of definitions) {
    const command = defineCommand(raw);
    if (commands.has(command.id)) throw new Error(`V4_COMMAND_DUPLICATE_ID:${command.id}`);
    commands.set(command.id, command);
    for (const alias of command.aliases) {
      const key = alias.toLowerCase();
      if (aliases.has(key)) throw new Error(`V4_COMMAND_DUPLICATE_ALIAS:${alias}`);
      aliases.set(key, command.id);
    }
  }

  function get(id) { return commands.get(text(id)) || null; }

  function resolve(input) {
    const raw = text(input);
    if (!raw) return null;
    const exact = aliases.get(raw.toLowerCase());
    if (exact) return get(exact);
    const ordered = [...aliases.keys()].sort((a,b)=>b.length-a.length);
    const match = ordered.find(alias => raw.toLowerCase() === alias || raw.toLowerCase().startsWith(`${alias} `));
    return match ? get(aliases.get(match)) : null;
  }

  function list({ scope = "", permission = "" } = {}) {
    return [...commands.values()].filter(command =>
      (!scope || command.scopes.includes(scope)) &&
      (!permission || command.permission === permission)
    );
  }

  function panelItem(command, scope) {
    const adminOnly = scope === "group" && (
      command.panel.onlyAdmin ||
      ["group_ops", "ai_admin", "owner"].includes(command.permission)
    );
    return Object.freeze({
      type: "command",
      name: command.panel.command.slice(0, 14),
      desc: command.panel.desc.slice(0, 30),
      ...(adminOnly ? { only_admin: true } : {})
    });
  }

  function buildPanel(scope, { remark = "QQAIBOT V4", maxItems = 20 } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const items = list({ scope })
      .filter(command => command.panel.enabled)
      .slice(0, Math.max(1, Math.min(20, Number(maxItems) || 20)))
      .map(command => panelItem(command, scope));
    return Object.freeze({
      scope,
      target_type: "all",
      panel: Object.freeze({ items: Object.freeze(items), remark: text(remark).slice(0, 255) })
    });
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
          items: Object.freeze(page.map(command => panelItem(command, scope))),
          remark: `${text(remarkPrefix).slice(0, 220)} ${panels.length + 1}`.trim()
        })
      }));
    }
    return Object.freeze(panels);
  }

  function buildCategorizedPanels(scope, {
    remarkPrefix = "QQAIBOT V4",
    maxItemsPerPanel = 20,
    permissions = DEFAULT_GLOBAL_DISCOVERY_PERMISSIONS,
    targetType = "all",
    userOpenids = [],
    groupOpenids = []
  } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const allowed = new Set((Array.isArray(permissions) ? permissions : [permissions]).map(text).filter(Boolean));
    const limit = Math.max(1, Math.min(20, Number(maxItemsPerPanel) || 20));
    const grouped = new Map();

    for (const command of list({ scope })) {
      if (!command.panel.enabled || !allowed.has(command.permission)) continue;
      const key = command.discoveryCategory || "other";
      if (!grouped.has(key)) grouped.set(key, { label:command.discoveryCategoryLabel || key, rows:[] });
      grouped.get(key).rows.push(command);
    }

    const panels = [];
    for (const [key, group] of grouped.entries()) {
      for (let offset = 0; offset < group.rows.length; offset += limit) {
        const page = group.rows.slice(offset, offset + limit);
        const pageNo = Math.floor(offset / limit) + 1;
        const pageCount = Math.ceil(group.rows.length / limit);
        const target = targetType === "specific" ? "specific" : "all";
        panels.push(Object.freeze({
          scope,
          target_type: target,
          ...(scope === "c2c" && target === "specific" ? { user_openids:Object.freeze([...new Set(userOpenids.map(text).filter(Boolean))].slice(0,20)) } : {}),
          ...(scope === "group" && target === "specific" ? { group_openids:Object.freeze([...new Set(groupOpenids.map(text).filter(Boolean))].slice(0,20)) } : {}),
          panel: Object.freeze({
            items: Object.freeze(page.map(command => panelItem(command, scope))),
            remark: `${text(remarkPrefix).slice(0, 170)} [${group.label}] ${pageCount > 1 ? `${pageNo}/${pageCount}` : ""}`.trim()
          }),
          discovery_category: key,
          discovery_category_label: group.label
        }));
      }
    }
    if (panels.length > 20) throw new Error("V4_COMMAND_PANEL_LIMIT_EXCEEDED");
    return Object.freeze(panels);
  }

  function buildMenu({ maxItems = 10, maxSubItems = 5 } = {}) {
    const topLimit = Math.max(1, Math.min(10, Number(maxItems) || 10));
    const subLimit = Math.max(1, Math.min(5, Number(maxSubItems) || 5));
    const grouped = new Map();

    for (const command of list({ scope:"c2c" })) {
      if (!command.menu.enabled || !command.panel.enabled || command.permission !== "member") continue;
      const key = command.discoveryCategory || "other";
      if (!grouped.has(key)) grouped.set(key, { label:command.discoveryCategoryLabel || key, rows:[] });
      grouped.get(key).rows.push(command);
    }

    const items = [];
    for (const group of grouped.values()) {
      if (items.length >= topLimit) break;
      const children = group.rows.slice(0, subLimit).map(command => ({
        name: (command.menu.name || command.aliases[0]).slice(0, 14),
        type: command.menu.type === "link" ? "link" : "send_message",
        ...(command.menu.type === "link"
          ? { link:command.menu.value }
          : { send_message:command.menu.value })
      }));
      if (!children.length) continue;
      items.push(Object.freeze({
        name: String(group.label || "更多").replace(/\s+/g, "").slice(0, 10),
        type: "menu",
        sub_menu_items: Object.freeze(children)
      }));
    }
    return Object.freeze({ items:Object.freeze(items) });
  }

  return Object.freeze({
    get,
    resolve,
    list,
    buildPanel,
    buildPanels,
    buildCategorizedPanels,
    buildMenu,
    size: commands.size
  });
}

export {
  COMMAND_SCOPES,
  DEFAULT_GLOBAL_DISCOVERY_PERMISSIONS,
  DISCOVERY_CATEGORY_META,
  createCommandRegistry,
  defineCommand
};
