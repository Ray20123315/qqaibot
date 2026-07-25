import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const aiSource = fs.readFileSync('src/ai/runtime.js', 'utf8');
const configSource = fs.readFileSync('src/config/runtime.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.toml', 'utf8');
const workerModule = await import(`./worker.js?verify=${Date.now()}`);

assert(typeof workerModule.default?.fetch === 'function', 'Default Worker fetch handler is missing');
assert(typeof workerModule.default?.scheduled === 'function', 'Default Worker scheduled handler is missing');
assert(typeof workerModule.OneBotHub === 'function', 'OneBotHub export is missing');
for (const name of [
  'googleApiKeysFor',
  'roundRobinKeys',
  'geminiSearchApiKeys',
  'geminiVisionApiKeys',
  'imageInspectionEnabled',
  'deepSeekApiKeys',
  'callGoogleDecision',
  'callGeminiGenerate',
  'generateHybridReply',
  'enforceExecutedSearchForReply',
]) {
  assert(new RegExp(`\\b${name}\\b`).test(aiSource), `Model routing symbol missing: ${name}`);
}
assert(/const DEFAULTS\s*=\s*Object\.freeze/.test(configSource), 'Runtime defaults are missing');
assert(/^GEMINI_CHAT_MODELS\s*=\s*"/m.test(wrangler), 'Gemini model configuration is missing');
assert(/^DEEPSEEK_FLASH_MODEL\s*=\s*"/m.test(wrangler), 'DeepSeek model configuration is missing');
console.log('verify-model-routing: ok');
