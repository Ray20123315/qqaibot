import { cleanMediaRef } from "../message/core.js";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function directMediaSource(media = {}) {
  const ref = cleanMediaRef(media);
  if (ref.base64) return Object.freeze({ type: "base64", value: ref.base64, mimeType: ref.mimeType });
  if (isHttpUrl(ref.url)) return Object.freeze({ type: "url", value: ref.url, mimeType: ref.mimeType });
  if (isHttpUrl(ref.file)) return Object.freeze({ type: "url", value: ref.file, mimeType: ref.mimeType });
  return null;
}

function planMediaResolution(part) {
  if (!part || !["image", "audio", "video", "file", "mface", "forward"].includes(part.kind)) {
    return Object.freeze({ strategy: "none", reason: "not_resolvable" });
  }
  if (part.kind === "forward") {
    return part.forwardId
      ? Object.freeze({ strategy: "onebot", action: "get_forward_msg", params: { message_id: String(part.forwardId) } })
      : Object.freeze({ strategy: "none", reason: "missing_forward_id" });
  }
  const direct = directMediaSource(part.media || {});
  if (direct) return Object.freeze({ strategy: "direct", source: direct });
  const file = String(part.media?.file || "");
  if (part.kind === "image" || part.kind === "mface") {
    return file
      ? Object.freeze({ strategy: "onebot", action: "get_image", params: { file } })
      : Object.freeze({ strategy: "none", reason: "missing_image_file" });
  }
  if (part.kind === "audio") {
    return file
      ? Object.freeze({ strategy: "onebot", action: "get_record", params: { file, out_format: "mp3" } })
      : Object.freeze({ strategy: "none", reason: "missing_audio_file" });
  }
  if (part.kind === "file") {
    if (part.media?.fileId) return Object.freeze({ strategy: "file-api", fileId: String(part.media.fileId), name: String(part.media.name || part.media.file || "") });
    return Object.freeze({ strategy: "none", reason: "file_context_required" });
  }
  return Object.freeze({ strategy: "none", reason: "video_requires_url_or_refresh_context" });
}

function mediaCapabilityProbeActions() {
  return Object.freeze([
    Object.freeze({ action: "can_send_image", params: {} }),
    Object.freeze({ action: "can_send_record", params: {} })
  ]);
}

export { directMediaSource, isHttpUrl, mediaCapabilityProbeActions, planMediaResolution };
