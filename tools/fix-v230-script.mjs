import fs from 'node:fs';

const path = 'tools/apply-v230.mjs';
let source = fs.readFileSync(path, 'utf8');
const oldLine = "replaceAllIn('src/config/runtime.js', 'const BUILD_DATE = \"2026-07-25\";', 'const BUILD_DATE = \"2026-07-26\";');";
const newLine = "if (!read('src/config/runtime.js').includes('const BUILD_DATE = \"2026-07-26\";')) replaceAllIn('src/config/runtime.js', 'const BUILD_DATE = \"2026-07-25\";', 'const BUILD_DATE = \"2026-07-26\";');";
if (!source.includes(oldLine)) throw new Error('Unable to locate build-date patch line');
source = source.replace(oldLine, newLine);
fs.writeFileSync(path, source);
console.log('fix-v230-script: ok');
