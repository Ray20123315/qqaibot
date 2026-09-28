const COMMAND_SCOPES = Object.freeze(["c2c", "group", "channel", "dm"]);

const CATEGORY_META = Object.freeze({
  core: Object.freeze({ order: 10, label: "基础与多模态", menu: "基础" }),
  ai: Object.freeze({ order: 20, label: "AI / Codex", menu: "AI" }),
  tool: Object.freeze({ order: 30, label: "网页与翻译", menu: "工具" }),
  interaction: Object.freeze({ order: 40, label: "QQ 互动", menu: "QQ互动" }),
  member: Object.freeze({ order: 50, label: "群聊整理与分析", menu: "分析" }),
  group: Object.freeze({ order: 60, label: "群聊状态", menu: "群聊" }),
  memory: Object.freeze({ order: 70, label: "记忆", menu: "记忆" }),
  persona: Object.freeze({ order: 80, label: "人格", menu: "人格" }),
  user: Object.freeze({ order: 90, label: "个人设置", menu: "设置" }),
  message: Object.freeze({ order: 100, label: "消息工具", menu: "消息" }),
  event: Object.freeze({ order: 110, label: "活动与投票", menu: "活动" }),
  schedule: Object.freeze({ order: 120, label: "排程", menu: "排程" }),
  appeal: Object.freeze({ order: 130, label: "申诉", menu: "申诉" }),
  rules: Object.freeze({ order: 140, label: "群规协作", menu: "群规" }),
  ai_admin: Object.freeze({ order: 150, label: "AI 管理", menu: "AI管理" }),
  moderation: Object.freeze({ order: 160, label: "群操作", menu: "群操作" }),
  owner: Object.freeze({ order: 170, label: "群主设置", menu: "群主" }),
  developer: Object.freeze({ order: 180, label: "开发者", menu: "开发者" }),
  general: Object.freeze({ order: 999, label: "其他", menu: "其他" })
});

function text(value) { return String(value ?? "").trim(); }
function normalizeScopes(value) {
  const rows = Array.isArray(value) ? value : [value];
  const out = [...new Set(rows.map(text).filter(Boolean))];
  if (!out.length || out.some(scope => !COMMAND_SCOPES.includes(scope))) throw new Error("V4_COMMAND_INVALID_SCOPE");
  return Object.freeze(out);
}
function categoryMeta(value) {
  const key = text(value || "general");
  return CATEGORY_META[key] || Object.freeze({ order: 900, label: key || "其他", menu: (key || "其他").slice(0, 5) });
}
function defineCommand(spec = {}) {
  const id = text(spec.id);
  if (!/^[a-z0-9][a-z0-9._-]{1,95}$/i.test(id)) throw new Error("V4_COMMAND_INVALID_ID");
  const aliases = [...new Set((Array.isArray(spec.aliases) ? spec.aliases : [spec.command]).map(text).filter(Boolean))];
  if (!aliases.length) throw new Error(`V4_COMMAND_ALIAS_REQUIRED:${id}`);
  const permission = text(spec.permission || "member");
  const category = text(spec.category || "general");
  return Object.freeze({
    id,
    aliases: Object.freeze(aliases),
    scopes: normalizeScopes(spec.scopes || ["c2c", "group"]),
    permission,
    description: text(spec.description),
    category,
    panel: Object.freeze({
      enabled: spec.panel?.enabled !== false,
      onlyAdmin: Boolean(spec.panel?.onlyAdmin || ["group_ops", "ai_admin", "owner"].includes(permission)),
      command: text(spec.panel?.command || aliases[0]),
      desc: text(spec.panel?.desc || spec.description).slice(0, 30)
    }),
    menu: Object.freeze({
      enabled: spec.menu?.enabled !== false,
      name: text(spec.menu?.name || aliases[0].replace(/^[!！]/, "")),
      type: text(spec.menu?.type || "send_message"),
      value: text(spec.menu?.value || aliases[0])
    }),
    legacy: spec.legacy !== false,
    plugin: text(spec.plugin || "")
  });
}
function publicDiscoverable(command, scope) {
  if (!command.panel.enabled || !command.scopes.includes(scope)) return false;
  if (command.permission === "developer") return false;
  return true;
}
function developerDiscoverable(command, scope) {
  if (!command.panel.enabled || !command.scopes.includes(scope)) return false;
  return command.permission === "developer";
}
function panelItem(command) {
  return Object.freeze({
    type: "command",
    name: command.panel.command.slice(0, 14),
    desc: command.panel.desc.slice(0, 30),
    ...(command.panel.onlyAdmin ? { only_admin: true } : {})
  });
}
function groupedCommands(rows) {
  const groups = new Map();
  for (const command of rows) {
    if (!groups.has(command.category)) groups.set(command.category, []);
    groups.get(command.category).push(command);
  }
  return [...groups.entries()].sort((a, b) => {
    const ma = categoryMeta(a[0]);
    const mb = categoryMeta(b[0]);
    return ma.order - mb.order || ma.label.localeCompare(mb.label);
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
    const ordered = [...aliases.keys()].sort((a, b) => b.length - a.length);
    const match = ordered.find(alias => raw.toLowerCase() === alias || raw.toLowerCase().startsWith(`${alias} `));
    return match ? get(aliases.get(match)) : null;
  }
  function list({ scope = "", permission = "" } = {}) {
    return [...commands.values()].filter(command =>
      (!scope || command.scopes.includes(scope)) &&
      (!permission || command.permission === permission)
    );
  }
  function buildPanel(scope, { remark = "QQAIBOT V4", maxItems = 20 } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const limit = Math.max(1, Math.min(20, Number(maxItems) || 20));
    const items = list({ scope }).filter(command => publicDiscoverable(command, scope)).slice(0, limit).map(panelItem);
    return Object.freeze({
      scope,
      target_type: "all",
      panel: Object.freeze({ items: Object.freeze(items), remark: text(remark).slice(0, 255) })
    });
  }
  function buildPanels(scope, {
    remarkPrefix = "QQAIBOT V4",
    maxItemsPerPanel = 20,
    audience = "public",
    userOpenids = [],
    groupOpenids = []
  } = {}) {
    if (!COMMAND_SCOPES.includes(scope)) throw new Error("V4_COMMAND_INVALID_SCOPE");
    const limit = Math.max(2, Math.min(20, Number(maxItemsPerPanel) || 20));
    const rows = list({ scope }).filter(command =>
      audience === "developer" ? developerDiscoverable(command, scope) : publicDiscoverable(command, scope)
    );
    const panels = [];
    for (const [category, commandsInCategory] of groupedCommands(rows)) {
      const meta = categoryMeta(category);
      for (let offset = 0; offset < commandsInCategory.length; offset += limit) {
        const page = commandsInCategory.slice(offset, offset + limit);
        const pageNo = Math.floor(offset / limit) + 1;
        const targetSpecific = audience === "developer";
        const panel = {
          scope,
          target_type: targetSpecific ? "specific" : "all",
          ...(scope === "c2c" && targetSpecific ? { user_openids: [...new Set(userOpenids.map(text).filter(Boolean))].slice(0, 20) } : {}),
          ...(scope === "group" && targetSpecific ? { group_openids: [...new Set(groupOpenids.map(text).filter(Boolean))].slice(0, 20) } : {}),
          panel: Object.freeze({
            items: Object.freeze(page.map(panelItem)),
            remark: `${text(remarkPrefix).slice(0, 160)} :: ${meta.label}${commandsInCategory.length > limit ? ` ${pageNo}` : ""}`.slice(0, 255)
          })
        };
        if (targetSpecific) {
          const targets = scope === "c2c" ? panel.user_openids : panel.group_openids;
          if (!targets?.length) continue;
        }
        panels.push(Object.freeze(panel));
      }
    }
    return Object.freeze(panels);
  }
  function buildMenu({ maxItems = 10, maxSubItems = 5 } = {}) {
    const topLimit = Math.max(1, Math.min(10, Number(maxItems) || 10));
    const childLimit = Math.max(1, Math.min(5, Number(maxSubItems) || 5));
    const rows = list({ scope: "c2c" }).filter(command =>
      command.menu.enabled && command.permission !== "developer" && command.permission !== "owner"
    );
    const items = [];
    for (const [category, commandsInCategory] of groupedCommands(rows)) {
      if (items.length >= topLimit) break;
      const children = commandsInCategory.slice(0, childLimit).map(command => ({
        name: (command.menu.name || command.aliases[0]).slice(0, 14),
        type: command.menu.type === "link" ? "link" : "send_message",
        ...(command.menu.type === "link" ? { link: command.menu.value } : { send_message: command.menu.value })
      }));
      if (!children.length) continue;
      items.push(Object.freeze({
        name: categoryMeta(category).menu.slice(0, 10),
        type: "menu",
        sub_menu_items: Object.freeze(children)
      }));
    }
    return Object.freeze({ items: Object.freeze(items) });
  }

  return Object.freeze({
    get,
    resolve,
    list,
    buildPanel,
    buildPanels,
    buildMenu,
    size: commands.size,
    categories: CATEGORY_META
  });
}

export { CATEGORY_META, COMMAND_SCOPES, createCommandRegistry, defineCommand };
