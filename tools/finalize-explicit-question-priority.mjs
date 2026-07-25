import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  '      if (internalResponse.status === 204 && explicitQuestion && semanticQuestion && !options.signal?.aborted && body?.__qqai_force_explicit_reply !== true) {',
  '      if (internalResponse.status === 204 && explicitQuestion && semanticQuestion && safeRetry && !options.signal?.aborted && body?.__qqai_force_explicit_reply !== true) {',
  'safe explicit 204 retry'
);
fs.writeFileSync('worker.js', worker);

let verify = fs.readFileSync('verify-explicit-question-priority.mjs', 'utf8');
verify = replaceOnce(
  verify,
  "assert(worker.includes('__qqai_force_explicit_reply: true'), 'Explicit 204 responses must trigger a forced retry');",
  "assert(worker.includes('__qqai_force_explicit_reply: true'), 'Explicit 204 responses must trigger a forced retry');\nassert(worker.includes('explicitQuestion && semanticQuestion && safeRetry'), 'Forced 204 retry must be limited to side-effect-free chat');",
  'safe retry regression'
);
fs.writeFileSync('verify-explicit-question-priority.mjs', verify);
console.log('finalize-explicit-question-priority: patched');
