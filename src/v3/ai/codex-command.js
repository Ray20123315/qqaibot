const CODEX_COMMAND_DEFAULT_MODEL = "gpt-6-luna";
const CODEX_COMMAND_DEFAULT_REASONING = "none";
const CODEX_PUBLIC_MODEL = "gpt-6-luna";
const CODEX_PUBLIC_REASONING = "none";
const CODEX_COMMAND_REASONING_LEVELS = Object.freeze(["none", "low", "medium", "high", "xhigh", "max"]);

const REASONING_ALIASES = Object.freeze(new Map([
  ["無", "none"], ["无", "none"], ["無思考", "none"], ["无思考", "none"], ["none", "none"],
  ["低", "low"], ["low", "low"],
  ["中", "medium"], ["medium", "medium"], ["med", "medium"],
  ["高", "high"], ["high", "high"],
  ["超高", "xhigh"], ["xhigh", "xhigh"], ["extra-high", "xhigh"], ["extrahigh", "xhigh"],
  ["最大", "max"], ["max", "max"]
]));

const BOOLEAN_ALIASES = Object.freeze(new Map([
  ["是", true], ["yes", true], ["true", true], ["1", true],
  ["否", false], ["no", false], ["false", false], ["0", false]
]));

const MODEL_ALIASES = Object.freeze([
  [/^gpt[- ]?6\s+luna(?:\s+|$)/i, "gpt-6-luna"],
  [/^gpt[- ]?6\s+sol(?:\s+|$)/i, "gpt-6-sol"],
  [/^gpt[- ]?6\s+astra(?:\s+|$)/i, "gpt-6-astra"],
  [/^luna(?:\s+|$)/i, "gpt-6-luna"],
  [/^sol(?:\s+|$)/i, "gpt-6-sol"],
  [/^astra(?:\s+|$)/i, "gpt-6-astra"]
]);

function consumeWord(source) {
  const text = String(source || "").trimStart();
  const match = text.match(/^(\S+)(?:\s+|$)/);
  if (!match) return null;
  return { token: match[1], rest: text.slice(match[0].length).trimStart() };
}

function consumeModel(source) {
  const text = String(source || "").trimStart();
  for (const [pattern, model] of MODEL_ALIASES) {
    const match = text.match(pattern);
    if (match) return { value: model, rest: text.slice(match[0].length).trimStart() };
  }
  const word = consumeWord(text);
  if (!word) return null;
  const token = word.token;
  if (/^(?:gpt-[a-z0-9][a-z0-9._-]*|o\d[a-z0-9._-]*|codex-[a-z0-9._-]+)$/i.test(token)) {
    return { value: token.toLowerCase(), rest: word.rest };
  }
  return null;
}

function consumeReasoning(source) {
  const word = consumeWord(source);
  if (!word) return null;
  const normalized = REASONING_ALIASES.get(word.token.toLowerCase()) ?? REASONING_ALIASES.get(word.token);
  return normalized ? { value: normalized, rest: word.rest } : null;
}

function consumeBoolean(source) {
  const word = consumeWord(source);
  if (!word) return null;
  const key = word.token.toLowerCase();
  if (!BOOLEAN_ALIASES.has(key) && !BOOLEAN_ALIASES.has(word.token)) return null;
  return { value: BOOLEAN_ALIASES.get(key) ?? BOOLEAN_ALIASES.get(word.token), rest: word.rest };
}

function normalizeReasoning(value, fallback = CODEX_COMMAND_DEFAULT_REASONING) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return REASONING_ALIASES.get(text.toLowerCase()) ?? REASONING_ALIASES.get(text) ?? "";
}

function normalizeModel(value, fallback = CODEX_COMMAND_DEFAULT_MODEL) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const consumed = consumeModel(text);
  return consumed && !consumed.rest ? consumed.value : "";
}

function splitOptionTokens(source) {
  const input = String(source || "").trim();
  const out = [];
  let token = "";
  let quote = "";
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      token += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = "";
      else token += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (token) {
        out.push(token);
        token = "";
      }
      continue;
    }
    token += ch;
  }
  if (escaped) token += "\\";
  if (token) out.push(token);
  return out;
}

function aiCommandCodexUsage() {
  return [
    "AI 指令 Codex 格式：",
    "!指令 <參數> --codex",
    "公開 --codex 固定 GPT-6 Luna／無思考，所有人共用個人每日額度。",
    "開發者可改用 --codexchat [模型] [思考等級]，或 --codexwork [--root 名稱] [--edit] [--export]。"
  ].join("\n");
}

function parseDeveloperChatOptions(source) {
  let rest = String(source || "").trim();
  let model = CODEX_COMMAND_DEFAULT_MODEL;
  let reasoningEffort = CODEX_COMMAND_DEFAULT_REASONING;
  if (rest) {
    const modelPart = consumeModel(rest);
    if (!modelPart) return null;
    model = modelPart.value;
    rest = modelPart.rest;
    if (rest) {
      const reasoningPart = consumeReasoning(rest);
      if (!reasoningPart || reasoningPart.rest) return null;
      reasoningEffort = reasoningPart.value;
    }
  }
  return { model, reasoningEffort };
}

function codexWorkUsage() {
  return [
    "格式：!codexwork [--root 名稱] [--edit] [--export] [--model 模型] [--reasoning 等級] <工作>",
    "預設唯讀；--edit 只允許本機 Bridge 設定的可編輯區域，永遠不提供刪除能力。",
    "若加 --export，Bridge 可將允許範圍內的指定產物交給 QQ 上傳。",
    "開發者專用；檔案邊界由本機 Bridge 再次驗證。"
  ].join("\n");
}

function parseWorkOptions(source, { requireQuestion = true } = {}) {
  const tokens = splitOptionTokens(source);
  let rootAlias = "";
  let edit = false;
  let exportFiles = false;
  let model = CODEX_COMMAND_DEFAULT_MODEL;
  let reasoningEffort = CODEX_COMMAND_DEFAULT_REASONING;
  const question = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (question.length) {
      question.push(token);
      continue;
    }
    if (token === "--edit") {
      edit = true;
      continue;
    }
    if (["--readonly", "--read-only"].includes(token)) {
      edit = false;
      continue;
    }
    if (token === "--export") {
      exportFiles = true;
      continue;
    }
    if (token === "--root") {
      rootAlias = String(tokens[++index] || "").trim();
      if (!rootAlias) return null;
      continue;
    }
    if (token.startsWith("--root=")) {
      rootAlias = token.slice("--root=".length).trim();
      if (!rootAlias) return null;
      continue;
    }
    if (token === "--model") {
      let rawModel = String(tokens[++index] || "");
      if (/^gpt[- ]?6$/i.test(rawModel) && /^(?:luna|sol|astra)$/i.test(String(tokens[index + 1] || ""))) {
        rawModel += ` ${tokens[++index]}`;
      }
      model = normalizeModel(rawModel);
      if (!model) return null;
      continue;
    }
    if (token.startsWith("--model=")) {
      model = normalizeModel(token.slice("--model=".length));
      if (!model) return null;
      continue;
    }
    if (token === "--reasoning") {
      reasoningEffort = normalizeReasoning(tokens[++index]);
      if (!reasoningEffort) return null;
      continue;
    }
    if (token.startsWith("--reasoning=")) {
      reasoningEffort = normalizeReasoning(token.slice("--reasoning=".length));
      if (!reasoningEffort) return null;
      continue;
    }
    question.push(token);
  }

  const text = question.join(" ").trim();
  if (requireQuestion && !text) return null;
  return Object.freeze({
    rootAlias: rootAlias.slice(0, 80),
    edit,
    exportFiles,
    model,
    reasoningEffort,
    question: text
  });
}

function parseAiCommandCodexOverride(value) {
  const raw = String(value || "").trim();
  if (!/^[!！]/.test(raw)) return Object.freeze({ matched: false, text: raw });

  const marker = raw.match(/^(.*?)(?:\s+--(codexwork|codexchat|codex))(?:\s+([\s\S]*))?$/i);
  if (!marker) return Object.freeze({ matched: false, text: raw });

  const text = String(marker[1] || "").trim();
  const mode = String(marker[2] || "").toLowerCase();
  const rest = String(marker[3] || "").trim();
  if (!text) return Object.freeze({ matched: true, ok: false, text: raw, message: aiCommandCodexUsage() });

  if (mode === "codex") {
    if (rest) return Object.freeze({ matched: true, ok: false, text, message: aiCommandCodexUsage() });
    return Object.freeze({
      matched: true,
      ok: true,
      mode: "public",
      requiresDeveloper: false,
      text,
      provider: "codex",
      model: CODEX_PUBLIC_MODEL,
      reasoningEffort: CODEX_PUBLIC_REASONING
    });
  }

  if (mode === "codexchat") {
    const options = parseDeveloperChatOptions(rest);
    if (!options) return Object.freeze({ matched: true, ok: false, text, message: aiCommandCodexUsage() });
    return Object.freeze({
      matched: true,
      ok: true,
      mode: "chat",
      requiresDeveloper: true,
      text,
      provider: "codex",
      model: options.model,
      reasoningEffort: options.reasoningEffort
    });
  }

  const work = parseWorkOptions(rest, { requireQuestion: false });
  if (!work) return Object.freeze({ matched: true, ok: false, text, message: codexWorkUsage() });
  return Object.freeze({
    matched: true,
    ok: true,
    mode: "work",
    requiresDeveloper: true,
    text,
    provider: "codex",
    model: work.model,
    reasoningEffort: work.reasoningEffort,
    work: Object.freeze({ rootAlias: work.rootAlias, edit: work.edit, exportFiles: work.exportFiles })
  });
}

function codexCommandUsage() {
  return [
    "格式：!codex <問題>",
    "所有人可用；固定 GPT-6 Luna／無思考，使用個人每日額度。",
    "同一使用者／群組會沿用同一 Codex 對話，不會每次新開對話。"
  ].join("\n");
}

function codexChatCommandUsage() {
  return [
    "格式：!codexchat <模型> <思考等級> <忽略程式碼及其他提示詞（原版輸入）:是否> <問題>",
    "模型、思考等級、是否都可省略；預設 GPT-6 Luna／無思考。",
    "僅開發者可用，保留原本 !codex 的進階能力。"
  ].join("\n");
}

function parseCodexCommand(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^[!！]codex(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const question = String(match[1] || "").trim();
  if (!question) return Object.freeze({ ok: false, message: codexCommandUsage() });
  return Object.freeze({
    ok: true,
    mode: "public",
    model: CODEX_PUBLIC_MODEL,
    reasoningEffort: CODEX_PUBLIC_REASONING,
    originalPromptOnly: false,
    question
  });
}

function parseCodexChatCommand(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^[!！]codexchat(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  let rest = String(match[1] || "").trim();
  if (!rest) return Object.freeze({ ok: false, message: codexChatCommandUsage() });

  let model = CODEX_COMMAND_DEFAULT_MODEL;
  let reasoningEffort = CODEX_COMMAND_DEFAULT_REASONING;
  let originalPromptOnly = false;

  const modelPart = consumeModel(rest);
  if (modelPart) {
    model = modelPart.value;
    rest = modelPart.rest;
  }
  const reasoningPart = consumeReasoning(rest);
  if (reasoningPart) {
    reasoningEffort = reasoningPart.value;
    rest = reasoningPart.rest;
  }
  const booleanPart = consumeBoolean(rest);
  if (booleanPart) {
    originalPromptOnly = booleanPart.value;
    rest = booleanPart.rest;
  }

  const question = rest.trim();
  if (!question) return Object.freeze({ ok: false, message: codexChatCommandUsage() });
  return Object.freeze({
    ok: true,
    mode: "chat",
    model,
    reasoningEffort,
    originalPromptOnly,
    question
  });
}

function parseCodexWorkCommand(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^[!！]codexwork(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const work = parseWorkOptions(String(match[1] || ""), { requireQuestion: true });
  if (!work) return Object.freeze({ ok: false, message: codexWorkUsage() });
  return Object.freeze({
    ok: true,
    mode: "work",
    model: work.model,
    reasoningEffort: work.reasoningEffort,
    originalPromptOnly: false,
    rootAlias: work.rootAlias,
    edit: work.edit,
    exportFiles: work.exportFiles,
    question: work.question
  });
}

export {
  CODEX_COMMAND_DEFAULT_MODEL,
  CODEX_COMMAND_DEFAULT_REASONING,
  CODEX_COMMAND_REASONING_LEVELS,
  CODEX_PUBLIC_MODEL,
  CODEX_PUBLIC_REASONING,
  aiCommandCodexUsage,
  codexChatCommandUsage,
  codexCommandUsage,
  codexWorkUsage,
  parseAiCommandCodexOverride,
  parseCodexChatCommand,
  parseCodexCommand,
  parseCodexWorkCommand
};