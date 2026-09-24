import assert from "node:assert/strict";
import {
  MediaResolutionError,
  resolveMediaPart,
  resolveMessageMedia,
  tryResolveMediaPart
} from "./src/v3/media/resolver.js";
import { createCanonicalMessage } from "./src/v3/message/core.js";

function response(bytes, mime = "image/png", status = 200, contentLength = null) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const headers = new Headers({ "content-type": mime });
  if (contentLength !== null) headers.set("content-length", String(contentLength));
  return new Response(body, { status, headers });
}

{
  const value = await resolveMediaPart({ kind: "image", media: { base64: "YWJj", mimeType: "image/png" } }, {}, {});
  assert.equal(value.base64, "YWJj");
  assert.equal(value.size, 3);
  assert.equal(value.source, "direct:base64");
}

{
  const calls = [];
  const value = await resolveMediaPart({ kind: "image", media: { file: "img-token" } }, { messageId: "99" }, {
    onebotCall: async (action) => { calls.push(action); return { url: "https://cdn.example/image.png" }; },
    safeFetch: async () => response(new Uint8Array([1,2,3,4]), "image/png")
  });
  assert.equal(value.source, "onebot:get_image");
  assert.deepEqual(calls, ["get_image"]);
  assert.equal(value.size, 4);
}

{
  const calls = [];
  let fetchCount = 0;
  const value = await resolveMediaPart({ kind: "image", media: { url: "https://cdn.example/expired.png", file: "img-refresh-token" } }, { messageId: "88" }, {
    onebotCall: async (action, params) => {
      calls.push([action, params]);
      if (action === "get_image") return { url: "https://cdn.example/fresh.png" };
      throw new Error("unexpected");
    },
    safeFetch: async (url) => {
      fetchCount += 1;
      if (String(url).includes("expired")) return response(new Uint8Array([0]), "image/png", 403);
      return response(new Uint8Array([7,8,9]), "image/png");
    }
  });
  assert.equal(value.source, "onebot:get_image", "expired direct URL must refresh through OneBot when file token exists");
  assert.equal(fetchCount, 2);
  assert.equal(calls[0][0], "get_image");
  assert.equal(value.attempts.some(item => item.stage === "direct" && item.ok === false && item.errorCode === "MEDIA_HTTP_ERROR"), true);
}

{
  const calls = [];
  const value = await resolveMediaPart({ kind: "audio", media: { file: "voice-token", path: "C:/NapCat/voice.silk" } }, { messageId: "77" }, {
    onebotCall: async (action, params) => {
      calls.push([action, params]);
      if (action === "get_record") return { file: "C:/NapCat/cache/voice.mp3" };
      if (action === "get_msg") return { message: [{ type: "record", data: { file: "voice-token", url: "https://cdn.example/voice.mp3" } }] };
      throw new Error("unexpected");
    },
    safeFetch: async () => response(new Uint8Array([4,5,6]), "audio/mpeg")
  });
  assert.equal(value.source, "onebot:get_msg");
  assert.equal(calls[0][0], "get_record");
  assert.equal(calls[0][1].out_format, "mp3");
  assert.equal(calls[1][0], "get_msg");
}

{
  const failed = await tryResolveMediaPart({ kind: "image", media: { path: "C:/NapCat/private.png" } }, {}, {});
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "MEDIA_LOCAL_PATH_UNREACHABLE");
  assert.equal(JSON.stringify(failed).includes("C:/NapCat/private.png"), false, "local path must not leak into resolver error output");
}

{
  await assert.rejects(
    () => resolveMediaPart({ kind: "image", media: { url: "https://cdn.example/huge.png" } }, {}, {
      limits: { image: 1024 },
      safeFetch: async () => response(new Uint8Array([1]), "image/png", 200, 4096)
    }),
    error => error instanceof MediaResolutionError && error.code === "MEDIA_TOO_LARGE"
  );
}

{
  await assert.rejects(
    () => resolveMediaPart({ kind: "image", media: { url: "https://cdn.example/not-image" } }, {}, {
      safeFetch: async () => response(new Uint8Array([1,2]), "text/html")
    }),
    error => error instanceof MediaResolutionError && error.code === "MEDIA_MIME_REJECTED"
  );
}

{
  const forward = await resolveMediaPart({ kind: "forward", forwardId: "fw1" }, {}, {
    onebotCall: async (action) => {
      assert.equal(action, "get_forward_msg");
      return { messages: [
        { user_id: 1, nickname: "A", message: [{ type: "text", data: { text: "hello" } }] },
        { user_id: 2, nickname: "B", message: [{ type: "image", data: { file: "x" } }] }
      ] };
    }
  });
  assert.equal(forward.nodeCount, 2);
  assert.equal(forward.nodes[0].parts[0].kind, "text");
  assert.equal(forward.nodes[1].parts[0].kind, "image");
}

{
  const message = createCanonicalMessage({ messageId: "5", groupId: "6", scope: "group" }, [
    { kind: "text", text: "x" },
    { kind: "image", media: { base64: "YWJj", mimeType: "image/png" } },
    { kind: "audio", media: { base64: "ZGVm", mimeType: "audio/mpeg" } }
  ]);
  const resolved = await resolveMessageMedia(message, {});
  assert.equal(resolved.length, 2);
  assert.equal(resolved.every(item => item.ok), true);
}

console.log("verify-v3-media-resolver: ok");
