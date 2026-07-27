import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyPoliticalTopic } from "./src/policy/political-topics.js";
import { PORTAL_PAGE_SIZE_MAX, collectFilteredPage, normalizePortalPagination } from "./src/data/pagination.js";

assert.equal(classifyPoliticalTopic("法国现任总统是谁？").blocked, true);
assert.equal(classifyPoliticalTopic("你怎么看最近的选举和政党政策").blocked, true);
assert.equal(classifyPoliticalTopic("讨论两岸主权争议").blocked, true);
assert.equal(classifyPoliticalTopic("这个游戏里的总统角色怎么升级").blocked, false, "明确虚构／游戏语境不应误挡");
assert.equal(classifyPoliticalTopic("大众汽车是哪国的").blocked, false);

assert.equal(PORTAL_PAGE_SIZE_MAX, 100);
assert.deepEqual(normalizePortalPagination("2", "500"), { page: 2, pageSize: 100, offset: 100 });
assert.deepEqual(normalizePortalPagination("bad", "0"), { page: 1, pageSize: 50, offset: 0 });
const sample = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const filtered = await collectFilteredPage(sample, { page: 2, pageSize: 2, load: async x => x, match: x => x % 2 === 0 });
assert.deepEqual(filtered.items, [6, 4], "分页偏移必须按过滤后的匹配项计算");
assert.equal(filtered.pageInfo.hasMore, true);
assert.equal(filtered.pageInfo.nextPage, 3);

const worker = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const permissions = fs.readFileSync("src/core/permissions.js", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(worker, /let trustedSelfOperator = false/);
assert.match(worker, /const apiMessage = await isKnownOutboundMessage/);
assert.match(worker, /trustedSelfOperator = explicitSelfChat \|\| explicitSelfCommand/);
assert.match(worker, /if \(trustedSelfOperator\) \{\s*isDeveloper = true;/);
assert.match(worker, /reason: "political_topic_filter"/);
assert.match(worker, /naturalLanguageTrigger = [^\n]*!politicalTopic\.blocked/);
assert.doesNotMatch(worker, /您的发言已涉嫌违反平台政治敏感内容管理规范/);
assert.match(worker, /同号人工控制：机器人 QQ 本人可直接发送 !指令/);
assert.match(config, /ruleStrictness: "smart"/);
assert.match(portal, /normalizePortalPagination/);
assert.match(portal, /pageSize:String\(Number\(\$\('convPageSize'\)\.value\|\|50\)\)/);
assert.match(portal, /pageSize:String\(Number\(\$\('aiLogPageSize'\)\.value\|\|50\)\)/);
assert.doesNotMatch(portal, /limit:'500'/);
assert.match(portal, /服务器每页最多 100 条/);
assert.match(permissions, /async function listAiDecisionLogPage/);
assert.equal(pkg.version, "2.7.7");
assert.match(pkg.scripts.check, /verify-v277-emergency\.mjs/);

console.log("verify-v277-emergency: ok");
