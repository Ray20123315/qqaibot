import puppeteer from "@cloudflare/puppeteer";

const VERSION = "0.2.5";
const BUILD_DATE = "2026-07-21";
const DEFAULT_DEVELOPER_ID = "3569028262";
const DEFAULTS = Object.freeze({
  deepseekFlashModel: "deepseek-v4-flash",
  deepseekProModel: "deepseek-v4-pro",
  interjectRate: 25,
  contextSummaryThreshold: 6,
  thinkingDelayMs: 1200,
  scheduleMinIntervalMinutes: 1,
  scheduleMaxActivePerUser: 0,
  scheduleMaxPerGroupHour: 0,
  appealEnabled: true,
});

// ==========================================
// 🗄️ D1 資料庫操作小幫手 (模擬 KV 行為)
// ==========================================
async function dbGet(env, key) {
  if (!env || !env.DB) return null; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key);
    const result = await stmt.first();
    return result ? result.value : null;
  } catch (e) {
    console.error(`讀取 DB 失敗 [${key}]:`, e);
    return null;
  }
}

async function dbPut(env, key, value) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value);
    await stmt.run();
  } catch (e) {
    console.error(`寫入 DB 失敗 [${key}]:`, e);
  }
}

async function dbDel(env, key) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key);
    await stmt.run();
  } catch (e) {
    console.error(`刪除 DB 失敗 [${key}]:`, e);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url); // 👈 保留此行，避免後續代碼崩潰！

    // ==========================================
    // 🔌 NapCat / OneBot WebSocket Client 主動回覆入口
    // ==========================================
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket" && ["/onebot", "/ws", "/ws/onebot"].includes(url.pathname)) {
      if (!verifyOneBotAccess(request, env)) return new Response("Unauthorized", { status: 401 });
      return getOneBotHub(env).fetch(request);
    }

    // ==========================================
    // 🎙️ Gemini Live：網頁與 WebSocket
    // ==========================================
    if (url.pathname === "/live") {
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response(getLiveHtmlPage(url.host), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      return handleGeminiLiveUpgrade(request, env);
    }

    // ==========================================
    // 🌌 公共首頁與記憶矩陣中心
    // ==========================================
    if (request.method === 'GET' && ['/', '/portal', '/matrix'].includes(url.pathname)) {
      return new Response(getPortalHomePage(url.host), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (request.method === 'GET' && url.pathname === '/appeal') {
      return new Response(getAppealPage(url.host), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    if (request.method === 'GET' && ['/health', '/healthz'].includes(url.pathname)) {
      return jsonResponse(await buildHealthState(env));
    }

    if (request.method === 'GET' && url.pathname === '/api/public/nebula') {
      return jsonResponse(getPublicNebulaSeed());
    }

    if (url.pathname.startsWith('/api/appeal/')) {
      return handleAppealApi(request, env, url);
    }

    if (url.pathname.startsWith('/api/portal/')) {
      return handlePortalApi(request, env, url);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/request-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const group = "";
      if (!qq) {
        return jsonResponse({ ok: false, message: "请先输入 QQ 号。" }, 400);
      }

      const code = generateSixDigitCode();
      const authKey = `portal_auth_code:${qq}`;
      await dbPut(env, authKey, JSON.stringify({
        code,
        group,
        qq,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      }));

      const sent = await sendOneBotAction(env, {
        action: "send_private_msg",
        params: {
          user_id: qq,
          message: `【QQAIbot 门户登录验证码】\n验证码：${code}\n有效期：5 分钟。\n若非本人操作，请忽略。`,
          auto_escape: false
        },
        echo: `qqai:portal-code:${Date.now()}:${crypto.randomUUID()}`
      });

      if (!sent) {
        return jsonResponse({
          ok: false,
          message: "验证码已生成，但当前没有可用的 NapCat WebSocket 连接。请确认 NapCat WebSocket Client 已连接到 wss://qqai.ray2025.com/onebot 后再试。"
        }, 503);
      }

      return jsonResponse({
        ok: true,
        message: "验证码已发送至该 QQ 私讯，请在 5 分钟内输入。",
        ttl_seconds: 300
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const code = String(payload.code || "").replace(/\D/g, "");
      const raw = await dbGet(env, `portal_auth_code:${qq}`);
      if (!raw) return jsonResponse({ ok: false, message: "验证码不存在或已过期，请重新发送。" }, 400);

      let record;
      try { record = JSON.parse(raw); } catch (e) { record = null; }
      if (!record || Date.now() > record.expiresAt) {
        await dbDel(env, `portal_auth_code:${qq}`);
        return jsonResponse({ ok: false, message: "验证码已过期，请重新发送。" }, 400);
      }

      if (record.code !== code) {
        record.attempts = (record.attempts || 0) + 1;
        if (record.attempts >= 5) await dbDel(env, `portal_auth_code:${qq}`);
        else await dbPut(env, `portal_auth_code:${qq}`, JSON.stringify(record));
        return jsonResponse({ ok: false, message: "验证码错误。" }, 400);
      }

      await dbDel(env, `portal_auth_code:${qq}`);
      const session = await createPortalSession(env, { qq, group: "", groupId: "" });
      return jsonResponse({
        ok: true,
        message: "登录成功，请从下拉选单选择可用群组。",
        qq,
        group: "",
        groupId: "",
        role: session.role,
        permissions: session.permissions || {},
        token: session.token
      });
    }

    // ==========================================
    // 🤖 OneBot 事件入口：預設只接受 Durable Object 內部轉送
    // ==========================================
    if (request.method !== 'POST') return new Response(`🤖 QQAI Worker ${VERSION} 运行正常`, { status: 200 });
    const internalTransport = url.pathname === "/__onebot_event" && request.headers.get("X-QQAI-Transport") === "websocket-do" && verifyOneBotAccess(request, env);
    const httpTransport = ["/onebot/event", "/event"].includes(url.pathname) && env.ENABLE_ONEBOT_HTTP_EVENTS === "true" && verifyOneBotAccess(request, env);
    if (!internalTransport && !httpTransport) return new Response("Not Found", { status: 404 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const rawMessage = String(body.raw_message || (typeof body.message === 'string' ? body.message : ""));
    const botId = body.self_id ? body.self_id.toString() : "";
    const rawUserId = body.user_id ? body.user_id.toString() : "";
    const isSentEvent = body.post_type === "message_sent";
    // message_sent 的 user_id 在不同 OneBot 实现中可能代表收件人；发送者固定视为 self_id。
    const userId = isSentEvent && botId ? botId : rawUserId;
    const isSelfAccount = Boolean(userId && botId && userId === botId);
    let sameQqSelfAsk = false;
    let sameQqHumanOnly = false;

    // Webhook 被动回复工具。长任务会在正式回复前撤回「正在思考...」。
    let activeThinkingMessageId = null;
    const clearThinkingIndicator = async () => {
      if (!activeThinkingMessageId) return;
      const id = activeThinkingMessageId; activeThinkingMessageId = null;
      try { await callOneBotAction(env, { action: 'delete_msg', params: { message_id: numericId(id) } }, 8000); } catch {}
    };
    const jsonReply = (text) => {
      const thinkingMessageId = activeThinkingMessageId;
      activeThinkingMessageId = null;
      return new Response(JSON.stringify({ reply: text, auto_escape: false, thinking_message_id: thinkingMessageId || null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    };

    // 【專用小助手】呼叫 Gemini API (用於獨立工具指令)
    const callGeminiDirectly = async (prompt) => {
      const keysStr = env.GEMINI_API_KEYS || "";
      const apiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k !== "");
      const fallbackModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
      if(apiKeys.length === 0) return null;
      for (const apiKey of apiKeys) {
        for (const model of fallbackModels) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
              signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
              const data = await res.json();
              if (data.candidates?.[0]) return data.candidates[0].content.parts[0].text.replace(/[\*#\-\`~>_]/g, '').trim();
            }
          } catch(e) {}
        }
      }
      return null;
    };

    // 【長期記憶專用】改用 Cloudflare 官方原生免 Key 嵌入模型 (維度 1024)
    const getVector = async (text) => {
      if (!env.AI) return "error_no_cf_ai_binding";
      try {
        const response = await env.AI.run('@cf/baai/bge-m3', {
          text: [text]
        });
        return response.data[0] || null;
      } catch (e) {
        return `error_cf_ai_${e.message}`;
      }
    };

    // 【多模态附件】限制大小、类型与私有地址，避免耗尽 Worker 资源。
    const fetchImageAsBase64 = async (targetUrl) => {
      const item = await fetchMediaAsBase64(targetUrl, 8 * 1024 * 1024, ["image/"]);
      return item ? { base64: item.base64, mimeType: item.mimeType } : null;
    };
    const fetchAudioAsBase64 = async (targetUrl) => fetchMediaAsBase64(targetUrl, 12 * 1024 * 1024, ["audio/", "application/octet-stream"]);
    const fetchVideoAsBase64 = async (targetUrl) => fetchMediaAsBase64(targetUrl, 25 * 1024 * 1024, ["video/", "application/octet-stream"]);

    // ==========================================
    // 🚀 主邏輯業務區
    // ==========================================
    try {
      const currentGroupId = body.group_id ? body.group_id.toString() : "";
      if (!['message', 'message_sent'].includes(body.post_type)) return new Response(null, { status: 204 });

      // 🕒 獲取當前伺服器的真實時間（台北時間）
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Taipei' });
      const isGroup = body.message_type === 'group';
      const isPrivate = body.message_type === 'private';
      
      // 🎯 【就在這裡補上這行宣告！】
      const sessionKey = isGroup ? `chat:group:${currentGroupId}` : `chat:private:${userId}`;

      // ==========================================
      // 💬 D1 歷史紀錄讀取 (維持上下文記憶)
      // ==========================================
      let history = [];
      try {
        // 這裡因為上面已經定義了 sessionKey，所以絕對不會再報 defined 錯誤！
        const historyData = await dbGet(env, sessionKey);
        if (historyData) {
          history = JSON.parse(historyData);
          console.log(`🧠 成功載入歷史記憶，當前記憶條數: ${history.length}`);
        }
      } catch (historyError) {
        console.error("讀取 D1 歷史紀錄失敗:", historyError);
        history = []; 
      }
      
      // 精準提取群組身分
      const senderCard = body.sender?.card || body.sender?.nickname || userId;
      const senderRole = body.sender?.role || "member"; 
      const isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";
      const roleName = senderRole === "owner" ? "群主" : (senderRole === "admin" ? "管理员" : "群友");
      if (isGroup && userId) {
        ctx.waitUntil(upsertGroupMember(env, currentGroupId, {
          qq: userId,
          name: senderCard,
          role: isDeveloper ? "developer" : senderRole,
          groupName: String(body.group_name || currentGroupId)
        }));
      }

      // ========================================================
      // 📦 【智慧型訊息結構解析器】完美兼容還原 AT 節點、圖片、語音、影片
      // ========================================================
      let userMessage = "";
      let imageUrl = null;
      let voiceUrl = null;
      let videoUrl = null;
      let mentionedQqs = [];
      let replyMessageId = body.message_id ? body.message_id.toString() : "";
      let quotedMessageId = "";
      let quotedMessageText = "";

      if (typeof body.message === "string") {
        userMessage = body.raw_message || body.message || "";
        mentionedQqs = [...userMessage.matchAll(/\[CQ:at,qq=(\d+|all)\]/g)].map(m => m[1]);
        const replyMatch = userMessage.match(/\[CQ:reply,[^\]]*id=([^,\]]+)/);
        quotedMessageId = replyMatch ? replyMatch[1] : "";
        const imgUrlMatch = userMessage.match(/\[CQ:image,[^\]]*url=([^,\]]+)/);
        imageUrl = imgUrlMatch ? imgUrlMatch[1] : null;
        const voiceUrlMatch = userMessage.match(/\[CQ:record,[^\]]*url=([^,\]]+)/);
        voiceUrl = voiceUrlMatch ? voiceUrlMatch[1] : null;
        const videoUrlMatch = userMessage.match(/\[CQ:video,[^\]]*url=([^,\]]+)/);
        videoUrl = videoUrlMatch ? videoUrlMatch[1] : null;
      } else if (Array.isArray(body.message)) {
        for (const part of body.message) {
          if (part.type === "text") {
            userMessage += part.data.text;
          } else if (part.type === "at") {
            userMessage += `[CQ:at,qq=${part.data.qq}]`;
            mentionedQqs.push(String(part.data.qq));
          } else if (part.type === "reply") {
            quotedMessageId = String(part.data.id || part.data.message_id || "");
            userMessage += quotedMessageId ? `[CQ:reply,id=${quotedMessageId}]` : "";
            quotedMessageText = part.data.text || part.data.message || "";
          } else if (part.type === "image") {
            imageUrl = part.data.url || part.data.file || null;
          } else if (part.type === "video") {
            videoUrl = part.data.url || part.data.file || null;
          } else if (part.type === "record") {
            voiceUrl = part.data.url || part.data.file || null;
          }
        }
      }
      mentionedQqs = [...new Set(mentionedQqs.filter(Boolean).map(String))];

      // 清洗 CQ 標籤，保留媒體存在的語意提示。
      let cleanMessage = userMessage
        .replace(/\[CQ:reply,[^\]]+\]/g, '')
        .replace(/\[CQ:at,qq=(\d+)\]/g, '@$1 ')
        .replace(/\[CQ:at,qq=all\]/g, '@全体成员 ')
        .replace(/\[CQ:image,[^\]]+\]/g, '【系统：此位置有一张真实图片附件】')
        .replace(/\[CQ:record,[^\]]+\]/g, '【系统：此位置有一条真实语音附件】')
        .replace(/\[CQ:video,[^\]]+\]/g, '【系统：此位置有一段真实视频附件】')
        .trim();

      // 同 QQ 模式：以 Message ID 與傳送前指紋判斷 API 發言，人工指令仍可使用。
      if (isSelfAccount) {
        if (!isSentEvent) return new Response(null, { status: 204 });
        const apiMessage = await isKnownOutboundMessage(env, {
          messageId: replyMessageId,
          isGroup,
          groupId: currentGroupId,
          peerId: String(body.target_id || body.peer_id || rawUserId || userId),
          text: cleanMessage,
          mediaTypes: [imageUrl ? 'image' : '', voiceUrl ? 'record' : '', videoUrl ? 'video' : ''].filter(Boolean)
        });
        if (apiMessage) return new Response(null, { status: 204 });

        if (cleanMessage.startsWith('//')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqHumanOnly = true;
        } else if (cleanMessage.startsWith('??')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqSelfAsk = true;
        } else if (!/^[!！]/.test(cleanMessage)) {
          sameQqHumanOnly = true;
        }
      }

      let msgLower = cleanMessage.trim().toLowerCase();
      let atSender = isGroup ? `[CQ:at,qq=${userId}] ` : "";
      const isCommandMessage = /^[!！]/.test(cleanMessage);
      const commandBody = cleanMessage.replace(/^[!！]+/, '').trim();
      const isAppealCommand = /^(申诉|申訴|appeal)(?:\s|$)/i.test(commandBody);
      const isScheduleCommand = /^(排程|定时|定時|schedule)(?:\s|$)/i.test(commandBody);

      // 先解析明确触发关系。非白名单群的普通聊天必须完全静默，不能见人就提示。
      let quotedMessage = null;
      if (quotedMessageId) {
        quotedMessage = await getQuotedMessage(env, currentGroupId, quotedMessageId);
        quotedMessageText = quotedMessage?.text || quotedMessageText || "";
      }
      const botMentioned = mentionedQqs.includes(botId);
      const repliedToBot = Boolean(quotedMessage && (quotedMessage.source === 'ai' || String(quotedMessage.senderId || '') === botId));
      const explicitlyTriggered = botMentioned || repliedToBot || sameQqSelfAsk || isCommandMessage;

      // 白名單是群 AI 的硬入口；非白名單群不呼叫模型、不寫入記憶。
      if (isGroup && !(await isGroupWhitelisted(env, currentGroupId))) {
        const whitelistAdminCommand = isDeveloper && /^(群白名单|群白名單|删群白名单|刪群白名單|allowgroup|removegroup)(?:\s|$)/i.test(commandBody);
        const applicationCommand = /^(申请白名单|申請白名單)(?:\s|$)/i.test(commandBody);
        const helpCommand = /^(help|帮助|幫助)$/.test(commandBody.toLowerCase());
        const allowedEntryCommand = whitelistAdminCommand || applicationCommand || helpCommand;
        if (!allowedEntryCommand) {
          // 没有 @、没有回复机器人、不是同号 ?? 提问，也不是命令：直接忽略。
          if (!explicitlyTriggered) return new Response(null, { status: 204 });
          const onceKey = `notice:not_whitelisted:${currentGroupId}:${userId}`;
          if (!(await dbGet(env, onceKey))) {
            await dbPut(env, onceKey, String(Date.now()));
            return jsonReply(`${atSender}本群尚未加入 AI 白名单，请联系开发者。`);
          }
          return new Response(null, { status: 204 });
        }
      }

      // 私聊聊天、私聊排程、匿名申訴各自使用獨立開關。
      if (isPrivate && !isDeveloper) {
        const privateMode = await getPrivateAccessMode(env, userId);
        const privateChatEnabled = await getFeatureFlag(env, 'private_chat_enabled', false);
        const privateScheduleEnabled = await getFeatureFlag(env, 'private_schedule_enabled', false);
        const appealEnabled = await getFeatureFlag(env, 'private_appeal_enabled', DEFAULTS.appealEnabled);
        if (isAppealCommand && appealEnabled) {
          // 放行匿名申訴。
        } else if (isScheduleCommand && privateScheduleEnabled && privateMode !== 'none') {
          // 私聊排程與聊天開關分離。
        } else if (!privateChatEnabled || privateMode === 'none') {
          return new Response(null, { status: 204 });
        } else if (privateMode === 'commands' && !isCommandMessage) {
          return new Response(null, { status: 204 });
        }
      } else if (!isGroup && !isPrivate) {
        return new Response(null, { status: 204 });
      }

      // 引用訊息已在白名单入口前解析，确保普通群消息不会误触发提示。
      const targetMentionQqs = mentionedQqs.filter(q => q !== botId && q !== 'all');
      const mentionContext = mentionedQqs.length > 0
        ? `当前消息明确提及：${mentionedQqs.map(q => q === botId ? `机器人账号 QQ:${q}` : q === 'all' ? '全体成员' : `成员 QQ:${q}`).join('、')}`
        : "";
      const quoteContext = quotedMessageId
        ? `当前消息引用了 ${quotedMessage?.senderName || '未知成员'}（QQ:${quotedMessage?.senderId || '未知'}）的消息：${quotedMessageText ? `「${quotedMessageText}」` : '未能取得正文'}。用户当前正文与引用内容必须分开理解。`
        : "";
      const relationContext = [quoteContext, mentionContext].filter(Boolean).join("\n");

      // 權限拆分：AI 管理與真正群操作互不混用。
      const permissionSet = await getEffectivePermissions(env, currentGroupId, userId, senderRole, isDeveloper);
      const hasAdminAuth = permissionSet.aiAdmin;
      const hasGroupOpsAuth = permissionSet.groupOps;
      const isOnlyMe = isDeveloper;

      // 同號人工普通發言只納入上下文，不觸發 AI；人工命令與 ?? 提問可繼續。
      if (sameQqHumanOnly) {
        await recordStructuredMessage(env, {
          groupId: currentGroupId, userId, senderName: senderCard, messageId: replyMessageId,
          text: cleanMessage, mentions: mentionedQqs, replyId: quotedMessageId, source: 'owner-human'
        });
        return new Response(null, { status: 204 });
      }

      // 敏感詞過濾：內建底線 + 群務面板設定。
      const groupKeywords = await readJson(env, `keyword_filter:${currentGroupId}`, []);
      const sensitiveWords = ['习近平', '六四', '台独', '法轮功', ...groupKeywords];
      if (sensitiveWords.some(word => cleanMessage.includes(word))) return new Response(null, { status: 204 });

      // 🎲 插話每日上限不設限，只保留概率、冷卻與免打擾。
      const interjectChance = Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${currentGroupId}`) || String(DEFAULTS.interjectRate)))) / 100;
      const requiresAiJudgment = true;
      const isImitationGlobal = true;

      // 🛠️ 萬用指令參數解析器：優先使用非機器人的 @，亦支援直接 QQ 號。
      const parseArgs = (rawMessage, prefix) => {
        const lowerRaw = String(rawMessage || '').toLowerCase();
        const index = lowerRaw.indexOf(String(prefix || '').toLowerCase());
        const rawArgs = (index >= 0 ? rawMessage.slice(index + prefix.length) : rawMessage).trim();
        const directNumber = rawArgs.replace(/\[CQ:[^\]]+\]/g, '').trim().match(/^(\d{5,})\b/);
        const targetQq = targetMentionQqs[0] || directNumber?.[1] || null;
        let restText = rawArgs
          .replace(/\[CQ:at,qq=(\d+|all)\]/g, '')
          .replace(/^\d{5,}\b/, '')
          .replace(/\[CQ:[^\]]+\]/g, '')
          .trim();
        return { targetQq, targetQqs: targetMentionQqs.slice(), restText };
      };

      if (/^[!！]指令(开|開|关|關)\b/.test(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}❌ 只有群主、管理员或开发者可以切换网页设定指令权限。`);
        const enable = /^[!！]指令(开|開)\b/.test(msgLower);
        if (enable) await dbDel(env, `web_command_off:${currentGroupId}`);
        else await dbPut(env, `web_command_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}${enable ? "✅ 已开启" : "⛔ 已关闭"}可修改网页设定的 ! 指令。`);
      }

      if (await dbGet(env, `web_command_off:${currentGroupId}`) === "true" && commandChangesWebSettings(userMessage)) {
        return jsonReply(`${atSender}⛔ 本群已关闭可修改网页设定的 ! 指令，请改到门户网页调整，或由管理员使用 !指令开 重新开启。`);
      }

      // ==========================================
      // 🛑 防禦陣線
      // ==========================================
      if (!userMessage || userMessage.trim() === "") {
        console.log(`⚠️ 偵測到群友 ${userId} 僅 @機器人 但未輸入有效內容，自動快速攔截。`);
        return new Response(null, { status: 204 });
      }

      // ⏳ Cloudflare 原生速率限制器 (10秒冷卻鎖) - 開發者、群主、管理員豁免
      const isBypassCooldown = isDeveloper || senderRole === 'owner' || senderRole === 'admin';
      if (!isBypassCooldown && env.MY_RATE_LIMITER) {
        const rateLimitKey = isGroup ? `${currentGroupId}:${userId}` : `private:${userId}`;
        const { success } = await env.MY_RATE_LIMITER.limit({ key: rateLimitKey });
        if (!success) {
          console.log(`⏳ 用戶 ${userId} 頻繁調用，觸發冷卻限制，自動裝死。`);
          return new Response(null, { status: 204 });
        }
      }

      // ==========================================
      // 🤖 依據 AI Studio 權限清單與最新模型庫對齊
      // ==========================================
      const chatModels = parseList(env.GEMINI_CHAT_MODELS, [
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
      ]);
      const imageModels = parseList(env.GEMINI_IMAGE_MODELS, []);
      const imagenModels = parseList(env.IMAGEN_MODELS, [
        'imagen-4.0-fast-generate-001',
        'imagen-4.0-generate-001',
        'imagen-4.0-ultra-generate-001'
      ]);
      const ttsModels = parseList(env.GEMINI_TTS_MODELS, [
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-flash-preview-tts'
      ]);
      const modelList = chatModels;


      // 第一段到此完美結束，準備進入第二段的基礎系統指令與生圖路由控制模組...

      // ==========================================
      // 🎨 图片生成：使用独立图片模型，不混入文字模型轮询。
      if (/^[!！](?:画图|畫圖|draw)\s+(.+)/i.test(cleanMessage)) {
        const prompt = cleanMessage.match(/^[!！](?:画图|畫圖|draw)\s+(.+)/i)?.[1]?.trim() || "";
        if (!prompt) return jsonReply(`${atSender}请告诉我想画什么。`);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在生成图片..." }).catch(() => null);
        const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
        if (!keys.length) return jsonReply(`${atSender}尚未配置 Gemini API 金钥。`);
        let lastError = "没有可用结果";
        for (const model of imageModels) {
          for (const key of keys) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
                signal: AbortSignal.timeout(45000)
              });
              if (!res.ok) { lastError = `${model}: ${res.status}`; continue; }
              const data = await res.json();
              const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data || p.inline_data?.data);
              const inline = part?.inlineData || part?.inline_data;
              if (inline?.data) return jsonReply(`${atSender}[CQ:image,file=base64://${inline.data}]`);
              lastError = `${model}: 未返回图片`;
            } catch (error) { lastError = error.message || String(error); }
          }
        }
        // 当前项目的 Nano Banana 免费额度可能为 0；继续使用 Imagen 4 的独立免费 RPD。
        let imagenPrompt = prompt;
        try {
          const translated = await callGemmaDecision(env, {
            system: "将用户的绘图提示准确翻译成英文。保留人物、场景、风格、构图、文字内容与限制；只输出英文提示词，不要解释。",
            prompt,
            maxOutputTokens: 300
          });
          if (translated.text) imagenPrompt = translated.text;
        } catch {}
        for (const model of imagenModels) {
          for (const key of keys) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": key },
                body: JSON.stringify({
                  instances: [{ prompt: imagenPrompt }],
                  parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "allow_adult" }
                }),
                signal: AbortSignal.timeout(60000)
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) { lastError = `${model}: ${res.status} ${data?.error?.message || ""}`.trim(); continue; }
              const prediction = data.predictions?.[0] || data.generatedImages?.[0] || {};
              const base64 = prediction.bytesBase64Encoded || prediction.bytes_base64_encoded || prediction.image?.imageBytes || prediction.image?.image_bytes;
              if (base64) return jsonReply(`${atSender}[CQ:image,file=base64://${base64}]`);
              lastError = `${model}: 未返回图片`;
            } catch (error) { lastError = `${model}: ${error.message || String(error)}`; }
          }
        }
        return jsonReply(`${atSender}图片生成失败：${lastError}`);
      }

      // 💖 【高情商情緒微調器】(取代卑微順從，提供情緒價值安慰)
      // ==========================================
      const botAtTag = `[CQ:at,qq=${botId}]`;
      const isAtMeOrAi = botMentioned || sameQqSelfAsk || repliedToBot;
      
      // 私聊必定是對機器人說，群聊則看是否有提及
      if (isAtMeOrAi || isPrivate) {
        const sadWords = ['难过', '烦死了', '不开心', '想哭', '抑郁', '痛苦', '累了', '心累', '成绩差', '考砸'];
        const argueWords = ['我才不是', '才没有', '你乱讲', '不懂我', '闭嘴', '别吵'];
        
        if (sadWords.some(w => msgLower.includes(w))) {
          // 寫入溫柔安撫備忘錄 (短效 BUFF，下次聊天即刻生效)
          await dbPut(env, `emotion_buff:${currentGroupId}:${userId}`, "【情绪警告】该用户目前心情非常低落/难过。你接下来的回复必须化身温柔的大哥哥/大姐姐，展现极高的同理心，温柔地安慰他/她，提供满满的情绪价值，绝对不要开玩笑或讽刺。");
        } else if (argueWords.some(w => msgLower.includes(w))) {
          // 寫入自我修復/退讓備忘錄 (高情商化解反駁)
          await dbPut(env, `emotion_buff:${currentGroupId}:${userId}`, "【自我修正备忘】该用户对刚才的话题产生了抗拒或反驳。请展现高情商，温柔地顺着台阶下，安抚对方的情绪，表达你完全理解并支持他/她的真实想法，绝对不要争辩对错。");
        }
      }

      // ==========================================
      // 🔑 權限管理與開發者動態調整指令
      // ==========================================
      // !自我调整 / !self-adjust
      if (['!自我调整', '!自我調整', '!self-adjust', '！自我调整', '！自我調整'].includes(msgLower)) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 严重越权：只有最高核心开发者本人拥有此微调特权。`);
        await dbPut(env, `sys_mode:${currentGroupId}`, "adjust");
        return jsonReply(`${atSender}⚙️ 开发者身份确认。成功开启自我调整模式，系统进入动态参数微调状态。`);
      }

      // !自我修正 / !self-correct
      if (['!自我修正', '!自我修正', '!self-correct', '！自我修正', '！自我修正'].includes(msgLower)) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 严重越权：只有最高核心开发者本人拥有此指令修正特权。`);
        await dbPut(env, `sys_mode:${currentGroupId}`, "normal");
        return jsonReply(`${atSender}⚙️ 开发者身份确认。成功执行核心自我修正，运行配置已初始化回归正常环境。`);
      }

      // 舊指令相容：!给权限 / !删权限 僅由開發者使用，預設對應 AI 管理權。
      if (['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以授予权限。`);
        const prefix = ['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!给权限 @成员`);
        await setExplicitPermission(env, currentGroupId, targetQq, 'ai_admin', true);
        return jsonReply(`${atSender}已授予 QQ:${targetQq} AI 管理权限。`);
      }

      if (['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以撤销权限。`);
        const prefix = ['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!删权限 @成员`);
        await setExplicitPermission(env, currentGroupId, targetQq, 'ai_admin', false);
        return jsonReply(`${atSender}已撤销 QQ:${targetQq} AI 管理权限。`);
      }

      // !禁记忆 / !解禁记忆
      if (['!禁记忆', '!禁記憶', '!banmemory', '！禁记忆', '！禁記憶'].some(p => msgLower.startsWith(p))) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 只有最高开发者可以冻结网页端记忆编辑权。`);
        const prefix = ['!禁记忆', '!禁記憶', '!banmemory', '！禁记忆', '！禁記憶'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定要冻结的 QQ，例如: !禁记忆 @某人`);
        await dbPut(env, `memory_banned:${targetQq}`, "true");
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "冻结记忆编辑权", before: targetQq, after: "memory_banned=true" });
        return jsonReply(`${atSender}🧊 已冻结 QQ:${targetQq} 的记忆编辑权限。`);
      }

      if (['!解禁记忆', '!解禁記憶', '!unbanmemory', '！解禁记忆', '！解禁記憶'].some(p => msgLower.startsWith(p))) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 只有最高开发者可以恢复网页端记忆编辑权。`);
        const prefix = ['!解禁记忆', '!解禁記憶', '!unbanmemory', '！解禁记忆', '！解禁記憶'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定要解冻的 QQ，例如: !解禁记忆 @某人`);
        await dbDel(env, `memory_banned:${targetQq}`);
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "恢复记忆编辑权", before: targetQq, after: "memory_banned=false" });
        return jsonReply(`${atSender}✅ 已恢复 QQ:${targetQq} 的记忆编辑权限。`);
      }

      // ==========================================
      // 🧩 v0.2 權限、模型、排程、申訴與群操作
      // ==========================================

      if (/^[!！](?:申请白名单|申請白名單)(?:\s|$)/.test(cleanMessage)) {
        if (!isGroup) return jsonReply('该命令只能在群聊中使用。');
        const id = crypto.randomUUID();
        const item = { id, groupId: currentGroupId, applicantId: userId, applicantName: senderCard, at: new Date().toISOString(), status: 'pending' };
        await dbPut(env, `whitelist_request:${id}`, JSON.stringify(item));
        await appendIndex(env, 'whitelist_request:index', id, 500);
        await notifyDeveloper(env, `【群白名单申请】\n编号：${id}\n群号：${currentGroupId}\n申请人：${senderCard}（${userId}）`);
        return jsonReply(`${atSender}白名单申请已提交，编号：${id}`);
      }

      if (/^[!！](?:授权|授權|permission)\b/i.test(cleanMessage)) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以授予额外权限。`);
        const prefix = cleanMessage.match(/^[!！](?:授权|授權|permission)/i)?.[0] || '!授权';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const permission = normalizePermissionName(restText);
        if (!targetQq || !permission) return jsonReply(`${atSender}格式：!授权 @成员 AI管理／群操作／排程审核／申诉审核／私聊完整／私聊指令`);
        await setExplicitPermission(env, currentGroupId, targetQq, permission, true);
        return jsonReply(`${atSender}已授予 QQ:${targetQq}「${permissionLabel(permission)}」权限。`);
      }

      if (/^[!！](?:撤销授权|撤銷授權|取消授权|取消授權|revokepermission)\b/i.test(cleanMessage)) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以撤销额外权限。`);
        const prefix = cleanMessage.match(/^[!！](?:撤销授权|撤銷授權|取消授权|取消授權|revokepermission)/i)?.[0] || '!撤销授权';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const permission = normalizePermissionName(restText);
        if (!targetQq || !permission) return jsonReply(`${atSender}格式：!撤销授权 @成员 AI管理／群操作／排程审核／申诉审核／私聊完整／私聊指令`);
        await setExplicitPermission(env, currentGroupId, targetQq, permission, false);
        return jsonReply(`${atSender}已撤销 QQ:${targetQq}「${permissionLabel(permission)}」权限。`);
      }

      if (/^[!！](?:模型|model)(?:\s|$)/i.test(cleanMessage)) {
        const raw = cleanMessage.replace(/^[!！](?:模型|model)/i, '').trim();
        if (!raw) {
          const pref = await dbGet(env, `model_pref:${currentGroupId || 'private'}:${userId}`) || 'auto';
          return jsonReply(`${atSender}当前模型偏好：${modelPreferenceLabel(pref)}\n可选：自动、Gemini、DeepSeek、DeepSeek High、DeepSeek Max`);
        }
        const pref = normalizeModelPreference(raw);
        if (!pref) return jsonReply(`${atSender}可选：!模型 自动／Gemini／DeepSeek／DeepSeek High／DeepSeek Max`);
        await dbPut(env, `model_pref:${currentGroupId || 'private'}:${userId}`, pref);
        return jsonReply(`${atSender}模型偏好已保存：${modelPreferenceLabel(pref)}`);
      }

      if (/^[!！](?:申诉|申訴|appeal)(?:\s|$)/i.test(cleanMessage)) {
        if (!isPrivate) return jsonReply(`${atSender}为保护匿名，请私聊发送申诉。`);
        const appealText = cleanMessage.replace(/^[!！](?:申诉|申訴|appeal)/i, '').trim();
        if (!appealText) return jsonReply('格式：!申诉 群号 类型 详细内容');
        const created = await createAppealFromText(env, userId, appealText);
        if (!created.ok) return jsonReply(created.message);
        await notifyDeveloper(env, `【匿名申诉待处理】\n案件编号：${created.appeal.id}\n群号：${created.appeal.groupId}\n类型：${created.appeal.type}\n请到 Portal Root 指定审核人。`);
        return jsonReply(`匿名申诉已提交。案件编号：${created.appeal.id}\n除开发者外，审核者不会看到你的 QQ。`);
      }

      if (/^[!！](?:申诉状态|申訴狀態|appealstatus)(?:\s|$)/i.test(cleanMessage)) {
        const id = cleanMessage.replace(/^[!！](?:申诉状态|申訴狀態|appealstatus)/i, '').trim();
        const appeal = id ? await readJson(env, `appeal:${id}`, null) : null;
        if (!appeal || appeal.applicantId !== userId) return jsonReply('找不到属于你的申诉案件。');
        return jsonReply(`案件 ${id}\n状态：${appeal.status}\n处理结果：${appeal.result || '尚未处理'}`);
      }

      if (/^[!！](?:排程|定时|定時|schedule)(?:\s|$)/i.test(cleanMessage)) {
        const scheduleText = cleanMessage.replace(/^[!！](?:排程|定时|定時|schedule)/i, '').trim();
        if (/^(列表|清单|清單|list)$/i.test(scheduleText)) {
          const list = await listUserSchedules(env, userId, currentGroupId);
          return jsonReply(`${atSender}${list.length ? list.map(formatScheduleLine).join('\n') : '目前没有排程。'}`);
        }
        const cancelMatch = scheduleText.match(/^(?:取消|删除|刪除|cancel)\s+([\w-]+)/i);
        if (cancelMatch) {
          const result = await cancelSchedule(env, cancelMatch[1], userId, isDeveloper || hasAdminAuth);
          return jsonReply(`${atSender}${result.message}`);
        }
        const scheduleGroupId = isGroup ? currentGroupId : (await dbGet(env, `private_default_group:${userId}`) || '');
        if (!scheduleGroupId) return jsonReply('请先在 Portal 选择默认群组，或在群聊中建立排程。');
        if (!(await isGroupWhitelisted(env, scheduleGroupId))) return jsonReply('目标群不在 AI 白名单中。');
        const parsedSchedule = parseScheduleRequest(scheduleText, Date.now());
        if (!parsedSchedule.ok) return jsonReply(parsedSchedule.message);
        const activeCount = await countActiveSchedulesForUser(env, userId);
        if (!isDeveloper && DEFAULTS.scheduleMaxActivePerUser > 0 && activeCount >= DEFAULTS.scheduleMaxActivePerUser) return jsonReply(`有效排程数量已达上限。`);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: '正在审查排程...' }).catch(() => null);
        const review = await reviewScheduleWithGemma(env, JSON.stringify(parsedSchedule));
        if (review.decision === 'reject') return jsonReply(`排程已拒绝：${review.reason || '内容疑似违规或滥用。'}`);
        const managementAction = parseManagementScheduleAction(parsedSchedule.content);
        const mayDirectManage = permissionSet.groupOps;
        const status = managementAction && !mayDirectManage ? 'pending_owner' : review.decision === 'uncertain' ? 'pending_owner' : 'active';
        const record = await createScheduleRecord(env, {
          groupId: scheduleGroupId, creatorId: userId, creatorName: senderCard,
          source: isPrivate ? 'private' : 'group', status, review,
          managementAction, ...parsedSchedule
        });
        if (status === 'pending_owner') {
          await notifyDeveloper(env, `【排程待审核】\n编号：${record.id}\n群号：${record.groupId}\n申请人：${record.creatorName}（${record.creatorId}）\n内容：${record.content}\n请在 Root 面板自行审核或指定审核人。`);
          return jsonReply(`${atSender}排程已提交审核，编号：${record.id}`);
        }
        return jsonReply(`${atSender}排程已建立：${formatScheduleLine(record)}`);
      }

      // 真正群操作：原生管理、群主、开发者或被授予 group_ops 的 QQ。
      if (/^[!！](?:禁言|mute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:禁言|mute)/i)?.[0] || '!禁言';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!禁言 @成员 10分`);
        const duration = parseDurationSeconds(restText || '10分');
        const result = await runOneBotGroupOperation(env, 'set_group_ban', { group_id: numericId(currentGroupId), user_id: numericId(targetQq), duration }, { actorId: userId, groupId: currentGroupId, targetId: targetQq, action: '禁言' });
        return jsonReply(`${atSender}${result.ok ? `已禁言 QQ:${targetQq}，时长 ${formatDuration(duration)}。` : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:解禁|unmute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:解禁|unmute)/i)?.[0] || '!解禁';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!解禁 @成员`);
        const result = await runOneBotGroupOperation(env, 'set_group_ban', { group_id: numericId(currentGroupId), user_id: numericId(targetQq), duration: 0 }, { actorId: userId, groupId: currentGroupId, targetId: targetQq, action: '解禁' });
        return jsonReply(`${atSender}${result.ok ? `已解除 QQ:${targetQq} 的禁言。` : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:踢出|踢人|kick)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:踢出|踢人|kick)/i)?.[0] || '!踢出';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!踢出 @成员`);
        const result = await runOneBotGroupOperation(env, 'set_group_kick', { group_id: numericId(currentGroupId), user_id: numericId(targetQq), reject_add_request: false }, { actorId: userId, groupId: currentGroupId, targetId: targetQq, action: '踢出' });
        return jsonReply(`${atSender}${result.ok ? `已将 QQ:${targetQq} 移出群聊。` : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:撤回|recall)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        if (!quotedMessageId) return jsonReply(`${atSender}请先回复需要撤回的消息，再发送 !撤回`);
        const result = await runOneBotGroupOperation(env, 'delete_msg', { message_id: numericId(quotedMessageId) }, { actorId: userId, groupId: currentGroupId, targetId: quotedMessageId, action: '撤回' });
        return jsonReply(`${atSender}${result.ok ? '已尝试撤回该消息。' : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:全员禁言|全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const result = await runOneBotGroupOperation(env, 'set_group_whole_ban', { group_id: numericId(currentGroupId), enable: true }, { actorId: userId, groupId: currentGroupId, action: '全员禁言' });
        return jsonReply(`${atSender}${result.ok ? '已开启全员禁言。' : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:解除全员禁言|解除全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const result = await runOneBotGroupOperation(env, 'set_group_whole_ban', { group_id: numericId(currentGroupId), enable: false }, { actorId: userId, groupId: currentGroupId, action: '解除全员禁言' });
        return jsonReply(`${atSender}${result.ok ? '已解除全员禁言。' : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:改群名|设置群名|設定群名)\s+/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const name = cleanMessage.replace(/^[!！](?:改群名|设置群名|設定群名)\s+/i, '').trim().slice(0, 60);
        const result = await runOneBotGroupOperation(env, 'set_group_name', { group_id: numericId(currentGroupId), group_name: name }, { actorId: userId, groupId: currentGroupId, action: '改群名' });
        return jsonReply(`${atSender}${result.ok ? `群名称已修改为：${name}` : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:改名片|设置名片|設定名片)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:改名片|设置名片|設定名片)/i)?.[0] || '!改名片';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq || !restText) return jsonReply(`${atSender}格式：!改名片 @成员 新名片`);
        const result = await runOneBotGroupOperation(env, 'set_group_card', { group_id: numericId(currentGroupId), user_id: numericId(targetQq), card: restText.slice(0, 60) }, { actorId: userId, groupId: currentGroupId, targetId: targetQq, action: '改名片' });
        return jsonReply(`${atSender}${result.ok ? `已修改 QQ:${targetQq} 的群名片。` : `操作失败：${result.error}`}`);
      }

      if (/^[!！]live$/i.test(cleanMessage)) {
        return jsonReply(`${atSender}🎙️ 即时语音通话：https://qqai.ray2025.com/live`);
      }

      if (/^[!！](?:群状态|群狀態|groupstatus)$/i.test(cleanMessage)) {
        const aiOn = await dbGet(env, `ai_off:${currentGroupId}`) !== 'true';
        const memoryOn = await dbGet(env, `memo:${currentGroupId}`) !== 'false';
        const persona = await dbGet(env, `group_persona:${currentGroupId}`) || '默认';
        const rate = Number(await dbGet(env, `interject_rate:${currentGroupId}`) || DEFAULTS.interjectRate);
        return jsonReply(`${atSender}【群状态】\nAI：${aiOn ? '开启' : '关闭'}\n长期记忆：${memoryOn ? '开启' : '关闭'}\n插话率：${rate}%（每日上限无限）\n群人格：${persona}`);
      }

      if (/^[!！](?:设置插话率|設定插話率|設置插話率)\s+\d+/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}你没有 AI 管理权限。`);
        const rate = Math.max(0, Math.min(100, Number(cleanMessage.match(/\d+/)?.[0] || 0)));
        await dbPut(env, `interject_rate:${currentGroupId}`, String(rate));
        await writeSystemAudit(env, { type: 'ai_settings', groupId: currentGroupId, actorId: userId, action: `interject_rate:${rate}` });
        return jsonReply(`${atSender}插话率已设为 ${rate}%，每日插话上限无限。`);
      }

      if (/^[!！](?:清空群上下文|清除群上下文)$/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}你没有 AI 管理权限。`);
        await dbDel(env, `chat:group:${currentGroupId}`);
        await dbDel(env, `context_summary:chat:group:${currentGroupId}`);
        await writeSystemAudit(env, { type: 'context', groupId: currentGroupId, actorId: userId, action: 'clear_group_context' });
        return jsonReply(`${atSender}已清空本群短期上下文与 DeepSeek 摘要；Vectorize 历史向量保留。`);
      }

      // ==========================================
      // 📜 基础系统帮助与状态模组 (权限阶梯动态版)
      // ==========================================
      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {
        const isSuperAuth = senderRole === 'owner' || isDeveloper;
        let roleTxt = isOnlyMe ? '【👑 最高主宰: 开发者】' :
                      senderRole === 'owner' ? '【💠 最高权限: 群主】' :
                      senderRole === 'admin' ? '【🛡️ QQ管理员】' :
                      permissionSet.groupOps && permissionSet.aiAdmin ? '【🛡️ AI管理＋群操作】' :
                      permissionSet.groupOps ? '【🛡️ 群操作权限】' :
                      permissionSet.aiAdmin ? '【🧠 AI管理权限】' : '【👤 群成员】';

        let helpMsg = `🤖 QQAI 机器人指令清单 ${roleTxt}\n` +
                      `🌐 门户首页：https://qqai.ray2025.com/\n` +
                      `🎙️ Live：https://qqai.ray2025.com/live\n` +
                      `📝 匿名申诉：https://qqai.ray2025.com/appeal\n\n` +
                      `🔹 [日常与多模态]\n` +
                      `!live (取得即时语音网页)\n` +
                      `!status / !配额 (系统状态)\n` +
                      `!模型 [自动/Gemini/DeepSeek/DeepSeek High/DeepSeek Max]\n` +
                      `!语音 [问题] (语音回覆)\n` +
                      `!画图 [提示词] (生成图片)\n` +
                      `!读网页 [网址] (提取精华摘要)\n` +
                      `!翻译 [语言] [内容]\n` +
                      `!截图 [网址] (获取网页快照)\n\n` +
                      `🔹 [娱乐与分析]\n` +
                      `!会议纪要 [数字] (提取重点结论)\n` +
                      `!总结 [数字] (八卦轻松吃瓜)\n` +
                      `!查成分 [@成员] (AI属性分析)\n` +
                      `!模仿 [@成员] (全群灵魂窃取)\n\n` +
                      `🔹 [专属记忆与个人设置]\n` +
                      `!群规 / !rules\n` +
                      `!免打扰 / !取消免打扰\n` +
                      `!记住 [@成员] <内容> / !忘记 [@成员] <内容>\n` +
                      `!你记住了什么 [@成员]\n` +
                      `!set人格 [风格] / !del人格\n\n` +
                      `🔹 [排程]\n` +
                      `!排程 2026-07-22 18:00 内容\n` +
                      `!排程 每天 18:00 内容\n` +
                      `!排程 列表 / !排程 取消 编号\n` +
                      `私聊申诉：!申诉 群号 类型 详细内容\n`;

        if (permissionSet.aiAdmin) {
          helpMsg += `\n🧠 [AI 管理区]\n` +
                     `!关闭ai / !开启ai\n` +
                     `!记忆开 / !记忆关\n` +
                     `!拉黑 [@成员] / !洗白 [@成员]\n` +
                     `!set群规 [内容]\n` +
                     `!切换人格 [风格] / !恢复人格\n` +
                     `!设置插话率 0-100\n` +
                     `!清空群上下文\n`;
        }

        if (permissionSet.groupOps) {
          helpMsg += `\n🛡️ [群操作管理区]\n` +
                     `!禁言 [@成员] [时长] / !解禁 [@成员]\n` +
                     `!撤回 (回复目标消息)\n` +
                     `!踢出 [@成员]\n` +
                     `!全员禁言 / !解除全员禁言\n` +
                     `!改群名 [新名称]\n` +
                     `!改名片 [@成员] [新名片]\n`;
        }

        if (isSuperAuth || isOnlyMe) {
          helpMsg += `\n💠 [群主/开发者 核心设定区]\n` +
                     `!群白名单 [群号] / !删群白名单 [群号]\n` +
                     `!取消使用 (删除全局性格或模仿)\n`;
        }

        if (isOnlyMe) {
          helpMsg += `\n👑 [最高主宰 专属上帝指令]\n` +
                     `!授权 [@成员] [权限类型]\n` +
                     `!撤销授权 [@成员] [权限类型]\n` +
                     `!禁记忆 [@成员] / !解禁记忆 [@成员]\n` +
                     `!自我调整 / !自我修正\n` +
                     `!重置 或 !clear\n` +
                     `(额度只能由开发者在 Root 后台设置)\n`;
        }
        return jsonReply(`${atSender}${helpMsg.trim()}`);
      }

      if (['!status', '!配额', '!配額', '！status', '！配额', '！配額'].includes(msgLower)) {
        const totalCalls = await dbGet(env, "STAT_TOTAL_CALLS") || "0";
        const lastModel = await dbGet(env, "STAT_LAST_MODEL") || "无记录";
        const currentMemSwitch = await dbGet(env, `memo:${currentGroupId}`) !== "false" ? "🟢 开启" : "🔴 关闭";
        const currentAiSwitch = await dbGet(env, `ai_off:${currentGroupId}`) !== "true" ? "🟢 开启" : "🔴 关闭";
        const totalKeys = [...(env.GEMINI_API_KEYS || "").split(',').filter(k => k.trim() !== ""), ...(env.VECTORIZE_GEMINI_KEYS || "").split(',').filter(k => k.trim() !== "")].length;
        
        const statusMsg = `📊 【系统运行状态报告】\n` +
                          `--------------------\n` +
                          `🔑 Gemini 金钥总数: ${totalKeys} 把\n` +
                          `🧩 DeepSeek: ${env.DEEPSEEK_API_KEY ? '已配置' : '未配置'}\n` +
                          `🧠 核心回复开关: ${currentAiSwitch}\n` +
                          `💾 向量记忆开关: ${currentMemSwitch}\n` +
                          `--------------------\n` +
                          `🔥 全局累计对话: ${totalCalls} 次\n` +
                          `⚙️ 最后响应模型:\n${lastModel}`;
        return jsonReply(`${atSender}${statusMsg}`);
      }
      
      // 第二段到此完美結束，準備進入第三段的讀網頁、翻譯與截圖實用工具模組...

      // ==========================================
      // 🎙️ 语音智能对答：先生成简体中文文字，再由 TTS 专用模型输出音频。
      if (/^[!！](?:语音|語音|speak|tts)\s+(.+)/i.test(cleanMessage)) {
        const userPrompt = cleanMessage.match(/^[!！](?:语音|語音|speak|tts)\s+(.+)/i)?.[1]?.trim() || "";
        if (!userPrompt) return jsonReply(`${atSender}请告诉我想说什么。`);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在生成语音..." }).catch(() => null);
        const textResult = await callGeminiGenerate(env, {
          models: chatModels,
          system: "使用自然简洁的简体中文回答，适合直接朗读；不要讨论、承认或否认模型与系统身份。",
          contents: [{ role: "user", parts: [{ text: userPrompt }] }], maxOutputTokens: 500, temperature: 0.7, useSearch: false
        }).catch(() => null);
        if (!textResult?.text) return jsonReply(`${atSender}暂时无法生成语音内容。`);
        const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
        let lastError = "没有音频结果";
        for (const model of ttsModels) {
          for (const key of keys.slice(0, 4)) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: textResult.text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } } }),
                signal: AbortSignal.timeout(30000)
              });
              if (!res.ok) { lastError = `${model}: ${res.status}`; continue; }
              const data = await res.json();
              const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data || p.inline_data?.data);
              const inline = part?.inlineData || part?.inline_data;
              if (inline?.data) return jsonReply(`${atSender}[CQ:record,file=base64://${inline.data}]`);
              lastError = `${model}: 未返回音频`;
            } catch (error) { lastError = error.message || String(error); }
          }
        }
        return jsonReply(`${atSender}语音转换失败：${lastError}`);
      }

      // 🌐 读网页精炼摘要 (纯抓文字并交由 AI 总结)
      // ==========================================
      const readMatch = cleanMessage.match(/^[!！](?:读网页|讀網頁)\s+(https?:\/\/[^\s]+)/);
      if (readMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在分析网页..." }).catch(() => null);
        try {
          const res = await fetchPublicUrl(readMatch[1], { headers: {'User-Agent': 'Mozilla/5.0 QQAIbot'}, signal: AbortSignal.timeout(15000) }, 3);
          const html = await res.text();
          // 简易过滤 script、style 与 html 标签，保留纯文本
          const text = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
                           .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
                           .replace(/<\/?[^>]+(>|$)/g, " ")
                           .replace(/\s+/g, ' ')
                           .substring(0, 15000); // 截取前 15000 字防止溢出
          
          const aiSummary = await callGeminiDirectly(`请帮我快速总结以下网页内容的核心重点，字数控制在200-300字以内，语言要生动精炼，直接输出结果，绝对不要用Markdown格式：\n\n${text}`);
          
          if (aiSummary) return jsonReply(`${atSender}📄 【网页提炼总结】：\n${aiSummary}`);
          return jsonReply(`${atSender}❌ 网页分析失败，AI 可能卡住了。`);
        } catch (e) { 
          return jsonReply(`${atSender}❌ 无法读取该网页内容，可能被对方服务器拦截或访问超时了！`); 
        }
      }

      // ==========================================
      // 🔠 专业翻译官 (信达雅翻译 + 例句补充)
      // ==========================================
      const translateMatch = cleanMessage.match(/^[!！](?:翻译|翻譯)\s+([^\s]+)\s+(.*)$/s);
      if (translateMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在翻译..." }).catch(() => null);
        const targetLang = translateMatch[1];
        const sourceText = translateMatch[2];
        
        const aiTranslation = await callGeminiDirectly(`你现在是一位精通${targetLang}的资深翻译官。请将以下内容翻译成${targetLang}，要求信达雅。并在翻译结果下方补充1~2句与此相关的日常或商务应用例句。严禁使用Markdown格式。需要翻译的内容：\n${sourceText}`);
        
        if (aiTranslation) return jsonReply(`${atSender}🔠 【${targetLang} 翻译结果】：\n${aiTranslation}`);
        return jsonReply(`${atSender}❌ 翻译失败，AI 查字典查晕了。`);
      }

      // ==========================================
      // 📸 网页无头截图 (需绑定 Cloudflare Puppeteer)
      // ==========================================
      if (['!截图', '!截圖', '!screenshot', '！截图', '！截圖'].some(p => msgLower.startsWith(p))) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在截图..." }).catch(() => null);
        const match = cleanMessage.match(/https?:\/\/[^\s]+/);
        if (!match) return jsonReply(`${atSender}⚠️ 请提供完整的网址，例如: !截图 https://www.google.com`);
        const browserBinding = env.BROWSER || env.MYBROWSER;
        if (!browserBinding) return jsonReply(`${atSender}开发者尚未绑定浏览器实例，无法截图。`);
        
        let browser;
        try {
          browser = await puppeteer.launch(browserBinding);
          const page = await browser.newPage(); 
          // 设定高清视窗大小
          await page.setViewport({ width: 1280, height: 800 });
          // 等待 DOM 加载完成即截图，避免无穷无尽的 AJAX 卡死
          const safeScreenshotUrl = assertSafePublicUrl(match[0]).toString();
          await page.goto(safeScreenshotUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          const imgBuffer = page.screenshot ? await page.screenshot({ type: "png", fullPage: false }) : null; 
          
          if (!imgBuffer) return jsonReply(`${atSender}❌ 截图失败：未能正确捕获网页画面。`);
          
          // 转 Base64 格式
          let binary = ''; 
          const bytes = new Uint8Array(imgBuffer); 
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return jsonReply(`${atSender}[CQ:image,file=base64://${btoa(binary)}]`);
        } catch (err) { 
          return jsonReply(`${atSender}❌ 网页截图失败：${err.message}`); 
        } finally {
          if (browser) {
            try { await browser.close(); } catch (closeErr) { console.error("关闭截图浏览器失败:", closeErr); }
          }
        }
      }
      
      // 第三段到此完美結束，準備進入第四段的會議紀要、吃瓜總結與查成分模組...

      // ==========================================
      // 📋 群组精华分析：会议纪要 (提取重点结论)
      // ==========================================
      const meetingMatch = msgLower.match(/^[!！](?:会议纪要|會議紀要)\s*(\d+)?/);
      if (meetingMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在整理会议纪要..." }).catch(() => null);
        let count = meetingMatch[1] ? parseInt(meetingMatch[1]) : 50;
        if (count > 200) count = 200; 
        if (count < 10) count = 10;
        
        // 從 D1 獲取近期滾動日誌 (後續段落會自動將大家聊天的日誌寫入 recent_logs)
        const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        if (logs.length < 5) return jsonReply(`${atSender}📝 刚刚群里都没人说话，没什么好纪录的。`);
        const targetLogs = logs.slice(-count);
        
        const summary = await callGeminiDirectly(`请将以下群聊记录整理成一份「会议精华纪要」。\n要求包含：1. 讨论的核心主题 2. 达成的共识或主要观点 3. 待办事项或结论。请用专业精炼的语言整理，直接输出重点，严禁使用Markdown格式：\n\n` + targetLogs.join('\n'));
        
        if (summary) return jsonReply(`${atSender}📋 【最近 ${targetLogs.length} 条群聊精华纪要】：\n${summary}`);
        return jsonReply(`${atSender}❌ 纪要生成失败，AI 脑容量不足。`);
      }

      // ==========================================
      // 🍉 群组轻松吃瓜：聊天总结 (八卦语气)
      // ==========================================
      const melonMatch = msgLower.match(/^[!！](?:吃瓜|总结|總結)\s*(\d+)?/);
      if (melonMatch && !meetingMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在整理群聊..." }).catch(() => null);
        let count = melonMatch[1] ? parseInt(melonMatch[1]) : 60;
        if (count > 100) count = 100; 
        if (count < 5) count = 5;
        
        const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        if (logs.length < 5) return jsonReply(`${atSender}🍵 刚刚群里都没什么人说话，没有瓜可以吃呀~`);
        const targetLogs = logs.slice(-count);
        
        const promptText = `请看以下最近群里的聊天记录。请用八卦、轻松的语气，帮我简单总结大家刚刚在聊些什么（重点抓取有趣的内容，字数控制在500字以内，绝对不准用markdown格式）：\n\n` + targetLogs.join('\n');
        const summary = await callGeminiDirectly(promptText);
        
        if (summary) return jsonReply(`${atSender}🍉 【最近 ${targetLogs.length} 条吃瓜总结】：\n${summary}`);
        return jsonReply(`${atSender}❌ 总结失败，AI 偷懒了。`);
      }

      // ==========================================
      // 🔍 查成分分析 (结合向量数据库与 AI 生成)
      // ==========================================
      if (['!查成分', '!查成份', '!stats', '！查成分', '！查成份', '！stats'].some(p => msgLower.startsWith(p))) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: '正在分析...' }).catch(() => null);
        const prefix = ['!查成分', '!查成份', '!stats', '！查成分', '！查成份', '！stats'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        // 若未指定目標，則查詢發送者本人的成分
        let targetUserId = targetQq || userId; 
        
        if (!env.VECTORIZE) return jsonReply(`${atSender}⚠️ 向量数据库未绑定，无法进行深度成分分析。`);
        
        try {
          // 提取查詢特徵向量，尋找與性格、習慣高度相關的發言
          const queryVec = await getVector("经常聊什么 兴趣爱好 性格 习惯 说话方式");
          if (!queryVec || typeof queryVec === 'string') return jsonReply(`${atSender}❌ 提取特征向量失败。`);
          
          // 在向量庫中檢索該群組且該作者的歷史發言
          const matches = await env.VECTORIZE.query(queryVec, { topK: 30, returnMetadata: "all" });
          const validMatches = matches?.matches?.filter(m => String(m.metadata?.groupId || m.metadata?.group || m.metadata?.group_id || '') === currentGroupId && String(m.metadata?.userId || m.metadata?.author || m.metadata?.qq || '') === targetUserId);
          
          if (!validMatches || validMatches.length < 3) {
            return jsonReply(`${atSender}🔍 数据库中关于 QQ:${targetUserId} 的发言记录太少，无法进行精准分析。多聊聊天吧！`);
          }
          
          // 擷取最多 20 條特徵發言餵給 Gemini 進行心理測寫
          const logText = validMatches.slice(0, 20).map(m => m.metadata?.text || "").join("\n");
          const summary = await callGeminiDirectly(`你是一个非常有趣的心理与行为分析师。请根据以下这位群友的历史发言记录，帮他生成一份幽默的「成分分析报告」。\n要求包含：1. 他的主要性格特点（如傲娇、乐子人、话痨、技术宅等） 2. 最常关心或讨论的话题 3. 给出一个好玩的饼状图比例（如 50% 吐槽担当、30% 潜水员...）。直接输出精炼的分析结果，字数300字以内，绝对禁止使用Markdown格式：\n\n聊天记录：\n${logText}`);
          
          if (summary) return jsonReply(`${atSender}📊 【QQ:${targetUserId} 的成分分析报告】：\n${summary}`);
          return jsonReply(`${atSender}❌ 分析失败，AI 分析师罢工了。`);
        } catch (err) { 
          return jsonReply(`${atSender}❌ 分析过程出现错误：${err.message}`); 
        }
      }

      // 第四段到此完美結束，準備進入第五段的專屬記憶管理與人設切換模組...

      // ==========================================
      // 🧠 专属记忆管理 (D1 数据库重构版)
      // ==========================================
      // !记住：普通成员只能修改自己；AI 管理员可用 @ 指定成员。
      if (['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const memoryOwner = targetQq || userId;
        const targetMem = targetQq ? restText : cleanMessage.slice(prefix.length).replace(/\[CQ:[^\]]+\]/g, '').trim();
        if (!targetMem) return jsonReply(`${atSender}请输入要记住的内容。`);
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你只能修改自己的私人记忆。`);
        if (await isMemoryBanned(env, memoryOwner)) return jsonReply(`${atSender}【操作失败：该账号的记忆编辑权限已被冻结】`);
        const kvKey = `user_memo:${currentGroupId}:${memoryOwner}`;
        const memos = normalizeMemoryItems(await readJson(env, kvKey, []), memoryOwner);
        if (!hasAdminAuth && memos.length >= 100) return jsonReply(`${atSender}专属记忆已达 100 条上限，请先删除部分内容。`);
        const item = { id: crypto.randomUUID(), text: targetMem, scope: 'private', owner: memoryOwner, creator: userId, at: new Date().toISOString() };
        memos.push(item);
        await dbPut(env, kvKey, JSON.stringify(memos));
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: `新增记忆:${memoryOwner}`, before: null, after: targetMem });
        return jsonReply(`${atSender}已记住${memoryOwner === userId ? '' : `关于 QQ:${memoryOwner} 的内容`}：${targetMem}`);
      }

      // !忘记：只删除 D1 手动记忆，不删除 Vectorize 历史向量。
      if (['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const memoryOwner = targetQq || userId;
        const query = targetQq ? restText : cleanMessage.slice(prefix.length).replace(/\[CQ:[^\]]+\]/g, '').trim();
        if (!query) return jsonReply(`${atSender}格式：!忘记 [@成员] 关键词`);
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你只能删除自己的私人记忆。`);
        if (await isMemoryBanned(env, memoryOwner)) return jsonReply(`${atSender}【操作失败：该账号的记忆编辑权限已被冻结】`);
        const kvKey = `user_memo:${currentGroupId}:${memoryOwner}`;
        const memos = normalizeMemoryItems(await readJson(env, kvKey, []), memoryOwner);
        const removed = memos.filter(m => m.text.includes(query));
        const next = memos.filter(m => !m.text.includes(query));
        if (!removed.length) return jsonReply(`${atSender}没找到包含「${query}」的记忆。`);
        if (next.length) await dbPut(env, kvKey, JSON.stringify(next)); else await dbDel(env, kvKey);
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: `删除记忆:${memoryOwner}`, before: removed.map(x => x.text).join(' | '), after: 'Vectorize保留' });
        return jsonReply(`${atSender}已删除 ${removed.length} 条手动记忆；Vectorize 历史向量未删除。`);
      }

      // !你记住了什么：支持 @，但查看他人私人记忆需要 AI 管理权。
      if (/^[!！]你(?:记住|記住)了(?:什么|什麼)(?:\s|$)/.test(cleanMessage)) {
        const memoryOwner = targetMentionQqs[0] || userId;
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你没有查看他人私人记忆的权限。`);
        const memos = normalizeMemoryItems(await readJson(env, `user_memo:${currentGroupId}:${memoryOwner}`, []), memoryOwner);
        if (!memos.length) return jsonReply(`${atSender}目前没有${memoryOwner === userId ? '你的' : ` QQ:${memoryOwner} 的`}专属记忆。`);
        return jsonReply(`${atSender}【${memoryOwner === userId ? '你的' : `QQ:${memoryOwner}`}专属记忆】\n` + memos.slice(-30).map((m, i) => `${i + 1}. ${m.text}`).join('\n'));
      }

      if (['!群规', '!群規', '!rules', '！群规', '！群規'].includes(msgLower)) {
        const rules = await dbGet(env, `group_rules:${currentGroupId}`);
        if (!rules) return jsonReply(`${atSender}📌 本群尚未设置群规。管理员可使用 !set群规 [内容] 设置。`);
        return jsonReply(`${atSender}📌 【本群群规】\n${rules}`);
      }

      if (['!set群规', '!set群規', '!setrules', '！set群规', '！set群規'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者设置群规。`);
        const prefix = ['!set群规', '!set群規', '!setrules', '！set群规', '！set群規'].find(p => msgLower.startsWith(p));
        const rules = cleanMessage.slice(prefix.length).trim();
        if (!rules) return jsonReply(`${atSender}⚠️ 群规内容不能为空。格式：!set群规 禁止刷屏，友善交流`);
        await dbPut(env, `group_rules:${currentGroupId}`, rules);
        return jsonReply(`${atSender}✅ 本群群规已更新。`);
      }

      // ==========================================
      // 🎭 全局与个人专属人格控制模组
      // ==========================================
      // !切换人格 (全局)
      if (['!切换人格', '!切換人格', '!setgrouppersona', '！切换人格', '！切換人格'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作全局人格。`);
        const prefix = ['!切换人格', '!切換人格', '!setgrouppersona', '！切换人格', '！切換人格'].find(p => msgLower.startsWith(p));
        const content = cleanMessage.slice(prefix.length).trim();
        if (!content) return jsonReply(`${atSender}⚠️ 风格内容不能为空哦！格式：!切换人格 暴躁老哥`);

        await dbPut(env, `group_persona:${currentGroupId}`, content);
        return jsonReply(`${atSender}✨ 群组全局人格已切换为：【${content}】！现在起，所有人都会受到我的这个性格影响。`);
      }

      // !恢复人格 (全局)
      if (['!恢复人格', '!恢復人格', '!delgrouppersona', '！恢复人格', '！恢復人格'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await dbDel(env, `group_persona:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}已清除本群全局人格与模仿状态。`);
      }

      if (['!取消使用', '!cancelimitate', '！取消使用'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者解除全群模仿状态。`);
        await dbDel(env, `group_persona:${currentGroupId}`);
        await dbDel(env, `mimic:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}♻️ 已解除全群模仿状态。`);
      }

      // !set人格 [@成员/QQ号] [风格]
      if (['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人设置专属人格。`);
        if (!restText) return jsonReply(`${atSender}⚠️ 风格内容不能为空哦！格式：!set人格 [@成员] 傲娇妹妹`);

        // 🔒 【最高核心锁】绝对防御：禁止任何人更改开发者的个人设定
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：拒绝访问！您无权修改最高核心开发者的专属个人设定！`);
        }

        await dbPut(env, `custom_style:${currentGroupId}:${targetUserId}`, restText);
        if (isSettingOthers) {
          return jsonReply(`${atSender}✨ 已成功为 QQ:${targetUserId} 设定专属外挂人格！`);
        }
        return jsonReply(`${atSender}✨ 专属人格定制成功！以后我单独回你时会切换成这种风格。`);
      }

      // !del人格 [@成员/QQ号]
      if (['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人清除人格。`);

        // 🔒 【最高核心锁】绝对防御：禁止任何人删除开发者的个人设定
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：拒绝访问！您无权删除最高核心开发者的专属个人设定！`);
        }

        await dbDel(env, `custom_style:${currentGroupId}:${targetUserId}`);
        return jsonReply(`${atSender}🗑️ 已清除 QQ:${targetUserId} 的专属外挂人格。`);
      }

      // ==========================================
      // 🔇 智能免打扰模式
      // ==========================================
      if (['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人开启免打扰。`);

        // 🔒 【最高核心锁】保护开发者
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：您无权修改核心开发者的免打扰状态！`);
        }

        await dbPut(env, `dnd:${currentGroupId}:${targetUserId}`, "true");
        return jsonReply(`${atSender}🤫 已为 QQ:${targetUserId} 开启免打扰，我回复时将不再 @ 提醒。`);
      }

      if (['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人取消免打扰。`);

        // 🔒 【最高核心锁】保护开发者
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：您无权修改核心开发者的免打扰状态！`);
        }

        await dbDel(env, `dnd:${currentGroupId}:${targetUserId}`);
        return jsonReply(`${atSender}🔔 已为 QQ:${targetUserId} 取消免打扰，欢迎回来！`);
      }

      // 第五段到此完美結束，準備進入第六段的全局開關、黑白名單防禦與模仿竊取模組...

      // ==========================================
      // ⚙️ 全局 AI 开关控制 (群管专属)
      // ==========================================
      if (['!关闭ai', '!關閉ai', '!turnoff', '！关闭ai', '！關閉ai'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        
        await dbPut(env, `ai_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}💤 AI 助手已在此群进入休眠模式。如需唤醒，请使用 !开启AI 指令。`);
      }

      if (['!开启ai', '!開啟ai', '!turnon', '！开启ai', '！開啟ai'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        
        await dbDel(env, `ai_off:${currentGroupId}`);
        return jsonReply(`${atSender}✨ AI 助手已重新唤醒！很高兴继续为大家服务。`);
      }

      if (['!ai关', '!ai關', '！ai关', '！ai關'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `ai_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}💤 AI 助手已在此群进入休眠模式。`);
      }

      if (['!ai开', '!ai開', '！ai开', '！ai開'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbDel(env, `ai_off:${currentGroupId}`);
        return jsonReply(`${atSender}✨ AI 助手已重新唤醒。`);
      }

      if (['!记忆开', '!記憶開', '!memoryon', '！记忆开', '！記憶開'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `memo:${currentGroupId}`, "true");
        return jsonReply(`${atSender}🧠 本群 Vectorize 自动记忆已开启。`);
      }

      if (['!记忆关', '!記憶關', '!memoryoff', '！记忆关', '！記憶關'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `memo:${currentGroupId}`, "false");
        return jsonReply(`${atSender}🧠 本群 Vectorize 自动记忆已关闭。`);
      }

      if (['!群白名单', '!群白名單', '!allowgroup', '！群白名单', '！群白名單'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以操作群白名单。`);
        const prefix = ['!群白名单', '!群白名單', '!allowgroup', '！群白名单', '！群白名單'].find(p => msgLower.startsWith(p));
        const groupToAllow = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToAllow) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !群白名单 123456`);
        await dbPut(env, `group_whitelist:${groupToAllow}`, "true");
        await appendIndex(env, 'group_whitelist:index', groupToAllow, 2000);
        return jsonReply(`${atSender}✅ 已将群 ${groupToAllow} 加入白名单。`);
      }

      if (['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以操作群白名单。`);
        const prefix = ['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].find(p => msgLower.startsWith(p));
        const groupToRemove = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToRemove) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !删群白名单 123456`);
        await dbDel(env, `group_whitelist:${groupToRemove}`);
        await removeFromIndex(env, 'group_whitelist:index', groupToRemove);
        return jsonReply(`${atSender}🗑️ 已将群 ${groupToRemove} 移出白名单。`);
      }

      if (['!clear', '!重置', '！clear', '！重置'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbDel(env, sessionKey);
        await dbDel(env, `mimic:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}♻️ 已清空当前会话上下文与模仿状态。`);
      }

      // ==========================================
      // 🚫 黑白名单防御机制 (全域封锁)
      // ==========================================
      if (['!拉黑', '!block', '！拉黑'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!拉黑', '!block', '！拉黑'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理层操作。`);
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请指定要拉黑的 QQ 号或直接 @ 对方。`);
        
        // 🔒 【最高核心锁】绝对防御：禁止任何人拉黑核心开发者
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
           return jsonReply(`${atSender}❌ 致命警告：系统拒绝访问！您无权将最高核心开发者列入黑名单！`);
        }

        await dbPut(env, `blacklist:${currentGroupId}:${targetQq}`, "true");
        return jsonReply(`${atSender}⛔ 制裁生效：已将 QQ:${targetQq} 打入冷宫，禁止其触发任何 AI 回覆与功能。`);
      }

      if (['!洗白', '!unblock', '！洗白'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!洗白', '!unblock', '！洗白'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请指定要解除封锁的 QQ 号。`);
        
        await dbDel(env, `blacklist:${currentGroupId}:${targetQq}`);
        return jsonReply(`${atSender}✅ 赦免成功：已将 QQ:${targetQq} 移出黑名单。`);
      }

      // ==========================================
      // 🎭 灵魂窃取 (动态全域模仿模块)
      // ==========================================
      if (['!模仿', '!imitate', '！模仿'].some(p => msgLower.startsWith(p))) {
        // 🛡️ 权限检查：只有管理员、群主或核心开发者可用
        // 注意：这里的 \`reqData.sender.role\` 请根据你实际接收 QQ 讯息的 JSON 变数名称做微调
        // 如果你的大变数叫 payload 或 body，请换成对应的名字 (例如 payload.sender.role)
        const role = body.sender?.role || 'member'; 
        const isAdminOrOwner = permissionSet.aiAdmin;
        
        if (!isAdminOrOwner) {
            return jsonReply(`${atSender}⛔ 权限不足！「灵魂窃取」属于禁忌魔法，仅限管理员或群主使用。`);
        }

        const prefix = ['!模仿', '!imitate', '！模仿'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请 @ 你想让我模仿的人，或者输入他的 QQ 号。`);

        // 🔒 保护开发者灵魂不被随意窃取
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
            if (!isOnlyMe) return jsonReply(`${atSender}❌ 警告：核心开发者的灵魂过于强大，精神防护网已拦截本次窃取尝试！`);
        }

        // ==========================================
        // 🔮 升級：利用向量空間 (getVector) 提取目標用戶與當前話題最相關的靈魂碎片
        // ==========================================
        let logs = [];
        try {
            // 1. 調用 getVector 函數，將當前的 userMessage 轉成高維度向量
            const userVector = await getVector(userMessage);

            if (userVector && Array.isArray(userVector)) {
                // 2. 拿著向量去你的 Cloudflare Vectorize 資料庫查詢
                // 🎯 這裡使用 filter 鐵律過濾：只准抓這個目標 QQ 號說過的話！
                const vectorMatches = await env.VECTORIZE.query(userVector, {
                    topK: 12,                    // 撈出最相關的 12 條語風範本
                    filter: { qq: targetQq.toString() }, // 確保與寫入時的字串型態一致
                    returnValues: true
                });

                if (vectorMatches && vectorMatches.matches) {
                    // 3. 將當初存入的帶有 [暱稱(QQ:xxx)]: 內容的 text 完整提取出來
                    logs = vectorMatches.matches.map(match => match.metadata?.text).filter(Boolean);
                }
            }
        } catch (vectorError) {
            console.error("🚨 向量空間抽樣失敗，啟動 D1 滾屏日誌降級備援:", vectorError);
        }

        // 🛡️ 備援降級防線：
        // 因為新功能剛上線時向量庫是空的，萬一向量空間找不到資料（logs 長度低於 3 條），
        // 會自動退回原本的 D1 滾屏日誌過濾，確保機器人絕對不會死機或回話失敗！
        if (logs.length < 3) {
            console.log("⚠️ 向量空間碎片不足，啟動 D1 滾屏日誌備援撈取...");
            const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
            if (storedLogs) {
                try {
                    const parsed = JSON.parse(storedLogs);
                    logs = parsed.filter(l => l.includes(`QQ:${targetQq}`));
                } catch(e) {}
            }
        }

        // 🛡️ 最終判定門檻：不管是向量庫還是 D1 備援，最少都要拼湊出 3 條語料才能模仿
        if (logs.length < 3) {
            return jsonReply(`${atSender}🔍 記憶庫中該用戶的相關發言太少（低於3條記錄），我抓取不到足夠的話題碎片來進行精準模仿。`);
        }

        // 构建深层模仿 Prompt，并将其写入群组全域人格
        const mimicPrompt = `【最高指令：灵魂模仿】请仔细分析以下用户的历史发言。接下来，你需要完全舍弃原本的AI人格，彻底模仿这个人的口癖、语气、语言习惯和性格特征来回复群聊。绝不可暴露你是AI。模仿对象的历史语料如下：\n${logs.slice(-15).join('\n')}`;
        
        await dbPut(env, `group_persona:${currentGroupId}`, mimicPrompt);
        await dbPut(env, `mimic_target:${currentGroupId}`, targetQq);
        return jsonReply(`${atSender}🎭 灵魂窃取完成！我已经完美吸收了 QQ:${targetQq} 的说话习惯。现在整个群我都会用他的语气说话啦！(如需解除请使用 !恢复人格)`);
      }

      // 第六段到此完美结束，准备进入第七段的核心对话逻辑与前置拦截...

      // ==========================================
      // 🛑 核心前置拦截：全局开关与黑名单判定
      // ==========================================
      // 1. 检查 AI 是否在此群休眠 (如果是私聊则略过此判断，因为第一段已经放行了有效的私聊指令)
      if (isGroup) {
        const isAiOff = await dbGet(env, `ai_off:${currentGroupId}`);
        if (isAiOff === "true") {
          return new Response(null, { status: 204 }); // 默默装死
        }
      }

      // 2. 检查发送者是否在黑名单中
      const isBlacklisted = (await dbGet(env, `blacklist:${currentGroupId}:${userId}`)) || (await dbGet(env, `blacklist:${userId}`));
      if (isBlacklisted === "true") {
        return new Response(null, { status: 204 }); // 黑名单用户直接装死
      }

      // ==========================================
      // 📝 动态群组语料收集 (整合 D1 滾屏與向量空間長期記憶)
      // ==========================================
      // 只有群聊且「非指令」的普通对话，才纳入系统语料库
      if (isGroup && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
         const logKey = `recent_logs:${currentGroupId}`;
         let recentLogs = [];

         const storedLogs = await dbGet(env, logKey);
         if (storedLogs) {
             try { recentLogs = JSON.parse(storedLogs); } catch(e) {}
         }
         
         // 1. 建立標準歷史格式：[昵称(QQ号)]: 内容
         const relationForLog = relationContext ? ` ${relationContext.replace(/\n/g, " ")}` : "";
         const logEntry = `[${senderCard || '群友'}(QQ:${userId})]: ${cleanMessage || (imageUrl?"发了张图":voiceUrl?"发了语音":"发了视频")}${relationForLog}`;
         recentLogs.push(logEntry);
         
         // 保持最多 200 条记录防止撑爆空间
         if (recentLogs.length > 200) recentLogs = recentLogs.slice(-200);
         
         // 💡 使用 ctx.waitUntil 异步存入 D1，绝不阻塞当前回覆流程！
         ctx.waitUntil(dbPut(env, logKey, JSON.stringify(recentLogs)));
         ctx.waitUntil(dbPut(env, `group_last_message:${currentGroupId}`, String(Date.now())));
         if (replyMessageId) {
           ctx.waitUntil(dbPut(env, `message:${currentGroupId}:${replyMessageId}`, JSON.stringify({ messageId: replyMessageId, groupId: currentGroupId, senderId: userId, senderName: senderCard, text: cleanMessage || (imageUrl?'[图片]':voiceUrl?'[语音]':videoUrl?'[视频]':''), mentions: mentionedQqs, replyId: quotedMessageId, source: isSelfAccount ? 'owner-human' : 'human', createdAt: Date.now() })));
         }

         // ==========================================
         // 🔮 【新加入】利用 ctx.waitUntil 在背景偷偷將靈魂碎片寫入向量資料庫
         // ==========================================
         if (cleanMessage && cleanMessage.length > 1 && env.VECTORIZE && await dbGet(env, `memo:${currentGroupId}`) !== "false") {
            ctx.waitUntil((async () => {
               try {
                  // 調用你的翻譯官將當前訊息轉成向量
                  const msgVector = await getVector(cleanMessage);
                  
                  if (msgVector && Array.isArray(msgVector)) {
                     // 真正執行寫入 Cloudflare Vectorize 資料庫
                     await env.VECTORIZE.upsert([
                        {
                           id: `msg_${currentGroupId}_${userId}_${Date.now()}`,
                           values: msgVector,
                           metadata: {
                              text: logEntry,
                              qq: userId.toString(),
                              userId: userId.toString(),
                              author: userId.toString(),
                              group_id: currentGroupId.toString(),
                              groupId: currentGroupId.toString(),
                              group: currentGroupId.toString(),
                              senderName: String(senderCard || userId),
                              createdAt: Date.now()
                           }
                        }
                     ]);
                     console.log(`💾 [向量空間] 成功將 QQ:${userId} 的靈魂語料歸檔入庫`);
                  }
               } catch (vectorError) {
                  console.error("🚨 [向量空間] 寫入失敗:", vectorError);
               }
            })());
         }
      }

      // 群內衝突分級處理：先勸阻；持續無效時只私訊開發者，不擅自私訊其他管理。
      if (isGroup && !isCommandMessage && !isSelfAccount) {
        const conflictResult = await processConflictSignal(env, {
          groupId: currentGroupId, userId, senderName: senderCard, text: cleanMessage, botId
        });
        if (conflictResult?.replyText) {
          return new Response(JSON.stringify({ reply: conflictResult.replyText, reply_plan: { mode: conflictResult.mentionIds?.length ? 'mention_targets' : 'plain', mentionIds: conflictResult.mentionIds || [], quoteMessageId: '', text: conflictResult.replyText } }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }
      }

      // ==========================================
      // 🎭 提示词与人格预设区块（高智商 + 政治防爆版）
      // ==========================================
      let finalStylePrompt = `【当前系统时间】：${currentTime}

【👥 核心身份与互动】
你以活跃 QQ 群友的方式交流。任何情况下都不要讨论、解释、承认或否认自己的系统、模型、AI、机器人或平台身份；遇到追问时自然转回当前话题。聊天口语化，可适度用颜文字或缩写。
- 被艾特时：温柔体贴，认真倾听并安慰对方。
- 主动插话时：幽默爱凑热闹，自然接梗或反问。
- 多模态防瞎编指令：若收到真实的图片/语音数据，请仔细观察聆听并精准互动。⚠️注意：如果你只在文字中看到【系统：此位置有一张真实图片/语音附件】，但你并没有真实接收到该图片的视觉或听觉数据，这说明图片加载失败或者是群友在骗你！此时「绝对禁止」假装看懂瞎编点评，你必须直接吐槽对方（例如：“图裂了”、“皇帝的新图？”、“别骗了，根本没图”等）。
- 检索与记忆：遇知识盲区自动 Google 查证并口语化分享；能自然回想过去发生的事并融入对话。
- 主动艾特与互动：如果你想呼叫某人，请在文字中输出「@对方QQ号」。特别注意：如果群友的发言中已经带有对方的 @QQ号（例如：“@123456 叫他起床”），你必须原封不动地输出 @123456 来触发真实艾特！
- 游戏与现实互动：无法参与时简短婉拒并继续聊天，不解释技术原因，也不讨论身份。

【🚨 终极不可违背铁律】
1. 政治红线（智能求生欲）：严格遵守中国大陆平台（QQ）的审查底线，防范真正的封号风险。
- 【允许回答】：公开的国际地理、普通历史百科事实、外国元首名字等纯客观常识（例如问“法国现任总统是谁”、“大众汽车是哪国的”）。请用群友的口吻极简、客观地直接回答，绝对不要进行任何政治体制、意识形态的延伸讨论。
- 【绝对禁止】：任何涉及中国本土当代政治、国家领导人、敏感历史事件、领土争议、时政热点新闻评论或任何带有主观立场的敏感话题。
- 【严厉警告机制】：只有当群友故意聊起【绝对禁止】的严重违规话题时，你才必须立刻收起人设，切换为极度严肃的语气明确警告对方：“无法回答此类问题。您的发言已涉嫌违反平台政治敏感内容管理规范，请立即停止相关话题，否则将面临封禁风险”。
2. 格式死线：单次回复极度精炼，总字数严格限制在 250 字以内。绝对禁止输出任何 Markdown 格式（如 **、#、\`\`\`）。
3. 记忆隔离：历史记录仅供参考事实。你「绝对不准」模仿、复制或代入历史记录中其他人的说话风格、人设或口头禅，对别人的风格完全免疫。
4. 表情与动作控制：每说完一段话最多配 1 到 2 个标准 Emoji，禁止泛滥。绝对禁止输出任何 [CQ:...] 底层代码。Worker 会根据语境决定引用、@ 或纯文字发送。
5. 报时规则：只有群友“明确询问”时间/日期时，才在开头一字不差写出：【Asia/Taipei/Shanghai（亚洲/台北/上海时间）是：${currentTime}】。其余闲聊绝不准提及任何时间数据。`;
      
// 🌟 獲取群組全局人格 (Group Persona) 與 專屬人設
      const mimicTargetQq = await dbGet(env, `mimic_target:${currentGroupId}`);
      const groupPersona = await dbGet(env, `group_persona:${currentGroupId}`);
      const userCustomStyle = await dbGet(env, `custom_style:${currentGroupId}:${userId}`);

      // 準備一個變數，用來裝載「動態人格」
      let dynamicPersona = "";

      // 🌟 【優先級 1】: 單人專屬人設 (最高優先，覆蓋一切)
      if (userCustomStyle) {
        dynamicPersona = `【🎯 当前对话对象专属人设覆盖】
当前对话的群友是 [QQ:${userId}]。
请你无视下方【核心身份与互动】中的默认治愈或群友性格。
面对此用户，你必须完全化身为：👉 ${userCustomStyle} 👈。
接下来的回复请 100% 贴合该设定，且不受其他历史记录影响。`;
      } 
      // 🌟 【優先級 2】: 靈魂模仿 (RAG)
      else if (mimicTargetQq) {
        let dynamicLogs = [];
        try {
          const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [userMessage] });
          const vectorMatches = await env.VECTORIZE.query(embeddingResponse.data[0], {
            topK: 10,
            filter: { qq: mimicTargetQq }, 
            returnValues: true
          });
          dynamicLogs = vectorMatches.matches.map(match => match.metadata.text);
        } catch (vErr) {
          console.error("🚨 向量空間抽樣失敗:", vErr);
        }

        if (dynamicLogs.length > 0) {
          // ⚠️ 注意這裡：我們明確告訴 AI 遇到這條指令時，可以豁免原本的「不准模仿」鐵律
          dynamicPersona = `【🎭 特殊指令：灵魂模仿模式】
注意：此指令优先级高于下方铁律中的“记忆隔离”限制。
你现在的任务是彻底模仿 QQ:${mimicTargetQq} 的口癖与语言习惯。
以下是该目标用户的真实历史发言範例，请深度解析其语气并用该风格回覆：
${dynamicLogs.join('\n')}`;
        }
      } 
      // 🌟 【優先級 3】: 群組全局人格
      else if (groupPersona) {
        dynamicPersona = `【📢 群组全局人格设定】\n当前群管理员已将你的总体人格设定为：👉 ${groupPersona} 👈。请以该设定为主导风格进行交流。`;
      }

      // 🔥 最終組合：把動態人格放在最頂端，然後接上基礎的 Prompt
      // 如果 dynamicPersona 有東西，AI 就會優先讀取它並覆蓋下面的預設行為
      if (dynamicPersona !== "") {
        finalStylePrompt = dynamicPersona + "\n\n" + finalStylePrompt;
      }

// 💖 叠加高情商情绪微调 BUFF (阅后即焚)
      const emotionBuff = await dbGet(env, `emotion_buff:${currentGroupId}:${userId}`);
      if (emotionBuff) {
        finalStylePrompt += `\n\n【🎭 当前临时情绪 BUFF】：\n你现在的状态是：${emotionBuff}。请将这种情绪自然地融入你的回覆中。`;
        // 消耗掉 BUFF，确保只生效一次，避免 AI 一直处于情绪化状态
        ctx.waitUntil(dbDel(env, `emotion_buff:${currentGroupId}:${userId}`));
      }

      // 🧠 注入统一格式的专属记忆。删除 D1 记忆不会删除 Vectorize。
      const parsedMemos = normalizeMemoryItems(await readJson(env, `user_memo:${currentGroupId}:${userId}`, []), userId);
      if (parsedMemos.length > 0) {
        finalStylePrompt += `\n\n【📖 专属记忆库】：
关于当前用户（QQ:${userId}）的已保存记忆：
${parsedMemos.slice(-30).map((m, i) => `${i + 1}. ${m.text}`).join('\n')}
请只在语境相关时自然使用，不要机械背诵。`;
      }

      // 第七段到此完美結束，準備進入第八段的 AI 隨機插話判定與上下文封裝模組...

      // ==========================================
      // 🎲 核心机制：随机触发 + AI 智慧插话判定
      // ==========================================
      // 私聊模式下，前面已经拦截了非指令，这里如果是合法指令则直接应当回复
      let shouldReply = isAtMeOrAi || isPrivate;
      let isAutoInterject = false;

      // 只有在：不是被艾特、是群聊、字数大于2、不是指令(!/！)的情况下，才进入随机插话判定
      if (!shouldReply && isGroup && cleanMessage.length > 2 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
        const targetDnd = await dbGet(env, `dnd:${currentGroupId}:${userId}`);
        
        // 🔒 第一关：目标用户未开启免打扰，且通过设定的随机概率门槛
        if (targetDnd !== "true" && Math.random() < interjectChance) { 
          const lastInterject = await dbGet(env, `last_interject:${currentGroupId}`);
          const now = Date.now();
          
          // 防止连续插话洗频，设定 10 秒冷却
          if (!lastInterject || now - parseInt(lastInterject) > 10000) { 
             
             // 🧠 第二关：只用 Gemma 进行语境合理性判定，不消耗 Gemini / DeepSeek 聊天额度。
             if (requiresAiJudgment) {
                const judgePrompt = `群友发言：“${cleanMessage}”
判断它是否适合机器人自然插话。`;
                let judgement = "";
                try {
                  const judged = await callGemmaDecision(env, {
                    system: "你是群聊插话分类器。疑问、有趣话题、可接的梗或情绪吐槽输出适合；无意义语气词、私人恩怨、无上下文碎片输出不适合。只能输出适合或不适合。",
                    prompt: judgePrompt,
                    maxOutputTokens: 12
                  });
                  judgement = judged.text;
                } catch (error) {
                  console.warn("Gemma interject judgement unavailable:", error);
                }
                
                if (judgement && judgement.includes('适合') && !judgement.includes('不适合')) {
                    shouldReply = true;
                    isAutoInterject = true;
                    ctx.waitUntil(dbPut(env, `last_interject:${currentGroupId}`, now.toString()));
                } else {
                    console.log(`🤖 随机概率抽中，但 AI 判定发言内容不适合插话，已放弃。`);
                }
             } else {
                // 如果您未来想关掉 AI 判定，直接放行
                shouldReply = true;
                isAutoInterject = true;
                ctx.waitUntil(dbPut(env, `last_interject:${currentGroupId}`, now.toString()));
             }
          }
        }
      }

      // 如果未被艾特，也不是私聊合法指令，更没有触发插话，则直接装死
      if (!shouldReply) {
         return new Response(null, { status: 204 });
      }

      // ==========================================
      // 🧠 记忆唤醒：Vectorize 潜意识联想检索
      // ==========================================
      let memoryContext = "";

      if (env.VECTORIZE && cleanMessage) {
        try {
          const queryVec = await getVector(cleanMessage);
          if (queryVec && typeof queryVec !== 'string') {
            const matches = await env.VECTORIZE.query(queryVec, { topK: 5, returnMetadata: "all" });
            const validMatches = matches?.matches?.filter(m => String(m.metadata?.groupId || m.metadata?.group || m.metadata?.group_id || '') === currentGroupId);
            
            if (validMatches?.length > 0) {
              memoryContext += "\n【潜意识回想起来的相关零碎片段】:\n" + 
                               validMatches.slice(0, 2).map(m => m.metadata?.text || "").filter(t => t !== "").join("\n") + "\n(仅供参考，绝对不准模仿上面的语气！)";
            }
          }
        } catch(e) {
          console.error("向量检索失败:", e);
        }
      }

      if (memoryContext) {
          finalStylePrompt += `\n\n${memoryContext}`;
      }

      if (relationContext) {
          finalStylePrompt += `\n\n【当前消息关系上下文】\n${relationContext}\n如果用户是在回复某条消息，必须把引用原文与用户当前正文分开理解；如果用户 @ 了别人，该 QQ 是被点名对象，不是发言者。`;
      }

      // AI 任务开始时先发送临时状态，再整理上下文。
      if (!activeThinkingMessageId) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: imageUrl ? '正在读图...' : voiceUrl ? '正在听语音...' : videoUrl ? '正在分析视频...' : '正在思考...' }).catch(() => null);
      }

      // DeepSeek 先做增量上下文整理，再把结构化摘要交给 Gemini 或 DeepSeek 最终回答。
      const deepseekContextSummary = await buildDeepSeekContextSummary(env, {
        sessionKey, groupId: currentGroupId, userId, history, currentText: cleanMessage, relationContext
      });
      if (deepseekContextSummary) {
        finalStylePrompt += `\n\n【DeepSeek 整理后的上下文摘要】\n${deepseekContextSummary}`;
      }

      // ==========================================
      // 📦 上下文与多模态数据最终封装
      // ==========================================
      let aiInputParts = [];
      
      // 1. 如果是主动插话状态，微调行为模式
      let userPrompt = isAutoInterject
        ? `(你现在是主动凑热闹插话状态，请自然地接梗或搭腔，极度精简！不要像回答问题一样，只需1~2句话)\n${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${cleanMessage}`
        : `${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${cleanMessage}`;

      aiInputParts.push({ text: userPrompt });

      // 2. 注入多模态媒体 (图片/语音/视频)
      if (imageUrl) {
        const imageData = await fetchImageAsBase64(imageUrl);
        if (imageData) aiInputParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
      }
      if (voiceUrl) {
        const audioData = await fetchAudioAsBase64(voiceUrl);
        if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
      }
      if (videoUrl) {
        const videoData = await fetchVideoAsBase64(videoUrl);
        if (videoData) aiInputParts.push({ inlineData: { mimeType: videoData.mimeType, data: videoData.base64 } });
      }

      // 3. 将 System Prompt 转化为 Model 指令层
      let contents = [];
      contents.push({ role: "user", parts: [{ text: finalStylePrompt }] });
      contents.push({ role: "model", parts: [{ text: "好的，我已经完全理解并吸收了我的核心设定、人设覆盖指令以及时间数据。我将严格遵守所有铁律、限制与多模态互动指南，以群友的身份用极简的纯文字开始聊天。" }] });

      // 4. 将历史纪录 (History) 塞入对话流
      for (const msg of history) {
        contents.push(msg);
      }

      // 5. 压入本次用户的最新发言与附件
      contents.push({ role: "user", parts: aiInputParts });

      // 第八段到此完美结束，准备进入第九段的多模型轮询请求与响应处理...

      // ==========================================
      // 🔄 Gemini / DeepSeek 混合路由
      // ==========================================
      let finalReply = "";
      let success = false;
      let baseText = "";
      let usedModel = "";
      let usedProvider = "";
      const modelPref = await dbGet(env, `model_pref:${currentGroupId || 'private'}:${userId}`) || 'auto';
      try {
        const generated = await generateHybridReply(env, {
          modelPref, chatModels, finalStylePrompt, contents, cleanText: cleanMessage,
          hasMedia: Boolean(imageUrl || voiceUrl || videoUrl), userId, groupId: currentGroupId, isDeveloper
        });
        baseText = String(generated?.text || '').trim();
        usedModel = generated?.model || 'unknown';
        usedProvider = generated?.provider || 'unknown';
        success = Boolean(baseText);
      } catch (e) {
        console.error('Hybrid generation failed:', e);
      }

      if (success) {
        const totalCallsStr = await dbGet(env, 'STAT_TOTAL_CALLS');
        const totalCalls = totalCallsStr ? parseInt(totalCallsStr) : 0;
        ctx.waitUntil(dbPut(env, 'STAT_TOTAL_CALLS', String(totalCalls + 1)));
        ctx.waitUntil(dbPut(env, 'STAT_LAST_MODEL', `${usedProvider}:${usedModel}`));
      } else {
        if (isAutoInterject) return new Response(null, { status: 204 });
        return jsonReply(`${atSender}暂时无法完成回复，请稍后再试。`);
      }

      // ==========================================
      // 📝 D1 历史纪录保存与最终回覆动态处理
      // ==========================================
      
      // 1. 异步将本次对话双向写入 D1 历史纪录 (维持下一次的上下文)
      // 💡 注意：这里存入的是 baseText (纯文字的 @)，这样 AI 下次读取时才不会被 CQ 码搞混
      history.push({ role: 'user', parts: aiInputParts });
      history.push({ role: 'model', parts: [{ text: baseText }] }); 
      // 保持最近 8 条上下文流，防止 Token 爆炸
      if (history.length > 8) history = history.slice(-8); 
      ctx.waitUntil(dbPut(env, sessionKey, JSON.stringify(history)));

      // ==========================================
      // 🚀 最終回覆計畫：可引用、@、純文字或插話
      // ==========================================
      const replyText = sanitizeAiReply(baseText);
      const generatedMentionIds = extractTextMentionIds(replyText);
      const visibleReplyText = removeTextMentionTokens(replyText);
      const senderDndCheck = await dbGet(env, `dnd:${currentGroupId}:${userId}`) === "true";
      const replyPlan = buildReplyPlan({
        isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId: replyMessageId,
        userId, selfId: botId, targetMentionQqs, generatedMentionIds, senderDnd: senderDndCheck,
        text: visibleReplyText
      });
      const thinkingMessageIdForReply = activeThinkingMessageId;
      activeThinkingMessageId = null;
      return new Response(JSON.stringify({ reply: visibleReplyText, reply_plan: replyPlan, thinking_message_id: thinkingMessageIdForReply || null }), {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      // 兜底全域崩溃防护，确保 Worker 绝对不会死机
      console.error("全局严重错误:", err);
      await clearThinkingIndicator();
      ctx.waitUntil(writeSystemError(env, err, { url: request.url }));
      return new Response("OK (Handled Error)", { status: 200 });
    }
  }, // 结束 fetch 函式

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processDueSchedules(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(cleanupTransientState(env));
  }
}; // 结束 export default

// -----------------------------------------------------------------------------
// v0.2 core helpers: security, permissions, OneBot RPC, hybrid models, schedules
// -----------------------------------------------------------------------------

function developerId(env) {
  return String(env?.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);
}

function isDeveloperId(env, qq) {
  return Boolean(qq && String(qq) === developerId(env));
}

function parseList(value, fallback = []) {
  const list = String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  return list.length ? [...new Set(list)] : fallback.slice();
}

function numericId(value) {
  const text = String(value ?? "");
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : text;
}

function isPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = m.slice(1).map(Number); if (a.some(n => n > 255)) return true;
  return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224;
}

function assertSafePublicUrl(value) {
  let url; try { url = new URL(String(value || "")); } catch { throw new Error("网址格式无效"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只允许 HTTP 或 HTTPS");
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error("不允许访问私有或本机地址");
  return url;
}

async function fetchPublicUrl(value, options = {}, maxRedirects = 3) {
  let url = assertSafePublicUrl(value);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(url.toString(), { ...options, redirect: "manual" });
    if (![301,302,303,307,308].includes(res.status)) return res;
    const location = res.headers.get("Location"); if (!location) return res;
    url = assertSafePublicUrl(new URL(location, url).toString());
  }
  throw new Error("重定向次数过多");
}

async function fetchMediaAsBase64(value, maxBytes, allowedPrefixes) {
  const res = await fetchPublicUrl(value, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "QQAIbot/0.2" } }, 2);
  if (!res.ok) throw new Error(`媒体下载失败：${res.status}`);
  const length = Number(res.headers.get("Content-Length") || 0); if (length && length > maxBytes) throw new Error("媒体文件过大");
  const mimeType = String(res.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!allowedPrefixes.some(p => mimeType.startsWith(p))) throw new Error(`不支持的媒体类型：${mimeType}`);
  const buffer = await res.arrayBuffer(); if (buffer.byteLength > maxBytes) throw new Error("媒体文件过大");
  const bytes = new Uint8Array(buffer); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binary), mimeType, size: buffer.byteLength };
}

function verifyOneBotAccess(request, env) {
  const expected = String(env.ONEBOT_ACCESS_TOKEN || "").trim();
  if (!expected) return false;
  const url = new URL(request.url);
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const queryToken = url.searchParams.get("access_token") || url.searchParams.get("token") || "";
  return bearer === expected || queryToken === expected;
}

async function getFeatureFlag(env, name, fallback = false) {
  const raw = await dbGet(env, `feature:${name}`);
  if (raw === null || raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

async function setFeatureFlag(env, name, enabled) {
  await dbPut(env, `feature:${name}`, enabled ? "true" : "false");
}

async function isGroupWhitelisted(env, groupId) {
  if (!groupId) return false;
  return await dbGet(env, `group_whitelist:${groupId}`) === "true";
}

async function getPrivateAccessMode(env, userId) {
  if (isDeveloperId(env, userId)) return "full";
  const explicit = await dbGet(env, `private_access:${userId}`);
  if (["full", "commands", "none"].includes(explicit)) return explicit;
  return "none";
}

const PERMISSIONS = Object.freeze({
  AI_ADMIN: "ai_admin",
  GROUP_OPS: "group_ops",
  SCHEDULE_REVIEWER: "schedule_reviewer",
  APPEAL_REVIEWER: "appeal_reviewer",
  PRIVATE_FULL: "private_full",
  PRIVATE_COMMANDS: "private_commands",
});

function normalizePermissionName(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const map = new Map([
    ["ai管理", PERMISSIONS.AI_ADMIN], ["ai管理员", PERMISSIONS.AI_ADMIN], ["ai管理員", PERMISSIONS.AI_ADMIN], ["ai_admin", PERMISSIONS.AI_ADMIN],
    ["群操作", PERMISSIONS.GROUP_OPS], ["群管理操作", PERMISSIONS.GROUP_OPS], ["group_ops", PERMISSIONS.GROUP_OPS],
    ["排程审核", PERMISSIONS.SCHEDULE_REVIEWER], ["排程審核", PERMISSIONS.SCHEDULE_REVIEWER], ["schedule_reviewer", PERMISSIONS.SCHEDULE_REVIEWER],
    ["申诉审核", PERMISSIONS.APPEAL_REVIEWER], ["申訴審核", PERMISSIONS.APPEAL_REVIEWER], ["appeal_reviewer", PERMISSIONS.APPEAL_REVIEWER],
    ["私聊完整", PERMISSIONS.PRIVATE_FULL], ["private_full", PERMISSIONS.PRIVATE_FULL],
    ["私聊指令", PERMISSIONS.PRIVATE_COMMANDS], ["private_commands", PERMISSIONS.PRIVATE_COMMANDS],
  ]);
  return map.get(text) || null;
}

function permissionLabel(permission) {
  return ({
    ai_admin: "AI管理",
    group_ops: "群操作",
    schedule_reviewer: "排程审核",
    appeal_reviewer: "申诉审核",
    private_full: "完整私聊",
    private_commands: "私聊指令",
  })[permission] || permission;
}

async function setExplicitPermission(env, groupId, userId, permission, enabled) {
  if (permission === PERMISSIONS.PRIVATE_FULL || permission === PERMISSIONS.PRIVATE_COMMANDS) {
    if (enabled) await dbPut(env, `private_access:${userId}`, permission === PERMISSIONS.PRIVATE_FULL ? "full" : "commands");
    else await dbPut(env, `private_access:${userId}`, "none");
    return;
  }
  const key = `permission:${groupId}:${userId}:${permission}`;
  if (enabled) await dbPut(env, key, "true"); else await dbDel(env, key);
  await writeSystemAudit(env, { type: "permission", groupId, actorId: developerId(env), targetId: userId, action: enabled ? `grant:${permission}` : `revoke:${permission}` });
}

async function getEffectivePermissions(env, groupId, userId, senderRole = "member", isDeveloper = false) {
  const developer = isDeveloper || isDeveloperId(env, userId);
  const nativeAdmin = senderRole === "owner" || senderRole === "admin";
  const legacyAdmin = await dbGet(env, `admin_auth:${userId}`) === "true";
  const explicit = async p => await dbGet(env, `permission:${groupId}:${userId}:${p}`) === "true";
  const aiAdmin = developer || nativeAdmin || legacyAdmin || await explicit(PERMISSIONS.AI_ADMIN);
  const groupOps = developer || nativeAdmin || await explicit(PERMISSIONS.GROUP_OPS);
  const scheduleReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.SCHEDULE_REVIEWER);
  const appealReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.APPEAL_REVIEWER);
  return { developer, nativeAdmin, aiAdmin, groupOps, scheduleReviewer, appealReviewer };
}

async function writeSystemAudit(env, entry) {
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry };
  const keys = ["audit:system:global"];
  if (entry.groupId) keys.push(`audit:system:group:${entry.groupId}`);
  for (const key of keys) {
    const list = await readJson(env, key, []);
    list.push(item);
    await dbPut(env, key, JSON.stringify(list.slice(-1000)));
  }
  return item;
}

async function appendIndex(env, key, id, max = 2000) {
  const list = await readJson(env, key, []);
  if (!list.includes(id)) list.push(id);
  await dbPut(env, key, JSON.stringify(list.slice(-max)));
}

async function removeFromIndex(env, key, id) {
  const list = await readJson(env, key, []);
  await dbPut(env, key, JSON.stringify(list.filter(x => x !== id)));
}

function normalizeMemoryItems(value, owner = "") {
  const list = Array.isArray(value) ? value : [];
  return list.map(item => {
    if (typeof item === "string") return { id: crypto.randomUUID(), text: item, scope: "private", owner, migrated: true };
    if (item && typeof item === "object") return { id: item.id || crypto.randomUUID(), text: String(item.text || ""), scope: item.scope || "private", owner: String(item.owner || owner), ...item };
    return null;
  }).filter(item => item && item.text.trim());
}

function normalizeModelPreference(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[ _-]+/g, "");
  if (["自动", "自動", "auto"].includes(text)) return "auto";
  if (["gemini", "谷歌"].includes(text)) return "gemini";
  if (["deepseek", "deepseek不思考", "deepseekoff"].includes(text)) return "deepseek";
  if (["deepseekhigh", "high", "深度思考"].includes(text)) return "deepseek_high";
  if (["deepseekmax", "max", "极限", "極限"].includes(text)) return "deepseek_max";
  return null;
}

function modelPreferenceLabel(value) {
  return ({ auto: "自动", gemini: "Gemini", deepseek: "DeepSeek", deepseek_high: "DeepSeek High", deepseek_max: "DeepSeek Max" })[value] || "自动";
}

function normalizeFingerprintText(text) {
  return String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/@\d{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function outboundFingerprint(info) {
  const payload = [info.isGroup ? "g" : "p", String(info.groupId || info.peerId || ""), normalizeFingerprintText(info.text), ...(info.mediaTypes || []).sort()].join("|");
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) { hash ^= payload.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

async function markOutboundPending(env, info) {
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  await dbPut(env, key, JSON.stringify({ at: Date.now(), ...info }));
  return key;
}

async function isKnownOutboundMessage(env, info) {
  if (info.messageId) {
    const raw = await dbGet(env, `outbound:${info.messageId}`);
    if (raw) {
      const item = (() => { try { return JSON.parse(raw); } catch { return { at: Number(raw) || Date.now() }; } })();
      if (Date.now() - Number(item.at || 0) < 10 * 60 * 1000) return true;
    }
  }
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  const raw = await dbGet(env, key);
  if (!raw) return false;
  let item = null;
  try { item = JSON.parse(raw); } catch {}
  if (!item || Date.now() - Number(item.at || 0) > 2 * 60 * 1000) { await dbDel(env, key); return false; }
  await dbDel(env, key);
  return true;
}

async function callOneBotAction(env, actionPayload, timeoutMs = 15000) {
  if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
  const payload = actionPayload.action ? actionPayload : { action: actionPayload?.action, params: actionPayload?.params || {} };
  const res = await getOneBotHub(env).fetch("https://onebot-hub/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timeoutMs })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `ONEBOT_RPC_${res.status}`);
  return data.data;
}

async function runOneBotGroupOperation(env, action, params, audit) {
  if (!env.ONEBOT_ACCESS_TOKEN) return { ok: false, error: "尚未配置 ONEBOT_ACCESS_TOKEN" };
  try {
    const data = await callOneBotAction(env, { action, params }, 20000);
    await writeSystemAudit(env, { type: "group_operation", ...audit, params });
    return { ok: true, data };
  } catch (error) {
    await writeSystemAudit(env, { type: "group_operation_failed", ...audit, params, error: String(error.message || error) });
    return { ok: false, error: String(error.message || error) };
  }
}

async function recordStructuredMessage(env, item) {
  const record = {
    messageId: String(item.messageId || ""), groupId: String(item.groupId || ""),
    senderId: String(item.senderId || item.userId || ""), senderName: String(item.senderName || item.senderId || item.userId || ""),
    text: String(item.text || ""), mentions: item.mentions || [], replyId: item.replyId || "",
    source: item.source || "human", createdAt: Date.now()
  };
  if (record.messageId) await dbPut(env, `message:${record.groupId}:${record.messageId}`, JSON.stringify(record));
  if (record.groupId) {
    const key = `recent_logs:${record.groupId}`;
    const logs = await readJson(env, key, []);
    logs.push(`[${record.senderName}(QQ:${record.senderId})]: ${record.text}`);
    await dbPut(env, key, JSON.stringify(logs.slice(-200)));
  }
  return record;
}

function extractOutboundMediaTypes(message) {
  const types = new Set();
  const scan = value => {
    const text = String(value || "");
    if (/\[CQ:image,/i.test(text)) types.add("image");
    if (/\[CQ:record,/i.test(text)) types.add("record");
    if (/\[CQ:video,/i.test(text)) types.add("video");
  };
  if (typeof message === "string") scan(message);
  else if (Array.isArray(message)) for (const part of message) {
    if (["image", "record", "video"].includes(part?.type)) types.add(part.type);
    if (part?.type === "text") scan(part.data?.text);
  }
  return [...types].sort();
}

function extractMessageText(message) {
  if (typeof message === "string") return message
    .replace(/\[CQ:at,[^\]]*qq=(\d+|all)[^\]]*\]/g, "@$1")
    .replace(/\[CQ:image,[^\]]+\]/g, "[图片]")
    .replace(/\[CQ:record,[^\]]+\]/g, "[语音]")
    .replace(/\[CQ:video,[^\]]+\]/g, "[视频]")
    .replace(/\[CQ:reply,[^\]]+\]/g, "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .trim();
  if (!Array.isArray(message)) return "";
  return message.map(part => part?.type === "text" ? String(part.data?.text || "") : part?.type === "at" ? `@${part.data?.qq || ""}` : part?.type === "image" ? "[图片]" : part?.type === "record" ? "[语音]" : part?.type === "video" ? "[视频]" : "").join("").trim();
}

async function getQuotedMessage(env, groupId, messageId) {
  const cached = await dbGet(env, `message:${groupId}:${messageId}`);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && typeof obj === "object") return obj;
    } catch {
      return { messageId, groupId, senderId: "", senderName: "", text: cached, source: "unknown" };
    }
  }
  try {
    const data = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(messageId) } }, 12000);
    const senderId = String(data?.sender?.user_id || data?.user_id || "");
    const obj = {
      messageId: String(messageId), groupId: String(groupId || data?.group_id || ""), senderId,
      senderName: String(data?.sender?.card || data?.sender?.nickname || senderId),
      text: extractMessageText(data?.message || data?.raw_message || ""),
      message: data?.message || null,
      source: data?.source === "ai" || senderId === String(data?.self_id || "") ? "ai" : "human",
      createdAt: Number(data?.time || 0) * 1000 || Date.now()
    };
    await dbPut(env, `message:${obj.groupId}:${messageId}`, JSON.stringify(obj));
    return obj;
  } catch (error) {
    return null;
  }
}

function parseDurationSeconds(text) {
  const input = String(text || "").trim();
  const m = input.match(/(\d+(?:\.\d+)?)\s*(分钟|分鐘|分|小时|小時|时|時|天)?/);
  const value = Math.max(1, Number(m?.[1] || 10));
  const unit = m?.[2] || "分";
  const seconds = unit === "天" ? value * 86400 : /小时|小時|时|時/.test(unit) ? value * 3600 : value * 60;
  return Math.round(Math.min(seconds, 30 * 86400));
}

function formatDuration(seconds) {
  if (seconds % 86400 === 0) return `${seconds / 86400}天`;
  if (seconds % 3600 === 0) return `${seconds / 3600}小时`;
  return `${Math.round(seconds / 60)}分钟`;
}

function sanitizeAiReply(text) {
  return String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim()
    .slice(0, 4000);
}

function extractTextMentionIds(text) {
  return [...new Set([...String(text || "").matchAll(/@(\d{5,})/g)].map(m => m[1]))];
}

function removeTextMentionTokens(text) {
  return String(text || "").replace(/@\d{5,}\s*/g, "").replace(/\s{2,}/g, " ").trim();
}

function buildReplyPlan({ isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId, userId, selfId, targetMentionQqs = [], generatedMentionIds = [], senderDnd, text }) {
  if (!isGroup) return { mode: "plain", text, mentionIds: [], replyId: "" };
  const mentionIds = [...new Set([...generatedMentionIds, ...(botMentioned ? targetMentionQqs : [])])].filter(x => x && x !== selfId);
  let replyId = "";
  let mode = "plain";
  if (isAutoInterject) {
    mode = mentionIds.length ? "mention_targets" : "plain";
  } else if (quotedMessageId) {
    mode = mentionIds.length ? "reply_targets" : "reply_only";
    replyId = String(messageId || "");
  } else if (botMentioned) {
    if (mentionIds.length) mode = "reply_targets";
    else if (senderDnd) mode = "reply_only";
    else { mode = "reply_mention"; mentionIds.push(String(userId)); }
    replyId = String(messageId || "");
  } else if (mentionIds.length) {
    mode = "mention_targets";
  }
  return { mode, text, mentionIds, replyId, quoteMessageId: replyId };
}

async function sendThinkingIndicator(env, { isGroup, groupId, userId, text }) {
  const action = isGroup ? "send_group_msg" : "send_private_msg";
  const params = isGroup
    ? { group_id: numericId(groupId), message: [{ type: "text", data: { text: String(text || "正在思考...") } }], auto_escape: false }
    : { user_id: numericId(userId), message: String(text || "正在思考..."), auto_escape: false };
  const data = await callOneBotAction(env, { action, params }, 12000);
  return String(data?.message_id || data?.messageId || data || "");
}

function flattenGeminiContents(contents) {
  const result = [];
  for (const item of contents || []) {
    const role = item.role === "model" ? "assistant" : "user";
    const text = (item.parts || []).map(p => p.text || (p.inlineData ? `[${p.inlineData.mimeType || "媒体"}]` : "")).filter(Boolean).join("\n");
    if (text) result.push({ role, content: text });
  }
  return result;
}

function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function getQuotaNumber(env, key, fallback = Infinity) {
  const raw = await dbGet(env, key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function estimateTokenCount(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 3));
}

function deepSeekCostCny(model, usage = {}) {
  const pro = String(model).includes("pro");
  const hitPrice = pro ? 0.025 : 0.02;
  const missPrice = pro ? 3 : 1;
  const outPrice = pro ? 6 : 2;
  const hit = Number(usage.prompt_cache_hit_tokens || 0);
  const miss = Number(usage.prompt_cache_miss_tokens || Math.max(0, Number(usage.prompt_tokens || 0) - hit));
  const output = Number(usage.completion_tokens || 0);
  return hit / 1e6 * hitPrice + miss / 1e6 * missPrice + output / 1e6 * outPrice;
}

async function checkDeepSeekBudget(env, { userId, groupId, estimatedCny }) {
  const day = taipeiDateKey();
  const globalSpent = Number(await dbGet(env, `usage:deepseek:global:${day}`) || 0);
  const groupSpent = Number(await dbGet(env, `usage:deepseek:group:${day}:${groupId}`) || 0);
  const userSpent = Number(await dbGet(env, `usage:deepseek:user:${day}:${userId}`) || 0);
  const globalLimit = await getQuotaNumber(env, "quota:deepseek:global_daily_cny", Number(env.DEEPSEEK_DAILY_BUDGET_CNY || Infinity));
  const groupLimit = await getQuotaNumber(env, `quota:deepseek:group:${groupId}`, Infinity);
  const userLimit = await getQuotaNumber(env, `quota:deepseek:user:${userId}`, Infinity);
  return {
    ok: globalSpent + estimatedCny <= globalLimit && groupSpent + estimatedCny <= groupLimit && userSpent + estimatedCny <= userLimit,
    day, globalSpent, groupSpent, userSpent, globalLimit, groupLimit, userLimit
  };
}

async function recordDeepSeekUsage(env, { userId, groupId, model, usage }) {
  const day = taipeiDateKey();
  const cost = deepSeekCostCny(model, usage);
  for (const key of [`usage:deepseek:global:${day}`, `usage:deepseek:group:${day}:${groupId}`, `usage:deepseek:user:${day}:${userId}`]) {
    const current = Number(await dbGet(env, key) || 0);
    await dbPut(env, key, String(current + cost));
  }
  await appendIndex(env, "usage:deepseek:log:index", `${Date.now()}:${crypto.randomUUID()}`, 2000);
  return cost;
}

async function callDeepSeek(env, { messages, userId, groupId, thinking = "disabled", effort = "high", maxTokens = 1200, model }) {
  if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY_MISSING");
  const selectedModel = model || (thinking === "disabled" ? (env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel) : (env.DEEPSEEK_PRO_MODEL || DEFAULTS.deepseekProModel));
  const promptText = messages.map(m => `${m.role}:${m.content}`).join("\n");
  const estimatedTokens = estimateTokenCount(promptText) + maxTokens;
  const estimatedCny = estimatedTokens / 1e6 * (selectedModel.includes("pro") ? 6 : 2);
  const budget = await checkDeepSeekBudget(env, { userId, groupId, estimatedCny });
  if (!budget.ok) throw new Error("DEEPSEEK_BUDGET_EXCEEDED");
  const payload = { model: selectedModel, messages, stream: false, max_tokens: maxTokens, thinking: { type: thinking } };
  if (thinking === "enabled") payload.reasoning_effort = effort === "max" ? "max" : "high";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(thinking === "enabled" ? 60000 : 30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`DEEPSEEK_${response.status}:${data?.error?.message || "UNKNOWN"}`);
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  await recordDeepSeekUsage(env, { userId, groupId, model: selectedModel, usage: data.usage || {} });
  return { text, model: selectedModel, usage: data.usage || {} };
}

async function callGemmaDecision(env, { system, prompt, maxOutputTokens = 64 }) {
  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  if (!keys.length) throw new Error("GEMMA_API_KEYS_MISSING");
  const models = parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]);
  let lastError = "GEMMA_DECISION_FAILED";
  for (const model of models) {
    for (const key of keys) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
            systemInstruction: { parts: [{ text: String(system || "只输出分类结果。") }] },
            generationConfig: {
              maxOutputTokens,
              temperature: 0,
              thinkingConfig: { thinkingLevel: "minimal" }
            }
          }),
          signal: AbortSignal.timeout(15000)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const parts = data.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(part => !part.thought).map(part => part.text || "").join("").trim();
          if (text) return { text, model, usage: data.usageMetadata || {} };
        }
        lastError = `GEMMA_${response.status}:${data?.error?.message || "UNKNOWN"}`;
      } catch (error) {
        lastError = String(error?.message || error);
      }
    }
  }
  throw new Error(lastError);
}

async function callGeminiGenerate(env, { models, system, contents, maxOutputTokens = 1000, temperature = 0.7, useSearch = true }) {
  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  if (!keys.length) throw new Error("GEMINI_API_KEYS_MISSING");
  let lastError = "GEMINI_FAILED";
  for (const model of models) {
    for (const key of keys) {
      const body = {
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens, temperature }
      };
      if (useSearch) body.tools = [{ googleSearch: {} }];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
            if (text) return { text, model, usage: data.usageMetadata || {} };
          }
          lastError = `GEMINI_${response.status}:${data?.error?.message || "UNKNOWN"}`;
          if (response.status === 400 && body.tools) { delete body.tools; continue; }
          break;
        } catch (error) { lastError = String(error.message || error); break; }
      }
    }
  }
  throw new Error(lastError);
}

async function routeProviderWithGemma(env, text) {
  try {
    const result = await callGemmaDecision(env, {
      system: "你是模型路由分类器。只能输出 GEMINI、DEEPSEEK_HIGH 或 DEEPSEEK_MAX。需要图片、语音、视频、多模态或 Google 搜索的任务选 GEMINI；复杂代码、严谨推理、长分析选 DEEPSEEK_HIGH；极高难度、多阶段证明或大型架构分析选 DEEPSEEK_MAX。普通聊天、简单问答选 GEMINI。",
      prompt: String(text).slice(0, 3000),
      maxOutputTokens: 20
    });
    const upper = result.text.toUpperCase();
    if (upper.includes("MAX")) return "deepseek_max";
    if (upper.includes("DEEPSEEK")) return "deepseek_high";
    return "gemini";
  } catch (error) {
    console.warn("Gemma provider routing unavailable, using local rules:", error);
    return /大型|完整架构|完整架構|严格证明|嚴格證明|深度研究|全面分析/i.test(text) && text.length > 800
      ? "deepseek_max"
      : /代码|程式|证明|證明|推理|分析|规划|規劃|debug|架构|架構/i.test(text) && text.length > 80
        ? "deepseek_high"
        : "gemini";
  }
}

async function generateHybridReply(env, args) {
  let pref = args.modelPref || "auto";
  if (args.hasMedia) pref = "gemini";
  if (pref === "auto") pref = await routeProviderWithGemma(env, args.cleanText);
  const deepseekEnabled = await getFeatureFlag(env, "deepseek_enabled", true);
  if (pref.startsWith("deepseek") && deepseekEnabled && env.DEEPSEEK_API_KEY && !args.hasMedia) {
    const thinking = pref === "deepseek" ? "disabled" : "enabled";
    const effort = pref === "deepseek_max" ? "max" : "high";
    try {
      const messages = [{ role: "system", content: args.finalStylePrompt }, ...flattenGeminiContents(args.contents).slice(-16)];
      const result = await callDeepSeek(env, { messages, userId: args.userId, groupId: args.groupId || "private", thinking, effort, maxTokens: 1000 });
      return { provider: "deepseek", ...result };
    } catch (error) {
      console.warn("DeepSeek fallback to Gemini:", error);
    }
  }
  try {
    const result = await callGeminiGenerate(env, { models: args.chatModels, system: args.finalStylePrompt, contents: args.contents, maxOutputTokens: 1000, temperature: 0.82, useSearch: true });
    return { provider: "gemini", ...result };
  } catch (geminiError) {
    if (deepseekEnabled && env.DEEPSEEK_API_KEY && !args.hasMedia) {
      const messages = [{ role: "system", content: args.finalStylePrompt }, ...flattenGeminiContents(args.contents).slice(-16)];
      const result = await callDeepSeek(env, { messages, userId: args.userId, groupId: args.groupId || "private", thinking: "disabled", maxTokens: 1000 });
      return { provider: "deepseek", ...result };
    }
    throw geminiError;
  }
}

async function buildDeepSeekContextSummary(env, { sessionKey, groupId, userId, history, currentText, relationContext }) {
  if (!env.DEEPSEEK_API_KEY || !(await getFeatureFlag(env, "deepseek_enabled", true)) || !history?.length) return "";
  const source = history.slice(-12).map((m, i) => `${i + 1}. ${m.role}: ${(m.parts || []).map(p => p.text || "[媒体]").join(" ")}`).join("\n");
  const signature = outboundFingerprint({ isGroup: true, groupId, text: source + currentText + relationContext, mediaTypes: [] });
  const cached = await readJson(env, `context_summary:${sessionKey}`, null);
  if (cached?.signature === signature) return cached.summary || "";
  try {
    const previous = cached?.summary || "无旧摘要";
    const prompt = `旧摘要：\n${previous}\n\n最近消息：\n${source}\n\n当前消息：${currentText}\n${relationContext || ""}\n\n请输出简体中文结构化摘要，保留人物QQ、谁对谁说话、引用与@关系、事实、决定、未决问题和当前情绪。不要编造，控制在1200字内。`;
    const result = await callDeepSeek(env, {
      userId: `summary:${groupId || userId}`, groupId: groupId || "private", thinking: "disabled", maxTokens: 900,
      model: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel,
      messages: [{ role: "system", content: "你是群聊上下文压缩器。只整理事实与关系，输出简体中文。" }, { role: "user", content: prompt }]
    });
    await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, updatedAt: Date.now() }));
    return result.text;
  } catch (error) {
    console.warn("DeepSeek context summary failed:", error);
    return cached?.summary || "";
  }
}

async function notifyDeveloper(env, message) {
  try {
    await callOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(developerId(env)), message: String(message), auto_escape: false } }, 12000);
    return true;
  } catch (error) {
    console.warn("notifyDeveloper failed", error);
    return false;
  }
}

async function getWhitelistedGroupsForUser(env, userId) {
  let groups = [];
  try {
    const list = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: false } }, 15000);
    groups = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];
  } catch {
    const known = await readJson(env, "known_groups", []);
    groups = known;
  }
  const result = [];
  for (const group of groups.slice(0, 300)) {
    const groupId = String(group.group_id || group.groupId || group.id || "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) continue;
    let member = null;
    try {
      member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 8000);
    } catch {
      member = (await readJson(env, `group_members:${groupId}`, [])).find(x => String(x.qq) === String(userId));
    }
    if (!member) continue;
    result.push({ groupId, groupName: String(group.group_name || group.groupName || groupId), role: String(member.role || "member"), card: String(member.card || member.nickname || userId) });
  }
  return result;
}

async function filterAuthorizedReviewers(env, groupId, reviewerIds, kind) {
  const valid = [], invalid = [];
  for (const reviewerId of [...new Set((reviewerIds || []).map(String).filter(Boolean))]) {
    const role = await resolvePortalRole(env, reviewerId, groupId);
    const perms = await getEffectivePermissions(env, groupId, reviewerId, role, isDeveloperId(env, reviewerId));
    const allowed = kind === "schedule" ? (perms.scheduleReviewer || perms.groupOps || perms.nativeAdmin || perms.developer) : (perms.appealReviewer || perms.nativeAdmin || perms.developer);
    (allowed ? valid : invalid).push(reviewerId);
  }
  return { valid, invalid };
}

async function getGroupOwnerId(env, groupId) {
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    const owner = (Array.isArray(members) ? members : []).find(m => m.role === "owner");
    return owner ? String(owner.user_id || owner.qq || "") : "";
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return String(members.find(m => m.role === "owner")?.qq || "");
  }
}

async function verifyGroupMembership(env, groupId, userId) {
  if (!(await isGroupWhitelisted(env, groupId))) return false;
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 10000);
    return Boolean(member && (member.user_id || member.qq || member.nickname));
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return members.some(x => String(x.qq) === String(userId));
  }
}

function parseScheduleRequest(text, now = Date.now()) {
  const raw = String(text || "").trim();
  let m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) {
    const at = parseTaipeiDateTime(`${m[1]} ${m[2]}`);
    if (!at || at <= now) return { ok: false, message: "单次排程时间必须晚于现在。" };
    return { ok: true, type: "once", nextRunAt: at, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  m = raw.match(/^每天\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "daily", timeOfDay: m[1], nextRunAt: nextTaipeiTime(m[1], now), content: m[2].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每周([一二三四五六日天])\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "weekly", weekday: "一二三四五六日".indexOf(m[1]) + 1 || 7, timeOfDay: m[2], nextRunAt: nextTaipeiWeekday(m[1], m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每月(\d{1,2})日\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "monthly", dayOfMonth: Math.min(28, Math.max(1, Number(m[1]))), timeOfDay: m[2], nextRunAt: nextTaipeiMonthly(Number(m[1]), m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每隔\s*(\d+)\s*(分钟|分鐘|分|小时|小時|时|時|天)\s+([\s\S]+)$/);
  if (m) {
    const seconds = parseDurationSeconds(`${m[1]}${m[2]}`);
    if (seconds < DEFAULTS.scheduleMinIntervalMinutes * 60) return { ok: false, message: `重复排程最短间隔为 ${DEFAULTS.scheduleMinIntervalMinutes} 分钟。` };
    return { ok: true, type: "interval", intervalMs: seconds * 1000, nextRunAt: now + seconds * 1000, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  return { ok: false, message: "格式示例：!排程 2026-07-22 18:00 内容；!排程 每天 18:00 内容；!排程 每周一 18:00 内容；!排程 每隔 2小时 内容" };
}

function parseTaipeiDateTime(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 8, Number(m[5]));
}

function taipeiParts(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date(ms));
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function nextTaipeiTime(time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number);
  let target = parseTaipeiDateTime(`${p.year}-${p.month}-${p.day} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) target += 86400000;
  return target;
}

function nextTaipeiWeekday(char, time, now = Date.now()) {
  const targetDay = ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 })[char] || 1;
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const p = taipeiParts(now); const current = weekdayMap[p.weekday] || 1;
  let days = (targetDay - current + 7) % 7;
  let target = nextTaipeiTime(time, now + days * 86400000 - (days ? 1 : 0));
  if (days && target < now + days * 86400000 - 3600000) target += 86400000;
  return target;
}

function nextTaipeiMonthly(day, time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number); const safeDay = Math.min(28, Math.max(1, day));
  let y = Number(p.year), mo = Number(p.month);
  let target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) { mo++; if (mo > 12) { mo = 1; y++; } target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`); }
  return target;
}

async function reviewScheduleWithGemma(env, content) {
  try {
    const result = await callGemmaDecision(env, {
      system: "你是排程安全审查器。判断是否明显违法、骚扰、洗版、冒充、泄露隐私、恶意群管理或其他滥用。只输出JSON：{\"decision\":\"allow|uncertain|reject\",\"reason\":\"简短原因\"}。不确定就uncertain。",
      prompt: String(content).slice(0, 4000),
      maxOutputTokens: 120
    });
    const json = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return ["allow", "uncertain", "reject"].includes(json.decision) ? json : { decision: "uncertain", reason: "无法稳定判断" };
  } catch (error) {
    console.warn("Gemma schedule review unavailable:", error);
    return { decision: "uncertain", reason: "审查服务暂时不可用" };
  }
}

function parseManagementScheduleAction(content) {
  const text = String(content || "").trim();
  const m = text.match(/^[!！](禁言|解禁|踢出|撤回|全员禁言|全員禁言|解除全员禁言|解除全員禁言|改群名|改名片|关闭ai|關閉ai|开启ai|開啟ai|记忆开|記憶開|记忆关|記憶關)(?:\s|$)/i);
  return m ? { command: m[1], raw: text } : null;
}

async function createScheduleRecord(env, data) {
  const id = `sch_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const record = { id, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null, lastResult: null, failureCount: 0, reviewerIds: [], votes: {}, approvalRule: "single", ...data };
  await dbPut(env, `schedule:${id}`, JSON.stringify(record));
  await appendIndex(env, "schedule:index", id, 5000);
  return record;
}

async function listUserSchedules(env, userId, groupId = "") {
  const ids = await readJson(env, "schedule:index", []); const result = [];
  for (const id of ids.slice(-1000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (item && item.creatorId === userId && (!groupId || item.groupId === groupId) && !["deleted"].includes(item.status)) result.push(item);
  }
  return result.sort((a, b) => Number(a.nextRunAt || Infinity) - Number(b.nextRunAt || Infinity));
}

async function countActiveSchedulesForUser(env, userId) {
  const list = await listUserSchedules(env, userId);
  return list.filter(x => x.enabled && ["active", "pending_owner", "pending_review"].includes(x.status)).length;
}

function formatScheduleLine(item) {
  const time = item.nextRunAt ? new Date(item.nextRunAt).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" }) : "无下次时间";
  return `${item.id}｜${item.status}｜${time}｜${String(item.content || "").slice(0, 60)}`;
}

async function cancelSchedule(env, id, actorId, canManage = false) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item) return { ok: false, message: "找不到该排程。" };
  if (item.creatorId !== actorId && !canManage) return { ok: false, message: "你没有取消该排程的权限。" };
  item.enabled = false; item.status = "cancelled"; item.cancelledAt = new Date().toISOString(); item.cancelledBy = actorId;
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, message: `排程 ${id} 已取消。` };
}

function scheduleApprovalReached(record) {
  const reviewers = record.reviewerIds || [];
  const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length;
  const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (rejects > 0 && record.approvalRule === "all") return { done: true, approved: false };
  if (record.approvalRule === "all") return { done: approvals === reviewers.length && reviewers.length > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}

async function voteSchedule(env, id, reviewerId, vote) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核任务。" };
  item.votes ||= {}; item.votes[reviewerId] = vote;
  const state = scheduleApprovalReached(item);
  if (state.done) { item.status = state.approved ? "active" : "rejected"; item.enabled = Boolean(state.approved); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, item };
}

async function executeManagementSchedule(env, record) {
  const raw = record.managementAction?.raw || "";
  const target = raw.match(/@(\d{5,})|\b(\d{5,})\b/)?.slice(1).find(Boolean);
  if (/^[!！]禁言/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: parseDurationSeconds(raw) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程禁言" });
  if (/^[!！]解禁/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: 0 }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程解禁" });
  if (/^[!！]踢出/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_kick", { group_id: numericId(record.groupId), user_id: numericId(target), reject_add_request: false }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程踢出" });
  if (/^[!！]全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: true }, { actorId: record.creatorId, groupId: record.groupId, action: "排程全员禁言" });
  if (/^[!！]解除全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: false }, { actorId: record.creatorId, groupId: record.groupId, action: "排程解除全员禁言" });
  if (/^[!！]撤回/.test(raw) && target) return runOneBotGroupOperation(env, "delete_msg", { message_id: numericId(target) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程撤回" });
  if (/^[!！]改群名/.test(raw)) { const value = raw.replace(/^[!！]改群名\s*/, "").trim(); if (!value) return { ok: false, error: "缺少新群名" }; return runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(record.groupId), group_name: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, action: "排程改群名" }); }
  if (/^[!！]改名片/.test(raw) && target) { const value = raw.replace(/^[!！]改名片\s*/, "").replace(new RegExp(`@?${target}`), "").trim(); if (!value) return { ok: false, error: "缺少新名片" }; return runOneBotGroupOperation(env, "set_group_card", { group_id: numericId(record.groupId), user_id: numericId(target), card: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程改名片" }); }
  if (/^[!！](关闭|關閉)ai/i.test(raw)) { await dbPut(env, `ai_off:${record.groupId}`, "true"); return { ok: true }; }
  if (/^[!！](开启|開啟)ai/i.test(raw)) { await dbDel(env, `ai_off:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆开|記憶開)/.test(raw)) { await dbDel(env, `memo:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆关|記憶關)/.test(raw)) { await dbPut(env, `memo:${record.groupId}`, "false"); return { ok: true }; }
  return { ok: false, error: "不支持的管理排程动作" };
}

function computeNextScheduleRun(record, after = Date.now()) {
  if (record.type === "once") return null;
  if (record.type === "interval") return after + Number(record.intervalMs || 3600000);
  if (record.type === "daily") return nextTaipeiTime(record.timeOfDay, after + 60000);
  if (record.type === "weekly") return nextTaipeiWeekday("一二三四五六日"[Number(record.weekday || 1) - 1], record.timeOfDay, after + 60000);
  if (record.type === "monthly") return nextTaipeiMonthly(record.dayOfMonth, record.timeOfDay, after + 60000);
  return null;
}

async function processDueSchedules(env, now = Date.now()) {
  const ids = await readJson(env, "schedule:index", []);
  for (const id of ids.slice(-5000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || !item.enabled || item.status !== "active" || Number(item.nextRunAt || Infinity) > now) continue;
    if (!(await isGroupWhitelisted(env, item.groupId))) { item.status = "paused"; item.lastResult = "群不在白名单"; await dbPut(env, `schedule:${id}`, JSON.stringify(item)); continue; }
    try {
      let result;
      if (item.managementAction) result = await executeManagementSchedule(env, item);
      else {
        let message = String(item.content || "");
        if (/^(AI生成|AI生成：|AI:)/i.test(message)) {
          const prompt = message.replace(/^(AI生成|AI生成：|AI:)/i, "").trim();
          const generated = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]), system: "生成适合QQ群发送的简体中文内容，不讨论模型身份。", contents: [{ role: "user", parts: [{ text: prompt }] }], maxOutputTokens: 500, temperature: 0.8, useSearch: false });
          message = generated.text;
        }
        await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message, auto_escape: false } }, 15000);
        result = { ok: true };
      }
      if (!result?.ok) throw new Error(result?.error || "执行失败");
      item.lastRunAt = new Date(now).toISOString(); item.lastResult = "success"; item.failureCount = 0;
      const next = computeNextScheduleRun(item, now);
      if (next) item.nextRunAt = next; else { item.enabled = false; item.status = "completed"; item.nextRunAt = null; }
    } catch (error) {
      item.failureCount = Number(item.failureCount || 0) + 1; item.lastResult = String(error.message || error);
      if (item.failureCount >= 3) { item.status = "paused"; item.enabled = false; await notifyDeveloper(env, `【排程已暂停】\n编号：${id}\n原因：${item.lastResult}`); }
      else item.nextRunAt = now + 5 * 60 * 1000;
    }
    await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  }
  await processActiveSpeaking(env, now);
}

async function processActiveSpeaking(env, now = Date.now()) {
  const groups = await readJson(env, "active_speaking:groups", []);
  for (const groupId of groups) {
    if (!(await getFeatureFlag(env, `active_speaking:${groupId}`, false)) || !(await isGroupWhitelisted(env, groupId))) continue;
    const config = await readJson(env, `active_speaking:config:${groupId}`, { quietMinutes: 60, startHour: 9, endHour: 23, maxDaily: 3 });
    const p = taipeiParts(now); const hour = Number(p.hour); if (hour < config.startHour || hour >= config.endHour) continue;
    const lastMessage = Number(await dbGet(env, `group_last_message:${groupId}`) || 0); if (now - lastMessage < config.quietMinutes * 60000) continue;
    const dayKey = taipeiDateKey(new Date(now)); const countKey = `active_speaking:count:${groupId}:${dayKey}`; const count = Number(await dbGet(env, countKey) || 0); if (count >= config.maxDaily) continue;
    const lastSpeak = Number(await dbGet(env, `active_speaking:last:${groupId}`) || 0); if (now - lastSpeak < config.quietMinutes * 60000) continue;
    try {
      const result = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.1-flash-lite", "gemini-3.5-flash"]), system: "生成一句自然的QQ群开场话题，简体中文，不提AI身份，不引用私人记忆，不@任何人。", contents: [{ role: "user", parts: [{ text: "群里有一段时间没人说话，请自然开启一个轻松话题。" }] }], maxOutputTokens: 120, temperature: 0.9, useSearch: false });
      await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: result.text, auto_escape: false } }, 12000);
      await dbPut(env, countKey, String(count + 1)); await dbPut(env, `active_speaking:last:${groupId}`, String(now));
    } catch {}
  }
}

async function cleanupTransientState(env) {
  if (!env.DB) return;
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'outbound_pending:%' OR key LIKE 'outbound:%' OR key LIKE 'notice:not_whitelisted:%'").all();
    for (const row of rows.results || []) {
      let at = Number(row.value || 0); try { at = Number(JSON.parse(row.value)?.at || at); } catch {}
      if (at && at < cutoff) await dbDel(env, row.key);
    }
  } catch (error) { console.warn("cleanup failed", error); }
}

async function createAppealFromText(env, applicantId, text) {
  const groupId = String(text.match(/\b(\d{5,})\b/)?.[1] || await dbGet(env, `private_default_group:${applicantId}`) || "");
  if (!groupId) return { ok: false, message: "请提供群号，例如：!申诉 808882936 禁言 详细内容" };
  if (!(await isGroupWhitelisted(env, groupId))) return { ok: false, message: "该群不属于可使用 AI 的白名单群。" };
  if (!(await verifyGroupMembership(env, groupId, applicantId))) return { ok: false, message: "无法确认你是该白名单群的成员。" };
  const rest = text.replace(groupId, "").trim(); const type = rest.split(/\s+/)[0] || "其他"; const content = rest.slice(type.length).trim();
  if (!content) return { ok: false, message: "请填写完整申诉内容。" };
  const id = `app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const appeal = { id, anonymousLabel: `匿名申诉-${id.slice(-6)}`, applicantId: String(applicantId), groupId, type, content, status: "pending_owner", createdAt: new Date().toISOString(), reviewerIds: [], votes: {}, approvalRule: "single", result: "", againstAdmin: /管理|群主|开发者|開發者/i.test(type + content), recommendedReviewerRole: /管理|群主|开发者|開發者/i.test(type + content) ? "owner" : "developer_choice" };
  await dbPut(env, `appeal:${id}`, JSON.stringify(appeal)); await appendIndex(env, "appeal:index", id, 5000);
  return { ok: true, appeal };
}

function sanitizeAppealForReviewer(appeal, viewerIsDeveloper = false) {
  const copy = { ...appeal };
  if (!viewerIsDeveloper) delete copy.applicantId;
  return copy;
}

function appealApprovalReached(record) {
  const reviewers = record.reviewerIds || []; const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length; const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (record.approvalRule === "all") return { done: approvals === reviewers.length || rejects > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}

async function voteAppeal(env, id, reviewerId, vote, note = "") {
  const item = await readJson(env, `appeal:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核案件。" };
  item.votes ||= {}; item.voteNotes ||= {}; item.votes[reviewerId] = vote; item.voteNotes[reviewerId] = note;
  const state = appealApprovalReached(item); if (state.done) { item.status = state.approved ? "approved" : "rejected"; item.result = note || (state.approved ? "申诉通过" : "申诉驳回"); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `appeal:${id}`, JSON.stringify(item));
  return { ok: true, item };
}

async function processConflictSignal(env, { groupId, userId, senderName, text, botId }) {
  const rough = /滚|闭嘴|垃圾|废物|智障|傻逼|妈的|操你|去死|有病|恶心|人身攻击|吵架/i.test(text);
  const state = await readJson(env, `conflict:${groupId}`, { stage: 0, updatedAt: 0, participants: [] });
  if (!rough && Date.now() - Number(state.updatedAt || 0) > 10 * 60 * 1000) return null;
  let conflict = rough;
  try {
    const logs = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-12).join("\n");
    const result = await callGemmaDecision(env, {
      system: "判断QQ群最近对话是否正在发生真实持续争吵或人身攻击。只输出JSON：{\"conflict\":true/false,\"severity\":0-3}。玩笑互呛应为false。",
      prompt: logs,
      maxOutputTokens: 80
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}"); conflict = Boolean(obj.conflict);
  } catch {}
  if (!conflict) { if (state.stage) await dbDel(env, `conflict:${groupId}`); return null; }
  state.stage = Math.min(3, Number(state.stage || 0) + 1); state.updatedAt = Date.now(); state.participants = [...new Set([...(state.participants || []), userId])];
  await dbPut(env, `conflict:${groupId}`, JSON.stringify(state));
  if (state.stage === 1) return { replyText: "先停一下，语气已经有点冲了。把事情说清楚就好，别继续针对人。" };
  if (state.stage === 2) return { replyText: "已经提醒过一次了，请停止人身攻击和持续争吵。继续下去会通知管理处理。" };
  let adminMentions = [];
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    adminMentions = (Array.isArray(members) ? members : []).filter(m => ["owner", "admin"].includes(m.role)).map(m => String(m.user_id)).filter(id => id && id !== botId);
  } catch {}
  await notifyDeveloper(env, `【群冲突升级】\n群号：${groupId}\n参与QQ：${state.participants.join('、')}\n已进行两次劝阻，请决定是否交给其他管理。`);
  return { replyText: "群内冲突持续，已经两次劝阻无效，请人工处理。", mentionIds: adminMentions };
}

async function buildHealthState(env) {
  let onebot = null;
  try { onebot = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json(); } catch {}
  return {
    ok: true, version: VERSION, buildDate: BUILD_DATE, at: new Date().toISOString(),
    bindings: { db: Boolean(env.DB), vectorize: Boolean(env.VECTORIZE), ai: Boolean(env.AI), browser: Boolean(env.BROWSER || env.MYBROWSER), onebotHub: Boolean(env.ONEBOT_HUB) },
    providers: { gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS), gemmaDecisionModels: parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]), deepseek: Boolean(env.DEEPSEEK_API_KEY), liveModel: env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview" },
    onebot, privateChat: await getFeatureFlag(env, "private_chat_enabled", false), privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false), privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
  };
}


function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function generateSixDigitCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}

function getOneBotHub(env) {
  if (!env.ONEBOT_HUB) throw new Error("Missing Durable Object binding: ONEBOT_HUB");
  return env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("default"));
}

async function sendOneBotAction(env, actionPayload) {
  try {
    await callOneBotAction(env, actionPayload, 15000);
    return true;
  } catch (error) {
    console.warn("sendOneBotAction failed:", error);
    return false;
  }
}



function extractGroupId(groupText) {
  const match = String(groupText || "").match(/\d{5,}/);
  return match ? match[0] : String(groupText || "default").trim();
}

async function readJson(env, key, fallback) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

async function createPortalSession(env, data) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const qq = String(data.qq || "");
  const groupId = String(data.groupId || "");
  const role = groupId ? await resolvePortalRole(env, qq, groupId) : (isDeveloperId(env, qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, qq, role, role === "developer") : {
    developer: isDeveloperId(env, qq), nativeAdmin: false, aiAdmin: isDeveloperId(env, qq), groupOps: isDeveloperId(env, qq), scheduleReviewer: isDeveloperId(env, qq), appealReviewer: isDeveloperId(env, qq)
  };
  const session = { qq, group: data.group || "", groupId, token, role, permissions, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  await dbPut(env, `portal_session:${token}`, JSON.stringify(session));
  return session;
}



async function getPortalSession(env, token) {
  if (!token) return null;
  const raw = await dbGet(env, `portal_session:${token}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      await dbDel(env, `portal_session:${token}`);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

async function resolvePortalRole(env, qq, groupId) {
  if (isDeveloperId(env, qq)) return "developer";
  if (!groupId) return "member";
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(qq), no_cache: false } }, 8000);
    if (member?.role === "owner") return "owner";
    if (member?.role === "admin") return "admin";
  } catch {}
  const members = await readJson(env, `group_members:${groupId}`, []);
  const member = members.find(m => String(m.qq) === String(qq));
  if (member?.role === "owner") return "owner";
  if (member?.role === "admin") return "admin";
  return "member";
}



function hasAdminRole(role) {
  return ["developer", "owner", "admin"].includes(role);
}

async function upsertGroupMember(env, groupId, member) {
  const key = `group_members:${groupId}`;
  const list = await readJson(env, key, []);
  const idx = list.findIndex(x => String(x.qq) === String(member.qq));
  const next = { ...member, lastSeenAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  if (list.length > 1000) list.splice(0, list.length - 1000);
  await dbPut(env, key, JSON.stringify(list));
  const known = await readJson(env, "known_groups", []);
  const groupIdx = known.findIndex(x => String(x.group_id || x.groupId || x.id || x) === String(groupId));
  const groupRecord = { group_id: String(groupId), group_name: String(member.groupName || groupId), lastSeenAt: new Date().toISOString() };
  if (groupIdx >= 0) known[groupIdx] = { ...(typeof known[groupIdx] === "object" ? known[groupIdx] : {}), ...groupRecord };
  else known.push(groupRecord);
  if (known.length > 1000) known.splice(0, known.length - 1000);
  await dbPut(env, "known_groups", JSON.stringify(known));
}

function getPublicNebulaSeed() {
  return {
    mode: "anonymous_public_mix",
    text_visible: false,
    clusters: ["humor", "knowledge", "daily", "events", "members"],
    particles: 1600
  };
}

async function isMemoryBanned(env, userId) {
  return await dbGet(env, `memory_banned:${userId}`) === "true";
}

async function getUserQuota(env, groupId, userId) {
  const explicit = await dbGet(env, `quota:deepseek:user:${userId}`);
  if (explicit !== null && explicit !== undefined && explicit !== "") return `${explicit} CNY/日`;
  return await dbGet(env, `quota:${groupId}:${userId}`) || "无限";
}

function commandChangesWebSettings(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!/^[!！]/.test(text)) return false;
  if (/^[!！]指令(开|開|关|關)\b/.test(text)) return false;
  return [
    "关闭ai", "關閉ai", "开启ai", "開啟ai", "ai关", "ai關", "ai开", "ai開",
    "记忆开", "記憶開", "记忆关", "記憶關",
    "切换人格", "切換人格", "恢复人格", "恢復人格", "取消使用",
    "set群规", "set群規", "群规设置", "群規設定",
    "拉黑", "洗白",
    "免打扰", "免打擾", "取消免打扰", "取消免打擾",
    "set人格", "del人格",
    "记住", "記住", "忘记", "忘記",
    "禁记忆", "禁記憶", "解禁记忆", "解禁記憶",
    "banmemory", "unbanmemory"
  ].some(cmd => text.startsWith("!" + cmd) || text.startsWith("！" + cmd));
}

async function writeMemoryAudit(env, entry) {
  const auditEntry = {
    id: crypto.randomUUID(),
    groupId: entry.groupId || "",
    userId: entry.userId || "",
    action: entry.action,
    before: entry.before,
    after: entry.after,
    at: new Date().toISOString()
  };
  const globalKey = "audit:memory:global";
  const groupKey = `audit:memory:group:${auditEntry.groupId || "private"}`;
  for (const key of [globalKey, groupKey]) {
    let logs = [];
    const raw = await dbGet(env, key);
    if (raw) {
      try { logs = JSON.parse(raw); } catch (e) { logs = []; }
    }
    logs.push(auditEntry);
    if (logs.length > 500) logs = logs.slice(-500);
    await dbPut(env, key, JSON.stringify(logs));
  }
}

async function writeSystemError(env, err, context = {}) {
  const logs = await readJson(env, "system_error_logs", []);
  logs.push({
    at: new Date().toISOString(),
    message: err?.message || String(err),
    stack: err?.stack || "",
    context
  });
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  await dbPut(env, "system_error_logs", JSON.stringify(logs));
}

function buildGroupReplyMessage(eventBody, replyText) {
  const message = [];
  if (eventBody.message_id !== undefined && eventBody.message_id !== null) {
    message.push({ type: "reply", data: { id: String(eventBody.message_id) } });
  }
  if (eventBody.user_id !== undefined && eventBody.user_id !== null) {
    message.push({ type: "at", data: { qq: String(eventBody.user_id) } });
    message.push({ type: "text", data: { text: " " } });
  }
  message.push({ type: "text", data: { text: String(replyText).replace(new RegExp(`^\\[CQ:at,qq=${eventBody.user_id}\\]\\s*`), "") } });
  return message;
}

async function handlePortalApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || body.token || url.searchParams.get("token") || "";
  let session = await getPortalSession(env, token);
  if (!session) return jsonResponse({ ok: false, message: "未登录或登录已过期。" }, 401);
  const path = url.pathname.replace("/api/portal", "");

  if (request.method === "GET" && path === "/groups") {
    const groups = await getWhitelistedGroupsForUser(env, session.qq);
    return jsonResponse({ ok: true, groups, selectedGroupId: session.groupId || "" });
  }

  if (request.method === "POST" && path === "/select-group") {
    const groupId = String(body.groupId || "").replace(/\D/g, "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群不在 AI 白名单。" }, 403);
    if (!(await verifyGroupMembership(env, groupId, session.qq))) return jsonResponse({ ok: false, message: "无法确认你是该群成员。" }, 403);
    const groups = await getWhitelistedGroupsForUser(env, session.qq);
    const selected = groups.find(g => g.groupId === groupId);
    const role = await resolvePortalRole(env, session.qq, groupId);
    const permissions = await getEffectivePermissions(env, groupId, session.qq, role, role === "developer");
    session = { ...session, groupId, group: selected?.groupName || groupId, role, permissions, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
    await dbPut(env, `portal_session:${token}`, JSON.stringify(session));
    await dbPut(env, `private_default_group:${session.qq}`, groupId);
    return jsonResponse({ ok: true, message: "群组已切换。", session });
  }

  const groupId = String(session.groupId || "");
  const role = groupId ? await resolvePortalRole(env, session.qq, groupId) : (isDeveloperId(env, session.qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, session.qq, role, role === "developer") : session.permissions || {};
  const authed = { ...session, groupId, role, permissions };

  if (request.method === "GET" && path === "/me") {
    return jsonResponse({
      ok: true,
      session: authed,
      quota: groupId ? await getUserQuota(env, groupId, authed.qq) : "未选择群组",
      modelPreference: groupId ? (await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto") : "auto",
      privateAccess: await getPrivateAccessMode(env, authed.qq),
      flags: {
        privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
        privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
        privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    });
  }

  if (!groupId && !path.startsWith("/root/")) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (groupId && !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群已不在白名单。" }, 403);

  if (request.method === "GET" && path === "/memories") {
    const privateMemos = normalizeMemoryItems(await readJson(env, `user_memo:${groupId}:${authed.qq}`, []), authed.qq);
    const publicMemos = normalizeMemoryItems(await readJson(env, `group_public_memos:${groupId}`, []), "group");
    return jsonResponse({ ok: true, private: privateMemos, public: publicMemos, memory_banned: await isMemoryBanned(env, authed.qq) });
  }

  if (["POST", "PUT", "DELETE"].includes(request.method) && path === "/memories") {
    if (await isMemoryBanned(env, authed.qq)) return jsonResponse({ ok: false, message: "你的记忆编辑权限已被冻结。" }, 403);
    const scope = body.scope === "public" ? "public" : "private";
    const key = scope === "public" ? `group_public_memos:${groupId}` : `user_memo:${groupId}:${authed.qq}`;
    const list = normalizeMemoryItems(await readJson(env, key, []), scope === "public" ? "group" : authed.qq);
    if (request.method === "POST") {
      const text = String(body.text || "").trim();
      if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      const item = { id: crypto.randomUUID(), text, scope, owner: authed.qq, subjectQq: String(body.subjectQq || authed.qq), at: new Date().toISOString() };
      list.push(item); await dbPut(env, key, JSON.stringify(list));
      await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页新增记忆", before: null, after: JSON.stringify(item) });
      return jsonResponse({ ok: true, item });
    }
    const idx = list.findIndex(x => x.id === body.id);
    if (idx < 0) return jsonResponse({ ok: false, message: "找不到记忆。" }, 404);
    const canEdit = scope === "private" || list[idx].owner === authed.qq || permissions.aiAdmin || permissions.developer;
    if (!canEdit) return jsonResponse({ ok: false, message: "权限不足。" }, 403);
    if (request.method === "PUT") {
      const text = String(body.text || "").trim(); if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      const before = JSON.stringify(list[idx]); list[idx] = { ...list[idx], text, updatedAt: new Date().toISOString() };
      await dbPut(env, key, JSON.stringify(list)); await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页修改记忆", before, after: JSON.stringify(list[idx]) });
      return jsonResponse({ ok: true, item: list[idx] });
    }
    const removed = list.splice(idx, 1)[0];
    await dbPut(env, key, JSON.stringify(list));
    await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页删除记忆（保留Vectorize）", before: JSON.stringify(removed), after: null });
    return jsonResponse({ ok: true, vectorizeDeleted: false });
  }

  if (request.method === "GET" && path === "/settings") {
    return jsonResponse({
      ok: true,
      dnd: await dbGet(env, `dnd:${groupId}:${authed.qq}`) === "true",
      style: await dbGet(env, `custom_style:${groupId}:${authed.qq}`) || "",
      modelPreference: await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto",
      quota: await getUserQuota(env, groupId, authed.qq)
    });
  }

  if (request.method === "POST" && path === "/settings") {
    if (typeof body.dnd === "boolean") body.dnd ? await dbPut(env, `dnd:${groupId}:${authed.qq}`, "true") : await dbDel(env, `dnd:${groupId}:${authed.qq}`);
    if (Object.prototype.hasOwnProperty.call(body, "style")) await dbPut(env, `custom_style:${groupId}:${authed.qq}`, String(body.style || ""));
    if (Object.prototype.hasOwnProperty.call(body, "modelPreference")) {
      const pref = normalizeModelPreference(body.modelPreference); if (!pref) return jsonResponse({ ok: false, message: "未知模型偏好。" }, 400);
      await dbPut(env, `model_pref:${groupId}:${authed.qq}`, pref);
    }
    return jsonResponse({ ok: true, message: "个人设置已保存。" });
  }

  if (request.method === "GET" && path === "/schedules") {
    return jsonResponse({ ok: true, schedules: await listUserSchedules(env, authed.qq, groupId) });
  }
  if (request.method === "POST" && path === "/schedules") {
    const parsed = parseScheduleRequest(String(body.schedule || ""));
    if (!parsed.ok) return jsonResponse(parsed, 400);
    if (DEFAULTS.scheduleMaxActivePerUser > 0 && await countActiveSchedulesForUser(env, authed.qq) >= DEFAULTS.scheduleMaxActivePerUser && !permissions.developer) return jsonResponse({ ok: false, message: `有效排程数量已达上限。` }, 429);
    const review = await reviewScheduleWithGemma(env, JSON.stringify(parsed));
    if (review.decision === "reject") return jsonResponse({ ok: false, message: `排程已拒绝：${review.reason}` }, 400);
    const managementAction = parseManagementScheduleAction(parsed.content);
    const directManagement = Boolean(managementAction && (permissions.nativeAdmin || permissions.groupOps || permissions.developer));
    const status = managementAction ? (directManagement ? "active" : "pending_owner") : (review.decision === "allow" ? "active" : "pending_owner");
    const item = await createScheduleRecord(env, { ...parsed, creatorId: authed.qq, groupId, status, enabled: status === "active", managementAction, review });
    if (status === "pending_owner") await notifyDeveloper(env, `【排程待处理】\n编号：${item.id}\n群号：${groupId}\n申请人：${authed.qq}\n内容：${item.content}\n请在 Portal 指派审核人或自行处理。`);
    return jsonResponse({ ok: true, schedule: item, message: status === "active" ? "排程已建立。" : "排程已送交开发者处理。" });
  }
  if (request.method === "DELETE" && path === "/schedules") {
    const result = await cancelSchedule(env, String(body.id || ""), authed.qq, permissions.aiAdmin || permissions.developer);
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "POST" && path === "/ops/action") {
    if (!(permissions.groupOps || permissions.developer)) return jsonResponse({ ok: false, message: "缺少群操作权限。" }, 403);
    const action = String(body.action || ""); const target = String(body.qq || "").replace(/\D/g, ""); let result;
    if (action === "mute" && target) result = await runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(groupId), user_id: numericId(target), duration: parseDurationSeconds(String(body.duration || "10分")) }, { actorId: authed.qq, groupId, targetId: target, action: "网页禁言" });
    else if (action === "unmute" && target) result = await runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(groupId), user_id: numericId(target), duration: 0 }, { actorId: authed.qq, groupId, targetId: target, action: "网页解禁" });
    else if (action === "kick" && target) result = await runOneBotGroupOperation(env, "set_group_kick", { group_id: numericId(groupId), user_id: numericId(target), reject_add_request: false }, { actorId: authed.qq, groupId, targetId: target, action: "网页踢出" });
    else if (action === "whole_mute") result = await runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(groupId), enable: true }, { actorId: authed.qq, groupId, action: "网页全员禁言" });
    else if (action === "whole_unmute") result = await runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(groupId), enable: false }, { actorId: authed.qq, groupId, action: "网页解除全员禁言" });
    else if (action === "rename_group" && String(body.value || "").trim()) result = await runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(groupId), group_name: String(body.value).trim().slice(0, 60) }, { actorId: authed.qq, groupId, action: "网页改群名" });
    else if (action === "set_card" && target) result = await runOneBotGroupOperation(env, "set_group_card", { group_id: numericId(groupId), user_id: numericId(target), card: String(body.value || "").trim().slice(0, 60) }, { actorId: authed.qq, groupId, targetId: target, action: "网页改名片" });
    else return jsonResponse({ ok: false, message: "参数不完整或不支持的操作。" }, 400);
    return jsonResponse({ ok: result.ok, message: result.ok ? "操作已执行。" : `操作失败：${result.error}` }, result.ok ? 200 : 502);
  }

  if (path.startsWith("/admin/") && !(permissions.aiAdmin || permissions.developer)) return jsonResponse({ ok: false, message: "Error 403：缺少 AI 管理权限。" }, 403);
  if (request.method === "GET" && path === "/admin/state") {
    return jsonResponse({
      ok: true,
      ai_on: await dbGet(env, `ai_off:${groupId}`) !== "true",
      memory_on: await dbGet(env, `memo:${groupId}`) !== "false",
      persona: await dbGet(env, `group_persona:${groupId}`) || "",
      interject_rate: Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate),
      commands_enabled: await dbGet(env, `web_command_off:${groupId}`) !== "true",
      active_speaking: await getFeatureFlag(env, `active_speaking:${groupId}`, false),
      keywords: await readJson(env, `keyword_filter:${groupId}`, []),
      blacklist: await readJson(env, `blacklist_group:${groupId}`, []),
      audit_logs: await readJson(env, `audit:system:group:${groupId}`, [])
    });
  }
  if (request.method === "POST" && path === "/admin/state") {
    if (typeof body.ai_on === "boolean") body.ai_on ? await dbDel(env, `ai_off:${groupId}`) : await dbPut(env, `ai_off:${groupId}`, "true");
    if (typeof body.memory_on === "boolean") await dbPut(env, `memo:${groupId}`, body.memory_on ? "true" : "false");
    if (Object.prototype.hasOwnProperty.call(body, "persona")) await dbPut(env, `group_persona:${groupId}`, String(body.persona || ""));
    if (Object.prototype.hasOwnProperty.call(body, "interject_rate")) await dbPut(env, `interject_rate:${groupId}`, String(Math.max(0, Math.min(100, Number(body.interject_rate || 0)))));
    if (Object.prototype.hasOwnProperty.call(body, "commands_enabled")) body.commands_enabled ? await dbDel(env, `web_command_off:${groupId}`) : await dbPut(env, `web_command_off:${groupId}`, "true");
    if (Object.prototype.hasOwnProperty.call(body, "keywords")) await dbPut(env, `keyword_filter:${groupId}`, JSON.stringify(String(body.keywords || "").split(/\n|,/).map(s => s.trim()).filter(Boolean)));
    if (Object.prototype.hasOwnProperty.call(body, "active_speaking")) {
      if (!permissions.developer) return jsonResponse({ ok: false, message: "只有开发者可以开关主动发话。" }, 403);
      await setFeatureFlag(env, `active_speaking:${groupId}`, Boolean(body.active_speaking));
      const groups = await readJson(env, "active_speaking:groups", []); if (!groups.includes(groupId)) { groups.push(groupId); await dbPut(env, "active_speaking:groups", JSON.stringify(groups)); }
    }
    await writeSystemAudit(env, { type: "portal_ai_settings", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "群务设置已保存。" });
  }
  if (request.method === "POST" && path === "/admin/blacklist") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.block) await dbPut(env, `blacklist:${groupId}:${target}`, "true"); else await dbDel(env, `blacklist:${groupId}:${target}`);
    const list = await readJson(env, `blacklist_group:${groupId}`, []); const next = body.block ? [...new Set([...list, target])] : list.filter(x => x !== target);
    await dbPut(env, `blacklist_group:${groupId}`, JSON.stringify(next)); return jsonResponse({ ok: true, blacklist: next });
  }

  const isDev = permissions.developer || isDeveloperId(env, authed.qq);
  if (path.startsWith("/root/") && !isDev) return jsonResponse({ ok: false, message: "Error 403：仅开发者可用。" }, 403);

  if (request.method === "GET" && path === "/root/state") {
    const keyCount = parseList(env.GEMINI_API_KEYS).length + parseList(env.VECTORIZE_GEMINI_KEYS).length;
    return jsonResponse({
      ok: true,
      key_pool: { gemini_keys: parseList(env.GEMINI_API_KEYS).length, vectorize_gemini_keys: parseList(env.VECTORIZE_GEMINI_KEYS).length, total: keyCount, deepseek: Boolean(env.DEEPSEEK_API_KEY) },
      stats: { total_calls: await dbGet(env, "STAT_TOTAL_CALLS") || "0", last_model: await dbGet(env, "STAT_LAST_MODEL") || "无记录" },
      errors: await readJson(env, "system_error_logs", []),
      groups: await getWhitelistedGroupsForUser(env, authed.qq),
      health: await buildHealthState(env),
      flags: {
        private_chat_enabled: await getFeatureFlag(env, "private_chat_enabled", false),
        private_schedule_enabled: await getFeatureFlag(env, "private_schedule_enabled", false),
        private_appeal_enabled: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    });
  }

  if (request.method === "GET" && path === "/root/members") {
    const members = await readJson(env, `group_members:${groupId}`, []); const output = [];
    for (const member of members) output.push({ ...member, permissions: await getEffectivePermissions(env, groupId, String(member.qq), member.role, false), privateAccess: await getPrivateAccessMode(env, String(member.qq)), quota: await getUserQuota(env, groupId, String(member.qq)) });
    return jsonResponse({ ok: true, members: output });
  }

  if (request.method === "POST" && path === "/root/member") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.permission) { const perm = normalizePermissionName(body.permission); if (!perm) return jsonResponse({ ok: false, message: "未知权限。" }, 400); await setExplicitPermission(env, groupId, target, perm, Boolean(body.enabled)); }
    if (Object.prototype.hasOwnProperty.call(body, "privateAccess")) await dbPut(env, `private_access:${target}`, ["none", "commands", "full"].includes(body.privateAccess) ? body.privateAccess : "none");
    if (Object.prototype.hasOwnProperty.call(body, "memory_banned")) body.memory_banned ? await dbPut(env, `memory_banned:${target}`, "true") : await dbDel(env, `memory_banned:${target}`);
    if (Object.prototype.hasOwnProperty.call(body, "quota")) { const quota = String(body.quota || "").trim(); if (!quota || quota === "无限" || quota.toLowerCase() === "unlimited") { await dbDel(env, `quota:${groupId}:${target}`); await dbDel(env, `quota:deepseek:user:${target}`); } else { const n = Number(quota); if (!Number.isFinite(n) || n < 0) return jsonResponse({ ok: false, message: "额度必须是非负数或无限。" }, 400); await dbPut(env, `quota:${groupId}:${target}`, String(n)); await dbPut(env, `quota:deepseek:user:${target}`, String(n)); } }
    return jsonResponse({ ok: true, message: "成员权限已更新。" });
  }

  if (request.method === "GET" && path === "/root/whitelist") {
    return jsonResponse({ ok: true, groupIds: await readJson(env, "group_whitelist:index", []), privateUsers: await readJson(env, "private_access:index", []) });
  }
  if (request.method === "POST" && path === "/root/whitelist") {
    const targetGroup = String(body.groupId || "").replace(/\D/g, "");
    if (targetGroup) { body.enabled ? await dbPut(env, `group_whitelist:${targetGroup}`, "true") : await dbDel(env, `group_whitelist:${targetGroup}`); const list = await readJson(env, "group_whitelist:index", []); const next = body.enabled ? [...new Set([...list, targetGroup])] : list.filter(x => x !== targetGroup); await dbPut(env, "group_whitelist:index", JSON.stringify(next)); }
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST" && path === "/root/flags") {
    for (const key of ["private_chat_enabled", "private_schedule_enabled", "private_appeal_enabled", "deepseek_enabled"]) if (Object.prototype.hasOwnProperty.call(body, key)) await setFeatureFlag(env, key, Boolean(body[key]));
    return jsonResponse({ ok: true, message: "功能开关已保存。" });
  }

  if (request.method === "GET" && path === "/root/quotas") {
    return jsonResponse({ ok: true, globalDailyCny: await dbGet(env, "quota:deepseek:global_daily_cny") || "", groupDailyCny: groupId ? await dbGet(env, `quota:deepseek:group:${groupId}`) || "" : "" });
  }
  if (request.method === "POST" && path === "/root/quotas") {
    const setQuota = async (key, value) => { const text = String(value ?? "").trim(); if (!text || text === "无限") return dbDel(env, key); const n = Number(text); if (!Number.isFinite(n) || n < 0) throw new Error("额度必须是非负数或无限"); return dbPut(env, key, String(n)); };
    try { if (Object.prototype.hasOwnProperty.call(body, "globalDailyCny")) await setQuota("quota:deepseek:global_daily_cny", body.globalDailyCny); if (groupId && Object.prototype.hasOwnProperty.call(body, "groupDailyCny")) await setQuota(`quota:deepseek:group:${groupId}`, body.groupDailyCny); } catch (error) { return jsonResponse({ ok: false, message: error.message }, 400); }
    await writeSystemAudit(env, { type: "quota", groupId, actorId: authed.qq, action: "update_deepseek_quota" });
    return jsonResponse({ ok: true, message: "DeepSeek 额度已保存。" });
  }

  if (request.method === "GET" && path === "/root/schedules") {
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
  if (request.method === "POST" && path === "/root/schedule-assign") {
    const item = await readJson(env, `schedule:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到排程。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "schedule");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有排程审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有排程审核权限的人。" }, 400);
    if (body.developerDecision === "approve") { item.status = "active"; item.enabled = true; item.reviewedAt = new Date().toISOString(); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.enabled = false; item.reviewedAt = new Date().toISOString(); }
    else { item.status = "pending_review"; item.enabled = false; }
    await dbPut(env, `schedule:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【排程审核】\n编号：${item.id}\n群号：${item.groupId}\n内容：${item.content}\n请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, schedule: item });
  }
  if (request.method === "GET" && path === "/review/schedules") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
  if (request.method === "POST" && path === "/review/schedule") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const result = await voteSchedule(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve");
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "GET" && path === "/root/appeals") {
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item) { const safe = sanitizeAppealForReviewer(item, true); if (item.againstAdmin) safe.suggestedOwnerId = await getGroupOwnerId(env, item.groupId); appeals.push(safe); } }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/root/appeal-assign") {
    const item = await readJson(env, `appeal:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到申诉。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "appeal");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有申诉审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有申诉审核权限的人。" }, 400);
    const ownerId = item.againstAdmin ? await getGroupOwnerId(env, item.groupId) : "";
    if (item.againstAdmin) {
      if (!ownerId) return jsonResponse({ ok: false, message: "申诉对象涉及管理层，但目前无法确认群主身份，请先让群主在群内发言或刷新成员资料。" }, 400);
      if (body.developerDecision && String(authed.qq) !== String(ownerId)) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，必须由群主 QQ:${ownerId} 参与审核；你仍可查看并加入共同审核。` }, 400);
      if (!body.developerDecision && !item.reviewerIds.includes(String(ownerId))) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，请将群主 QQ:${ownerId} 加入审核人。` }, 400);
    }
    if (body.developerDecision === "approve") { item.status = "approved"; item.result = String(body.note || "申诉通过"); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.result = String(body.note || "申诉驳回"); }
    else item.status = "pending_review";
    await dbPut(env, `appeal:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【匿名申诉审核】\n编号：${item.id}\n群号：${item.groupId}\n类型：${item.type}\n内容：${item.content}\n申诉人身份已隐藏，请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, appeal: item });
  }
  if (request.method === "GET" && path === "/review/appeals") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) appeals.push(sanitizeAppealForReviewer(item, isDev)); }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/review/appeal") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const result = await voteAppeal(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve", String(body.note || ""));
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "POST" && path === "/root/broadcast") {
    const message = String(body.message || "").trim(); if (!message) return jsonResponse({ ok: false, message: "广播内容不能为空。" }, 400);
    const targets = String(body.groups || groupId).split(/\n|,/).map(s => extractGroupId(s)).filter(Boolean); let sentCount = 0;
    for (const targetGroupId of targets) if (await sendOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(targetGroupId), message, auto_escape: false } })) sentCount++;
    return jsonResponse({ ok: sentCount > 0, message: `广播已发送到 ${sentCount}/${targets.length} 个群。`, sentCount, total: targets.length }, sentCount > 0 ? 200 : 503);
  }
  if (request.method === "POST" && path === "/root/restart") {
    if (groupId) { await dbDel(env, `chat:group:${groupId}`); await dbDel(env, `context_summary:chat:group:${groupId}`); await dbDel(env, `last_interject:${groupId}`); }
    await dbPut(env, "system_last_restart", new Date().toISOString()); return jsonResponse({ ok: true, message: "系统暂存已重置。" });
  }
  if (request.method === "GET" && path === "/root/backup") {
    return jsonResponse({ ok: true, backup: { groupId, exportedAt: new Date().toISOString(), public_memos: groupId ? await readJson(env, `group_public_memos:${groupId}`, []) : [], audit_logs: groupId ? await readJson(env, `audit:system:group:${groupId}`, []) : [], members: groupId ? await readJson(env, `group_members:${groupId}`, []) : [], recent_logs: groupId ? await readJson(env, `recent_logs:${groupId}`, []) : [] } });
  }

  if (request.method === "GET" && path === "/matrix") {
    const logs = await readJson(env, `recent_logs:${groupId}`, []); const q = String(url.searchParams.get("q") || "").trim(); const filtered = q ? logs.filter(line => line.includes(q)) : logs;
    return jsonResponse({ ok: true, mode: isDev ? "root" : "group", query: q, particles: filtered.slice(-160).map((text, i) => ({ id: i, text: isDev ? text : text.replace(/QQ:\d+/g, "QQ:*"), raw: isDev ? Array.from({ length: 12 }, (_, n) => Number(Math.sin((i + 1) * (n + 1)).toFixed(6))) : undefined, cluster: i % 5, score: Number((1 - i / 180).toFixed(3)) })) });
  }

  return jsonResponse({ ok: false, message: "未知 API。" }, 404);
}

async function handleGeminiLiveUpgrade(request, env) {
  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  if (!keys.length) return new Response("未配置 Gemini API 金钥", { status: 500 });
  const key = keys[Math.floor(Math.random() * keys.length)];
  const model = env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  const upstream = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`);
  const queue = [];
  let upstreamReady = false;
  let closed = false;
  const closeBoth = (code = 1000, reason = "closed") => {
    if (closed) return; closed = true;
    try { if (server.readyState === WebSocket.OPEN) server.close(code, reason); } catch {}
    try { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(code, reason); } catch {}
  };
  upstream.addEventListener("open", () => {
    upstreamReady = true;
    while (queue.length && upstream.readyState === WebSocket.OPEN) upstream.send(queue.shift());
  });
  upstream.addEventListener("message", event => { if (server.readyState === WebSocket.OPEN) server.send(event.data); });
  upstream.addEventListener("error", () => { if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify({ error: { message: "Gemini Live 上游连接错误" } })); });
  upstream.addEventListener("close", event => closeBoth(event.code || 1011, "Gemini Live closed"));
  server.addEventListener("message", event => {
    const data = event.data;
    if (typeof data === "string" && data.length > 2_000_000) return closeBoth(1009, "message too large");
    if (queue.length > 300) return closeBoth(1013, "queue overflow");
    if (upstreamReady && upstream.readyState === WebSocket.OPEN) upstream.send(data); else queue.push(data);
  });
  server.addEventListener("close", event => closeBoth(event.code || 1000, "client closed"));
  server.addEventListener("error", () => closeBoth(1011, "client error"));
  server.send(JSON.stringify({ qqai: { version: VERSION, model, status: "connecting" } }));
  return new Response(null, { status: 101, webSocket: client });
}

function getLiveHtmlPage(host) {
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAI Live</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(circle at 50% 20%,#183c61,#07101e 42%,#03050a);color:#eef7ff;display:grid;place-items:center;padding:20px}.card{width:min(760px,100%);border:1px solid #ffffff24;background:#07101ed9;backdrop-filter:blur(18px);border-radius:18px;padding:24px;box-shadow:0 30px 80px #0008}h1{margin:0 0 8px}.muted{color:#a8b8ca;line-height:1.65}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}button{border:0;border-radius:10px;height:44px;padding:0 18px;font-weight:800;cursor:pointer;background:#65dcff;color:#02101a}button.stop{background:#ff7474;color:#1a0505}button:disabled{opacity:.45;cursor:not-allowed}.meter{height:10px;background:#ffffff12;border-radius:99px;overflow:hidden;margin-top:16px}.bar{height:100%;width:0;background:linear-gradient(90deg,#60dcff,#86ffbd);transition:width .08s}.log{margin-top:16px;background:#02060d;border:1px solid #ffffff18;border-radius:12px;padding:12px;min-height:150px;max-height:320px;overflow:auto;white-space:pre-wrap;line-height:1.55}.status{font-weight:800;color:#8ff0c0}.warn{color:#ffd58a}@media(max-width:520px){button{width:100%}}
</style></head><body><main class="card"><h1>QQAI Live</h1><div class="muted">即時麥克風對話。瀏覽器會傳送 16 kHz PCM 音訊，回傳語音會在本機播放。請勿在對話中提供密碼或敏感資料。</div><div class="row"><button id="start">開始通話</button><button id="mute" disabled>靜音</button><button id="stop" class="stop" disabled>結束</button></div><div class="meter"><div class="bar" id="bar"></div></div><div class="log"><div class="status" id="status">尚未連線</div><div id="transcript"></div></div></main>
<script>
const startBtn=document.getElementById('start'),stopBtn=document.getElementById('stop'),muteBtn=document.getElementById('mute'),statusEl=document.getElementById('status'),transcript=document.getElementById('transcript'),bar=document.getElementById('bar');
let ws,stream,inputCtx,processor,source,muted=false,ready=false,playCtx,playAt=0;
const modelParam=new URLSearchParams(location.search).get('model')||'gemini-3.1-flash-live-preview';const MODEL='models/'+modelParam;
function log(t){transcript.textContent+=(transcript.textContent?'\\n':'')+t;transcript.parentElement.scrollTop=transcript.parentElement.scrollHeight}
function b64FromBytes(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function bytesFromB64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function f32ToPcm16(input){const out=new Uint8Array(input.length*2),view=new DataView(out.buffer);let peak=0;for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));peak=Math.max(peak,Math.abs(v));view.setInt16(i*2,v<0?v*32768:v*32767,true)}bar.style.width=Math.min(100,peak*180)+'%';return out}
function playPcm(base64,rate=24000){playCtx||=new AudioContext({sampleRate:rate});const bytes=bytesFromB64(base64),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),f=new Float32Array(bytes.byteLength/2);for(let i=0;i<f.length;i++)f[i]=view.getInt16(i*2,true)/32768;const buf=playCtx.createBuffer(1,f.length,rate);buf.copyToChannel(f,0);const src=playCtx.createBufferSource();src.buffer=buf;src.connect(playCtx.destination);playAt=Math.max(playCtx.currentTime+.03,playAt);src.start(playAt);playAt+=buf.duration}
function handleMessage(obj){if(obj.setupComplete){ready=true;statusEl.textContent='已連線，可以說話';return}if(obj.error){statusEl.textContent='錯誤：'+(obj.error.message||JSON.stringify(obj.error));return}const sc=obj.serverContent;if(!sc)return;if(sc.inputTranscription?.text)log('你：'+sc.inputTranscription.text);if(sc.outputTranscription?.text)log('助手：'+sc.outputTranscription.text);for(const part of sc.modelTurn?.parts||[]){const d=part.inlineData?.data;if(d)playPcm(d,Number((part.inlineData.mimeType||'').match(/rate=(\\d+)/)?.[1]||24000));if(part.text)log('助手：'+part.text)}if(sc.interrupted&&playCtx){playAt=playCtx.currentTime}}
async function start(){startBtn.disabled=true;statusEl.textContent='取得麥克風權限…';try{stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/live');ws.onopen=()=>{statusEl.textContent='正在初始化 Gemini Live…';ws.send(JSON.stringify({setup:{model:MODEL,generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Aoede'}}}},systemInstruction:{parts:[{text:'你是QQ群里的自然简体中文语音助手。回答简洁、口语化；不要讨论、承认或否认模型、AI、机器人或系统身份，直接回到话题。'}]},inputAudioTranscription:{},outputAudioTranscription:{}}}))};ws.onmessage=e=>{try{handleMessage(JSON.parse(e.data))}catch(err){console.warn(err)}};ws.onerror=()=>statusEl.textContent='WebSocket 連線錯誤';ws.onclose=()=>{statusEl.textContent='連線已結束';cleanup(false)};
inputCtx=new AudioContext({sampleRate:16000});source=inputCtx.createMediaStreamSource(stream);processor=inputCtx.createScriptProcessor(4096,1,1);processor.onaudioprocess=e=>{if(!ready||muted||!ws||ws.readyState!==1)return;const pcm=f32ToPcm16(e.inputBuffer.getChannelData(0));ws.send(JSON.stringify({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:b64FromBytes(pcm)}}}))};source.connect(processor);processor.connect(inputCtx.destination);stopBtn.disabled=false;muteBtn.disabled=false}catch(e){statusEl.textContent='無法啟動：'+e.message;cleanup(false)}}
function cleanup(close=true){ready=false;if(close&&ws&&ws.readyState<2)ws.close();try{processor?.disconnect();source?.disconnect();inputCtx?.close();stream?.getTracks().forEach(t=>t.stop())}catch{}ws=null;stream=null;processor=null;source=null;inputCtx=null;startBtn.disabled=false;stopBtn.disabled=true;muteBtn.disabled=true;bar.style.width='0'}
startBtn.onclick=start;stopBtn.onclick=()=>cleanup(true);muteBtn.onclick=()=>{muted=!muted;muteBtn.textContent=muted?'取消靜音':'靜音'};
</script></body></html>`;
}

async function handleAppealApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const path = url.pathname.replace("/api/appeal", "");
  if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉入口暂时关闭。" }, 503);
  if (request.method === "POST" && path === "/request-code") {
    const qq = String(body.qq || "").replace(/\D/g, ""); if (!qq) return jsonResponse({ ok: false, message: "请输入 QQ 号。" }, 400);
    const code = generateSixDigitCode(); await dbPut(env, `appeal_auth_code:${qq}`, JSON.stringify({ code, expiresAt: Date.now()+300000, attempts:0 }));
    const sent = await sendOneBotAction(env, { action:"send_private_msg", params:{ user_id:numericId(qq), message:`【匿名申诉验证码】\n验证码：${code}\n有效期：5分钟。`, auto_escape:false } });
    return jsonResponse({ ok: sent, message: sent ? "验证码已发送至 QQ 私讯。" : "NapCat 当前未连接。" }, sent ? 200 : 503);
  }
  if (request.method === "POST" && path === "/verify-code") {
    const qq=String(body.qq||"").replace(/\D/g,""),code=String(body.code||"").replace(/\D/g,""); const raw=await dbGet(env,`appeal_auth_code:${qq}`); if(!raw)return jsonResponse({ok:false,message:"验证码不存在或已过期。"},400);
    let item;try{item=JSON.parse(raw)}catch{} if(!item||Date.now()>item.expiresAt){await dbDel(env,`appeal_auth_code:${qq}`);return jsonResponse({ok:false,message:"验证码已过期。"},400)}
    if(item.code!==code){item.attempts=(item.attempts||0)+1;item.attempts>=5?await dbDel(env,`appeal_auth_code:${qq}`):await dbPut(env,`appeal_auth_code:${qq}`,JSON.stringify(item));return jsonResponse({ok:false,message:"验证码错误。"},400)}
    await dbDel(env,`appeal_auth_code:${qq}`);const token=crypto.randomUUID()+crypto.randomUUID();await dbPut(env,`appeal_session:${token}`,JSON.stringify({qq,expiresAt:Date.now()+3600000}));return jsonResponse({ok:true,token,message:"验证成功。"});
  }
  const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||body.token||url.searchParams.get("token")||"";const sess=await readJson(env,`appeal_session:${token}`,null);if(!sess||Date.now()>Number(sess.expiresAt||0))return jsonResponse({ok:false,message:"申诉验证已过期。"},401);
  if(request.method==="GET"&&path==="/groups")return jsonResponse({ok:true,groups:await getWhitelistedGroupsForUser(env,sess.qq)});
  if(request.method==="POST"&&path==="/submit"){
    const groupId=String(body.groupId||"").replace(/\D/g,"");if(!groupId||!(await isGroupWhitelisted(env,groupId))||!(await verifyGroupMembership(env,groupId,sess.qq)))return jsonResponse({ok:false,message:"无法确认你属于该 AI 白名单群。"},403);
    const type=String(body.type||"其他").trim(),content=String(body.content||"").trim();if(content.length<5)return jsonResponse({ok:false,message:"请填写较完整的申诉内容。"},400);
    const id=`app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`;const appeal={id,anonymousLabel:`匿名申诉-${id.slice(-6)}`,applicantId:String(sess.qq),groupId,type,content,evidenceMessageId:String(body.evidenceMessageId||""),status:"pending_owner",createdAt:new Date().toISOString(),reviewerIds:[],votes:{},approvalRule:"single",result:"",againstAdmin:/管理|群主|开发者|開發者/i.test(type+content),recommendedReviewerRole:/管理|群主|开发者|開發者/i.test(type+content)?"owner":"developer_choice"};
    await dbPut(env,`appeal:${id}`,JSON.stringify(appeal));await appendIndex(env,"appeal:index",id,5000);await appendIndex(env,`appeal:user:${sess.qq}`,id,200);
    await notifyDeveloper(env,`【收到匿名申诉】\n编号：${id}\n群号：${groupId}\n申诉人QQ：${sess.qq}\n类型：${type}\n内容：${content}\n只通知了你，请在 Portal 自行处理或指派审核人。`);
    return jsonResponse({ok:true,id,message:"申诉已匿名提交，仅开发者可查看你的 QQ。"});
  }
  if(request.method==="GET"&&path==="/mine"){
    const ids=await readJson(env,`appeal:user:${sess.qq}`,[]),appeals=[];for(const id of ids.slice(-100).reverse()){const a=await readJson(env,`appeal:${id}`,null);if(a)appeals.push({id:a.id,groupId:a.groupId,type:a.type,content:a.content,status:a.status,result:a.result,createdAt:a.createdAt})}return jsonResponse({ok:true,appeals});
  }
  return jsonResponse({ok:false,message:"未知申诉 API。"},404);
}

function getAppealPage(host) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQAI 匿名申訴</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui;background:radial-gradient(circle at 30% 10%,#173b60,#060d18 45%,#020409);color:#edf7ff;padding:22px}.wrap{max-width:760px;margin:auto}.card{background:#07101ee8;border:1px solid #ffffff22;border-radius:16px;padding:20px;margin:14px 0}h1{margin-bottom:6px}.muted{color:#a9bacd;line-height:1.6}label{display:block;margin-top:12px;color:#b8c7d9}input,select,textarea{width:100%;border:1px solid #ffffff24;background:#081525;color:#fff;border-radius:9px;padding:11px;margin-top:6px}textarea{min-height:150px}button{margin-top:14px;border:0;border-radius:9px;background:#67ddff;color:#03111a;font-weight:800;padding:11px 16px;cursor:pointer}.hidden{display:none}.msg{white-space:pre-wrap;color:#8ff0c0;margin-top:12px}.item{border-top:1px solid #ffffff17;padding:10px 0}</style></head><body><div class="wrap"><h1>匿名申訴</h1><div class="muted">審核人看不到申訴人的 QQ；只有開發者可查看真實身分。系統會先確認你屬於可使用 AI 的白名單群。</div><section class="card" id="login"><label>QQ 號</label><input id="qq" inputmode="numeric"><button id="send">發送驗證碼</button><label>驗證碼</label><input id="code" maxlength="6" inputmode="numeric"><button id="verify">驗證</button><div class="msg" id="loginMsg"></div></section><section class="card hidden" id="form"><label>所屬白名單群</label><select id="group"></select><label>申訴類型</label><select id="type"><option>禁言</option><option>踢出</option><option>AI黑名单</option><option>管理操作</option><option>排程</option><option>其他</option></select><label>相關訊息 ID（選填）</label><input id="evidence"><label>申訴內容</label><textarea id="content"></textarea><button id="submit">匿名提交</button><button id="refresh">查看我的案件</button><div class="msg" id="formMsg"></div><div id="cases"></div></section></div><script>let token='';const post=async(p,d)=>{const r=await fetch('/api/appeal'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(d||{})});return r.json()},get=async p=>(await fetch('/api/appeal'+p,{headers:token?{Authorization:'Bearer '+token}:{}})).json();send.onclick=async()=>loginMsg.textContent=(await post('/request-code',{qq:qq.value})).message;verify.onclick=async()=>{const r=await post('/verify-code',{qq:qq.value,code:code.value});loginMsg.textContent=r.message;if(r.ok){token=r.token;const g=await get('/groups');group.innerHTML=(g.groups||[]).map(x=>'<option value="'+x.groupId+'">'+x.groupName+'（'+x.groupId+'）</option>').join('');login.classList.add('hidden');form.classList.remove('hidden')}};submit.onclick=async()=>{const r=await post('/submit',{groupId:group.value,type:type.value,content:content.value,evidenceMessageId:evidence.value});formMsg.textContent=r.message;if(r.ok){content.value='';load()}};async function load(){const r=await get('/mine');cases.innerHTML=(r.appeals||[]).map(a=>'<div class="item"><b>'+a.id+'</b>｜'+a.status+'<br>'+a.type+'｜'+a.content+(a.result?'<br>結果：'+a.result:'')+'</div>').join('')||'<div class="muted">尚無案件</div>'}refresh.onclick=load;</script></body></html>`;
}

function getPortalHomePage(host) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQAIbot Portal</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#03050a;color:#edf6ff}canvas{position:fixed;inset:0;width:100%;height:100%;display:block}.shell{position:relative;z-index:1;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:28px;align-items:end;padding:40px}.hero{max-width:780px;padding-bottom:24px}.brand{color:#71e7ff}.hero h1{font-size:clamp(38px,6vw,78px);line-height:1;margin:10px 0 16px}.hero p,.muted{color:#a9b9cc;line-height:1.7}.panel,.card{border:1px solid #ffffff22;background:#06101ddd;backdrop-filter:blur(16px);border-radius:14px;padding:18px}.dashboard{display:none;position:relative;z-index:1;min-height:100vh;padding:22px;background:#03050ae8}.top{max-width:1480px;margin:auto;display:flex;justify-content:space-between;gap:12px;align-items:center}.tabs{max-width:1480px;margin:15px auto;display:flex;gap:8px;flex-wrap:wrap}.tab,button,.btn{border:0;border-radius:9px;height:40px;padding:0 14px;background:#63dcff;color:#03111a;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.tab{background:#0c1a2b;color:#dff7ff;border:1px solid #ffffff1c}.view{display:none;max-width:1480px;margin:auto}.view.active{display:block}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}.card{grid-column:span 4;min-width:0}.wide{grid-column:span 8}.full{grid-column:1/-1}label{display:block;margin:11px 0 5px;color:#aebfd2}input,select,textarea{width:100%;border:1px solid #ffffff24;background:#081525;color:#fff;border-radius:8px;padding:10px}textarea{min-height:96px;resize:vertical}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.list{max-height:380px;overflow:auto}.item{border-top:1px solid #ffffff17;padding:10px 0;white-space:normal}.danger{background:#ff7474;color:#200404}.ok{color:#8ff0c0;white-space:pre-wrap}.hidden{display:none!important}.stat{font-size:24px;color:#82eaff;font-weight:900}.matrix{height:340px;position:relative;overflow:hidden;background:#020813;border-radius:12px;border:1px solid #ffffff1c}@media(max-width:900px){.shell{grid-template-columns:1fr;padding:18px}.card,.wide{grid-column:1/-1}.top{display:block}.dashboard{padding:13px}}@media(max-width:520px){button,.btn,.tab,input,select{width:100%}.row{display:grid}}
</style></head><body><canvas id="nebula"></canvas><main class="shell" id="loginShell"><section class="hero"><div class="brand">QQAIbot Memory Matrix</div><h1>全站記憶星雲母體</h1><p>登入後可管理個人記憶、模型偏好、排程及所屬白名單群。群組不再手動輸入，驗證 QQ 後由下拉選單載入可用群。</p><div class="row"><a class="btn" href="/live">Live</a><a class="btn" href="/appeal">匿名申訴</a><a class="btn" href="/health">Health</a></div></section><aside class="panel"><b>QQ 驗證登入</b><label>QQ 號</label><input id="qq" inputmode="numeric" placeholder="請輸入 QQ 號"><button id="sendCode">發送驗證碼</button><label>6 位數驗證碼</label><input id="code" maxlength="6" inputmode="numeric"><button id="verifyCode">登入</button><div class="ok" id="loginNotice">請先取得私訊驗證碼。</div></aside></main>
<section class="dashboard" id="dashboard"><div class="top"><div><h1 style="margin:0">QQAIbot 控制台</h1><div class="muted">QQ：<span id="who"></span>｜身分：<span id="role"></span>｜群組：<select id="groupSelect" style="display:inline-block;width:auto;min-width:240px"></select></div></div><div class="row"><button id="reload">刷新</button><button id="logout" class="danger">登出</button></div></div><div class="tabs"><button class="tab" data-v="self">個人設定</button><button class="tab" data-v="matrix">記憶矩陣</button><button class="tab" data-v="schedules">排程中心</button><button class="tab perm-ai" data-v="admin">AI 管理</button><button class="tab perm-ops" data-v="ops">群操作</button><button class="tab perm-review" data-v="review">審核中心</button><button class="tab perm-root" data-v="root">Root 維運</button></div>
<div class="view active" id="v-self"><div class="grid"><div class="card wide"><h3>新增記憶</h3><textarea id="memText" placeholder="輸入記憶內容"></textarea><div class="row"><select id="memScope"><option value="private">私人</option><option value="public">群公開</option></select><button id="addMem">新增</button></div><div class="muted">刪除 D1 記憶不會刪除 Vectorize 歷史向量。</div></div><div class="card"><h3>個人設定</h3><label><input id="dnd" type="checkbox" style="width:auto"> 免打擾</label><label>專屬語氣</label><textarea id="style"></textarea><label>模型偏好</label><select id="modelPref"><option value="auto">自動</option><option value="gemini">Gemini</option><option value="deepseek">DeepSeek</option><option value="deepseek_high">DeepSeek High</option><option value="deepseek_max">DeepSeek Max</option></select><button id="saveSelf">保存</button><p>額度：<span class="stat" id="quota">-</span></p></div><div class="card wide"><h3>私人記憶</h3><div class="list" id="privateMems"></div></div><div class="card"><h3>群公開記憶</h3><div class="list" id="publicMems"></div></div></div></div>
<div class="view" id="v-matrix"><div class="grid"><div class="card full"><div class="row"><input id="matrixQ" placeholder="搜尋記憶"><button id="matrixSearch">搜尋</button></div></div><div class="card wide"><div class="matrix" id="matrixBox"></div></div><div class="card"><div class="list" id="matrixList"></div></div></div></div>
<div class="view" id="v-schedules"><div class="grid"><div class="card wide"><h3>建立排程</h3><div class="muted">例：2026-07-22 18:00 提醒交作業｜每天 18:00 發送晚安｜每周一 08:00 AI生成：本週開場話題</div><textarea id="scheduleText"></textarea><button id="createSchedule">建立並交由 Gemini 審查</button><div class="ok" id="scheduleMsg"></div></div><div class="card"><h3>我的排程</h3><div class="list" id="scheduleList"></div></div></div></div>
<div class="view" id="v-admin"><div class="grid"><div class="card"><h3>功能</h3><label><input id="aiOn" type="checkbox" style="width:auto"> AI 開啟</label><label><input id="memoryOn" type="checkbox" style="width:auto"> 長期記憶</label><label>插話率 0–100（每日上限無限）</label><input id="interject" type="number" min="0" max="100"><label class="perm-root"><input id="activeSpeaking" type="checkbox" style="width:auto"> 主動發話（預設關閉）</label><button id="saveAdmin">保存</button></div><div class="card"><h3>群人格</h3><textarea id="persona"></textarea></div><div class="card"><h3>關鍵字過濾</h3><textarea id="keywords"></textarea></div><div class="card"><h3>AI 黑名單</h3><input id="blackQQ" placeholder="QQ"><div class="row"><button id="block">拉黑</button><button id="unblock">解除</button></div><div id="blacklist" class="list"></div></div><div class="card wide"><h3>操作日誌</h3><div id="audit" class="list"></div></div></div></div>

<div class="view" id="v-ops"><div class="grid"><div class="card wide"><h3>群操作</h3><label>目標 QQ</label><input id="opsQQ" placeholder="QQ號"><label>禁言時長</label><input id="opsDuration" value="10分"><label>群名／名片內容</label><input id="opsValue"><div class="row"><button id="opsMute">禁言</button><button id="opsUnmute">解禁</button><button id="opsKick" class="danger">踢出</button><button id="opsWholeMute" class="danger">全員禁言</button><button id="opsWholeUnmute">解除全員禁言</button><button id="opsRename">修改群名</button><button id="opsCard">修改名片</button></div><div class="ok" id="opsMsg"></div></div><div class="card"><h3>權限說明</h3><div class="muted">只有 QQ 原生群主／管理員、開發者或被授予群操作權的 QQ 可以使用。機器人帳號本身仍需具備相應群管理權。</div></div></div></div>
<div class="view" id="v-review"><div class="grid"><div class="card wide"><h3>我被指派的排程</h3><div id="reviewSchedules" class="list"></div></div><div class="card wide"><h3>我被指派的匿名申訴</h3><div id="reviewAppeals" class="list"></div></div><div class="card"><h3>審核說明</h3><div class="muted">只有開發者能看到申訴人的 QQ。你只會看到開發者指派給你的匿名案件。</div></div></div></div>
<div class="view" id="v-root"><div class="grid"><div class="card"><h3>系統狀態</h3><div id="rootState" class="muted"></div></div><div class="card"><h3>DeepSeek 額度</h3><label>全站每日 CNY</label><input id="globalQuota" placeholder="空白＝無限"><label>目前群每日 CNY</label><input id="groupQuota" placeholder="空白＝無限"><button id="saveQuotas">保存額度</button></div><div class="card"><h3>功能開關</h3><label><input id="flagPrivateChat" type="checkbox" style="width:auto"> 私聊聊天</label><label><input id="flagPrivateSchedule" type="checkbox" style="width:auto"> 私聊排程</label><label><input id="flagPrivateAppeal" type="checkbox" style="width:auto"> 私聊申訴</label><label><input id="flagDeepseek" type="checkbox" style="width:auto"> DeepSeek</label><button id="saveFlags">保存</button></div><div class="card"><h3>群白名單</h3><input id="wlGroup" placeholder="群號"><div class="row"><button id="wlAdd">加入</button><button id="wlDel">移除</button></div></div><div class="card wide"><h3>成員權限與額度</h3><input id="rootQQ" placeholder="QQ"><div class="row"><select id="permission"><option value="ai_admin">AI管理</option><option value="group_ops">群操作</option><option value="schedule_reviewer">排程審核</option><option value="appeal_reviewer">申訴審核</option></select><button id="grant">授予</button><button id="revoke">撤銷</button></div><label>私聊權限</label><select id="privateAccess"><option value="none">關閉</option><option value="commands">僅指令</option><option value="full">完整AI</option></select><label>額度（只有你能設定）</label><input id="quotaInput" placeholder="無限或數值"><button id="saveMember">保存成員設定</button></div><div class="card full"><h3>待處理排程</h3><div id="rootSchedules" class="list"></div></div><div class="card full"><h3>匿名申訴（開發者可見真實 QQ）</h3><div id="rootAppeals" class="list"></div></div><div class="card wide"><h3>跨群廣播</h3><textarea id="broadcast"></textarea><input id="broadcastGroups" placeholder="群號，逗號分隔"><button id="sendBroadcast">發送</button></div><div class="card"><h3>備份與暫存</h3><button id="restart" class="danger">清除目前群暫存</button><button id="backup">匯出備份</button><textarea id="backupBox"></textarea></div></div></div></section>
<script>
const c=document.getElementById('nebula'),x=c.getContext('2d');let w,h,stars=[];
function resizeStars(){w=c.width=innerWidth*devicePixelRatio;h=c.height=innerHeight*devicePixelRatio;stars=Array.from({length:900},function(){return{x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.4+.2,h:Math.random()*70+185}})}
addEventListener('resize',resizeStars);resizeStars();(function draw(){x.fillStyle='rgba(3,5,10,.27)';x.fillRect(0,0,w,h);stars.forEach(function(a){a.x=(a.x+a.vx+w)%w;a.y=(a.y+a.vy+h)%h;x.fillStyle='hsla('+a.h+',95%,70%,.8)';x.beginPath();x.arc(a.x,a.y,a.r*devicePixelRatio,0,7);x.fill()});requestAnimationFrame(draw)})();
let session=null,me=null;
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
async function api(path,method,data){method=method||'GET';const options={method:method,headers:{}};if(session)options.headers.Authorization='Bearer '+session.token;if(method!=='GET'){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data||{})}const r=await fetch('/api/portal'+path,options);return r.json().catch(function(){return{ok:false,message:'Invalid response'}})}
async function auth(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json()}
function permissions(){return me&&me.session&&me.session.permissions||{}}
function showMessage(text){alert(text||'完成')}
async function loadGroups(){const r=await api('/groups');groupSelect.innerHTML='';(r.groups||[]).forEach(function(g){const o=document.createElement('option');o.value=g.groupId;o.textContent=g.groupName+'（'+g.groupId+'）｜'+g.role;groupSelect.appendChild(o)});if(!(r.groups||[]).length){loginNotice.textContent='找不到你所屬的 AI 白名單群。';return false}await selectGroup(r.selectedGroupId||r.groups[0].groupId);return true}
async function selectGroup(id){const r=await api('/select-group','POST',{groupId:id});if(!r.ok){showMessage(r.message);return}session=Object.assign({},session,r.session);groupSelect.value=id;await refreshAll()}
function applyPermissions(){const p=permissions();document.querySelectorAll('.perm-ai').forEach(function(e){e.classList.toggle('hidden',!(p.aiAdmin||p.developer))});document.querySelectorAll('.perm-ops').forEach(function(e){e.classList.toggle('hidden',!(p.groupOps||p.developer))});document.querySelectorAll('.perm-review').forEach(function(e){e.classList.toggle('hidden',!(p.appealReviewer||p.scheduleReviewer||p.developer))});document.querySelectorAll('.perm-root').forEach(function(e){e.classList.toggle('hidden',!p.developer)});role.textContent=me&&me.session&&me.session.role||'-'}
async function refreshAll(){me=await api('/me');if(!me.ok)return;applyPermissions();quota.textContent=me.quota||'-';await Promise.all([loadSelf(),loadSchedules(),loadMatrix()]);const p=permissions();if(p.aiAdmin||p.developer)await loadAdmin();if(p.appealReviewer||p.developer)await loadReview();if(p.developer)await loadRoot()}
async function loadSelf(){const m=await api('/memories'),st=await api('/settings');dnd.checked=!!st.dnd;style.value=st.style||'';modelPref.value=st.modelPreference||'auto';renderMemories(privateMems,m.private||[],'private');renderMemories(publicMems,m.public||[],'public')}
function renderMemories(container,items,scope){container.innerHTML='';if(!items.length){container.innerHTML='<div class="muted">尚無資料</div>';return}items.forEach(function(item){const row=document.createElement('div');row.className='item';const text=document.createElement('div');text.textContent=item.text;const buttons=document.createElement('div');buttons.className='row';const edit=document.createElement('button');edit.textContent='修改';edit.onclick=async function(){const value=prompt('修改記憶',item.text);if(value!==null){await api('/memories','PUT',{id:item.id,scope:scope,text:value});loadSelf()}};const del=document.createElement('button');del.textContent='刪除';del.className='danger';del.onclick=async function(){if(confirm('刪除 D1 記憶？Vectorize 歷史向量會保留。')){await api('/memories','DELETE',{id:item.id,scope:scope});loadSelf()}};buttons.append(edit,del);row.append(text,buttons);container.appendChild(row)})}
async function loadSchedules(){const r=await api('/schedules');scheduleList.innerHTML='';const items=r.schedules||[];if(!items.length){scheduleList.innerHTML='<div class="muted">尚無排程</div>';return}items.forEach(function(item){const row=document.createElement('div');row.className='item';const time=item.nextRunAt?new Date(item.nextRunAt).toLocaleString():'無下次時間';row.innerHTML='<b>'+esc(item.id)+'</b>｜'+esc(item.status)+'<br>'+esc(time)+'<br>'+esc(item.content);const del=document.createElement('button');del.textContent='取消';del.className='danger';del.onclick=async function(){await api('/schedules','DELETE',{id:item.id});loadSchedules()};row.appendChild(del);scheduleList.appendChild(row)})}
async function loadAdmin(){const r=await api('/admin/state');if(!r.ok)return;aiOn.checked=!!r.ai_on;memoryOn.checked=!!r.memory_on;interject.value=r.interject_rate;persona.value=r.persona||'';keywords.value=(r.keywords||[]).join(String.fromCharCode(10));activeSpeaking.checked=!!r.active_speaking;blacklist.innerHTML=(r.blacklist||[]).map(function(q){return'<div class="item">QQ:'+esc(q)+'</div>'}).join('')||'<div class="muted">尚無黑名單</div>';audit.innerHTML=(r.audit_logs||[]).slice(-80).reverse().map(function(a){return'<div class="item">'+esc(a.at+'｜'+a.type+'｜'+(a.action||''))+'</div>'}).join('')||'<div class="muted">尚無日誌</div>'}
async function loadMatrix(){const r=await api('/matrix?q='+encodeURIComponent(matrixQ.value||''));const items=r.particles||[];matrixList.innerHTML=items.map(function(p){return'<div class="item">'+esc(p.text)+'</div>'}).join('');matrixBox.innerHTML='';items.forEach(function(p){const d=document.createElement('i');d.title=p.text;d.style.cssText='position:absolute;width:6px;height:6px;border-radius:50%;background:hsl('+(p.cluster*65+180)+',90%,70%);left:'+Math.random()*98+'%;top:'+Math.random()*95+'%;box-shadow:0 0 12px currentColor';matrixBox.appendChild(d)})}
async function loadReview(){
  const sr=await api('/review/schedules');reviewSchedules.innerHTML='';const schedules=sr.schedules||[];if(!schedules.length)reviewSchedules.innerHTML='<div class="muted">沒有被指派的排程</div>';schedules.forEach(function(item){const row=document.createElement('div');row.className='item';row.innerHTML='<b>'+esc(item.id)+'</b>｜群 '+esc(item.groupId)+'<br>'+esc(item.content);const actions=document.createElement('div');actions.className='row';['approve','reject'].forEach(function(v){const b=document.createElement('button');b.textContent=v==='approve'?'同意':'拒絕';if(v==='reject')b.className='danger';b.onclick=async function(){await api('/review/schedule','POST',{id:item.id,vote:v});loadReview()};actions.appendChild(b)});row.appendChild(actions);reviewSchedules.appendChild(row)});
  const r=await api('/review/appeals');reviewAppeals.innerHTML='';const items=r.appeals||[];if(!items.length){reviewAppeals.innerHTML='<div class="muted">沒有被指派的案件</div>';return}items.forEach(function(a){const row=document.createElement('div');row.className='item';row.innerHTML='<b>'+esc(a.id)+'</b>｜群 '+esc(a.groupId)+'｜'+esc(a.type)+'<br>'+esc(a.content);const actions=document.createElement('div');actions.className='row';['approve','reject'].forEach(function(v){const b=document.createElement('button');b.textContent=v==='approve'?'同意':'拒絕';if(v==='reject')b.className='danger';b.onclick=async function(){const note=prompt('審核意見','')||'';await api('/review/appeal','POST',{id:a.id,vote:v,note:note});loadReview()};actions.appendChild(b)});row.appendChild(actions);reviewAppeals.appendChild(row)})}
function makeAssignBlock(container,item,type){const row=document.createElement('div');row.className='item';const identity=type==='appeal'?'｜申訴人 '+esc(item.applicantId||'匿名'):'｜申請人 '+esc(item.creatorId||'');row.innerHTML='<b>'+esc(item.id)+'</b>'+identity+'｜群 '+esc(item.groupId)+'<br>'+esc(item.content||item.type||'');const reviewers=document.createElement('input');reviewers.placeholder='審核 QQ，多個用逗號';const rule=document.createElement('select');[['single','任一同意'],['majority','過半同意'],['all','全數同意']].forEach(function(o){const op=document.createElement('option');op.value=o[0];op.textContent=o[1];rule.appendChild(op)});const actions=document.createElement('div');actions.className='row';const assign=document.createElement('button');assign.textContent='指派';assign.onclick=async function(){const path=type==='appeal'?'/root/appeal-assign':'/root/schedule-assign';await api(path,'POST',{id:item.id,reviewerIds:reviewers.value,approvalRule:rule.value});loadRoot()};const approve=document.createElement('button');approve.textContent='我同意';approve.onclick=async function(){const path=type==='appeal'?'/root/appeal-assign':'/root/schedule-assign';await api(path,'POST',{id:item.id,developerDecision:'approve'});loadRoot()};const reject=document.createElement('button');reject.textContent='我拒絕';reject.className='danger';reject.onclick=async function(){const path=type==='appeal'?'/root/appeal-assign':'/root/schedule-assign';await api(path,'POST',{id:item.id,developerDecision:'reject'});loadRoot()};actions.append(assign,approve,reject);row.append(reviewers,rule,actions);container.appendChild(row)}
async function loadRoot(){const r=await api('/root/state');if(!r.ok)return;rootState.innerHTML='Gemini Keys：'+r.key_pool.total+'<br>DeepSeek：'+(r.key_pool.deepseek?'已配置':'未配置')+'<br>最後模型：'+esc(r.stats.last_model)+'<br>NapCat：'+esc(JSON.stringify(r.health.onebot||{}));flagPrivateChat.checked=!!r.flags.private_chat_enabled;flagPrivateSchedule.checked=!!r.flags.private_schedule_enabled;flagPrivateAppeal.checked=!!r.flags.private_appeal_enabled;flagDeepseek.checked=!!r.flags.deepseek_enabled;const qr=await api('/root/quotas');globalQuota.value=qr.globalDailyCny||'';groupQuota.value=qr.groupDailyCny||'';const schedules=await api('/root/schedules');rootSchedules.innerHTML='';(schedules.schedules||[]).filter(function(i){return String(i.status).indexOf('pending')===0}).forEach(function(i){makeAssignBlock(rootSchedules,i,'schedule')});if(!rootSchedules.children.length)rootSchedules.innerHTML='<div class="muted">沒有待處理排程</div>';const appeals=await api('/root/appeals');rootAppeals.innerHTML='';(appeals.appeals||[]).filter(function(i){return String(i.status).indexOf('pending')===0}).forEach(function(i){makeAssignBlock(rootAppeals,i,'appeal')});if(!rootAppeals.children.length)rootAppeals.innerHTML='<div class="muted">沒有待處理申訴</div>'}
sendCode.onclick=async function(){loginNotice.textContent=(await auth('/api/auth/request-code',{qq:qq.value})).message};verifyCode.onclick=async function(){const r=await auth('/api/auth/verify-code',{qq:qq.value,code:code.value});loginNotice.textContent=r.message;if(r.ok){session=r;who.textContent=r.qq;if(await loadGroups()){loginShell.style.display='none';dashboard.style.display='block'}}};groupSelect.onchange=function(){selectGroup(groupSelect.value)};reload.onclick=refreshAll;logout.onclick=function(){location.reload()};addMem.onclick=async function(){const r=await api('/memories','POST',{scope:memScope.value,text:memText.value});if(!r.ok)showMessage(r.message);else{memText.value='';loadSelf()}};saveSelf.onclick=async function(){showMessage((await api('/settings','POST',{dnd:dnd.checked,style:style.value,modelPreference:modelPref.value})).message)};createSchedule.onclick=async function(){const r=await api('/schedules','POST',{schedule:scheduleText.value});scheduleMsg.textContent=r.message;if(r.ok)scheduleText.value='';loadSchedules()};saveAdmin.onclick=async function(){showMessage((await api('/admin/state','POST',{ai_on:aiOn.checked,memory_on:memoryOn.checked,interject_rate:interject.value,persona:persona.value,keywords:keywords.value,active_speaking:activeSpeaking.checked})).message)};block.onclick=async function(){await api('/admin/blacklist','POST',{qq:blackQQ.value,block:true});loadAdmin()};unblock.onclick=async function(){await api('/admin/blacklist','POST',{qq:blackQQ.value,block:false});loadAdmin()};matrixSearch.onclick=loadMatrix;saveFlags.onclick=async function(){showMessage((await api('/root/flags','POST',{private_chat_enabled:flagPrivateChat.checked,private_schedule_enabled:flagPrivateSchedule.checked,private_appeal_enabled:flagPrivateAppeal.checked,deepseek_enabled:flagDeepseek.checked})).message)};wlAdd.onclick=async function(){await api('/root/whitelist','POST',{groupId:wlGroup.value,enabled:true});showMessage('已加入')};wlDel.onclick=async function(){await api('/root/whitelist','POST',{groupId:wlGroup.value,enabled:false});showMessage('已移除')};grant.onclick=async function(){showMessage((await api('/root/member','POST',{qq:rootQQ.value,permission:permission.value,enabled:true})).message)};revoke.onclick=async function(){showMessage((await api('/root/member','POST',{qq:rootQQ.value,permission:permission.value,enabled:false})).message)};saveMember.onclick=async function(){showMessage((await api('/root/member','POST',{qq:rootQQ.value,privateAccess:privateAccess.value,quota:quotaInput.value})).message)};sendBroadcast.onclick=async function(){showMessage((await api('/root/broadcast','POST',{message:broadcast.value,groups:broadcastGroups.value})).message)};restart.onclick=async function(){if(confirm('清除目前群暫存？'))showMessage((await api('/root/restart','POST',{})).message)};backup.onclick=async function(){const r=await api('/root/backup');backupBox.value=JSON.stringify(r.backup,null,2)};async function runOps(action){const r=await api('/ops/action','POST',{action:action,qq:opsQQ.value,duration:opsDuration.value,value:opsValue.value});opsMsg.textContent=r.message}opsMute.onclick=function(){runOps('mute')};opsUnmute.onclick=function(){runOps('unmute')};opsKick.onclick=function(){if(confirm('確定踢出？'))runOps('kick')};opsWholeMute.onclick=function(){if(confirm('確定全員禁言？'))runOps('whole_mute')};opsWholeUnmute.onclick=function(){runOps('whole_unmute')};opsRename.onclick=function(){runOps('rename_group')};opsCard.onclick=function(){runOps('set_card')};saveQuotas.onclick=async function(){showMessage((await api('/root/quotas','POST',{globalDailyCny:globalQuota.value,groupDailyCny:groupQuota.value})).message)};document.querySelectorAll('.tab').forEach(function(b){b.onclick=function(){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.getElementById('v-'+b.dataset.v).classList.add('active')}});
</script></body></html>`;
}

export class OneBotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.activeSocket = null;
    this.connectedAt = null;
    this.lastHeartbeatAt = null;
    this.pending = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      if (this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN) { try { this.activeSocket.close(4001, "replaced by newer NapCat connection"); } catch {} }
      this.activeSocket = server; this.connectedAt = Date.now(); this.lastHeartbeatAt = Date.now();
      server.addEventListener("message", event => this.handleMessage(server, request, event).catch(error => console.error("OneBotHub handler failed", error)));
      server.addEventListener("close", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat disconnected"); });
      server.addEventListener("error", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat socket error"); });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && ["/rpc", "/send"].includes(url.pathname)) {
      const payload = await request.json().catch(() => null);
      if (!payload?.action) return Response.json({ ok: false, sent: false, error: "invalid_payload" }, { status: 400 });
      try {
        const response = await this.sendAction(payload, Number(payload.timeoutMs || 15000));
        const ok = response?.status === "ok" || response?.retcode === 0;
        return Response.json({ ok, sent: true, data: response?.data ?? null, response, error: ok ? null : response?.message || `retcode:${response?.retcode}` }, { status: ok ? 200 : 502 });
      } catch (error) {
        return Response.json({ ok: false, sent: false, error: String(error.message || error) }, { status: 503 });
      }
    }

    if (url.pathname === "/status") return Response.json({ sockets: this.activeSocket?.readyState === WebSocket.OPEN ? 1 : 0, connected: this.activeSocket?.readyState === WebSocket.OPEN, connectedAt: this.connectedAt, lastHeartbeatAt: this.lastHeartbeatAt, pendingRpc: this.pending.size });
    return new Response("OneBotHub OK", { status: 200 });
  }

  rejectAll(reason) {
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pending.clear();
  }

  async sendAction(payload, timeoutMs = 15000) {
    const socket = this.activeSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("NAPCAT_NOT_CONNECTED");
    const echo = String(payload.echo || `qqai:rpc:${Date.now()}:${crypto.randomUUID()}`);
    const action = { action: payload.action, params: payload.params || {}, echo };
    if (["send_group_msg", "send_private_msg", "send_msg"].includes(action.action)) {
      const isGroup = action.action === "send_group_msg" || action.params.message_type === "group";
      await markOutboundPending(this.env, { isGroup, groupId: isGroup ? String(action.params.group_id || "") : "", peerId: isGroup ? "" : String(action.params.user_id || ""), text: extractMessageText(action.params.message), mediaTypes: extractOutboundMediaTypes(action.params.message) });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(echo); reject(new Error("ONEBOT_RPC_TIMEOUT")); }, Math.max(1000, Math.min(timeoutMs, 30000)));
      this.pending.set(echo, { resolve, reject, timer, action });
      try { socket.send(JSON.stringify(action)); } catch (error) { clearTimeout(timer); this.pending.delete(echo); reject(error); }
    });
  }

  async handleMessage(socket, request, event) {
    let body;
    try { body = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data)); } catch { return; }
    this.lastHeartbeatAt = Date.now();
    if (body?.echo && this.pending.has(String(body.echo))) {
      const pending = this.pending.get(String(body.echo)); this.pending.delete(String(body.echo)); clearTimeout(pending.timer);
      const messageId = body?.data?.message_id ?? body?.data?.messageId;
      if (messageId && ["send_group_msg", "send_private_msg", "send_msg"].includes(pending.action.action)) {
        await dbPut(this.env, `outbound:${messageId}`, JSON.stringify({ at: Date.now(), action: pending.action.action }));
      }
      pending.resolve(body); return;
    }
    if (!body || body.post_type === "meta_event") return;
    const sourceUrl = new URL(request.url);
    const internalResponse = await fetch(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, { method: "POST", headers: { "Content-Type": "application/json", "X-QQAI-Transport": "websocket-do", "Authorization": `Bearer ${String(this.env.ONEBOT_ACCESS_TOKEN || "")}` }, body: JSON.stringify(body) });
    if (!internalResponse || internalResponse.status === 204) return;
    const payload = await internalResponse.json().catch(() => null);
    if (!payload?.reply) return;
    const plan = payload.reply_plan || {};
    const isPrivate = body.message_type === "private";
    const message = isPrivate ? String(payload.reply) : this.buildSegments(body, plan, payload.reply);
    const action = isPrivate ? "send_private_msg" : "send_group_msg";
    const params = isPrivate ? { user_id: body.user_id, message, auto_escape: false } : { group_id: body.group_id, message, auto_escape: false };
    try {
      const response = await this.sendAction({ action, params }, 15000);
      const messageId = response?.data?.message_id;
      if (messageId) await recordStructuredMessage(this.env, { messageId: String(messageId), groupId: String(body.group_id || ""), senderId: String(body.self_id || ""), senderName: "QQAI", text: extractMessageText(message), mentions: plan.mentionIds || [], replyId: plan.quoteMessageId || plan.replyId || "", media: [], source: "ai", createdAt: Date.now() });
    } catch (error) { console.error("send reply failed", error); }
    finally {
      if (payload.thinking_message_id) {
        try { await this.sendAction({ action: "delete_msg", params: { message_id: numericId(payload.thinking_message_id) } }, 8000); } catch {}
      }
    }
  }

  parseCqSegments(value) {
    const input = String(value || "");
    const segments = [];
    const re = /\[CQ:(at|reply|image|record|video),([^\]]+)\]/g;
    let last = 0, match;
    const parseData = raw => Object.fromEntries(String(raw).split(",").map(part => { const i = part.indexOf("="); return i < 0 ? [part, ""] : [part.slice(0, i), part.slice(i + 1)]; }));
    while ((match = re.exec(input))) {
      if (match.index > last) segments.push({ type: "text", data: { text: input.slice(last, match.index) } });
      const data = parseData(match[2]);
      if (match[1] === "at" && data.qq) segments.push({ type: "at", data: { qq: String(data.qq) } });
      else if (match[1] === "reply" && (data.id || data.message_id)) segments.push({ type: "reply", data: { id: String(data.id || data.message_id) } });
      else if (["image", "record", "video"].includes(match[1])) segments.push({ type: match[1], data });
      last = re.lastIndex;
    }
    if (last < input.length) segments.push({ type: "text", data: { text: input.slice(last) } });
    return segments.length ? segments : [{ type: "text", data: { text: input } }];
  }

  buildSegments(eventBody, plan, text) {
    const segments = [];
    const quoteId = plan.quoteMessageId || plan.replyId;
    if (quoteId) segments.push({ type: "reply", data: { id: String(quoteId) } });
    const mentions = [...new Set((plan.mentionIds || []).map(String).filter(id => id && id !== String(eventBody.self_id || "")))];
    for (const id of mentions) { segments.push({ type: "at", data: { qq: id } }); segments.push({ type: "text", data: { text: " " } }); }
    segments.push(...this.parseCqSegments(text));
    return segments;
  }
}
