const GROUP_PANEL_CATEGORY_META = Object.freeze([
  Object.freeze({ key:"basic", label:"基础", aliases:Object.freeze(["基础","基礎","basic"]) }),
  Object.freeze({ key:"group-analysis", label:"群聊", aliases:Object.freeze(["群聊","群聊分析","群聊整理","group"]) }),
  Object.freeze({ key:"memory-personal", label:"记忆", aliases:Object.freeze(["记忆","記憶","人格","设置","設定","memory"]) }),
  Object.freeze({ key:"activity-schedule", label:"活动", aliases:Object.freeze(["活动","活動","投票","排程","schedule"]) }),
  Object.freeze({ key:"rules", label:"群规", aliases:Object.freeze(["群规","群規","规则","規則","rules"]) }),
  Object.freeze({ key:"ai-admin", label:"AI管理", aliases:Object.freeze(["AI管理","ai管理","aiadmin"]) }),
  Object.freeze({ key:"group-ops", label:"群操作", aliases:Object.freeze(["群操作","群管理","moderation"]) }),
  Object.freeze({ key:"owner", label:"群主", aliases:Object.freeze(["群主","owner"]) }),
  Object.freeze({ key:"developer", label:"开发者", aliases:Object.freeze(["开发者","開發者","developer","dev"]) }),
  Object.freeze({ key:"other", label:"其他", aliases:Object.freeze(["其他","other"]) })
]);

function clean(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return clean(value).normalize("NFKC").toLowerCase();
}

function commandToken(value) {
  return normalized(value).replace(/^[!！]+/, "");
}

function categoryMetaByToken(value) {
  const token = normalized(value);
  return GROUP_PANEL_CATEGORY_META.find(meta =>
    meta.aliases.some(alias => normalized(alias) === token)
  ) || null;
}

function groupCommandsForCategory(registry, key) {
  return registry.list({ scope:"group" }).filter(command =>
    command.panel.enabled && String(command.discoveryCategory || "other") === key
  );
}

function compactChildList(rows, max = 12) {
  const names = rows.slice(0, max).map(command => commandToken(command.panel.command));
  return names.join("、") + (rows.length > max ? "…" : "");
}

function buildGroupRootPanel(registry, { remark = "QQAIBOT V4 GROUP ROOT" } = {}) {
  const items = [];
  for (const meta of GROUP_PANEL_CATEGORY_META) {
    const rows = groupCommandsForCategory(registry, meta.key);
    if (!rows.length) continue;
    items.push(Object.freeze({
      type:"command",
      name:`!面板 ${meta.label}`,
      desc:`${rows.length} 个子指令，发送后查看`
    }));
  }
  if (!items.length) throw new Error("QQ_OPEN_GROUP_PANEL_EMPTY");
  if (items.length > 20) throw new Error(`QQ_OPEN_GROUP_PANEL_ROOT_LIMIT:${items.length}`);
  return Object.freeze({
    scope:"group",
    target_type:"all",
    panel:Object.freeze({
      items:Object.freeze(items),
      remark:clean(remark).slice(0,255)
    }),
    discovery_category:"group-root",
    discovery_category_label:"群聊指令分类"
  });
}

function resolveGroupPanelInput(input, registry) {
  const raw = clean(input);
  const match = raw.match(/^[!！]面板\s+([^\s]+)(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  const meta = categoryMetaByToken(match[1]);
  if (!meta) {
    return Object.freeze({
      matched:true,
      expanded:"",
      message:`未知分类「${clean(match[1])}」。可用：${GROUP_PANEL_CATEGORY_META.map(item => item.label).join("、")}`
    });
  }

  const rows = groupCommandsForCategory(registry, meta.key);
  if (!rows.length) {
    return Object.freeze({ matched:true, expanded:"", category:meta.key, message:`「${meta.label}」目前没有群聊子指令。` });
  }

  const tail = clean(match[2] || "");
  const help = `【${meta.label}】子指令：${compactChildList(rows)}\n用法：!面板 ${meta.label} <子指令> [参数]\n原本的 ! 指令仍可直接使用。`;
  if (!tail) return Object.freeze({ matched:true, expanded:"", category:meta.key, rows:Object.freeze(rows), message:help });

  const tokenMatch = tail.match(/^([^\s]+)(?:\s+([\s\S]+))?$/);
  const token = commandToken(tokenMatch?.[1] || "");
  const rest = clean(tokenMatch?.[2] || "");
  const command = rows.find(row => {
    const candidates = [row.panel.command, ...(row.aliases || [])].map(commandToken);
    return candidates.includes(token);
  });
  if (!command) {
    return Object.freeze({
      matched:true,
      expanded:"",
      category:meta.key,
      rows:Object.freeze(rows),
      message:`找不到「${clean(tokenMatch?.[1] || "")}」。\n${help}`
    });
  }
  return Object.freeze({
    matched:true,
    category:meta.key,
    commandId:command.id,
    expanded:`${command.panel.command}${rest ? ` ${rest}` : ""}`,
    message:""
  });
}

function assertGroupPanelCoverage(registry) {
  const uncovered = registry.list({ scope:"group" })
    .filter(command => command.panel.enabled)
    .filter(command => !GROUP_PANEL_CATEGORY_META.some(meta => meta.key === String(command.discoveryCategory || "other")));
  if (uncovered.length) throw new Error(`QQ_OPEN_GROUP_PANEL_UNCOVERED:${uncovered.map(command => command.id).join(",")}`);
  return true;
}

export {
  GROUP_PANEL_CATEGORY_META,
  assertGroupPanelCoverage,
  buildGroupRootPanel,
  resolveGroupPanelInput
};
