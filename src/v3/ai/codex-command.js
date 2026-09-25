const CODEX_COMMAND_DEFAULT_MODEL = "gpt-6-luna";
const CODEX_COMMAND_DEFAULT_REASONING = "none";
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

function codexCommandUsage() {
  return [
    "格式：!codex <模型> <思考等級> <忽略程式碼及其他提示詞（原版輸入）:是否> <問題>",
    "思考等級：無 / 低 / 中 / 高 / 超高 / 最大",
    "模型、思考等級、是否都可省略；預設模型 GPT-6 Luna，預設無思考。",
    "例：!codex GPT-6 Luna 高 是 幫我分析這段錯誤"
  ].join("\n");
}

function parseCodexCommand(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^[!！]codex(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  let rest = String(match[1] || "").trim();
  if (!rest) return Object.freeze({ ok: false, message: codexCommandUsage() });

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
  if (!question) return Object.freeze({ ok: false, message: codexCommandUsage() });

  return Object.freeze({
    ok: true,
    model,
    reasoningEffort,
    originalPromptOnly,
    question
  });
}

export {
  CODEX_COMMAND_DEFAULT_MODEL,
  CODEX_COMMAND_DEFAULT_REASONING,
  CODEX_COMMAND_REASONING_LEVELS,
  codexCommandUsage,
  parseCodexCommand
};
