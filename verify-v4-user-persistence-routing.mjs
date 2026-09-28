import assert from "node:assert/strict";
import fs from "node:fs";
import {
  allowPlatformUserContentPersistence,
  isQqOpenEvent,
  parseHistoryValue,
  qqOpenPrincipalFromBody
} from "./src/v4/public/chat-persistence.js";

const qqOpenPrivate = {
  __qqai_platform: "qq-open",
  __qqai_principal_id: "OPEN_USER",
  message_type: "private",
  user_id: "OPEN_USER"
};
assert.equal(isQqOpenEvent(qqOpenPrivate), true);
assert.equal(allowPlatformUserContentPersistence(qqOpenPrivate), false);
assert.equal(allowPlatformUserContentPersistence({ message_type: "group", user_id: "12345" }), true);
assert.equal(qqOpenPrincipalFromBody(qqOpenPrivate), "qqopen:OPEN_USER");
assert.deepEqual(parseHistoryValue('[{"role":"user"}]'), [{ role: "user" }]);
assert.deepEqual(parseHistoryValue([{ role: "model" }]), [{ role: "model" }]);
assert.deepEqual(parseHistoryValue("bad"), []);

const moduleSource = fs.readFileSync("src/v4/public/chat-persistence.js", "utf8");
assert.match(moduleSource, /readUserValue/);
assert.match(moduleSource, /persistUserValue/);
assert.match(moduleSource, /deleteUserValue/);
assert.match(moduleSource, /USER_STORAGE_REQUIRED/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /const isQqOpenV4 = isQqOpenEvent\(body\)/);
assert.match(worker, /readQqOpenPrivateHistory\(env, body, sessionKey/);
assert.match(worker, /persistQqOpenPrivateHistory\(env, body, sessionKey, history\)/);
assert.match(worker, /isGroup && allowPlatformUserContent/);
assert.match(worker, /isGroup && !?allowPlatformUserContent|isGroup && allowPlatformUserContent/);
assert.match(worker, /QQ Open 群聊在尚未指定群資料擁有者前不建立平台長期歷史/);
assert.match(worker, /clearQqOpenPrivateHistory/);

const readIndex = worker.indexOf("readQqOpenPrivateHistory(env, body, sessionKey");
const platformReadIndex = worker.indexOf("history = await readChatHistory(env, sessionKey");
assert.ok(readIndex > 0 && platformReadIndex > readIndex, "QQ Open private history must branch to user storage before legacy platform history");

const persistenceBlock = worker.slice(
  worker.indexOf("if (isQqOpenV4 && isPrivate) {", worker.indexOf("const userHistoryItem")),
  worker.indexOf("// ==========================================\n      // 🚀", worker.indexOf("const userHistoryItem"))
);
assert.match(persistenceBlock, /persistQqOpenPrivateHistory/);
assert.match(persistenceBlock, /isQqOpenV4 && isGroup/);
assert.doesNotMatch(
  persistenceBlock.split("isQqOpenV4 && isGroup")[1]?.split("else if \(isGroup\)")[0] || "",
  /appendChatHistoryTurn|dbPut\(env, sessionKey/,
  "QQ Open group branch must not persist chat history to platform D1"
);

console.log("verify-v4-user-persistence-routing: ok");
