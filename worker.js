const VERSION = "0.5.3";
const BUILD_DATE = "2026-07-22";
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
  userQueueMax: 5,
  userQueueTtlMs: 10 * 60 * 1000,
  moderationProposalTtlMs: 2 * 60 * 1000,
  modelCostPolicy: "free_first",
  deepseekEmergencyFallback: false,
  paidContextSummary: false,
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


function remainingTimeout(deadlineAt, capMs, floorMs = 800) {
  const remaining = Math.max(0, Number(deadlineAt || 0) - Date.now());
  return Math.max(floorMs, Math.min(Number(capMs || remaining || floorMs), remaining || floorMs));
}

function isDeadlineExceeded(deadlineAt, reserveMs = 0) {
  return Date.now() + Math.max(0, reserveMs) >= Number(deadlineAt || 0);
}

function withTimeout(promise, timeoutMs, label = "TASK_TIMEOUT") {
  const ms = Math.max(500, Number(timeoutMs || 0));
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    })
  ]).finally(() => clearTimeout(timer));
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
    const eventSelfId = body.self_id ? body.self_id.toString() : "";
    // 使用 OneBot 事件实际 self_id 判断 @；随机插话仍由插话率独立决定。
    const botId = eventSelfId;
    const rawUserId = body.user_id ? body.user_id.toString() : "";
    const isSentEvent = body.post_type === "message_sent";
    // message_sent 的 user_id 在不同 OneBot 实现中可能代表收件人；发送者固定视为事件 self_id。
    const userId = isSentEvent && eventSelfId ? eventSelfId : rawUserId;
    const isSelfAccount = Boolean(userId && eventSelfId && userId === eventSelfId);
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
      return new Response(JSON.stringify({ reply: text, auto_escape: false, thinking_message_id: thinkingMessageId || null, record_reply: false, reply_kind: "command_or_system" }), {
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
    const fetchImageAsBase64 = async (descriptor) => {
      const item = await resolveOneBotMediaAsBase64(env, descriptor, "image", 8 * 1024 * 1024, ["image/"]);
      return item ? { base64: item.base64, mimeType: item.mimeType } : null;
    };
    const fetchAudioAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "record", 12 * 1024 * 1024, ["audio/", "application/octet-stream"]);
    const fetchVideoAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "video", 25 * 1024 * 1024, ["video/", "application/octet-stream"]);

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
      let imageFile = null;
      let voiceUrl = null;
      let voiceFile = null;
      let videoUrl = null;
      let videoFile = null;
      let mentionedQqs = [];
      let replyMessageId = body.message_id ? body.message_id.toString() : "";
      let quotedMessageId = "";
      let quotedMessageText = "";

      if (typeof body.message === "string") {
        userMessage = body.raw_message || body.message || "";
        mentionedQqs = [...userMessage.matchAll(/\[CQ:at,qq=(\d+|all)\]/g)].map(m => m[1]);
        const replyMatch = userMessage.match(/\[CQ:reply,[^\]]*id=([^,\]]+)/);
        quotedMessageId = replyMatch ? replyMatch[1] : "";
        const imageMedia = extractMediaDescriptor(userMessage, "image");
        imageUrl = imageMedia.url;
        imageFile = imageMedia.file;
        const voiceMedia = extractMediaDescriptor(userMessage, "record");
        voiceUrl = voiceMedia.url;
        voiceFile = voiceMedia.file;
        const videoMedia = extractMediaDescriptor(userMessage, "video");
        videoUrl = videoMedia.url;
        videoFile = videoMedia.file;
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
            imageUrl = part.data?.url || null;
            imageFile = part.data?.file || null;
          } else if (part.type === "video") {
            videoUrl = part.data?.url || null;
            videoFile = part.data?.file || null;
          } else if (part.type === "record") {
            voiceUrl = part.data?.url || null;
            voiceFile = part.data?.file || null;
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
          mediaTypes: [(imageUrl || imageFile) ? 'image' : '', (voiceUrl || voiceFile) ? 'record' : '', (videoUrl || videoFile) ? 'video' : ''].filter(Boolean)
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
        quotedMessage = await getQuotedMessage(env, currentGroupId, quotedMessageId, botId);
        quotedMessageText = quotedMessage?.text || quotedMessageText || "";
        // 允许“回复图片并 @机器人”读图；只从被引用消息取媒体，不猜测上一条群消息。
        if (!imageUrl && !imageFile && quotedMessage?.message) {
          const quotedImage = extractMediaDescriptor(quotedMessage.message, "image");
          imageUrl = quotedImage.url;
          imageFile = quotedImage.file;
        }
        if (!voiceUrl && !voiceFile && quotedMessage?.message) {
          const quotedVoice = extractMediaDescriptor(quotedMessage.message, "record");
          voiceUrl = quotedVoice.url;
          voiceFile = quotedVoice.file;
        }
      }
      const botMentioned = Boolean(botId && mentionedQqs.includes(botId));
      const repliedToBot = Boolean(quotedMessage && quotedMessage.source === 'ai');
      const repliedToOwnerHuman = Boolean(quotedMessage && quotedMessage.source === 'owner-human');
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

      // v0.2.6 以前無法區分聊天回覆與系統回覆；一次性移除舊 recent_logs 中全部機器人條目，
      // 避免歷史白名單提示、權限提示或指令結果繼續污染摘要、模仿與判斷語料。
      if (isGroup && botId) await purgeLegacyBotRepliesFromRecentLogs(env, currentGroupId, botId);

      // 用户问“看到图片了吗”但当前消息既未附图、也未回复图片时，不允许模型假装看见。
      const hasImageReference = Boolean(imageUrl || imageFile);
      if (explicitlyTriggered && /(?:看|讀|读|识别|識別|看到|看见|看見).{0,10}(?:图片|圖片|照片|图|圖)|(?:图片|圖片|照片|图|圖).{0,10}(?:看到|看见|看見|看得到|看得見)/i.test(cleanMessage) && !hasImageReference) {
        return jsonReply(`${atSender}我这则消息没有收到可读取的图片。请直接“回复那张图片”再 @我，或把图片和问题放在同一则消息发送。`);
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
        ? `当前消息引用了 ${quotedMessage?.senderName || '未知成员'}（QQ:${quotedMessage?.senderId || '未知'}，来源:${quotedMessage?.source || 'unknown'}）的消息：${quotedMessageText ? `「${quotedMessageText}」` : '未能取得正文'}。用户当前正文与引用内容必须分开理解。${repliedToOwnerHuman ? '这是同 QQ 模式下的人工消息，不是机器人回答。' : ''}`
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

      // 🎲 插話每日上限不設限，只保留概率、冷卻與免打擾；插話率本身就是開關，0% 代表關閉。
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

      // v0.5.0：管理层自然语言只建立提案，必须二次确认才执行。
      const moderationConfirmation = isGroup ? parseModerationConfirmation(cleanMessage) : null;
      if (moderationConfirmation) {
        if (!hasGroupOpsAuth) {
          return jsonReply(`${atSender}你没有确认群管理操作的权限。`);
        }
        const result = await handleModerationConfirmation(env, {
          groupId: currentGroupId,
          actorId: userId,
          actorRole: senderRole,
          isDeveloper,
          confirmation: moderationConfirmation
        });
        return jsonReply(`${atSender}${result.message}`);
      }

      if (isGroup && !isCommandMessage && (isDeveloper || ["owner", "admin"].includes(senderRole))) {
        const proposalResult = await detectNaturalModerationProposal(env, {
          groupId: currentGroupId,
          actorId: userId,
          actorName: senderCard,
          actorRole: senderRole,
          isDeveloper,
          text: cleanMessage,
          targetMentionQqs,
          botId,
          messageId: replyMessageId
        });
        if (proposalResult?.handled) return jsonReply(`${atSender}${proposalResult.message}`);
      }

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
      const hasAnyMediaAttachment = Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile);
      if ((!userMessage || userMessage.trim() === "") && !hasAnyMediaAttachment) {
        console.log(`⚠️ 偵測到群友 ${userId} 僅 @機器人 但未輸入有效內容，自動快速攔截。`);
        return new Response(null, { status: 204 });
      }

      // ⏳ Cloudflare 原生速率限制器 (10秒冷卻鎖) - 開發者、群主、管理員豁免
      const isBypassCooldown = isDeveloper || senderRole === 'owner' || senderRole === 'admin' || body.__qqai_queued === true;
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
      const ttsModels = parseList(env.GEMINI_TTS_MODELS, [
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-flash-preview-tts'
      ]);
      const modelList = chatModels;


      // 第一段到此完美結束，準備進入第二段的基礎系統指令與生圖路由控制模組...

      // 图片理解保留；图片生成指令已在 v0.5.0 移除。

      // 💖 【高情商情緒微調器】(取代卑微順從，提供情緒價值安慰)
      // ==========================================
      const botAtTag = `[CQ:at,qq=${botId}]`;
      const isAtMeOrAi = botMentioned || sameQqSelfAsk || repliedToBot;
      // 模型不需要看到自己的 QQ @ 文字；短确认词走低延迟快速通道。
      const conversationText = stripBotMentionFromConversation(cleanMessage, botId) || cleanMessage;
      const isFastAcknowledgement = isAtMeOrAi && isLightweightAcknowledgement(conversationText);
      
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
          return jsonReply(`${atSender}当前模型偏好：${modelPreferenceLabel(pref)}\n可选：自动、Gemma 26B、Gemma 31B、Gemini、DeepSeek、DeepSeek High、DeepSeek Max`);
        }
        const pref = normalizeModelPreference(raw);
        if (!pref) return jsonReply(`${atSender}可选：!模型 自动／Gemma 26B／Gemma 31B／Gemini／DeepSeek／DeepSeek High／DeepSeek Max`);
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

      // 高影响群操作统一建立待确认提案；任何模型或指令都不能直接踢人／禁言。
      if (/^[!！](?:禁言|mute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:禁言|mute)/i)?.[0] || '!禁言';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!禁言 @成员 10分`);
        const duration = Math.max(60, parseDurationSeconds(restText || '10分'));
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'mute', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', durationSeconds: duration, sourceText: cleanMessage, classifierReason: '明确禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`);
      }

      if (/^[!！](?:解禁|unmute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:解禁|unmute)/i)?.[0] || '!解禁';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!解禁 @成员`);
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'unmute', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', sourceText: cleanMessage, classifierReason: '明确解禁指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`);
      }

      if (/^[!！](?:踢出|踢人|kick)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:踢出|踢人|kick)/i)?.[0] || '!踢出';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!踢出 @成员`);
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'kick', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', sourceText: cleanMessage, classifierReason: '明确踢出指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`);
      }

      if (/^[!！](?:撤回|recall)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        if (!quotedMessageId) return jsonReply(`${atSender}请先回复需要撤回的消息，再发送 !撤回`);
        const result = await runOneBotGroupOperation(env, 'delete_msg', { message_id: numericId(quotedMessageId) }, { actorId: userId, groupId: currentGroupId, targetId: quotedMessageId, action: '撤回' });
        return jsonReply(`${atSender}${result.ok ? '已尝试撤回该消息。' : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:全员禁言|全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'whole_mute', sourceText: cleanMessage, classifierReason: '明确全员禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`);
      }

      if (/^[!！](?:解除全员禁言|解除全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'whole_unmute', sourceText: cleanMessage, classifierReason: '明确解除全员禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`);
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
                      `!模型 [自动/Gemma 26B/Gemma 31B/Gemini/DeepSeek/DeepSeek High/DeepSeek Max]\n` +
                      `!语音 [问题] (语音回覆)\n` +
                      `!读网页 [网址] (提取精华摘要)\n` +
                      `!翻译 [语言] [内容]\n` +
                      `图片理解：把图片和问题放在同一则消息，或回复图片后 @我\n\n` +
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
                     `自然语言也可提出操作，例如「把 @某人 杀了」\n` +
                     `以上高风险操作只建立提案；确认 <操作编号> 后才执行\n` +
                     `取消 <操作编号> 可撤销提案\n` +
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
      
      // 第二段到此結束，準備進入第三段的讀網頁與翻譯工具模組。

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
         const logEntry = `[${senderCard || '群友'}(QQ:${userId})]: ${cleanMessage || ((imageUrl || imageFile)?"发了张图":(voiceUrl || voiceFile)?"发了语音":"发了视频")}${relationForLog}`;
         recentLogs.push(logEntry);
         
         // 保持最多 200 条记录防止撑爆空间
         if (recentLogs.length > 200) recentLogs = recentLogs.slice(-200);
         
         // 💡 使用 ctx.waitUntil 异步存入 D1，绝不阻塞当前回覆流程！
         ctx.waitUntil(dbPut(env, logKey, JSON.stringify(recentLogs)));
         ctx.waitUntil(dbPut(env, `group_last_message:${currentGroupId}`, String(Date.now())));
         if (replyMessageId) {
           ctx.waitUntil(dbPut(env, `message:${currentGroupId}:${replyMessageId}`, JSON.stringify({ messageId: replyMessageId, groupId: currentGroupId, senderId: userId, senderName: senderCard, text: cleanMessage || ((imageUrl || imageFile)?'[图片]':(voiceUrl || voiceFile)?'[语音]':(videoUrl || videoFile)?'[视频]':''), mentions: mentionedQqs, replyId: quotedMessageId, source: isSelfAccount ? 'owner-human' : 'human', createdAt: Date.now() })));
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
      if (!shouldReply && isGroup && interjectChance > 0 && cleanMessage.length > 2 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
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
          const queryVec = await getVector(conversationText);
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

      // 只有明确 @ 机器人时显示临时状态；随机插话、回复触发与普通私聊均不显示“正在思考”。
      if (botMentioned && !isAutoInterject && !activeThinkingMessageId) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: (imageUrl || imageFile) ? '正在读图...' : (voiceUrl || voiceFile) ? '正在听语音...' : (videoUrl || videoFile) ? '正在分析视频...' : '正在思考...' }).catch(() => null);
      }

      // 只有上下文确实复杂时才生成摘要；默认使用免费 Gemma/Gemini，短确认词禁止走重型摘要链路。
      const shouldBuildContextSummary = !isFastAcknowledgement && history.length >= 4 && (conversationText.length >= 24 || Boolean(relationContext));
      let deepseekContextSummary = "";
      if (shouldBuildContextSummary) {
        deepseekContextSummary = await withTimeout(buildDeepSeekContextSummary(env, {
          sessionKey, groupId: currentGroupId, userId, history, currentText: conversationText, relationContext
        }), 8000, "CONTEXT_SUMMARY_TIMEOUT").catch(error => {
          console.warn("Context summary skipped:", error?.message || error);
          return "";
        });
      }
      if (deepseekContextSummary) {
        finalStylePrompt += `

【免费优先模型整理的上下文摘要】
${deepseekContextSummary}`;
      }

      // ==========================================
      // 📦 上下文与多模态数据最终封装
      // ==========================================
      let aiInputParts = [];
      
      // 1. 如果是主动插话状态，微调行为模式
      let userPrompt = isAutoInterject
        ? `(你现在是主动凑热闹插话状态，请自然地接梗或搭腔，极度精简！不要像回答问题一样，只需1~2句话)\n${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${conversationText}`
        : `${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${conversationText}`;

      aiInputParts.push({ text: userPrompt });

      // 2. 注入多模态媒体 (图片/语音/视频)
      let loadedImage = false;
      if (imageUrl || imageFile) {
        try {
          const imageData = await fetchImageAsBase64({ url: imageUrl, file: imageFile });
          if (imageData) {
            loadedImage = true;
            aiInputParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
          }
        } catch (error) {
          console.warn("NapCat image download failed:", error);
          await clearThinkingIndicator();
          return jsonReply(`${atSender}我收到了图片消息，但 NapCat 没有提供 Cloudflare 可下载的图片网址。请更新 NapCat 后重试，或重新发送图片并 @我。`);
        }
      }
      if (voiceUrl || voiceFile) {
        try {
          const audioData = await fetchAudioAsBase64({ url: voiceUrl, file: voiceFile });
          if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
        } catch (error) {
          console.warn("NapCat audio download failed:", error);
        }
      }
      if (videoUrl || videoFile) {
        try {
          const videoData = await fetchVideoAsBase64({ url: videoUrl, file: videoFile });
          if (videoData) aiInputParts.push({ inlineData: { mimeType: videoData.mimeType, data: videoData.base64 } });
        } catch (error) {
          console.warn("NapCat video download failed:", error);
        }
      }
      if (!loadedImage) {
        finalStylePrompt += "\n\n【视觉真实性规则】当前请求没有成功载入任何图片像素。绝对禁止声称看到了图片、描述图片内容或假装能读取上一条未引用的图片；若用户询问图片，应明确要求他回复该图片或重新发送。";
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
          modelPref, chatModels, finalStylePrompt, contents, cleanText: conversationText,
          fastChat: isFastAcknowledgement,
          hasMedia: Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile), userId, groupId: currentGroupId, isDeveloper
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
      return new Response(JSON.stringify({ reply: visibleReplyText, reply_plan: replyPlan, thinking_message_id: thinkingMessageIdForReply || null, record_reply: true, reply_kind: "conversation" }), {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      // 兜底全域崩溃防护，确保 Worker 绝对不会死机
      console.error("全局严重错误:", err);
      await clearThinkingIndicator();
      ctx.waitUntil(writeSystemError(env, err, { url: request.url }));
      const fallbackText = body?.message_type === "group"
        ? `[CQ:at,qq=${String(body?.user_id || "")}] 处理这条消息时出现异常，请稍后再试。`
        : "处理这条消息时出现异常，请稍后再试。";
      return new Response(JSON.stringify({ reply: fallbackText, record_reply: false, reply_kind: "system_error" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }, // 结束 fetch 函式

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dbPut(env, "system:last_cron", String(Number(controller?.scheduledTime || Date.now()))));
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

function envFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).trim().toLowerCase());
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
  if (["gemma", "gemma26", "gemma4-26b", "26b", "便宜"].includes(text)) return "gemma_26b";
  if (["gemma31", "gemma4-31b", "31b", "gemma高质量", "gemma高品質"].includes(text)) return "gemma_31b";
  if (["deepseek", "deepseek不思考", "deepseekoff"].includes(text)) return "deepseek";
  if (["deepseekhigh", "high", "深度思考"].includes(text)) return "deepseek_high";
  if (["deepseekmax", "max", "极限", "極限"].includes(text)) return "deepseek_max";
  return null;
}

function modelPreferenceLabel(value) {
  return ({ auto: "自动", gemini: "Gemini", gemma_26b: "Gemma 4 26B", gemma_31b: "Gemma 4 31B", deepseek: "DeepSeek", deepseek_high: "DeepSeek High", deepseek_max: "DeepSeek Max" })[value] || "自动";
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
  // 僅保存短期去重時間戳；不保存任何指令或回覆正文。
  await dbPut(env, key, JSON.stringify({ at: Date.now() }));
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

async function purgeLegacyBotRepliesFromRecentLogs(env, groupId, botId) {
  const gid = String(groupId || "");
  const bid = String(botId || "");
  if (!gid || !bid) return;
  const doneKey = `cleanup:v027:recent_logs_bot_replies:${gid}`;
  if (await dbGet(env, doneKey)) return;
  const key = `recent_logs:${gid}`;
  const logs = await readJson(env, key, []);
  if (Array.isArray(logs) && logs.length) {
    const marker = `(QQ:${bid})]:`;
    const cleaned = logs.filter(line => !String(line || "").includes(marker));
    if (cleaned.length !== logs.length) await dbPut(env, key, JSON.stringify(cleaned.slice(-200)));
  }
  await dbPut(env, doneKey, String(Date.now()));
}

async function recordStructuredMessage(env, item) {
  const record = {
    messageId: String(item.messageId || ""), groupId: String(item.groupId || ""),
    senderId: String(item.senderId || item.userId || ""), senderName: String(item.senderName || item.senderId || item.userId || ""),
    text: String(item.text || ""), mentions: item.mentions || [], replyId: item.replyId || "",
    source: item.source || "human", createdAt: Date.now()
  };
  if (record.messageId) await dbPut(env, `message:${record.groupId}:${record.messageId}`, JSON.stringify(record));
  // 指令回覆、白名單提示、權限提示與其他系統訊息只保留引用辨識所需的 message metadata，
  // 不加入 recent_logs，也不成為模仿、摘要、衝突判斷或後續 AI 聊天的語料。
  if (record.groupId && item.includeInRecentLogs !== false) {
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

function decodeCqValue(value) {
  return String(value || "")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&amp;/g, "&");
}

function parseCqAttributes(raw) {
  const attrs = {};
  for (const item of String(raw || "").split(",")) {
    const index = item.indexOf("=");
    if (index <= 0) continue;
    attrs[item.slice(0, index).trim()] = decodeCqValue(item.slice(index + 1));
  }
  return attrs;
}

function extractMediaDescriptor(message, type) {
  if (Array.isArray(message)) {
    const part = message.find(item => item?.type === type);
    return { url: String(part?.data?.url || "") || null, file: String(part?.data?.file || "") || null };
  }
  const match = String(message || "").match(new RegExp(`\\[CQ:${type},([^\\]]+)\\]`, "i"));
  if (!match) return { url: null, file: null };
  const attrs = parseCqAttributes(match[1]);
  return { url: attrs.url || null, file: attrs.file || null };
}

async function decodeInlineMedia(value, maxBytes, allowedPrefixes) {
  const text = String(value || "");
  let mimeType = "application/octet-stream";
  let base64 = "";
  if (text.startsWith("base64://")) {
    base64 = text.slice(9);
  } else {
    const match = text.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return null;
    mimeType = match[1].toLowerCase();
    base64 = match[2];
  }
  if (!allowedPrefixes.some(prefix => mimeType.startsWith(prefix)) && mimeType !== "application/octet-stream") throw new Error(`不支持的媒体类型：${mimeType}`);
  const estimated = Math.floor(base64.length * 3 / 4);
  if (estimated > maxBytes) throw new Error("媒体文件过大");
  return { base64, mimeType, size: estimated };
}

async function resolveOneBotMediaAsBase64(env, descriptor, kind, maxBytes, allowedPrefixes) {
  const url = String(descriptor?.url || "").trim();
  const file = String(descriptor?.file || "").trim();
  for (const value of [url, file]) {
    if (!value) continue;
    const inline = await decodeInlineMedia(value, maxBytes, allowedPrefixes);
    if (inline) return inline;
    if (/^https?:\/\//i.test(value)) return fetchMediaAsBase64(value, maxBytes, allowedPrefixes);
  }
  if (file && kind === "image") {
    const data = await callOneBotAction(env, { action: "get_image", params: { file } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_image 未返回公网 URL");
  }
  if (file && kind === "record") {
    const data = await callOneBotAction(env, { action: "get_record", params: { file, out_format: "mp3" } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_record 未返回公网 URL");
  }
  throw new Error("媒体只有 NapCat 本机路径，Cloudflare 无法直接读取");
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

async function hasOutboundMessageMarker(env, messageId) {
  if (!messageId) return false;
  const raw = await dbGet(env, `outbound:${messageId}`);
  if (!raw) return false;
  try {
    const item = JSON.parse(raw);
    return Date.now() - Number(item?.at || 0) < 10 * 60 * 1000;
  } catch {
    return true;
  }
}

async function normalizeQuotedMessageSource(env, obj, botId, messageId) {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj };
  const senderId = String(result.senderId || "");
  const selfId = String(botId || result.selfId || "");
  const source = String(result.source || "unknown");

  // 新版由 Worker 自己写入的 AI 记录会固定使用 senderName=QQAI；这是可信来源。
  if (source === "ai" && String(result.senderName || "") === "QQAI") return result;
  if (source === "owner-human") return result;

  const outbound = await hasOutboundMessageMarker(env, messageId || result.messageId);
  if (outbound) {
    result.source = "ai";
    result.sourceConfidence = "outbound-message-id";
    return result;
  }

  // 同 QQ 模式的关键规则：账号相同不等于消息来自 AI。
  // 没有 Worker outbound 证据时，自身账号消息必须视为人工发言。
  if (senderId && selfId && senderId === selfId) {
    result.source = "owner-human";
    result.sourceConfidence = "same-account-without-outbound-proof";
    return result;
  }

  if (!["ai", "human", "owner-human"].includes(source)) result.source = "human";
  return result;
}

async function getQuotedMessage(env, groupId, messageId, botId = "") {
  const cacheKey = `message:${groupId}:${messageId}`;
  const cached = await dbGet(env, cacheKey);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && typeof obj === "object") {
        const normalized = await normalizeQuotedMessageSource(env, obj, botId, messageId);
        if (JSON.stringify(normalized) !== JSON.stringify(obj)) await dbPut(env, cacheKey, JSON.stringify(normalized));
        return normalized;
      }
    } catch {
      return { messageId, groupId, senderId: "", senderName: "", text: cached, source: "unknown" };
    }
  }
  try {
    const data = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(messageId) } }, 12000);
    const senderId = String(data?.sender?.user_id || data?.user_id || "");
    const selfId = String(botId || data?.self_id || "");
    const outbound = await hasOutboundMessageMarker(env, messageId);
    let source = "human";
    let sourceConfidence = "external-sender";
    if (data?.source === "ai" || outbound) {
      source = "ai";
      sourceConfidence = data?.source === "ai" ? "onebot-source" : "outbound-message-id";
    } else if (senderId && selfId && senderId === selfId) {
      source = "owner-human";
      sourceConfidence = "same-account-without-outbound-proof";
    }
    const obj = {
      messageId: String(messageId), groupId: String(groupId || data?.group_id || ""), senderId,
      senderName: String(data?.sender?.card || data?.sender?.nickname || senderId),
      text: extractMessageText(data?.message || data?.raw_message || ""),
      message: data?.message || null,
      source,
      sourceConfidence,
      selfId,
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

async function callGemmaDecision(env, { system, prompt, maxOutputTokens = 64, deadlineAt = Date.now() + 12000, maxAttempts = 4 }) {
  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  if (!keys.length) throw new Error("GEMMA_API_KEYS_MISSING");
  const models = parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]);
  let lastError = "GEMMA_DECISION_FAILED";
  let attempts = 0;
  for (const model of models) {
    for (const key of keys) {
      if (attempts >= Math.max(1, maxAttempts) || isDeadlineExceeded(deadlineAt, 800)) throw new Error(lastError);
      attempts += 1;
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
          signal: AbortSignal.timeout(remainingTimeout(deadlineAt, 7000))
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

async function callGemmaChat(env, { model, system, contents, maxOutputTokens = 1000, temperature = 0.72, timeoutMs = 30000 }) {
  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  if (!keys.length) throw new Error("GEMMA_API_KEYS_MISSING");
  const configured = parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]);
  const preferred = model === "gemma_31b" ? "gemma-4-31b-it" : "gemma-4-26b-a4b-it";
  const models = [preferred, ...configured.filter(x => x !== preferred)];
  let lastError = "GEMMA_CHAT_FAILED";
  for (const selectedModel of models) {
    for (const key of keys) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: (contents || []).map(item => ({
              role: item.role === "model" ? "model" : "user",
              parts: (item.parts || []).filter(part => part.text).map(part => ({ text: String(part.text || "") }))
            })).filter(item => item.parts.length),
            systemInstruction: { parts: [{ text: String(system || "") }] },
            generationConfig: {
              maxOutputTokens,
              temperature,
              thinkingConfig: { thinkingLevel: selectedModel.includes("31b") ? "high" : "minimal" }
            }
          }),
          signal: AbortSignal.timeout(Math.max(5000, Math.min(30000, Number(timeoutMs || 30000))))
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const text = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(part => part.text || "").join("").trim();
          if (text) return { text, model: selectedModel, usage: data.usageMetadata || {} };
        }
        lastError = `GEMMA_CHAT_${response.status}:${data?.error?.message || "UNKNOWN"}`;
      } catch (error) {
        lastError = String(error?.message || error);
      }
    }
  }
  throw new Error(lastError);
}

function extractGeminiGrounding(data) {
  const candidate = data?.candidates?.[0] || {};
  const metadata = candidate.groundingMetadata || {};
  const sources = [];
  const seen = new Set();
  for (const chunk of metadata.groundingChunks || []) {
    const web = chunk?.web || chunk?.retrievedContext || {};
    const uri = String(web.uri || "").trim();
    const title = String(web.title || uri || "网页来源").trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: title.slice(0, 120), uri });
    if (sources.length >= 5) break;
  }
  return {
    grounded: Boolean(sources.length || (metadata.webSearchQueries || []).length),
    sources,
    searchQueries: (metadata.webSearchQueries || []).map(String).filter(Boolean).slice(0, 8)
  };
}

function appendSearchSources(text, sources) {
  const base = String(text || "").trim();
  const list = Array.isArray(sources) ? sources.filter(item => item?.uri) : [];
  if (!base || !list.length) return base;
  const sourceLines = list.slice(0, 5).map((item, index) => `${index + 1}. ${item.title || "资料来源"}\n${item.uri}`);
  return `${base}\n\n资料来源：\n${sourceLines.join("\n")}`;
}

function stripBotMentionFromConversation(text, botId) {
  const id = String(botId || "").trim();
  if (!id) return String(text || "").trim();
  return String(text || "").split(`@${id}`).join(" ").replace(/\s+/g, " ").trim();
}

function isLightweightAcknowledgement(text) {
  const normalized = String(text || "")
    .replace(/[~～!！?？…。，,.、\s]/g, "")
    .trim();
  if (!normalized || normalized.length > 10) return false;
  return /^(?:嗯+|恩+|哦+|噢+|喔+|好+|好的|好吧|行+|可以|知道了|了解|明白了|收到|原来如此|原來如此|哈哈+|嘿嘿+|谢谢|謝謝|谢了|謝了|感谢|感謝|没事|沒事|没问题|沒問題)$/.test(normalized);
}

function searchRequirement(text) {
  const source = String(text || "");
  const explicit = /(?:帮我|幫我)?(?:上网|上網|联网|聯網|搜索|搜尋|查一下|查找|搜一下)|(?:请|請)?(?:查证|查證|验证|驗證)/i.test(source);
  const fresh = /今天|今日|現在|现在|目前|最新|剛剛|刚刚|本週|本周|新聞|新闻|價格|价格|現價|现价|版本|更新|上市|下架|限額|限额|匯率|汇率|天氣|天气|比分|賽程|赛程|政策|法律|規則|规则/i.test(source);
  return { needed: explicit || fresh, explicit };
}

async function callGeminiGenerate(env, { models, system, contents, maxOutputTokens = 1000, temperature = 0.7, useSearch = true, requireSearch = false, timeoutMs = 30000 }) {
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
      if (useSearch || requireSearch) body.tools = [{ googleSearch: {} }];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(5000, Math.min(30000, Number(timeoutMs || 30000))))
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const text = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(p => p.text || "").join("").trim();
            const grounding = extractGeminiGrounding(data);
            if (requireSearch && !grounding.grounded) {
              lastError = "GEMINI_SEARCH_NOT_GROUNDED";
              break;
            }
            if (text) return { text, model, usage: data.usageMetadata || {}, ...grounding };
          }
          lastError = `GEMINI_${response.status}:${data?.error?.message || "UNKNOWN"}`;
          // 自动搜索可以在模型不兼容时降级；强制搜索绝不能悄悄改成离线回答。
          if (response.status === 400 && body.tools && !requireSearch) { delete body.tools; continue; }
          break;
        } catch (error) { lastError = String(error?.message || error); break; }
      }
    }
  }
  throw new Error(lastError);
}

async function buildSharedSearchContext(env, { query, models }) {
  const requirement = searchRequirement(query);
  if (!requirement.needed) return null;
  const result = await callGeminiGenerate(env, {
    models,
    system: "你是联网检索器。必须使用 Google Search 查证用户问题，输出可供另一个模型引用的简体中文事实摘要。区分事实、日期与不确定性，不要编造来源。",
    contents: [{ role: "user", parts: [{ text: String(query || "").slice(0, 4000) }] }],
    maxOutputTokens: 700,
    temperature: 0.2,
    useSearch: true,
    requireSearch: true
  });
  return {
    context: result.text,
    sources: result.sources || [],
    searchQueries: result.searchQueries || []
  };
}

async function routeProviderWithGemma(env, text) {
  const source = String(text || "");
  try {
    const result = await callGemmaDecision(env, {
      system: "你是节省费用优先的模型路由分类器。只能输出 GEMMA_26B、GEMMA_31B、GEMINI、DEEPSEEK_HIGH 或 DEEPSEEK_MAX。Gemini/Gemma 使用免费额度，必须优先：普通短聊天与简单问答选 GEMMA_26B；较长聊天、摘要、解释、一般写作与普通代码选 GEMMA_31B；图片、语音、视频、实时资料或 Google 搜索选 GEMINI。只有在任务确实需要复杂多阶段推理、大型跨文件代码、严格证明或用户明确指定 DeepSeek 时，才选 DEEPSEEK_HIGH；仅极端高难度任务才选 DEEPSEEK_MAX。不要把普通问题送到付费 DeepSeek。",
      prompt: source.slice(0, 3000),
      maxOutputTokens: 24
    });
    const upper = result.text.toUpperCase();
    if (upper.includes("MAX")) return "deepseek_max";
    if (upper.includes("DEEPSEEK")) return "deepseek_high";
    if (upper.includes("GEMINI")) return "gemini";
    if (upper.includes("31")) return "gemma_31b";
    return "gemma_26b";
  } catch (error) {
    console.warn("Gemma provider routing unavailable, using local rules:", error);
    if (/今天|現在|现在|最新|新聞|新闻|搜尋|搜索|查一下|網址|网页|網頁/i.test(source)) return "gemini";
    if (/明确使用DeepSeek|明確使用DeepSeek|指定DeepSeek|deepseek/i.test(source)) return /max|极限|極限/i.test(source) ? "deepseek_max" : "deepseek_high";
    if (/大型跨文件|大型跨檔案|严格证明|嚴格證明|多阶段推理|多階段推理|完整系统架构|完整系統架構/i.test(source) && source.length > 1200) return "deepseek_high";
    return source.length > 220 || /代码|程式|证明|證明|推理|debug|架构|架構/i.test(source) ? "gemma_31b" : "gemma_26b";
  }
}

async function generateHybridReply(env, args) {
  let pref = args.modelPref || "auto";
  if (args.hasMedia) pref = "gemini";
  else if (args.fastChat) pref = "gemma_26b";
  if (pref === "auto") pref = await routeProviderWithGemma(env, args.cleanText);
  const deepseekEnabled = await getFeatureFlag(env, "deepseek_enabled", true);
  const costPolicy = String(env.MODEL_COST_POLICY || DEFAULTS.modelCostPolicy).trim().toLowerCase();
  const allowPaidEmergencyFallback = envFlag(env.DEEPSEEK_EMERGENCY_FALLBACK, DEFAULTS.deepseekEmergencyFallback);
  const searchState = searchRequirement(args.cleanText);
  let sharedSearchPromise = null;
  const getSharedSearch = async () => {
    if (!searchState.needed || args.hasMedia) return null;
    if (!sharedSearchPromise) sharedSearchPromise = buildSharedSearchContext(env, { query: args.cleanText, models: args.chatModels });
    return sharedSearchPromise;
  };
  const mergeSearchPrompt = (prompt, search) => search?.context
    ? `${prompt}\n\n【已联网查证的资料】\n${search.context}\n\n回答时只能将以上检索结果当作实时事实依据；无法由资料支持的部分必须说明不确定。`
    : prompt;
  const finish = (provider, result, search = null) => ({
    provider,
    ...result,
    text: appendSearchSources(result.text, result.sources?.length ? result.sources : search?.sources || []),
    searchQueries: result.searchQueries?.length ? result.searchQueries : search?.searchQueries || [],
    grounded: Boolean(result.grounded || search?.sources?.length)
  });

  const tryGemma = async modelPref => {
    if (args.hasMedia) throw new Error("GEMMA_NO_MEDIA");
    const search = await getSharedSearch();
    const result = await callGemmaChat(env, {
      model: modelPref,
      system: mergeSearchPrompt(args.finalStylePrompt, search),
      contents: args.contents,
      maxOutputTokens: args.fastChat ? 160 : 1000,
      temperature: args.fastChat ? 0.9 : 0.82,
      timeoutMs: args.fastChat ? 12000 : 30000
    });
    return finish("gemma", result, search);
  };
  const tryGemini = async () => {
    const result = await callGeminiGenerate(env, {
      models: args.chatModels,
      system: args.finalStylePrompt,
      contents: args.contents,
      maxOutputTokens: args.fastChat ? 180 : 1000,
      temperature: args.fastChat ? 0.9 : 0.82,
      useSearch: args.fastChat ? false : true,
      requireSearch: args.fastChat ? false : searchState.needed,
      timeoutMs: args.fastChat ? 12000 : 30000
    });
    return finish("gemini", result);
  };
  const tryDeepSeek = async mode => {
    if (!deepseekEnabled || !env.DEEPSEEK_API_KEY || args.hasMedia) throw new Error("DEEPSEEK_UNAVAILABLE");
    const search = await getSharedSearch();
    const thinking = mode === "deepseek" ? "disabled" : "enabled";
    const effort = mode === "deepseek_max" ? "max" : "high";
    const messages = [{ role: "system", content: mergeSearchPrompt(args.finalStylePrompt, search) }, ...flattenGeminiContents(args.contents).slice(-16)];
    const result = await callDeepSeek(env, { messages, userId: args.userId, groupId: args.groupId || "private", thinking, effort, maxTokens: 1000 });
    return finish("deepseek", result, search);
  };

  const attempts = [];
  if (args.fastChat) {
    attempts.push(() => tryGemma("gemma_26b"), tryGemini);
  } else if (pref === "gemma_26b" || pref === "gemma_31b") {
    attempts.push(() => tryGemma(pref), tryGemini);
    if (costPolicy !== "free_first" || allowPaidEmergencyFallback) attempts.push(() => tryDeepSeek("deepseek"));
  } else if (pref.startsWith("deepseek")) {
    // DeepSeek 只有被明确选择或路由器判定为高难度时才优先调用；失败后回退免费模型。
    attempts.push(() => tryDeepSeek(pref), () => tryGemma("gemma_31b"), tryGemini);
  } else {
    attempts.push(tryGemini, () => tryGemma("gemma_31b"));
    if (costPolicy !== "free_first" || allowPaidEmergencyFallback) attempts.push(() => tryDeepSeek("deepseek"));
  }

  let lastError = null;
  for (const attempt of attempts) {
    try { return await attempt(); }
    catch (error) { lastError = error; console.warn("Model fallback:", error?.message || error); }
  }
  throw lastError || new Error("ALL_MODELS_FAILED");
}

async function buildDeepSeekContextSummary(env, { sessionKey, groupId, userId, history, currentText, relationContext }) {
  if (!history?.length) return "";
  const source = history.slice(-12).map((m, i) => `${i + 1}. ${m.role}: ${(m.parts || []).map(p => p.text || "[媒体]").join(" ")}`).join("\n");
  const signature = outboundFingerprint({ isGroup: true, groupId, text: source + currentText + relationContext, mediaTypes: [] });
  const cached = await readJson(env, `context_summary:${sessionKey}`, null);
  if (cached?.signature === signature) return cached.summary || "";
  const previous = cached?.summary || "无旧摘要";
  const prompt = `旧摘要：\n${previous}\n\n最近消息：\n${source}\n\n当前消息：${currentText}\n${relationContext || ""}\n\n请输出简体中文结构化摘要，保留人物QQ、谁对谁说话、引用与@关系、事实、决定、未决问题和当前情绪。不要编造，控制在1200字内。`;
  const system = "你是群聊上下文压缩器。只整理事实与关系，输出简体中文。";
  try {
    // 免费优先：Gemma 31B 负责摘要，避免每轮对话消耗余额不多的 DeepSeek。
    const result = await callGemmaChat(env, {
      model: "gemma_31b",
      system,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      maxOutputTokens: 900,
      temperature: 0.15,
      timeoutMs: 8000
    });
    await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, provider: "gemma", updatedAt: Date.now() }));
    return result.text;
  } catch (gemmaError) {
    console.warn("Gemma context summary failed:", gemmaError);
  }
  try {
    const result = await callGeminiGenerate(env, {
      models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-2.5-flash-lite", "gemini-2.5-flash"]),
      system,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      maxOutputTokens: 900,
      temperature: 0.15,
      useSearch: false,
      requireSearch: false,
      timeoutMs: 8000
    });
    await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, provider: "gemini", updatedAt: Date.now() }));
    return result.text;
  } catch (geminiError) {
    console.warn("Gemini context summary failed:", geminiError);
  }
  const allowPaidSummary = envFlag(env.ALLOW_PAID_CONTEXT_SUMMARY, DEFAULTS.paidContextSummary);
  if (allowPaidSummary && env.DEEPSEEK_API_KEY && await getFeatureFlag(env, "deepseek_enabled", true)) {
    try {
      const result = await callDeepSeek(env, {
        userId: `summary:${groupId || userId}`, groupId: groupId || "private", thinking: "disabled", maxTokens: 900,
        model: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
      });
      await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, provider: "deepseek", updatedAt: Date.now() }));
      return result.text;
    } catch (deepseekError) {
      console.warn("Paid DeepSeek context summary failed:", deepseekError);
    }
  }
  return cached?.summary || "";
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

async function isVerifiedGroupOwner(env, groupId, userId) {
  const wanted = String(userId || "");
  if (!groupId || !wanted) return false;
  const ownerId = await getGroupOwnerId(env, groupId);
  if (ownerId) return String(ownerId) === wanted;
  const member = await getGroupMemberSafe(env, groupId, wanted);
  return String(member?.role || "") === "owner";
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


function moderationActionLabel(action) {
  return ({
    kick: "踢出群聊",
    mute: "禁言",
    unmute: "解除禁言",
    whole_mute: "开启全员禁言",
    whole_unmute: "解除全员禁言",
    set_admin: "设为管理员",
    unset_admin: "取消管理员"
  })[action] || action;
}

function moderationActionNeedsTarget(action) {
  return ["kick", "mute", "unmute", "set_admin", "unset_admin"].includes(action);
}

function parseModerationConfirmation(text) {
  const value = String(text || "").trim();
  const confirm = value.match(/^[!！]?(?:确认|確認|同意执行|同意執行|执行|執行)(?:\s+([a-z0-9_-]+))?$/i);
  if (confirm) return { type: "confirm", id: confirm[1] || "" };
  const cancel = value.match(/^[!！]?(?:取消操作|取消执行|取消執行|取消)(?:\s+([a-z0-9_-]+))?$/i);
  if (cancel) return { type: "cancel", id: cancel[1] || "" };
  return null;
}

function localModerationIntent(text) {
  const value = String(text || "").trim();
  const direct = value.match(/(?:QQ[:： ]*)?(\d{5,})/i)?.[1] || "";
  const hasMention = /@\d{5,}/.test(value);
  const imperativePrefix = /^(?:把|將|将|給我|给我|幫我|帮我|請|请|麻煩|麻烦|立刻|立即|馬上|马上|讓|让|快點|快点)/.test(value);
  const directActionStart = /^(?:踢出?|移出|请出|請出|杀了|殺了|斩了|斬了|清出去|禁言|闭麦|閉麥|解除禁言|解禁|全员禁言|全員禁言|解除全员禁言|解除全員禁言|设为管理员|設為管理員|取消管理员|取消管理員)/.test(value);
  const discussionOnly = /(?:吗|嗎|么|麼|是不是|是否|为什么|為什麼|怎么|怎麼|有人被|剛才|刚才|已經|已经|聽說|听说).{0,10}(?:踢|禁言|管理员|管理員)/.test(value) || /(?:踢|禁言|管理员|管理員).{0,8}(?:吗|嗎|么|麼|？|\?)/.test(value);
  const hasCommandShape = imperativePrefix || directActionStart || hasMention || Boolean(direct);
  if (!hasCommandShape || (discussionOnly && !imperativePrefix && !directActionStart)) return { action: "none", confidence: 0 };
  let action = "none";
  if (/(?:解除|取消).{0,5}(?:全员|全員)禁言/.test(value)) action = "whole_unmute";
  else if (/(?:开启|開啟|全员|全員).{0,5}禁言/.test(value) && !/@\d+/.test(value)) action = "whole_mute";
  else if (/(?:解除|取消|解开|解開|解禁).{0,6}(?:禁言|闭麦|閉麥)?/.test(value)) action = "unmute";
  else if (/(?:设|設|升|加).{0,8}(?:管理员|管理員)/.test(value)) action = "set_admin";
  else if (/(?:取消|撤销|撤銷|下掉).{0,8}(?:管理员|管理員)/.test(value)) action = "unset_admin";
  else if (/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|清出去)/.test(value)) action = "kick";
  else if (/(?:禁言|闭麦|閉麥|关小黑屋|關小黑屋)/.test(value)) action = "mute";
  if (action === "none") return { action: "none", confidence: 0 };
  let durationSeconds = 0;
  const durationText = value.match(/(\d+(?:\.\d+)?\s*(?:秒|分(?:钟|鐘)?|小时|小時|天))/)?.[1] || "";
  if (durationText) durationSeconds = parseDurationSeconds(durationText);
  return { action, targetQq: direct, targetName: "", durationSeconds, confidence: 0.62, reason: "本地保守规则识别" };
}

async function classifyNaturalModerationIntent(env, text) {
  const source = String(text || "").trim();
  if (!/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|禁言|闭麦|閉麥|全员禁言|全員禁言|管理员|管理員)/i.test(source)) {
    return { action: "none", confidence: 0 };
  }
  try {
    const result = await callGemmaDecision(env, {
      system: `你是QQ群管理意图解析器。只有当发言明显是在要求机器人执行群管理操作时才识别；闲聊、比喻、引用、讨论某人被踢或玩笑不得识别。只输出JSON，不要Markdown：{"action":"none|kick|mute|unmute|whole_mute|whole_unmute|set_admin|unset_admin","targetQq":"数字或空","targetName":"昵称或空","durationSeconds":数字,"confidence":0到1,"reason":"简短原因"}。中文“杀了/斩了/清出去”在明确命令语境中表示kick。禁言未给时长默认600秒。`,
      prompt: source.slice(0, 1200),
      maxOutputTokens: 180,
      deadlineAt: Date.now() + 9000,
      maxAttempts: 2
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const allowed = ["none", "kick", "mute", "unmute", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (!allowed.includes(obj.action)) return localModerationIntent(source);
    return {
      action: obj.action,
      targetQq: String(obj.targetQq || "").replace(/\D/g, ""),
      targetName: String(obj.targetName || "").trim(),
      durationSeconds: Number(obj.durationSeconds || 0),
      confidence: Number(obj.confidence || 0),
      reason: String(obj.reason || "Gemma 识别")
    };
  } catch (error) {
    console.warn("moderation classifier fallback:", error?.message || error);
    return localModerationIntent(source);
  }
}

async function getGroupMemberSafe(env, groupId, userId) {
  if (!groupId || !userId) return null;
  try {
    return await callOneBotAction(env, {
      action: "get_group_member_info",
      params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false }
    }, 10000);
  } catch {
    const cached = await readJson(env, `group_members:${groupId}`, []);
    const item = cached.find(m => String(m.qq || m.user_id) === String(userId));
    return item ? { user_id: numericId(userId), nickname: item.name || "", card: item.name || "", role: item.role || "member" } : null;
  }
}

async function resolveModerationTarget(env, { groupId, targetMentionQqs = [], intent, botId }) {
  let targetQq = String(intent?.targetQq || targetMentionQqs[0] || "").replace(/\D/g, "");
  if (targetQq && targetQq !== String(botId || "")) {
    const member = await getGroupMemberSafe(env, groupId, targetQq);
    return { ok: true, targetQq, member, targetName: member?.card || member?.nickname || targetQq };
  }
  const targetName = String(intent?.targetName || "").trim().replace(/^[@＠]/, "");
  if (!targetName) return { ok: false, reason: "missing", matches: [] };
  let members = [];
  try {
    const data = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    members = Array.isArray(data) ? data : [];
  } catch {
    members = await readJson(env, `group_members:${groupId}`, []);
  }
  const norm = value => String(value || "").trim().toLowerCase();
  const wanted = norm(targetName);
  const exact = members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v) === wanted));
  const partial = exact.length ? exact : members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v).includes(wanted) || wanted.includes(norm(v))));
  const matches = partial.filter(m => String(m.user_id || m.qq || "") !== String(botId || "")).slice(0, 8);
  if (matches.length !== 1) return { ok: false, reason: matches.length ? "ambiguous" : "not_found", matches };
  const member = matches[0];
  targetQq = String(member.user_id || member.qq || "");
  return { ok: true, targetQq, member, targetName: member.card || member.nickname || member.name || targetName };
}

async function createModerationProposal(env, data) {
  const id = `op_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const now = Date.now();
  const proposal = {
    id,
    status: "pending",
    createdAt: now,
    expiresAt: now + DEFAULTS.moderationProposalTtlMs,
    groupId: String(data.groupId || ""),
    actorId: String(data.actorId || ""),
    actorName: String(data.actorName || data.actorId || ""),
    actorRole: String(data.actorRole || "member"),
    action: data.action,
    targetId: String(data.targetId || ""),
    targetName: String(data.targetName || data.targetId || ""),
    targetRole: String(data.targetRole || "member"),
    durationSeconds: Number(data.durationSeconds || 0),
    rejectAddRequest: Boolean(data.rejectAddRequest),
    sourceText: String(data.sourceText || "").slice(0, 1000),
    classifierReason: String(data.classifierReason || ""),
    messageId: String(data.messageId || "")
  };
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  await dbPut(env, `moderation:last:${proposal.groupId}:${proposal.actorId}`, id);
  await appendIndex(env, `moderation:proposal:index:${proposal.groupId}`, id, 500);
  await writeSystemAudit(env, { type: "moderation_proposed", groupId: proposal.groupId, actorId: proposal.actorId, targetId: proposal.targetId, action: proposal.action, proposalId: id });
  return proposal;
}

function formatModerationProposal(proposal) {
  const targetLine = moderationActionNeedsTarget(proposal.action)
    ? `\n目标：${proposal.targetName || proposal.targetId}（QQ:${proposal.targetId}）`
    : "";
  const durationLine = proposal.action === "mute" ? `\n时长：${formatDuration(proposal.durationSeconds || 600)}` : "";
  return `⚠️ 已建立待确认操作\n编号：${proposal.id}\n动作：${moderationActionLabel(proposal.action)}${targetLine}${durationLine}\n识别原因：${proposal.classifierReason || "管理指令"}\n请在 2 分钟内发送「确认 ${proposal.id}」执行，或发送「取消 ${proposal.id}」。未确认不会执行任何群操作。`;
}

async function validateModerationProposalTarget(env, proposal, confirmerRole, confirmerId) {
  if (!moderationActionNeedsTarget(proposal.action)) return { ok: true };
  const developerId = String(env.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);
  if (!proposal.targetId) return { ok: false, message: "操作缺少明确目标。" };
  if (proposal.targetId === String(confirmerId)) return { ok: false, message: "不能对自己执行该操作。" };
  if (proposal.targetId === developerId) return { ok: false, message: "不能对核心开发者执行该操作。" };
  const target = await getGroupMemberSafe(env, proposal.groupId, proposal.targetId);
  const targetRole = target?.role || proposal.targetRole || "member";
  if (targetRole === "owner") return { ok: false, message: "不能对群主执行该操作。" };
  if (targetRole === "admin" && !["owner", "developer"].includes(confirmerRole)) return { ok: false, message: "管理员不能对其他管理员执行该操作，必须由群主确认。" };
  if (["set_admin", "unset_admin"].includes(proposal.action) && !(await isVerifiedGroupOwner(env, proposal.groupId, confirmerId))) {
    return { ok: false, message: "设置或取消 QQ 群管理员只能由当前群主确认；开发者与普通管理员均不能代替群主。" };
  }
  return { ok: true, target };
}

async function executeModerationProposal(env, proposal, confirmer) {
  const validation = await validateModerationProposalTarget(env, proposal, confirmer.role, confirmer.id);
  if (!validation.ok) return { ok: false, message: validation.message };
  const group_id = numericId(proposal.groupId);
  const user_id = numericId(proposal.targetId);
  let action = "";
  let params = {};
  if (proposal.action === "kick") { action = "set_group_kick"; params = { group_id, user_id, reject_add_request: Boolean(proposal.rejectAddRequest) }; }
  else if (proposal.action === "mute") { action = "set_group_ban"; params = { group_id, user_id, duration: Math.max(60, Math.min(30 * 24 * 3600, Number(proposal.durationSeconds || 600))) }; }
  else if (proposal.action === "unmute") { action = "set_group_ban"; params = { group_id, user_id, duration: 0 }; }
  else if (proposal.action === "whole_mute") { action = "set_group_whole_ban"; params = { group_id, enable: true }; }
  else if (proposal.action === "whole_unmute") { action = "set_group_whole_ban"; params = { group_id, enable: false }; }
  else if (proposal.action === "set_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: true }; }
  else if (proposal.action === "unset_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: false }; }
  else return { ok: false, message: "未知群操作。" };
  const result = await runOneBotGroupOperation(env, action, params, {
    actorId: confirmer.id,
    groupId: proposal.groupId,
    targetId: proposal.targetId,
    action: moderationActionLabel(proposal.action),
    proposalId: proposal.id
  });
  return result.ok ? { ok: true, message: `已执行：${moderationActionLabel(proposal.action)}。` } : { ok: false, message: `操作失败：${result.error}` };
}

async function handleModerationConfirmation(env, { groupId, actorId, actorRole, isDeveloper, confirmation }) {
  let id = String(confirmation.id || "").trim();
  if (!id) id = String(await dbGet(env, `moderation:last:${groupId}:${actorId}`) || "");
  if (!id) return { handled: true, ok: false, message: "没有找到你待确认的群操作。" };
  const proposal = await readJson(env, `moderation:proposal:${id}`, null);
  if (!proposal || String(proposal.groupId) !== String(groupId)) return { handled: true, ok: false, message: "找不到该待确认操作。" };
  if (proposal.status !== "pending") return { handled: true, ok: false, message: `该操作当前状态为 ${proposal.status}，不能重复处理。` };
  if (Date.now() > Number(proposal.expiresAt || 0)) {
    proposal.status = "expired";
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    return { handled: true, ok: false, message: "该操作已超过 2 分钟确认期限，未执行。" };
  }
  const adminRoleChange = ["set_admin", "unset_admin"].includes(proposal.action);
  const verifiedOwner = adminRoleChange ? await isVerifiedGroupOwner(env, groupId, actorId) : false;
  const canConfirm = adminRoleChange
    ? verifiedOwner
    : (String(proposal.actorId) === String(actorId) || isDeveloper || actorRole === "owner");
  if (!canConfirm) {
    return { handled: true, ok: false, message: adminRoleChange
      ? "设置或取消 QQ 群管理员只能由当前群主确认；开发者与普通管理员均无权执行。"
      : "只有提出操作的人、群主或开发者可以确认。" };
  }
  if (confirmation.type === "cancel") {
    proposal.status = "cancelled";
    proposal.cancelledAt = Date.now();
    proposal.cancelledBy = String(actorId);
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    await writeSystemAudit(env, { type: "moderation_cancelled", groupId, actorId, proposalId: id });
    return { handled: true, ok: true, message: `已取消操作 ${id}，未执行任何群管理动作。` };
  }
  const result = await executeModerationProposal(env, proposal, { id: String(actorId), role: isDeveloper ? "developer" : actorRole });
  proposal.status = result.ok ? "executed" : "failed";
  proposal.executedAt = Date.now();
  proposal.executedBy = String(actorId);
  proposal.result = result.message;
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  return { handled: true, ok: result.ok, message: `${result.message}\n操作编号：${id}` };
}

async function detectNaturalModerationProposal(env, { groupId, actorId, actorName, actorRole, isDeveloper, text, targetMentionQqs, botId, messageId }) {
  if (!groupId || !(isDeveloper || ["owner", "admin"].includes(actorRole))) return null;
  const intent = await classifyNaturalModerationIntent(env, text);
  if (!intent || intent.action === "none" || Number(intent.confidence || 0) < 0.55) return null;
  if (["set_admin", "unset_admin"].includes(intent.action) && !(await isVerifiedGroupOwner(env, groupId, actorId))) {
    return { handled: true, message: "设置或取消 QQ 群管理员只能由当前群主提出并确认；开发者与普通管理员均不能代替群主。" };
  }
  let target = { ok: true, targetQq: "", targetName: "", member: null };
  if (moderationActionNeedsTarget(intent.action)) {
    target = await resolveModerationTarget(env, { groupId, targetMentionQqs, intent, botId });
    if (!target.ok) {
      if (target.reason === "ambiguous") {
        const choices = target.matches.map(m => `${m.card || m.nickname || m.name || "成员"}(QQ:${m.user_id || m.qq})`).join("、");
        return { handled: true, message: `目标昵称不唯一：${choices}。请直接 @ 要操作的成员后再说一次。` };
      }
      return { handled: true, message: "我识别到群管理意图，但无法确定目标。请直接 @ 对方后再说一次；未执行任何操作。" };
    }
  }
  const proposal = await createModerationProposal(env, {
    groupId,
    actorId,
    actorName,
    actorRole: isDeveloper ? "developer" : actorRole,
    action: intent.action,
    targetId: target.targetQq,
    targetName: target.targetName,
    targetRole: target.member?.role || "member",
    durationSeconds: intent.action === "mute" ? Math.max(60, Number(intent.durationSeconds || 600)) : 0,
    sourceText: text,
    classifierReason: intent.reason || "AI 识别管理意图",
    messageId
  });
  return { handled: true, proposal, message: formatModerationProposal(proposal) };
}

async function listModerationProposals(env, groupId, { limit = 100 } = {}) {
  const ids = await readJson(env, `moderation:proposal:index:${groupId}`, []);
  const items = [];
  for (const id of ids.slice(-Math.max(1, Math.min(500, Number(limit || 100)))).reverse()) {
    const proposal = await readJson(env, `moderation:proposal:${id}`, null);
    if (proposal) items.push(proposal);
  }
  return items;
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "未设置";
  if (text.length <= 8) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 4)}••••••${text.slice(-3)}`;
}

async function runTimedHealthCheck(name, fn, options = {}) {
  const startedAt = Date.now();
  try {
    const detail = await withTimeout(Promise.resolve().then(fn), Number(options.timeoutMs || 12000), `HEALTH_${name}_TIMEOUT`);
    return { name, status: "ok", latencyMs: Date.now() - startedAt, detail: detail ?? null, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { name, status: options.optional ? "warning" : "error", latencyMs: Date.now() - startedAt, error: String(error?.message || error), checkedAt: new Date().toISOString() };
  }
}

async function runHealthChecks(env, { mode = "quick" } = {}) {
  const checks = [];
  checks.push(await runTimedHealthCheck("D1 Database", async () => {
    if (!env.DB) throw new Error("DB_NOT_BOUND");
    if (mode === "full") {
      const key = `health:test:${crypto.randomUUID()}`;
      await dbPut(env, key, "ok");
      const value = await dbGet(env, key);
      await dbDel(env, key);
      if (value !== "ok") throw new Error("D1_WRITE_READ_MISMATCH");
      return "读写删除正常";
    }
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    if (!row?.ok) throw new Error("D1_QUERY_FAILED");
    return "查询正常";
  }, { timeoutMs: 10000 }));

  checks.push(await runTimedHealthCheck("Durable Object / NapCat", async () => {
    if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    const state = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json();
    if (!state.connected) throw new Error("NAPCAT_NOT_CONNECTED");
    return { connected: true, sockets: state.sockets, pendingRpc: state.pendingRpc, inFlightQuestions: state.inFlightQuestions, queuedQuestions: state.queuedQuestions, lastHeartbeatAt: state.lastHeartbeatAt };
  }, { timeoutMs: 10000 }));

  const keys = [...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])];
  checks.push(await runTimedHealthCheck("Gemini API", async () => {
    if (!keys.length) throw new Error("GEMINI_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keys[0])}&pageSize=1`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`GEMINI_${response.status}`);
    return { key: maskSecret(keys[0]), reachable: true };
  }, { timeoutMs: 10000 }));

  checks.push(await runTimedHealthCheck("Gemma 4 26B", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-26b-a4b-it") };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA26_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-26b-a4b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("Gemma 4 31B", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-31b-it") };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA31_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-31b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("DeepSeek API", async () => {
    if (!env.DEEPSEEK_API_KEY) return { configured: false };
    if (mode !== "full") return { configured: true, key: maskSecret(env.DEEPSEEK_API_KEY) };
    const response = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`DEEPSEEK_${response.status}`);
    return { configured: true, reachable: true };
  }, { timeoutMs: 10000, optional: true }));

  checks.push(await runTimedHealthCheck("Workers AI", async () => {
    if (!env.AI) throw new Error("AI_NOT_BOUND");
    if (mode !== "full") return "binding present";
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["health check"] });
    if (!Array.isArray(result?.data?.[0])) throw new Error("WORKERS_AI_EMBEDDING_FAILED");
    return { dimensions: result.data[0].length };
  }, { timeoutMs: 15000 }));

  checks.push(await runTimedHealthCheck("Vectorize", async () => {
    if (!env.VECTORIZE) throw new Error("VECTORIZE_NOT_BOUND");
    if (mode !== "full") return "binding present";
    if (!env.AI) throw new Error("AI_REQUIRED_FOR_VECTOR_TEST");
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["vector health"] });
    const vector = result?.data?.[0];
    if (!Array.isArray(vector)) throw new Error("VECTOR_EMBEDDING_FAILED");
    const query = await env.VECTORIZE.query(vector, { topK: 1, returnMetadata: "all" });
    return { matches: query?.matches?.length || 0 };
  }, { timeoutMs: 18000 }));

  const lastCron = await dbGet(env, "system:last_cron");
  checks.push({ name: "Cron Scheduler", status: lastCron && Date.now() - Number(lastCron) < 5 * 60 * 1000 ? "ok" : "warning", latencyMs: 0, detail: { lastRunAt: lastCron ? new Date(Number(lastCron)).toISOString() : null }, checkedAt: new Date().toISOString() });
  checks.push({ name: "Rate Limiter", status: env.MY_RATE_LIMITER ? "ok" : "warning", latencyMs: 0, detail: env.MY_RATE_LIMITER ? "binding present" : "not bound", checkedAt: new Date().toISOString() });

  const summary = {
    ok: !checks.some(item => item.status === "error"),
    mode,
    version: VERSION,
    buildDate: BUILD_DATE,
    checkedAt: new Date().toISOString(),
    counts: {
      ok: checks.filter(item => item.status === "ok").length,
      warning: checks.filter(item => item.status === "warning").length,
      error: checks.filter(item => item.status === "error").length
    },
    checks
  };
  await dbPut(env, `health:last:${mode}`, JSON.stringify(summary));
  return summary;
}

async function buildHealthState(env) {
  const health = await runHealthChecks(env, { mode: "quick" });
  let onebot = null;
  try { onebot = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json(); } catch {}
  return {
    ...health,
    at: new Date().toISOString(),
    bindings: { db: Boolean(env.DB), vectorize: Boolean(env.VECTORIZE), ai: Boolean(env.AI), onebotHub: Boolean(env.ONEBOT_HUB) },
    providers: {
      gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS),
      gemmaDecisionModels: parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      gemmaChatModels: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      deepseek: Boolean(env.DEEPSEEK_API_KEY),
      liveModel: env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview"
    },
    onebot,
    privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
    privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
    privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
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


  const portalIsDeveloper = permissions.developer || isDeveloperId(env, authed.qq);

  if (request.method === "GET" && path === "/health") {
    const mode = url.searchParams.get("mode") === "full" ? "full" : "quick";
    if (mode === "full" && !portalIsDeveloper) return jsonResponse({ ok: false, message: "完整健康检查仅开发者可执行，因为会发送最小模型请求。" }, 403);
    return jsonResponse(await runHealthChecks(env, { mode }));
  }

  if (request.method === "GET" && path === "/models") {
    const health = await readJson(env, "health:last:quick", null);
    const lastByName = Object.fromEntries((health?.checks || []).map(item => [item.name, item]));
    const registry = [
      ...parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).map((id, index) => ({ id, provider: "Google", family: "Gemma", billing: "Gemini 免费层额度", capabilities: ["text", "chat", "routing"], priority: index + 1, status: lastByName[id.includes("31b") ? "Gemma 4 31B" : "Gemma 4 26B"]?.status || "unknown" })),
      ...parseList(env.GEMINI_CHAT_MODELS).map((id, index) => ({ id, provider: "Google", family: "Gemini", billing: "未启用付费／免费层额度", capabilities: ["text", "chat", "vision"], priority: index + 1, status: lastByName["Gemini API"]?.status || "unknown" })),
      ...[env.DEEPSEEK_FLASH_MODEL, env.DEEPSEEK_PRO_MODEL].filter(Boolean).map((id, index) => ({ id, provider: "DeepSeek", family: "DeepSeek", billing: "付费余额／受每日预算限制", capabilities: ["text", "chat", "reasoning", "code"], priority: index + 1, status: lastByName["DeepSeek API"]?.status || (env.DEEPSEEK_API_KEY ? "unknown" : "unconfigured") }))
    ];
    const deepseekDailyBudgetCny = await getQuotaNumber(env, "quota:deepseek:global_daily_cny", Number(env.DEEPSEEK_DAILY_BUDGET_CNY || 0.35));
    return jsonResponse({
      ok: true,
      models: registry,
      routing: { simple: "gemma-4-26b-a4b-it", general: "gemma-4-31b-it", vision: parseList(env.GEMINI_CHAT_MODELS)[0] || "Gemini", complex: env.DEEPSEEK_FLASH_MODEL || "DeepSeek" },
      costPolicy: { mode: String(env.MODEL_COST_POLICY || DEFAULTS.modelCostPolicy), geminiBilling: "free_tier", deepseekBilling: "paid_limited", deepseekDailyBudgetCny, emergencyFallback: envFlag(env.DEEPSEEK_EMERGENCY_FALLBACK, DEFAULTS.deepseekEmergencyFallback), paidContextSummary: envFlag(env.ALLOW_PAID_CONTEXT_SUMMARY, DEFAULTS.paidContextSummary) }
    });
  }

  if (request.method === "GET" && path === "/tasks") {
    if (!portalIsDeveloper && !groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const status = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json().catch(() => ({}));
    const queues = Array.isArray(status.queues) ? status.queues : [];
    const visible = portalIsDeveloper ? queues : queues.filter(item => String(item.groupId || "") === String(groupId));
    return jsonResponse({ ok: true, inFlightQuestions: visible.filter(item => item.startedAt).length, queuedQuestions: visible.reduce((sum, item) => sum + (item.queued?.length || 0), 0), queues: visible });
  }

  if (request.method === "POST" && path === "/tasks/cancel") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少任务管理权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    const targetUser = String(body.userId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能管理当前群的任务。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup, userId: targetUser, messageId: String(body.messageId || "") }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "任务取消失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/tasks/clear") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少清空等待列权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能清空当前群等待列。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "等待列清空失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/simulator") {
    const text = String(body.text || "").trim();
    const senderRole = ["owner", "admin", "member"].includes(body.senderRole) ? body.senderRole : "member";
    const mentionsBot = Boolean(body.mentionsBot);
    const hasImage = Boolean(body.hasImage);
    const currentlyBusy = Boolean(body.currentlyBusy);
    const isCommand = /^[!！]/.test(text);
    const localManagement = ["owner", "admin"].includes(senderRole) ? localModerationIntent(text) : { action: "none", confidence: 0 };
    const managementCandidate = localManagement.action !== "none" && !isCommand;
    const explicitQuestion = mentionsBot && Boolean(text || hasImage) && !isCommand && !managementCandidate;
    const interjectRate = groupId ? Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate))) : DEFAULTS.interjectRate;
    let final = "静默";
    if (isCommand) final = "执行指令；指令回复不写入聊天记忆";
    else if (managementCandidate) final = `建立「${moderationActionLabel(localManagement.action)}」提案，等待二次确认；不直接执行`;
    else if (explicitQuestion && currentlyBusy) final = "加入该群友的个人等待列";
    else if (explicitQuestion) final = "立即进入 AI 回答流程";
    else if (interjectRate > 0) final = "可进入随机插话候选；仍需 Gemma 判断与概率检查";
    return jsonResponse({ ok: true, parsed: { text, senderRole, mentionsBot, hasImage, isCommand, managementCandidate, managementAction: localManagement.action, explicitQuestion, currentlyBusy, interjectRate }, decisions: { queue: explicitQuestion && currentlyBusy, thinking: explicitQuestion && !currentlyBusy, recordReply: explicitQuestion && !isCommand, commandOrSystemRecordedAsChat: false, final }, steps: ["解析 OneBot 事件", `发送者角色：${senderRole}`, mentionsBot ? "检测到 @机器人" : "未检测到 @机器人", managementCandidate ? `检测到管理提案：${moderationActionLabel(localManagement.action)}` : "未检测到明确管理提案", final] });
  }

  if (!groupId && !path.startsWith("/root/")) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (groupId && !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群已不在白名单。" }, 403);


  if (request.method === "GET" && path === "/moderation/proposals") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群管理提案查看权限。" }, 403);
    const items = await listModerationProposals(env, groupId, { limit: Number(url.searchParams.get("limit") || 100) });
    return jsonResponse({ ok: true, proposals: items });
  }

  if (request.method === "POST" && path === "/moderation/confirm") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少确认群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, confirmation: { type: "confirm", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

  if (request.method === "POST" && path === "/moderation/cancel") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少取消群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, confirmation: { type: "cancel", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

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
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群操作权限。" }, 403);
    const action = String(body.action || "");
    const target = String(body.qq || "").replace(/\D/g, "");
    const proposedActions = ["mute", "unmute", "kick", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (proposedActions.includes(action)) {
      if (["set_admin", "unset_admin"].includes(action) && !(await isVerifiedGroupOwner(env, groupId, authed.qq))) {
        return jsonResponse({ ok: false, message: "设置或取消 QQ 群管理员只能由当前群主提出；开发者与普通管理员均无权代替。" }, 403);
      }
      if (moderationActionNeedsTarget(action) && !target) return jsonResponse({ ok: false, message: "请输入目标 QQ。" }, 400);
      const member = target ? await getGroupMemberSafe(env, groupId, target) : null;
      const proposal = await createModerationProposal(env, {
        groupId,
        actorId: authed.qq,
        actorName: authed.name || authed.qq,
        actorRole: portalIsDeveloper ? "developer" : role,
        action,
        targetId: target,
        targetName: member?.card || member?.nickname || target,
        targetRole: member?.role || "member",
        durationSeconds: action === "mute" ? Math.max(60, parseDurationSeconds(String(body.duration || "10分"))) : 0,
        sourceText: `Portal 提出 ${moderationActionLabel(action)}`,
        classifierReason: "Portal 手动提案",
        messageId: ""
      });
      return jsonResponse({ ok: true, pendingConfirmation: true, proposal, message: `已建立提案 ${proposal.id}，尚未执行。请在「管理提案」页面确认。` });
    }
    let result;
    if (action === "rename_group" && String(body.value || "").trim()) result = await runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(groupId), group_name: String(body.value).trim().slice(0, 60) }, { actorId: authed.qq, groupId, action: "网页改群名" });
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
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAIbot Control Center</title>
<style>
:root{color-scheme:light;--bg:#f5f7fb;--panel:#fff;--panel2:#f8fafc;--text:#172033;--muted:#68748a;--line:#e3e8f0;--primary:#5b5bd6;--primary2:#7777e8;--ok:#17845f;--warn:#b26a00;--bad:#c53d4d;--shadow:0 18px 48px rgba(31,42,68,.08);font-family:Inter,"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}.hidden{display:none!important}.muted{color:var(--muted)}
.login{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 10%,rgba(91,91,214,.15),transparent 38%),radial-gradient(circle at 90% 90%,rgba(23,132,95,.11),transparent 40%),var(--bg)}
.login-card{width:min(450px,100%);background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:26px;padding:30px;box-shadow:var(--shadow);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),#8a69e8);color:#fff;font-weight:800}.brand h1{font-size:22px;margin:0}.brand p{margin:4px 0 0;color:var(--muted);font-size:14px}
.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;font-weight:700}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--text);padding:11px 12px;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(91,91,214,.12)}.field textarea{min-height:100px;resize:vertical}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1;min-width:160px}
.btn{border:0;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer;background:#e9edf5;color:var(--text)}.btn:hover{filter:brightness(.98)}.btn.primary{background:var(--primary);color:#fff}.btn.danger{background:#fde9ec;color:var(--bad)}.btn.ghost{background:transparent;border:1px solid var(--line)}.btn:disabled{opacity:.55;cursor:not-allowed}.notice{margin-top:14px;padding:11px 13px;border-radius:11px;background:var(--panel2);color:var(--muted);font-size:14px;line-height:1.55}
.app{min-height:100vh;display:grid;grid-template-columns:250px 1fr}.sidebar{position:sticky;top:0;height:100vh;background:#171b2b;color:#e9ecf4;padding:18px 14px;display:flex;flex-direction:column}.side-brand{display:flex;align-items:center;gap:10px;padding:8px 8px 18px}.side-brand .logo{width:38px;height:38px;border-radius:12px}.side-brand b{display:block}.side-brand small{color:#98a2b7}.nav{display:grid;gap:4px;overflow:auto}.nav button{border:0;background:transparent;color:#aeb7c9;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-weight:650}.nav button:hover,.nav button.active{background:rgba(255,255,255,.1);color:#fff}.side-bottom{margin-top:auto;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.1)}
.main{min-width:0}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 24px;border-bottom:1px solid var(--line);background:rgba(245,247,251,.88);backdrop-filter:blur(12px);position:sticky;top:0;z-index:5}.topbar h2{margin:0;font-size:20px}.top-actions{display:flex;align-items:center;gap:10px}.top-actions select{max-width:250px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:#fff}.content{padding:24px;max-width:1500px;margin:auto}.view{display:none}.view.active{display:block}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.section-head h2{margin:0 0 5px;font-size:25px}.section-head p{margin:0;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 8px 28px rgba(38,49,76,.045);min-width:0}.span-3{grid-column:span 3}.span-4{grid-column:span 4}.span-6{grid-column:span 6}.span-8{grid-column:span 8}.span-12{grid-column:1/-1}.metric-label{font-size:13px;color:var(--muted);margin-bottom:8px}.metric-value{font-size:27px;font-weight:800;letter-spacing:-.03em}.metric-sub{font-size:12px;color:var(--muted);margin-top:7px}.card h3{margin:0 0 13px;font-size:16px}.status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:#edf1f7}.status:before{content:"";width:7px;height:7px;border-radius:50%;background:#8390a5}.status.ok{background:#e5f5ee;color:var(--ok)}.status.ok:before{background:var(--ok)}.status.warning{background:#fff2d9;color:var(--warn)}.status.warning:before{background:var(--warn)}.status.error{background:#fde9ec;color:var(--bad)}.status.error:before{background:var(--bad)}
.list{display:grid;gap:10px}.item{border:1px solid var(--line);border-radius:13px;padding:13px;background:#fff}.item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.item-title{font-weight:800;word-break:break-word}.item-meta{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.55}.item-body{margin-top:9px;line-height:1.55;word-break:break-word}.empty{padding:28px 12px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:13px}.health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:13px}.health-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff}.health-card .latency{font-size:12px;color:var(--muted);margin-top:8px}.health-card .detail{font-size:12px;color:var(--muted);margin-top:8px;word-break:break-word;white-space:pre-wrap}
.timeline{display:grid;gap:8px}.step{display:flex;gap:10px;align-items:flex-start}.step i{width:9px;height:9px;border-radius:50%;background:var(--primary);margin-top:6px;flex:0 0 auto}.step span{line-height:1.5}.pill{display:inline-block;border-radius:999px;padding:4px 8px;background:#eef0ff;color:#5050bd;font-size:12px;font-weight:700;margin:2px 4px 2px 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.switch{display:flex;align-items:center;gap:9px;margin:10px 0}.switch input{width:18px;height:18px}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#151a29;color:#e9ecf4;border-radius:12px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px}
.toast{position:fixed;right:22px;bottom:22px;max-width:420px;padding:12px 15px;border-radius:12px;background:#1c2233;color:#fff;box-shadow:var(--shadow);z-index:30}.mobile-menu{display:none}
@media(max-width:1050px){.span-3{grid-column:span 6}.span-4{grid-column:span 6}.span-8{grid-column:span 12}}
@media(max-width:760px){.app{display:block}.sidebar{position:fixed;left:0;top:0;width:270px;z-index:20;transform:translateX(-102%);transition:.2s}.sidebar.open{transform:none}.mobile-menu{display:inline-flex}.topbar{padding:0 14px}.topbar h2{font-size:17px}.top-actions select{max-width:145px}.content{padding:16px}.span-3,.span-4,.span-6,.span-8{grid-column:1/-1}.split{grid-template-columns:1fr}.section-head{display:block}.section-head .row{margin-top:12px}}
</style>
</head>
<body>
<section id="login" class="login">
  <div class="login-card">
    <div class="brand"><div class="logo">AI</div><div><h1>QQAIbot Control Center</h1><p>v0.5.0 智慧營運、管理提案與等待列</p></div></div>
    <div class="field"><label for="loginQq">QQ 號</label><input id="loginQq" inputmode="numeric" placeholder="輸入你的 QQ 號"></div>
    <div class="row"><button id="sendCode" class="btn ghost grow">傳送驗證碼</button></div>
    <div class="field"><label for="loginCode">六位驗證碼</label><input id="loginCode" inputmode="numeric" maxlength="6" placeholder="驗證碼"></div>
    <button id="verifyCode" class="btn primary" style="width:100%">登入管理中心</button>
    <div id="loginNotice" class="notice">驗證碼會由已連線的 NapCat 私訊至你的 QQ。</div>
  </div>
</section>
<div id="app" class="app hidden">
  <aside id="sidebar" class="sidebar">
    <div class="side-brand"><div class="logo">AI</div><div><b>QQAIbot</b><small>Control Center 0.5.0</small></div></div>
    <nav class="nav" id="nav">
      <button data-view="overview" class="active">總覽</button>
      <button data-view="health">健康檢查</button>
      <button data-view="tasks">任務與等待列</button>
      <button data-view="moderation">管理提案</button>
      <button data-view="simulator">事件模擬器</button>
      <button data-view="models">模型中心</button>
      <button data-view="quota">額度與限制</button>
      <button data-view="groups">群組設定</button>
      <button data-view="memory">記憶管理</button>
      <button data-view="logs">操作日誌</button>
    </nav>
    <div class="side-bottom"><div id="identity" style="font-size:13px"></div><button id="logout" class="btn ghost" style="margin-top:10px;width:100%;color:#fff;border-color:rgba(255,255,255,.18)">登出</button></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="row"><button id="menu" class="btn ghost mobile-menu">☰</button><h2 id="pageTitle">總覽</h2></div><div class="top-actions"><select id="groupSelect"><option value="">選擇群組</option></select><button id="refresh" class="btn ghost">重新整理</button></div></header>
    <div class="content">
      <section id="v-overview" class="view active">
        <div class="section-head"><div><h2>系統總覽</h2><p>只顯示重要狀態；詳細資訊可進入對應頁面。</p></div><span id="overallStatus" class="status">尚未檢查</span></div>
        <div class="grid">
          <div class="card span-3"><div class="metric-label">NapCat</div><div id="mNapcat" class="metric-value">—</div><div id="mNapcatSub" class="metric-sub">等待資料</div></div>
          <div class="card span-3"><div class="metric-label">執行中問題</div><div id="mActive" class="metric-value">0</div><div class="metric-sub">每位群友同時最多 1 題</div></div>
          <div class="card span-3"><div class="metric-label">等待中的問題</div><div id="mQueued" class="metric-value">0</div><div class="metric-sub">前一題完成後自動處理</div></div>
          <div class="card span-3"><div class="metric-label">待確認管理提案</div><div id="mProposals" class="metric-value">0</div><div class="metric-sub">AI 永遠不直接踢人或禁言</div></div>
          <div class="card span-8"><h3>最近需要注意</h3><div id="overviewIssues" class="list"><div class="empty">執行健康檢查後顯示</div></div></div>
          <div class="card span-4"><h3>路由摘要</h3><div class="item-meta">簡短聊天</div><div class="item-title">Gemma 4 26B</div><div class="item-meta" style="margin-top:10px">一般聊天</div><div class="item-title">Gemma 4 31B</div><div class="item-meta" style="margin-top:10px">圖片理解</div><div class="item-title">Gemini 視覺模型</div><div class="item-meta" style="margin-top:10px">複雜推理／程式</div><div class="item-title">DeepSeek／Gemini</div></div>
        </div>
      </section>
      <section id="v-health" class="view">
        <div class="section-head"><div><h2>完整健康檢查</h2><p>快速檢查只驗證綁定與連線；完整檢查會發送最小模型請求。</p></div><div class="row"><button id="quickHealth" class="btn">快速檢查</button><button id="fullHealth" class="btn primary">完整檢查</button></div></div>
        <div id="healthSummary" class="grid" style="margin-bottom:16px"></div><div id="healthList" class="health-grid"><div class="empty">尚未執行</div></div>
      </section>
      <section id="v-tasks" class="view">
        <div class="section-head"><div><h2>任務與等待列</h2><p>同一位群友的新問題會排隊，不會與前一題同時生成。</p></div><div class="row"><button id="clearQueue" class="btn danger">清空目前群等待列</button><button id="reloadTasks" class="btn">重新載入</button></div></div>
        <div id="taskStats" class="grid" style="margin-bottom:16px"></div><div id="taskList" class="list"><div class="empty">尚無任務</div></div>
      </section>
      <section id="v-moderation" class="view">
        <div class="section-head"><div><h2>群管理提案</h2><p>自然語言和 Portal 操作都只建立提案，確認後才會呼叫 OneBot。</p></div><button id="reloadProposals" class="btn">重新載入</button></div>
        <div class="grid">
          <div class="card span-4"><h3>手動建立提案</h3><div class="field"><label>動作</label><select id="opAction"><option value="mute">禁言</option><option value="unmute">解除禁言</option><option value="kick">踢出群聊</option><option value="whole_mute">全員禁言</option><option value="whole_unmute">解除全員禁言</option><option value="set_admin">設為管理員</option><option value="unset_admin">取消管理員</option></select></div><div class="field"><label>目標 QQ（全員操作可留空）</label><input id="opQq" inputmode="numeric"></div><div class="field"><label>禁言時長</label><input id="opDuration" value="10分"></div><button id="createProposal" class="btn primary">建立提案，不直接執行</button><div id="opMessage" class="notice">高風險操作需要二次確認；設為／取消 QQ 群管理員只允許目前群主提出及確認。</div></div>
          <div class="card span-8"><h3>提案紀錄</h3><div id="proposalList" class="list"><div class="empty">尚無提案</div></div></div>
        </div>
      </section>
      <section id="v-simulator" class="view">
        <div class="section-head"><div><h2>事件模擬器</h2><p>部署前先檢查觸發、排隊、思考提示與記憶行為。</p></div><button id="runSimulator" class="btn primary">執行模擬</button></div>
        <div class="split"><div class="card"><div class="field"><label>模擬訊息</label><textarea id="simText" placeholder="例如：把 @某人 殺了"></textarea></div><div class="field"><label>發送者角色</label><select id="simRole"><option value="member">群友</option><option value="admin">管理員</option><option value="owner">群主</option></select></div><label class="switch"><input id="simMention" type="checkbox" checked>有 @ 機器人</label><label class="switch"><input id="simImage" type="checkbox">含圖片</label><label class="switch"><input id="simBusy" type="checkbox">此群友已有問題執行中</label></div><div class="card"><h3>模擬結果</h3><div id="simDecision" class="notice">尚未執行</div><div id="simSteps" class="timeline" style="margin-top:14px"></div></div></div>
      </section>
      <section id="v-models" class="view">
        <div class="section-head"><div><h2>模型中心</h2><p>免費優先：Gemma／Gemini 優先處理；DeepSeek 僅用於高難度或明確指定，並受每日人民幣預算限制。</p></div><button id="reloadModels" class="btn">重新載入</button></div><div id="modelList" class="grid"><div class="empty span-12">尚未載入</div></div>
      </section>
      <section id="v-quota" class="view">
        <div class="section-head"><div><h2>DeepSeek 額度與限制</h2><p>留空代表不限制；填 0 代表完全禁止；正數代表每日人民幣上限。</p></div><button id="saveQuota" class="btn primary">儲存額度</button></div>
        <div class="grid"><div class="card span-6"><h3>全站每日 CNY</h3><div class="field"><label>所有群組合計上限</label><input id="globalQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div class="notice">0＝完全停用 DeepSeek；空白＝不設每日上限。</div></div><div class="card span-6"><h3>目前群每日 CNY</h3><div class="field"><label>目前選擇群組上限</label><input id="groupQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div id="quotaStatus" class="notice">僅開發者可以修改。</div></div></div>
      </section>
      <section id="v-groups" class="view">
        <div class="section-head"><div><h2>群組設定</h2><p>修改目前選擇群的 AI、記憶、插話率與人格。</p></div><button id="saveGroup" class="btn primary">儲存設定</button></div>
        <div class="grid"><div class="card span-6"><h3>功能開關</h3><label class="switch"><input id="groupAi" type="checkbox">啟用 AI</label><label class="switch"><input id="groupMemory" type="checkbox">啟用聊天記憶</label><label class="switch"><input id="activeSpeaking" type="checkbox">允許主動發話（開發者）</label><div class="field"><label>隨機插話率（0–100%）</label><input id="interjectRate" type="number" min="0" max="100"></div></div><div class="card span-6"><h3>人格與關鍵字</h3><div class="field"><label>群組人格</label><textarea id="groupPersona"></textarea></div><div class="field"><label>過濾關鍵字（逗號或換行）</label><textarea id="groupKeywords"></textarea></div></div></div>
      </section>
      <section id="v-memory" class="view">
        <div class="section-head"><div><h2>記憶管理</h2><p>指令、白名單提示與系統訊息不會進入聊天記憶。</p></div><button id="reloadMemory" class="btn">重新載入</button></div>
        <div class="grid"><div class="card span-4"><h3>新增記憶</h3><div class="field"><label>範圍</label><select id="memoryScope"><option value="private">個人</option><option value="public">群組公開</option></select></div><div class="field"><label>內容</label><textarea id="memoryText"></textarea></div><button id="addMemory" class="btn primary">新增</button></div><div class="card span-8"><h3>目前記憶</h3><div id="memoryList" class="list"><div class="empty">尚無記憶</div></div></div></div>
      </section>
      <section id="v-logs" class="view">
        <div class="section-head"><div><h2>操作日誌</h2><p>群務與設定操作獨立保存，不會當成 AI 聊天語料。</p></div><button id="reloadLogs" class="btn">重新載入</button></div><div id="logList" class="list"><div class="empty">尚無日誌</div></div>
      </section>
    </div>
  </main>
</div>
<div id="toast" class="toast hidden"></div>
<script>
(function(){
'use strict';
var token=sessionStorage.getItem('qqai_token')||'';var currentGroup='';var session=null;
var $=function(id){return document.getElementById(id)};var titles={overview:'總覽',health:'健康檢查',tasks:'任務與等待列',moderation:'管理提案',simulator:'事件模擬器',models:'模型中心',quota:'額度與限制',groups:'群組設定',memory:'記憶管理',logs:'操作日誌'};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(msg){$('toast').textContent=String(msg||'');$('toast').classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(function(){$('toast').classList.add('hidden')},3200)}
async function raw(path,method,data){var opt={method:method||'GET',headers:{}};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch(path,opt);var j=await r.json().catch(function(){return{ok:false,message:'無法解析伺服器回應'}});if(!r.ok&&!j.message)j.message='HTTP '+r.status;return j}
async function api(path,method,data){var opt={method:method||'GET',headers:{Authorization:'Bearer '+token}};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch('/api/portal'+path,opt);var j=await r.json().catch(function(){return{ok:false,message:'無法解析伺服器回應'}});if(r.status===401){sessionStorage.removeItem('qqai_token');showLogin()}return j}
function statusClass(s){return s==='ok'?'ok':s==='warning'?'warning':s==='error'?'error':''}
function showLogin(){$('login').classList.remove('hidden');$('app').classList.add('hidden')}
function showApp(){$('login').classList.add('hidden');$('app').classList.remove('hidden')}
function showView(name){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',b.dataset.view===name)});$('v-'+name).classList.add('active');$('pageTitle').textContent=titles[name]||name;$('sidebar').classList.remove('open');if(name==='health')loadHealth('quick');if(name==='tasks')loadTasks();if(name==='moderation')loadProposals();if(name==='models')loadModels();if(name==='quota')loadQuota();if(name==='groups')loadGroupSettings();if(name==='memory')loadMemory();if(name==='logs')loadLogs()}
async function loadGroups(){var r=await api('/groups');if(!r.ok){toast(r.message);return false}var sel=$('groupSelect');sel.innerHTML='<option value="">選擇群組</option>';(r.groups||[]).forEach(function(g){var o=document.createElement('option');o.value=g.groupId;o.textContent=(g.groupName||g.groupId)+' ('+g.groupId+')';sel.appendChild(o)});if(r.selectedGroupId){sel.value=r.selectedGroupId;currentGroup=r.selectedGroupId}return true}
async function selectGroup(id){if(!id){currentGroup='';return}var r=await api('/select-group','POST',{groupId:id});if(!r.ok){toast(r.message);return}currentGroup=id;session=r.session;$('identity').innerHTML='<b>'+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(session.role||'member')+'</span>';toast('群組已切換');refreshOverview()}
async function boot(){if(!token){showLogin();return}showApp();var me=await api('/me');if(!me.ok){showLogin();return}session=me.session;$('identity').innerHTML='<b>'+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(session.role||'member')+'</span>';await loadGroups();refreshOverview()}
async function loadHealth(mode){$('healthList').innerHTML='<div class="empty">檢查中…</div>';var r=await api('/health?mode='+encodeURIComponent(mode||'quick'));if(!r.checks){$('healthList').innerHTML='<div class="empty">'+esc(r.message||'檢查失敗')+'</div>';return}renderHealth(r)}
function renderHealth(r){$('healthSummary').innerHTML='<div class="card span-4"><div class="metric-label">正常</div><div class="metric-value">'+esc(r.counts.ok)+'</div></div><div class="card span-4"><div class="metric-label">警告</div><div class="metric-value">'+esc(r.counts.warning)+'</div></div><div class="card span-4"><div class="metric-label">錯誤</div><div class="metric-value">'+esc(r.counts.error)+'</div></div>';$('healthList').innerHTML=(r.checks||[]).map(function(c){var detail=c.error||JSON.stringify(c.detail||'');return '<div class="health-card"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(c.status)+'</span></div><div class="latency">'+esc(c.latencyMs)+' ms</div><div class="detail">'+esc(detail)+'</div></div>'}).join('')||'<div class="empty">沒有檢查項目</div>';var issues=(r.checks||[]).filter(function(c){return c.status!=='ok'});$('overviewIssues').innerHTML=issues.map(function(c){return '<div class="item"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(c.status)+'</span></div><div class="item-meta">'+esc(c.error||JSON.stringify(c.detail||''))+'</div></div>'}).join('')||'<div class="empty">所有檢查項目正常</div>';$('overallStatus').className='status '+(r.ok?'ok':'error');$('overallStatus').textContent=r.ok?'系統正常':'需要處理'}
async function loadTasks(){var r=await api('/tasks');if(!r.ok){$('taskList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('mActive').textContent=r.inFlightQuestions||0;$('mQueued').textContent=r.queuedQuestions||0;$('taskStats').innerHTML='<div class="card span-6"><div class="metric-label">執行中</div><div class="metric-value">'+esc(r.inFlightQuestions||0)+'</div></div><div class="card span-6"><div class="metric-label">等待中</div><div class="metric-value">'+esc(r.queuedQuestions||0)+'</div></div>';$('taskList').innerHTML='';(r.queues||[]).forEach(function(q){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">群 '+esc(q.groupId)+'／QQ '+esc(q.userId)+'</div><div class="item-meta">執行中：'+esc(q.preview||'無')+'<br>排隊：'+esc((q.queued||[]).length)+' 題</div></div></div>';(q.queued||[]).forEach(function(x){var p=document.createElement('div');p.className='item-body';p.textContent='等待：'+x.preview;d.appendChild(p)});var b=document.createElement('button');b.className='btn danger';b.textContent='取消此使用者等待列';b.addEventListener('click',async function(){var x=await api('/tasks/cancel','POST',{groupId:q.groupId,userId:q.userId});toast(x.message||'完成');loadTasks()});d.appendChild(b);$('taskList').appendChild(d)});if(!$('taskList').children.length)$('taskList').innerHTML='<div class="empty">目前沒有執行中或等待中的問題</div>'}
function proposalState(p){if(p.status==='pending'&&Date.now()>Number(p.expiresAt||0))return'expired';return p.status||'pending'}
async function loadProposals(){var r=await api('/moderation/proposals');if(!r.ok){$('proposalList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var pending=(r.proposals||[]).filter(function(p){return proposalState(p)==='pending'});$('mProposals').textContent=pending.length;$('proposalList').innerHTML='';(r.proposals||[]).forEach(function(p){var st=proposalState(p);var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(p.id)+'｜'+esc(p.actionLabel||p.action)+'</div><div class="item-meta">提出者：'+esc(p.actorName||p.actorId)+'｜目標：'+esc(p.targetName||p.targetId||'全群')+'｜狀態：'+esc(st)+'</div></div><span class="status '+(st==='executed'?'ok':st==='pending'?'warning':st==='failed'?'error':'')+'">'+esc(st)+'</span></div><div class="item-body">'+esc(p.sourceText||'')+'</div>';if(st==='pending'){var a=document.createElement('div');a.className='row';a.style.marginTop='10px';var yes=document.createElement('button');yes.className='btn primary';yes.textContent='確認並執行';yes.onclick=async function(){if(!confirm('確定執行 '+p.id+'？'))return;var x=await api('/moderation/confirm','POST',{id:p.id});toast(x.message);loadProposals()};var no=document.createElement('button');no.className='btn danger';no.textContent='取消';no.onclick=async function(){var x=await api('/moderation/cancel','POST',{id:p.id});toast(x.message);loadProposals()};a.append(yes,no);d.appendChild(a)}$('proposalList').appendChild(d)});if(!$('proposalList').children.length)$('proposalList').innerHTML='<div class="empty">尚無管理提案</div>'}
async function loadModels(){var r=await api('/models');if(!r.ok){$('modelList').innerHTML='<div class="empty span-12">'+esc(r.message)+'</div>';return}$('modelList').innerHTML=(r.models||[]).map(function(m){return '<div class="card span-4"><div class="item-head"><div><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">'+esc(m.provider)+'／'+esc(m.family)+(m.billing?'／'+esc(m.billing):'')+'</div></div><span class="status '+statusClass(m.status)+'">'+esc(m.status)+'</span></div><div style="margin-top:10px">'+(m.capabilities||[]).map(function(x){return'<span class="pill">'+esc(x)+'</span>'}).join('')+'</div></div>'}).join('')||'<div class="empty span-12">沒有模型</div>'}
async function loadQuota(){var r=await api('/root/quotas');if(!r.ok){$('quotaStatus').textContent=r.message;$('globalQuota').disabled=true;$('groupQuota').disabled=true;$('saveQuota').disabled=true;return}$('globalQuota').disabled=false;$('groupQuota').disabled=false;$('saveQuota').disabled=false;$('globalQuota').value=r.globalDailyCny||'';$('groupQuota').value=r.groupDailyCny||'';$('quotaStatus').textContent='全站：'+(r.globalDailyCny===''?'無限制':r.globalDailyCny+' CNY／日')+'；目前群：'+(r.groupDailyCny===''?'無限制':r.groupDailyCny+' CNY／日')}
async function loadGroupSettings(){var r=await api('/admin/state');if(!r.ok){toast(r.message);return}$('groupAi').checked=!!r.ai_on;$('groupMemory').checked=!!r.memory_on;$('activeSpeaking').checked=!!r.active_speaking;$('interjectRate').value=r.interject_rate;$('groupPersona').value=r.persona||'';$('groupKeywords').value=(r.keywords||[]).join('\\n')}
async function loadMemory(){var r=await api('/memories');if(!r.ok){$('memoryList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var all=(r.private||[]).map(function(x){x._scope='private';return x}).concat((r.public||[]).map(function(x){x._scope='public';return x}));$('memoryList').innerHTML='';all.forEach(function(m){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(m.text)+'</div><div class="item-meta">'+esc(m._scope)+'｜'+esc(m.at||m.updatedAt||'')+'</div></div></div>';var b=document.createElement('button');b.className='btn danger';b.textContent='刪除';b.onclick=async function(){var x=await api('/memories','DELETE',{scope:m._scope,id:m.id});toast(x.message||'已刪除');loadMemory()};d.appendChild(b);$('memoryList').appendChild(d)});if(!$('memoryList').children.length)$('memoryList').innerHTML='<div class="empty">尚無記憶</div>'}
async function loadLogs(){var r=await api('/admin/state');if(!r.ok){$('logList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('logList').innerHTML=(r.audit_logs||[]).slice().reverse().map(function(a){return '<div class="item"><div class="item-title">'+esc(a.type||a.action||'操作')+'</div><div class="item-meta">'+esc(a.at||'')+'｜'+esc(a.actorId||'')+'</div><div class="item-body">'+esc(a.action||'')+'</div></div>'}).join('')||'<div class="empty">尚無操作日誌</div>'}
async function refreshOverview(){var h=await api('/health?mode=quick');if(h.checks)renderHealth(h);var t=await api('/tasks');if(t.ok){$('mActive').textContent=t.inFlightQuestions||0;$('mQueued').textContent=t.queuedQuestions||0}var p=await api('/moderation/proposals');if(p.ok)$('mProposals').textContent=(p.proposals||[]).filter(function(x){return proposalState(x)==='pending'}).length;var doCheck=(h.checks||[]).find(function(c){return c.name==='Durable Object / NapCat'});var connected=doCheck&&doCheck.status==='ok';$('mNapcat').textContent=connected?'已連線':'未連線';$('mNapcatSub').textContent=doCheck?String(doCheck.latencyMs)+' ms':'尚無資料'}
$('sendCode').onclick=async function(){var r=await raw('/api/auth/request-code','POST',{qq:$('loginQq').value});$('loginNotice').textContent=r.message};$('verifyCode').onclick=async function(){var r=await raw('/api/auth/verify-code','POST',{qq:$('loginQq').value,code:$('loginCode').value});$('loginNotice').textContent=r.message;if(r.ok){token=r.token;sessionStorage.setItem('qqai_token',token);boot()}};
$('logout').onclick=function(){sessionStorage.removeItem('qqai_token');location.reload()};$('menu').onclick=function(){$('sidebar').classList.toggle('open')};$('refresh').onclick=function(){var active=document.querySelector('#nav button.active');showView(active?active.dataset.view:'overview')};$('groupSelect').onchange=function(){selectGroup(this.value)};document.querySelectorAll('#nav button').forEach(function(b){b.onclick=function(){showView(b.dataset.view)}});
$('quickHealth').onclick=function(){loadHealth('quick')};$('fullHealth').onclick=function(){loadHealth('full')};$('reloadTasks').onclick=loadTasks;$('clearQueue').onclick=async function(){if(!currentGroup){toast('請先選擇群組');return}if(!confirm('清空目前群所有等待中的問題？正在生成的問題不會被強制中斷。'))return;var r=await api('/tasks/clear','POST',{groupId:currentGroup});toast(r.message||'完成');loadTasks()};$('reloadProposals').onclick=loadProposals;
$('createProposal').onclick=async function(){var r=await api('/ops/action','POST',{action:$('opAction').value,qq:$('opQq').value,duration:$('opDuration').value});$('opMessage').textContent=r.message;toast(r.message);if(r.ok)loadProposals()};
$('runSimulator').onclick=async function(){var r=await api('/simulator','POST',{text:$('simText').value,senderRole:$('simRole').value,mentionsBot:$('simMention').checked,hasImage:$('simImage').checked,currentlyBusy:$('simBusy').checked});if(!r.ok){toast(r.message);return}$('simDecision').textContent=r.decisions.final;$('simSteps').innerHTML=(r.steps||[]).map(function(x){return'<div class="step"><i></i><span>'+esc(x)+'</span></div>'}).join('')};$('reloadModels').onclick=loadModels;$('saveQuota').onclick=async function(){var r=await api('/root/quotas','POST',{globalDailyCny:$('globalQuota').value,groupDailyCny:$('groupQuota').value});toast(r.message);if(r.ok)loadQuota()};
$('saveGroup').onclick=async function(){var r=await api('/admin/state','POST',{ai_on:$('groupAi').checked,memory_on:$('groupMemory').checked,active_speaking:$('activeSpeaking').checked,interject_rate:$('interjectRate').value,persona:$('groupPersona').value,keywords:$('groupKeywords').value});toast(r.message)};$('reloadMemory').onclick=loadMemory;$('addMemory').onclick=async function(){var r=await api('/memories','POST',{scope:$('memoryScope').value,text:$('memoryText').value});toast(r.message||'已新增');if(r.ok){$('memoryText').value='';loadMemory()}};$('reloadLogs').onclick=loadLogs;
boot();
})();
</script>
</body></html>`;
}

export class OneBotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.activeSocket = null;
    this.connectedAt = null;
    this.lastHeartbeatAt = null;
    this.pending = new Map();
    this.eventTasks = new Set();
    this.toolInFlight = new Map();
    this.toolCounts = new Map();
    this.userInFlight = new Map();
    this.userQueues = new Map();
    this.queueReady = Promise.resolve();
    if (state?.storage && typeof state.blockConcurrencyWhile === "function") {
      this.queueReady = state.blockConcurrencyWhile(async () => {
        const saved = await state.storage.list({ prefix: "userqueue:" });
        for (const [storageKey, value] of saved) {
          const key = String(storageKey).slice("userqueue:".length);
          const queue = Array.isArray(value) ? value.filter(item => Date.now() - Number(item?.enqueuedAt || 0) <= DEFAULTS.userQueueTtlMs) : [];
          if (queue.length) this.userQueues.set(key, queue);
          else await state.storage.delete(storageKey);
        }
      });
    }
  }

  async fetch(request) {
    await this.queueReady;
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      if (this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN) { try { this.activeSocket.close(4001, "replaced by newer NapCat connection"); } catch {} }
      this.activeSocket = server; this.connectedAt = Date.now(); this.lastHeartbeatAt = Date.now();
      server.addEventListener("message", event => {
        // 不把长任务 Promise 直接回传给 WebSocket 事件；让后续 NapCat 事件与 RPC 回包可继续进入。
        const task = this.handleMessage(server, request, event).catch(error => console.error("OneBotHub handler failed", error));
        this.eventTasks.add(task);
        task.finally(() => this.eventTasks.delete(task));
      });
      server.addEventListener("close", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat disconnected"); });
      server.addEventListener("error", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat socket error"); });
      for (const key of this.userQueues.keys()) {
        if (this.userInFlight.has(key)) continue;
        const task = this.drainUserQueue(key).catch(error => console.error("restore queued questions failed", error));
        this.eventTasks.add(task);
        task.finally(() => this.eventTasks.delete(task));
      }
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

    if (url.pathname === "/status") return Response.json({
      sockets: this.activeSocket?.readyState === WebSocket.OPEN ? 1 : 0,
      connected: this.activeSocket?.readyState === WebSocket.OPEN,
      connectedAt: this.connectedAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      pendingRpc: this.pending.size,
      inFlightQuestions: this.userInFlight.size,
      queuedQuestions: [...this.userQueues.values()].reduce((sum, list) => sum + list.length, 0),
      queues: this.queueSnapshot()
    });
    if (request.method === "POST" && url.pathname === "/queue/cancel") {
      const data = await request.json().catch(() => ({}));
      const key = `group:${String(data.groupId || "")}:user:${String(data.userId || "")}`;
      const queue = this.userQueues.get(key) || [];
      const messageId = String(data.messageId || "");
      const next = messageId ? queue.filter(item => String(item.body?.message_id || "") !== messageId) : [];
      if (next.length) this.userQueues.set(key, next); else this.userQueues.delete(key);
      await this.persistUserQueue(key);
      return Response.json({ ok: true, removed: queue.length - next.length, remaining: next.length, message: `已移除 ${queue.length - next.length} 条等待中的问题。` });
    }
    if (request.method === "POST" && url.pathname === "/queue/clear") {
      const data = await request.json().catch(() => ({}));
      const groupId = String(data.groupId || "");
      let removed = 0;
      const clearedKeys = [];
      for (const [key, queue] of this.userQueues) {
        if (!groupId || key.startsWith(`group:${groupId}:`)) { removed += queue.length; this.userQueues.delete(key); clearedKeys.push(key); }
      }
      await Promise.all(clearedKeys.map(key => this.persistUserQueue(key)));
      return Response.json({ ok: true, removed, message: `已清除 ${removed} 条等待中的问题。` });
    }
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

    if (this.shouldQueueUserQuestion(body)) {
      await this.enqueueUserQuestion(body, request.url);
      return;
    }
    await this.processInboundEvent(body, request.url);
  }

  shouldQueueUserQuestion(body) {
    if (!body || body.post_type !== "message" || body.message_type !== "group") return false;
    if (String(body.user_id || "") === String(body.self_id || "")) return false;
    const selfId = String(body.self_id || "");
    let mentioned = false;
    let text = "";
    if (Array.isArray(body.message)) {
      mentioned = body.message.some(part => part?.type === "at" && String(part?.data?.qq || "") === selfId);
      text = body.message.filter(part => part?.type === "text").map(part => part?.data?.text || "").join("").trim();
    } else {
      const raw = String(body.raw_message || body.message || "");
      mentioned = Boolean(selfId && raw.includes(`[CQ:at,qq=${selfId}]`));
      text = raw.replace(/\[CQ:[^\]]+\]/g, " ").trim();
    }
    if (!mentioned || !text || /^[!！]/.test(text)) return false;
    const role = String(body.sender?.role || "member");
    if (["owner", "admin"].includes(role) && /(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|禁言|闭麦|閉麥|全员禁言|全員禁言|管理员|管理員)/i.test(text)) return false;
    if (["owner", "admin"].includes(role) && /^(?:确认|確認|同意执行|同意執行|执行|執行|取消操作|取消执行|取消執行|取消)(?:\s+[a-z0-9_-]+)?$/i.test(text)) return false;
    return true;
  }

  userQueueKey(body) {
    return `group:${String(body.group_id || "")}:user:${String(body.user_id || "")}`;
  }

  queueSnapshot() {
    const rows = [];
    for (const [key, active] of this.userInFlight) {
      const queue = this.userQueues.get(key) || [];
      rows.push({ key, groupId: active.groupId, userId: active.userId, startedAt: active.startedAt, messageId: active.messageId, preview: active.preview, queued: queue.map(item => ({ messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    for (const [key, queue] of this.userQueues) {
      if (this.userInFlight.has(key)) continue;
      const [groupId, userId] = [key.match(/group:([^:]+)/)?.[1] || "", key.match(/user:([^:]+)/)?.[1] || ""];
      rows.push({ key, groupId, userId, startedAt: null, messageId: "", preview: "", queued: queue.map(item => ({ messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    return rows;
  }

  async persistUserQueue(key) {
    if (!this.state?.storage) return;
    const queue = this.userQueues.get(key) || [];
    const storageKey = `userqueue:${key}`;
    if (queue.length) await this.state.storage.put(storageKey, queue);
    else await this.state.storage.delete(storageKey);
  }

  eventPreview(body) {
    return extractMessageText(body?.message || body?.raw_message || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  async enqueueUserQuestion(body, requestUrl) {
    const key = this.userQueueKey(body);
    const queue = this.userQueues.get(key) || [];
    if (this.userInFlight.has(key)) {
      if (queue.length >= DEFAULTS.userQueueMax) {
        await this.sendQueueNotice(body, `等待列已满（最多 ${DEFAULTS.userQueueMax} 条），请等前面的回答完成后再问。`).catch(() => {});
        return;
      }
      const entry = { body, requestUrl, enqueuedAt: Date.now(), preview: this.eventPreview(body) };
      queue.push(entry);
      this.userQueues.set(key, queue);
      await this.persistUserQueue(key);
      await this.sendQueueNotice(body, `你前一个问题仍在处理，这条已加入等待列，目前排第 ${queue.length} 位。`).catch(() => {});
      return;
    }
    this.userInFlight.set(key, { groupId: String(body.group_id || ""), userId: String(body.user_id || ""), messageId: String(body.message_id || ""), preview: this.eventPreview(body), startedAt: Date.now() });
    try {
      await this.processInboundEvent(body, requestUrl);
    } finally {
      this.userInFlight.delete(key);
      await this.drainUserQueue(key);
    }
  }

  async drainUserQueue(key) {
    const queue = this.userQueues.get(key) || [];
    while (queue.length) {
      const entry = queue.shift();
      if (queue.length) this.userQueues.set(key, queue); else this.userQueues.delete(key);
      await this.persistUserQueue(key);
      if (!entry || Date.now() - Number(entry.enqueuedAt || 0) > DEFAULTS.userQueueTtlMs) continue;
      const body = { ...entry.body, __qqai_queued: true };
      this.userInFlight.set(key, { groupId: String(body.group_id || ""), userId: String(body.user_id || ""), messageId: String(body.message_id || ""), preview: entry.preview, startedAt: Date.now() });
      try {
        await this.processInboundEvent(body, entry.requestUrl);
      } catch (error) {
        console.error("queued user question failed", error);
        await this.sendQueueNotice(body, "排队的问题处理失败，已跳到下一条。请稍后重试。").catch(() => {});
      } finally {
        this.userInFlight.delete(key);
      }
    }
  }

  async sendQueueNotice(body, text) {
    const message = [
      ...(body.message_id !== undefined && body.message_id !== null ? [{ type: "reply", data: { id: String(body.message_id) } }] : []),
      { type: "at", data: { qq: String(body.user_id || "") } },
      { type: "text", data: { text: ` ${String(text)}` } }
    ];
    await this.sendAction({ action: "send_group_msg", params: { group_id: body.group_id, message, auto_escape: false } }, 10000);
  }

  async processInboundEvent(body, requestUrl) {
    const toolTask = this.classifyToolTask(body);
    const lease = toolTask ? this.acquireToolLease(body, toolTask) : { ok: true, key: "", token: "", type: "" };
    if (!lease.ok) {
      await this.sendToolBusyNotice(body, toolTask, lease.reason).catch(error => console.error("send tool busy notice failed", error));
      return;
    }

    let payload = null;
    let action = body.message_type === "private" ? "send_private_msg" : "send_group_msg";
    try {
      const sourceUrl = new URL(requestUrl);
      const internalTimeoutMs = toolTask ? 82000 : 65000;
      let internalResponse;
      try {
        internalResponse = await fetch(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-QQAI-Transport": "websocket-do",
            "Authorization": `Bearer ${String(this.env.ONEBOT_ACCESS_TOKEN || "")}`
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(internalTimeoutMs)
        });
      } catch (error) {
        console.error("OneBot internal event processing failed", error);
        const timedOut = /abort|timeout/i.test(String(error?.message || error));
        if (toolTask && timedOut) {
          await this.sendDirectText(body, `⏱️ ${toolTask.label}处理超过时限，任务已自动结束；机器人不会继续被占用。`).catch(() => {});
        } else if (timedOut && this.shouldQueueUserQuestion(body)) {
          await this.sendQueueNotice(body, "这次回答处理超时，任务已释放，请稍后再试。").catch(() => {});
        }
        return;
      }
      if (!internalResponse || internalResponse.status === 204) return;
      payload = await internalResponse.json().catch(() => null);
      if (!payload?.reply) return;
      const plan = payload.reply_plan || {};
      const isPrivate = body.message_type === "private";
      const message = isPrivate ? String(payload.reply) : this.buildSegments(body, plan, payload.reply);
      action = isPrivate ? "send_private_msg" : "send_group_msg";
      const params = isPrivate ? { user_id: body.user_id, message, auto_escape: false } : { group_id: body.group_id, message, auto_escape: false };
      try {
        const response = await this.sendAction({ action, params }, 15000);
        const messageId = response?.data?.message_id;
        // 只有真正的 AI 对话回覆才写入 message cache／recent_logs。
        if (messageId && payload.record_reply === true) {
          await recordStructuredMessage(this.env, {
            messageId: String(messageId), groupId: String(body.group_id || ""), senderId: String(body.self_id || ""), senderName: "QQAI",
            text: extractMessageText(message), mentions: plan.mentionIds || [], replyId: plan.quoteMessageId || plan.replyId || "", media: [],
            source: "ai", createdAt: Date.now()
          });
        }
      } catch (error) {
        console.error("send reply failed", error);
      } finally {
        if (payload.thinking_message_id) {
          try { await this.sendAction({ action: "delete_msg", params: { message_id: numericId(payload.thinking_message_id) } }, 8000); } catch {}
        }
      }
    } finally {
      if (toolTask) this.releaseToolLease(lease);
    }
  }

  classifyToolTask(body) {
    if (!body || !["message", "message_sent"].includes(body.post_type)) return null;
    const text = extractMessageText(body.message || body.raw_message || "")
      .replace(/@\d{5,}\s*/g, "")
      .trim();
    const definitions = [
      { type: "tts", label: "语音生成", limit: 2, pattern: /^[!！](?:语音|語音|speak|tts)(?:\s|$)/i },
      { type: "web", label: "网页分析", limit: 3, pattern: /^[!！](?:读网页|讀網頁)(?:\s|$)/i }
    ];
    return definitions.find(item => item.pattern.test(text)) || null;
  }

  acquireToolLease(body, toolTask) {
    const scope = body.message_type === "group"
      ? `group:${String(body.group_id || "")}`
      : `private:${String(body.user_id || "")}`;
    const key = `${scope}:${toolTask.type}`;
    if (this.toolInFlight.has(key)) return { ok: false, reason: "same_scope", key, type: toolTask.type };
    const count = Number(this.toolCounts.get(toolTask.type) || 0);
    if (count >= toolTask.limit) return { ok: false, reason: "global_limit", key, type: toolTask.type };
    const token = crypto.randomUUID();
    this.toolInFlight.set(key, token);
    this.toolCounts.set(toolTask.type, count + 1);
    return { ok: true, key, token, type: toolTask.type };
  }

  releaseToolLease(lease) {
    if (!lease?.ok || !lease.key) return;
    if (this.toolInFlight.get(lease.key) === lease.token) this.toolInFlight.delete(lease.key);
    const count = Math.max(0, Number(this.toolCounts.get(lease.type) || 0) - 1);
    if (count) this.toolCounts.set(lease.type, count);
    else this.toolCounts.delete(lease.type);
  }

  async sendDirectText(body, text) {
    const isPrivate = body.message_type === "private";
    const action = isPrivate ? "send_private_msg" : "send_group_msg";
    const params = isPrivate
      ? { user_id: body.user_id, message: String(text), auto_escape: false }
      : { group_id: body.group_id, message: String(text), auto_escape: false };
    await this.sendAction({ action, params }, 10000);
  }

  async sendToolBusyNotice(body, toolTask, reason) {
    const text = reason === "same_scope"
      ? `⏳ 本聊天已有一个${toolTask.label}任务正在处理，这次重复指令未加入队列；普通 AI 对话仍可继续使用。`
      : `⏳ 目前${toolTask.label}工作槽已满，请稍后再试；普通 AI 对话不受影响。`;
    await this.sendDirectText(body, text);
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
