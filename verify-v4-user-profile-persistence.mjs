import assert from "node:assert/strict";
import fs from "node:fs";
import { memoryKey, parseMemoryList } from "./src/v4/public/user-memory.js";

assert.equal(memoryKey("group/open id"), "manual:group_open_id");
assert.equal(memoryKey(""), "manual:private");
assert.deepEqual(parseMemoryList('[{"id":"a","text":"hello"}]'), [{ id: "a", text: "hello" }]);
assert.deepEqual(parseMemoryList("not-json"), []);

const memorySource = fs.readFileSync("src/v4/public/user-memory.js", "utf8");
assert.match(memorySource, /persistUserValue\(env, principal, "memory"/);
assert.match(memorySource, /readUserValue\(env, principal, "memory"/);
assert.match(memorySource, /deleteUserValue\(env, principal, "memory"/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /deleteUserSetting, readUserSetting, writeUserSetting/);
assert.match(worker, /readUserMemoryList/);
assert.match(worker, /writeUserMemoryList/);
assert.match(worker, /deleteUserMemoryList/);
assert.match(worker, /writeUserSetting\(env, targetPrincipal, `custom_style\.\$\{qqOpenSettingScope\}`/);
assert.match(worker, /writeUserSetting\(env, targetPrincipal, `dnd\.\$\{qqOpenSettingScope\}`/);
assert.match(worker, /readUserSetting\(env, qqOpenContentPrincipal, `custom_style\.\$\{qqOpenSettingScope\}`/);
assert.match(worker, /readUserSetting\(env, qqOpenContentPrincipal, `dnd\.\$\{qqOpenSettingScope\}`/);
assert.match(worker, /readUserMemoryList\(env, qqOpenContentPrincipal, qqOpenSettingScope\)/);
assert.match(worker, /if \(!isQqOpenV4 && env\.VECTORIZE && cleanMessage/);
assert.match(worker, /clearQqOpenPrivateHistory\(env, body, sessionKey\)/);

const memoryCommandStart = worker.indexOf("// 🧠 专属记忆管理");
const groupRulesStart = worker.indexOf("if (['!群规'", memoryCommandStart);
assert.ok(memoryCommandStart > 0 && groupRulesStart > memoryCommandStart);
const memoryCommandBlock = worker.slice(memoryCommandStart, groupRulesStart);
assert.match(memoryCommandBlock, /if \(isQqOpenV4\)/);
assert.match(memoryCommandBlock, /writeUserMemoryList/);
assert.match(memoryCommandBlock, /writeSystemAudit/);
assert.match(memoryCommandBlock, /else \{[\s\S]*?upsertMemoryVector|if \(!isQqOpenV4\)[\s\S]*?upsertMemoryVector/);

const personaStart = worker.indexOf("// !set人格");
const dndStart = worker.indexOf("// 🔇 智能免打扰模式", personaStart);
const personaBlock = worker.slice(personaStart, dndStart);
assert.match(personaBlock, /writeUserSetting/);
assert.match(personaBlock, /deleteUserSetting/);

console.log("verify-v4-user-profile-persistence: ok");
