import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const wrangler = fs.readFileSync('wrangler.toml', 'utf8');
const worker = fs.readFileSync('worker.js', 'utf8');
const tags = [...wrangler.matchAll(/^tag\s*=\s*"([^"]+)"/gm)].map(match => match[1]);
assert(JSON.stringify(tags) === JSON.stringify([
  'v1_onebot_hub',
  'v2_budget_guard',
  'v3_remove_budget_guard',
]), `Durable Object migration history changed: ${tags.join(', ')}`);
assert(/name\s*=\s*"ONEBOT_HUB"[\s\S]*?class_name\s*=\s*"OneBotHub"/.test(wrangler), 'ONEBOT_HUB binding changed');
assert((worker.match(/export class OneBotHub/g) || []).length === 1, 'OneBotHub must be exported exactly once');
assert(!/export class BudgetGuard/.test(worker), 'Deleted BudgetGuard class must not be reintroduced');
console.log('verify-migration: ok');
