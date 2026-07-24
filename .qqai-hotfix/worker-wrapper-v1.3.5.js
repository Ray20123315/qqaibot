import previousWorker, { OneBotHub as PreviousOneBotHub } from "./worker_v1.3.4_previous.js";

export const HOTFIX_VERSION = "1.3.5";
export default previousWorker;

const FAILURE_MESSAGES = Object.freeze({
  worker_error: "内部 Worker 处理失败，任务已释放。请到 Portal 的“健康检查”与“AI 回复记录”查看最新错误后重试。",
  worker_empty_reply: "内部 Worker 返回了异常或空白结果，任务已释放。请到 Portal 的“健康检查”查看模型、D1 与 Durable Object 状态。",
  worker_no_reply: "这次 @ 已收到，但主 Worker 没有产生回复。请检查本群 AI 开关、群白名单、权限与模型可用状态。",
  send_failed: "回复已经生成，但 WebSocket 与 HTTP 备用发送都失败。请检查 NapCat 连接、Access Token 与发送权限。"
});

function eventMentionedQqsCompat(body) {
  const result = [];
  const message = body?.message;
  if (Array.isArray(message)) {
    for (const part of message) {
      if (part?.type === "at" && part?.data?.qq !== undefined) result.push(String(part.data.qq));
    }
  }
  const raw = String(body?.raw_message || (typeof message === "string" ? message : ""));
  for (const match of raw.matchAll(/\[CQ:at,qq=(\d+|all)\]/g)) result.push(String(match[1]));
  return [...new Set(result.filter(Boolean))];
}

function eventHasBotMentionCompat(body) {
  const selfId = String(body?.self_id || "");
  return Boolean(selfId && eventMentionedQqsCompat(body).includes(selfId));
}

function eventPlainTextCompat(body) {
  if (Array.isArray(body?.message)) {
    return body.message
      .filter(part => part?.type === "text")
      .map(part => String(part?.data?.text || ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  return String(body?.raw_message || body?.message || "")
    .replace(/\[CQ:[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function responseMessageId(response) {
  return String(
    response?.message_id ??
    response?.messageId ??
    response?.data?.message_id ??
    response?.data?.messageId ??
    ""
  );
}

export class OneBotHub extends PreviousOneBotHub {
  constructor(state, env) {
    super(state, env);
    this.hotfixFailureNotified = new Set();
  }

  hotfixQuestionId(body) {
    return [
      String(body?.message_type || ""),
      String(body?.group_id || ""),
      String(body?.user_id || ""),
      String(body?.message_id || "")
    ].join(":");
  }

  async sendImmediateThinking(body) {
    if (body?.post_type !== "message" || body?.message_type !== "group") return "";
    if (!eventHasBotMentionCompat(body)) return "";
    const text = eventPlainTextCompat(body);
    if (!text || /^(?:[!！]|\/!)/.test(text)) return "";

    const message = [];
    if (body.message_id !== undefined && body.message_id !== null) {
      message.push({ type: "reply", data: { id: String(body.message_id) } });
    }
    if (body.user_id !== undefined && body.user_id !== null) {
      message.push({ type: "at", data: { qq: String(body.user_id) } });
      message.push({ type: "text", data: { text: " " } });
    }
    message.push({ type: "text", data: { text: "已收到，正在处理..." } });

    const response = await this.sendAction({
      action: "send_group_msg",
      params: { group_id: body.group_id, message, auto_escape: false }
    }, 10000);
    return responseMessageId(response);
  }

  async removeImmediateThinking(messageId) {
    if (!messageId) return;
    await this.sendAction({
      action: "delete_msg",
      params: { message_id: /^\d+$/.test(String(messageId)) ? Number(messageId) : messageId }
    }, 8000);
  }

  async notifyFailureOnce(body, disposition, extra = {}) {
    if (!eventHasBotMentionCompat(body)) return;
    const key = `${this.hotfixQuestionId(body)}:${disposition}`;
    if (this.hotfixFailureNotified.has(key)) return;

    let text = FAILURE_MESSAGES[disposition] || "本次处理发生异常，任务已释放，请稍后重试。";
    if (disposition === "worker_empty_reply" && Number(extra.httpStatus || 0)) {
      text += `（HTTP ${Number(extra.httpStatus)}）`;
    } else if (disposition === "worker_error" && extra.error) {
      text += `（${String(extra.error).slice(0, 160)}）`;
    }

    this.hotfixFailureNotified.add(key);
    if (this.hotfixFailureNotified.size > 300) this.hotfixFailureNotified.clear();
    await this.sendQueueNotice(body, text);
  }

  async runQuestion(key, body, requestUrl, options = {}) {
    let immediateThinkingId = "";
    try {
      immediateThinkingId = await this.sendImmediateThinking(body);
    } catch (error) {
      console.error("v1.3.5 immediate thinking indicator failed", error);
    }

    try {
      return await super.runQuestion(key, body, requestUrl, options);
    } finally {
      if (immediateThinkingId) {
        await this.removeImmediateThinking(immediateThinkingId)
          .catch(error => console.error("v1.3.5 immediate thinking cleanup failed", error));
      }
    }
  }

  async recordIngress(body, disposition, extra = {}) {
    const result = await super.recordIngress(body, disposition, extra);
    if (["worker_error", "worker_empty_reply", "worker_no_reply", "send_failed"].includes(String(disposition))) {
      await this.notifyFailureOnce(body, String(disposition), extra)
        .catch(error => console.error("v1.3.5 failure notice failed", error));
    }
    return result;
  }

  async processInboundEvent(body, requestUrl, options = {}) {
    try {
      return await super.processInboundEvent(body, requestUrl, options);
    } catch (error) {
      if (!options?.signal?.aborted) {
        await this.notifyFailureOnce(body, "uncaught_error", {
          error: String(error?.message || error).slice(0, 200)
        }).catch(notifyError => console.error("v1.3.5 uncaught error notice failed", notifyError));
      }
      throw error;
    }
  }
}
