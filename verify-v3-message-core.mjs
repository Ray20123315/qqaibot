import assert from "node:assert/strict";
import { canonicalPlainText, createCanonicalMessage, messageHasKind } from "./src/v3/message/core.js";
import { fromOneBotEvent, normalizeOneBotMessage, outboundMediaFile, parseCqMessage, toCqString, toOneBotSegments } from "./src/v3/message/onebot.js";
import { mediaCapabilityProbeActions, planMediaResolution } from "./src/v3/media/core.js";

const event = {
  post_type: "message",
  message_type: "group",
  message_id: 1001,
  group_id: 2002,
  user_id: 3003,
  self_id: 4004,
  time: 1700000000,
  message: [
    { type: "reply", data: { id: "900" } },
    { type: "at", data: { qq: "4004" } },
    { type: "text", data: { text: " 看这个 " } },
    { type: "image", data: { file: "img-1", url: "https://example.com/a.png", summary: "截图", file_size: 123 } },
    { type: "record", data: { file: "audio-1", path: "C:/NapCat/a.silk", file_size: 456 } },
    { type: "face", data: { id: "178", chainCount: 2 } },
    { type: "image", data: { file: "marketface", emoji_id: "e1", emoji_package_id: "p1", key: "k1", summary: "猫猫" } },
    { type: "file", data: { file: "report.pdf", file_id: "f1", file_size: 999 } },
    { type: "forward", data: { id: "fw1", content: [[{ type: "text", data: { text: "节点内容" } }]] } }
  ]
};

const canonical = fromOneBotEvent(event);
assert.equal(canonical.schemaVersion, 1);
assert.equal(canonical.scope, "group");
assert.equal(canonical.groupId, "2002");
assert.deepEqual(canonical.parts.map(x => x.kind), ["reply","mention","text","image","audio","face","mface","file","forward"]);
assert.equal(canonical.parts[6].emojiId, "e1", "market-face images must normalize to mface");
assert.equal(canonical.parts[6].media.file, "marketface");
assert.equal(canonical.parts[8].nodes[0].parts[0].text, "节点内容");
assert(messageHasKind(canonical, "audio"));
assert.match(canonicalPlainText(canonical), /商城表情:猫猫/);
assert.match(canonicalPlainText(canonical), /\[语音\]/);

const cq = "[CQ:reply,id=12][CQ:at,qq=all]hello&#91;x&#93;[CQ:image,file=https://example.com/a.png,summary=a&#44;b][CQ:face,id=14]";
const cqSegments = parseCqMessage(cq);
assert.equal(cqSegments[1].data.qq, "all");
assert.equal(cqSegments[2].data.text, "hello[x]");
const cqParts = normalizeOneBotMessage(cq);
assert.deepEqual(cqParts.map(x => x.kind), ["reply","mention","text","image","face"]);
assert.equal(cqParts[3].summary, "a,b");

const outbound = createCanonicalMessage({ scope: "private", userId: "3" }, [
  { kind: "reply", messageId: "99" },
  { kind: "text", text: "hello" },
  { kind: "face", faceId: "178" },
  { kind: "mface", emojiId: "e2", packageId: "p2", key: "k2", summary: "OK" },
  { kind: "image", summary: "pic", media: { base64: "YWJj", mimeType: "image/png" } },
  { kind: "audio", media: { url: "https://example.com/a.mp3" } },
  { kind: "file", media: { file: "document.txt", name: "Document" } }
]);
const rendered = toOneBotSegments(outbound);
assert.deepEqual(rendered.map(x => x.type), ["reply","text","face","mface","image","record","file"]);
assert.equal(rendered[4].data.file, "base64://YWJj");
assert.equal(rendered[5].data.file, "https://example.com/a.mp3");
assert.match(toCqString(outbound), /\[CQ:mface,/);
assert.equal(outboundMediaFile({ path: "C:/NapCat/a.png" }), "", "Cloudflare-safe default must reject local paths");
assert.throws(() => toOneBotSegments([{ kind: "image", media: { path: "C:/NapCat/a.png" } }]), /V3_MEDIA_NO_SENDABLE_SOURCE:image/);

assert.deepEqual(planMediaResolution({ kind: "image", media: { url: "https://example.com/a.png" } }).strategy, "direct");
assert.deepEqual(planMediaResolution({ kind: "image", media: { file: "abc.jpg" } }), { strategy: "onebot", action: "get_image", params: { file: "abc.jpg" } });
assert.deepEqual(planMediaResolution({ kind: "audio", media: { file: "abc.silk" } }), { strategy: "onebot", action: "get_record", params: { file: "abc.silk", out_format: "mp3" } });
assert.deepEqual(planMediaResolution({ kind: "forward", forwardId: "x" }), { strategy: "onebot", action: "get_forward_msg", params: { message_id: "x" } });
assert.deepEqual(mediaCapabilityProbeActions().map(x => x.action), ["can_send_image","can_send_record"]);

console.log("verify-v3-message-core: ok");
