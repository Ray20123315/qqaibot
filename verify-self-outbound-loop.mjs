import fs from "node:fs";

const worker = fs.readFileSync("worker.js", "utf8");
const permissions = fs.readFileSync("src/core/permissions.js", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

check(config.includes('const VERSION = "2.7.10";'), "runtime version must be 2.7.10");
check(pkg.version === "2.7.10", "package version must be 2.7.10");

const knownStart = permissions.indexOf("async function isKnownOutboundMessage");
const knownEnd = permissions.indexOf("async function callOneBotAction", knownStart);
const known = knownStart >= 0 ? permissions.slice(knownStart, knownEnd) : "";
check(known.includes("outbound_pending:${outboundFingerprint(info)}"), "pending outbound fingerprint lookup missing");
check(known.includes("Date.now() - Number(item.at || 0) > 2 * 60 * 1000"), "fixed outbound fingerprint TTL missing");
check(known.includes("Keep the fresh fingerprint until its fixed TTL expires"), "non-consuming outbound marker rationale missing");
check(!/await dbDel\(env, key\);\s*return true;/.test(known), "fresh outbound marker must not be deleted on a successful match");

const handlerStart = worker.indexOf("async handleMessage(socket, request, event)");
const echoGuard = worker.indexOf("self_outbound_echo_ignored", handlerStart);
const werewolf = worker.indexOf("const werewolfHandled", handlerStart);
const queueCheck = worker.indexOf("const explicitGroupQuestion = await this.shouldQueueUserQuestion", handlerStart);
check(handlerStart >= 0 && echoGuard > handlerStart, "Durable Object outbound echo guard missing");
check(echoGuard < werewolf && echoGuard < queueCheck, "outbound echo guard must run before games and question queueing");
check(worker.includes('inboundPostType === "message_sent" || Boolean(inboundSelfId && inboundUserId === inboundSelfId)'), "self message event detection missing");
check(worker.includes('text: extractMessageText(body.message || body.raw_message || "")'), "ingress fingerprint text must match sendAction normalization");
check(worker.includes('mediaTypes: extractOutboundMediaTypes(body.message || body.raw_message || "")'), "ingress media fingerprint must match sendAction normalization");
check(worker.includes("cleanMessage.startsWith('//')") && worker.includes("cleanMessage.startsWith('??')"), "same-account chat prefixes missing");
check(worker.includes("const explicitSelfCommand = /^[!！]/.test(cleanMessage);"), "same-account command path missing");
check(worker.includes("if (apiMessage) return new Response(null, { status: 204 });"), "inner Worker outbound defense missing");

console.log("Self-account outbound loop regression checks passed.");
