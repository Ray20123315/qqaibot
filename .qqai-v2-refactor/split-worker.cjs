const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const workerPath = path.join(root, 'worker.js');
const source = fs.readFileSync(workerPath, 'utf8');
const sf = ts.createSourceFile(workerPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const statements = [...sf.statements];

function declaredNames(node) {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return node.name ? [node.name.text] : [];
  }
  if (ts.isVariableStatement(node)) {
    const out = [];
    const walk = (name) => {
      if (ts.isIdentifier(name)) out.push(name.text);
      else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const el of name.elements) {
          if (ts.isBindingElement(el)) walk(el.name);
        }
      }
    };
    for (const decl of node.declarationList.declarations) walk(decl.name);
    return out;
  }
  return [];
}

const modules = [
  { name: 'config', file: 'src/config/runtime.js', indices: [0, ...range(24, 30), ...range(46, 48)] },
  { name: 'i18n', file: 'src/i18n/commands.js', indices: [...range(39, 45)] },
  { name: 'data', file: 'src/data/store.js', indices: [...range(49, 59)] },
  { name: 'identity', file: 'src/core/identity.js', indices: [...range(62, 77)] },
  { name: 'ai', file: 'src/ai/runtime.js', indices: [...range(31, 38), ...range(78, 90), ...range(194, 234)] },
  { name: 'security', file: 'src/security/network.js', indices: [...range(91, 101)] },
  { name: 'permissions', file: 'src/core/permissions.js', indices: [...range(102, 130)] },
  { name: 'messages', file: 'src/onebot/messages.js', indices: [...range(131, 193)] },
  { name: 'groups', file: 'src/group/runtime.js', indices: [...range(235, 258)] },
  { name: 'schedules', file: 'src/scheduler/runtime.js', indices: [...range(259, 298)] },
  { name: 'moderation', file: 'src/moderation/runtime.js', indices: [...range(299, 371)] },
  { name: 'health', file: 'src/health/runtime.js', indices: [...range(372, 378)] },
  { name: 'portalAuth', file: 'src/portal/auth.js', indices: [...range(379, 443)] },
  { name: 'bilibili', file: 'src/integrations/bilibili.js', indices: [...range(444, 464)] },
  { name: 'platform', file: 'src/platform/runtime.js', indices: [...range(465, 475)] },
  { name: 'operations', file: 'src/operations/runtime.js', indices: [...range(476, 563)] },
  { name: 'portal', file: 'src/portal/runtime.js', indices: [...range(564, 570)] },
];
function range(a,b){return Array.from({length:b-a+1},(_,i)=>a+i)}

const moduleForIndex = new Map();
for (const mod of modules) {
  for (const i of mod.indices) {
    if (moduleForIndex.has(i)) throw new Error(`Duplicate index ${i}`);
    moduleForIndex.set(i, mod);
  }
}
for (const i of [60,61,571]) moduleForIndex.set(i, {name:'entry',file:'worker.js'});
for (let i=0;i<statements.length;i++) if (!moduleForIndex.has(i)) moduleForIndex.set(i,{name:'entry',file:'worker.js'});

const declarationOwner = new Map();
const declarationNames = new Map();
for (let i=0;i<statements.length;i++) {
  const names = declaredNames(statements[i]);
  declarationNames.set(i,names);
  for (const n of names) declarationOwner.set(n,i);
}

function collectRefs(node, ownNames) {
  const refs = new Set();
  function visit(n) {
    if (ts.isIdentifier(n)) {
      const name=n.text;
      if (!ownNames.has(name) && declarationOwner.has(name)) refs.add(declarationOwner.get(name));
    }
    ts.forEachChild(n,visit);
  }
  visit(node);
  return [...refs];
}
const refsByIndex = new Map();
for (let i=0;i<statements.length;i++) refsByIndex.set(i,collectRefs(statements[i],new Set(declarationNames.get(i))));

function importPath(fromFile,toFile){
  let rel=path.posix.relative(path.posix.dirname(fromFile),toFile).replace(/\\/g,'/');
  if (!rel.startsWith('.')) rel='./'+rel;
  return rel;
}
function importsFor(ownerName, ownerFile, indices) {
  const byTarget = new Map();
  for (const i of indices) {
    for (const r of refsByIndex.get(i)) {
      const target=moduleForIndex.get(r);
      if (target.name===ownerName) continue;
      if (target.name==='entry') {
        throw new Error(`${ownerName} declaration ${i} (${declarationNames.get(i)}) depends on entry declaration ${r} (${declarationNames.get(r)})`);
      }
      const names=declarationNames.get(r);
      if (!names.length) throw new Error(`Referenced statement ${r} has no importable names`);
      if (!byTarget.has(target.file)) byTarget.set(target.file,new Set());
      for (const n of names) byTarget.get(target.file).add(n);
    }
  }
  return [...byTarget.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([targetFile,names])=>
    `import { ${[...names].sort().join(', ')} } from ${JSON.stringify(importPath(ownerFile,targetFile))};`
  ).join('\n');
}

fs.rmSync(path.join(root,'src'),{recursive:true,force:true});
for (const mod of modules) {
  const target=path.join(root,mod.file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const imports=importsFor(mod.name,mod.file,mod.indices);
  const chunks=mod.indices.sort((a,b)=>a-b).map(i=>source.slice(statements[i].getFullStart(),statements[i].end).trimEnd());
  const exports=[...new Set(mod.indices.flatMap(i=>declarationNames.get(i)))].sort();
  const header=`// Extracted from worker.js without behavioral changes.\n// Cloudflare still deploys worker.js as the single Worker entry point.\n`;
  const body=[header,imports,imports?'':'',chunks.join('\n\n'),'',`export { ${exports.join(', ')} };`,''].join('\n');
  fs.writeFileSync(target,body);
}

const entryIndices=[];
for(let i=0;i<statements.length;i++) if(moduleForIndex.get(i).name==='entry') entryIndices.push(i);
const entryImports=importsFor('entry','worker.js',entryIndices);
const entryChunks=entryIndices.sort((a,b)=>a-b).map(i=>source.slice(statements[i].getFullStart(),statements[i].end).trimEnd());
const entry=`${entryImports}\n\n${entryChunks.join('\n\n')}\n`;
fs.writeFileSync(workerPath,entry);

const manifest={
  generatedAt:new Date().toISOString(),
  sourceSha256:require('crypto').createHash('sha256').update(source).digest('hex'),
  entryStatements:entryIndices.length,
  modules:modules.map(m=>({name:m.name,file:m.file,statements:m.indices.length,exports:[...new Set(m.indices.flatMap(i=>declarationNames.get(i)))].length}))
};
fs.writeFileSync(path.join(root,'src/module-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
