import assert from "node:assert/strict";
import fs from "node:fs";
import { settingKey } from "./src/v4/public/user-settings.js";

assert.equal(settingKey("model_preference"), "preferences:model_preference");
assert.equal(settingKey("My Setting"), "preferences:my_setting");
assert.throws(() => settingKey(""), /USER_SETTING_KEY_REQUIRED/);

const settings = fs.readFileSync("src/v4/public/user-settings.js","utf8");
assert.match(settings, /readUserValue/);
assert.match(settings, /persistUserValue/);
assert.match(settings, /deleteUserValue/);
assert.match(settings, /"settings"/);
assert.match(settings, /USER_STORAGE_REQUIRED/);

const worker = fs.readFileSync("worker.js","utf8");
assert.match(worker, /readUserSetting/);
assert.match(worker, /writeUserSetting/);
assert.match(worker, /qqOpenContentPrincipal/);
assert.match(worker, /"model_preference"/);
assert.match(worker, /长期保存：未启用/);
assert.match(worker, /reason: "USER_STORAGE_REQUIRED"/);

const modelCommandStart = worker.indexOf("if (/^[!！](?:模型|model)");
const modelCommandEnd = worker.indexOf("if (/^[!！](?:申诉|申訴|appeal)", modelCommandStart);
assert.ok(modelCommandStart > 0 && modelCommandEnd > modelCommandStart);
const modelCommand = worker.slice(modelCommandStart, modelCommandEnd);
assert.match(modelCommand, /isQqOpenV4/);
assert.match(modelCommand, /writeUserSetting/);
assert.match(modelCommand, /else \{\s*await dbPut/, "legacy OneBot model preference should retain platform DB behavior");

const generationIndex = worker.indexOf('const modelPrefState = isQqOpenV4');
assert.ok(generationIndex > 0);
assert.match(worker.slice(generationIndex, generationIndex + 600), /readUserSetting/);

const switchIndex = worker.indexOf('if (action === "switch_model")');
assert.ok(switchIndex > 0);
const switchBlock = worker.slice(switchIndex, switchIndex + 1800);
assert.match(switchBlock, /resolveCanonicalPrincipal/);
assert.match(switchBlock, /writeUserSetting/);
assert.doesNotMatch(switchBlock, /dbPut\(this\.env, `model_pref:/);

console.log("verify-v4-user-settings-routing: ok");
