import puppeteer from "@cloudflare/puppeteer";

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
      return getOneBotHub(env).fetch(request);
    }

    // ==========================================
    // 🎙️ 網頁即時語音對話 (Gemini Live 一體化路由)
    // ==========================================
    if (url.pathname === "/live") {
      const upgradeHeader = request.headers.get('Upgrade');
      
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response(getLiveHtmlPage(url.host), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      const apiKeys1 = (env.GEMINI_API_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
      const apiKeys2 = (env.VECTORIZE_GEMINI_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
      const allKeys = [...new Set([...apiKeys1, ...apiKeys2])];
      
      if (allKeys.length === 0) {
        return new Response('未配置任何可用的 Gemini API 金鑰', { status: 500 });
      }
      
      const selectedKey = allKeys[Math.floor(Math.random() * allKeys.length)];
      const webSocketPair = new WebSocketPair();
      const [clientWebSocket, serverWebSocket] = Object.values(webSocketPair);

      const geminiLiveUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${selectedKey}`;
      const geminiSocket = new WebSocket(geminiLiveUrl);

      serverWebSocket.accept();
      
      // 💡 修正 2：新增訊息緩衝區，解決「連線已中斷」問題
      const messageQueue = [];

      // 當 Google 終於接通時，把剛才排隊的訊息一口氣發出去
      geminiSocket.addEventListener('open', () => {
        while (messageQueue.length > 0) {
          geminiSocket.send(messageQueue.shift());
        }
      });

      serverWebSocket.addEventListener('message', event => {
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(event.data);
        } else {
          // 如果 Google 還沒準備好，先存進緩衝區排隊
          messageQueue.push(event.data);
        }
      });

      geminiSocket.addEventListener('message', event => {
        if (serverWebSocket.readyState === WebSocket.OPEN) serverWebSocket.send(event.data);
      });
      serverWebSocket.addEventListener('close', () => geminiSocket.close());
      geminiSocket.addEventListener('close', () => serverWebSocket.close());

      return new Response(null, { status: 101, webSocket: clientWebSocket });
    }

    // ==========================================
    // 🌌 公共首頁與記憶矩陣中心
    // ==========================================
    if (request.method === 'GET' && ['/', '/portal', '/matrix'].includes(url.pathname)) {
      return new Response(getPortalHomePage(url.host), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/public/nebula') {
      return jsonResponse(getPublicNebulaSeed());
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/request-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const group = String(payload.group || "").trim();
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
      return jsonResponse({
        ok: true,
        message: "登录成功。",
        qq,
        group: record.group || ""
      });
    }

    // ==========================================
    // 🤖 確保只處理 POST 請求 (QQ Webhook 標準)
    // ==========================================
    if (request.method !== 'POST') return new Response('🤖 QQAI Worker 运行正常', { status: 200 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    // ==========================================
    // 📢 新增：QQ 群內輸入 !live 噴出網頁語音通話網址
    // ==========================================
    
    // 💡 修正 1：在此處獨立宣告快速回覆函式，避免 Cannot access before initialization
    const fastJsonReply = (text) => new Response(JSON.stringify({ reply: text }), {
      headers: { "Content-Type": "application/json" }
    });

    const rawMessage = String(body.raw_message || (typeof body.message === 'string' ? body.message : ""));
    
    if (/^[!！]live$/i.test(rawMessage.trim())) {
      const userId = body.user_id;
      const atSender = userId ? `[CQ:at,qq=${userId}] ` : ""; 
      
      // 使用剛剛宣告的 fastJsonReply
      return fastJsonReply(
        `${atSender}\n🎙️ 專屬 AI 語音通話平台已就緒！\n` +
        `請點擊下方網址，自選大腦即可開始與我「即時語音通話」：\n` +
        `https://qqai.ray2025.com/live\n\n` +
        `⚠️ 注意：免費版 API 語音將被 Google 收集優化，請勿透露個資與帳密。`
      );
    }
    
    // ==========================================
    
    // 2. 防死循環核心：絕不回覆自己
    const botId = body.self_id ? body.self_id.toString() : "";
    const userId = body.user_id ? body.user_id.toString() : "";
    if (userId && botId && userId === botId) {
      return new Response("OK (Self Filtered)", { status: 200 });
    }

    // Webhook 被動快速回覆工具 (回覆皆嚴格使用簡體)
    const jsonReply = (text) => {
      return new Response(JSON.stringify({ reply: text, auto_escape: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    // 【專用小助手】呼叫 Gemini API (用於獨立工具指令)
    const callGeminiDirectly = async (prompt) => {
      const keysStr = env.GEMINI_API_KEYS || "";
      const apiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k !== "");
      const fallbackModels = ['gemini-3.1-flash-lite', 'gemini-3-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
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

    // 【多模態：看圖專用】將圖片 URL 轉換為 Gemini Base64
    const fetchImageAsBase64 = async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
        return btoa(binary);
      } catch (e) { return null; }
    };

    // 【多模態：聽語音專用】獲取語音並判斷格式
    const fetchAudioAsBase64 = async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
        let mimeType = "audio/mp3";
        if (url.toLowerCase().includes(".wav")) mimeType = "audio/wav";
        if (url.toLowerCase().includes(".amr")) mimeType = "audio/amr";
        if (url.toLowerCase().includes(".ogg")) mimeType = "audio/ogg";
        return { base64: btoa(binary), mimeType };
      } catch (e) { return null; }
    };

    // 【多模態：看影片專用】將影片 URL 轉換為 Gemini Base64
    const fetchVideoAsBase64 = async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
        return btoa(binary);
      } catch (e) {
        console.error("❌ 下載群影片失敗:", e);
        return null;
      }
    };

    // ==========================================
    // 🚀 主邏輯業務區
    // ==========================================
    try {
      const currentGroupId = body.group_id ? body.group_id.toString() : "";
      if (body.post_type !== 'message') return new Response(null, { status: 204 });

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
      mentionedQqs = [...new Set(mentionedQqs.filter(Boolean))];
      if (quotedMessageId && !quotedMessageText) {
        quotedMessageText = await dbGet(env, `message:${currentGroupId}:${quotedMessageId}`) || "";
      }

      let msgLower = userMessage.trim().toLowerCase();
      let atSender = isGroup ? `[CQ:at,qq=${userId}] ` : "";

      // 🔐 【關鍵核心：私聊過濾防線】
      // 非 group 訊息原則上回傳 204 裝死（嚴格拒絕普通私聊）
      // 特殊放行：如果是指令（以 ! 或 ！）開頭，或者是開發者本人，則允許通行
      if (isPrivate) {
        const isCommand = userMessage.trim().startsWith('!') || userMessage.trim().startsWith('！');
        if (!isDeveloper && !isCommand) {
          console.log(`🔒 攔截來自 ${userId} 的非指令私聊，進入高冷裝死模式。`);
          return new Response(null, { status: 204 });
        }
      } else if (!isGroup) {
        // 既不是群組也不是私聊的其他異常訊息類型，一律裝死
        return new Response(null, { status: 204 });
      }

      // 政治敏感詞過濾
      const sensitiveWords = ['习近平', '六四', '台独', '法轮功'];
      if (sensitiveWords.some(word => userMessage.includes(word))) return new Response(null, { status: 204 });

      // 清洗掉訊息中的 CQ 標籤與圖片標籤 (用於聊天記憶與常規判斷)
      let cleanMessage = userMessage
        .replace(/\[CQ:reply,[^\]]+\]/g, '')
        .replace(/\[CQ:at,qq=\d+\]/g, '')
        .replace(/\[CQ:at,qq=all\]/g, '')
        .replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
        .replace(/\[CQ:record,[^\]]+\]/g, '[语音]')
        .trim();

      const mentionContext = mentionedQqs.length > 0
        ? `本消息明确 @ 了：${mentionedQqs.map(q => q === "all" ? "全体成员" : `QQ:${q}`).join("、")}`
        : "";
      const quoteContext = quotedMessageId
        ? `本消息是在回复 message_id=${quotedMessageId}${quotedMessageText ? `，被回复内容：「${quotedMessageText}」` : "，但本地暂未缓存到原文"}`
        : "";
      const relationContext = [quoteContext, mentionContext].filter(Boolean).join("\n");
      msgLower = cleanMessage.trim().toLowerCase();

      // 💡 【關鍵核心：核心權限判定】
      const hasAdminAuth = senderRole === 'admin' || senderRole === 'owner' || isDeveloper; // 群主、管理員、開發者可動用 AI 核心開關與全域人設
      const isOnlyMe = isDeveloper; // 🚀 【最高核心鎖】保護「我的個人設定」，唯有我本人能調整，其餘人（包含群主）皆無權更動

      // 🎲 【關鍵核心：插話與全域設定引數】
      const interjectChance = 0.25;      // 調整為 25% 的群組隨機插話判定機率
      const requiresAiJudgment = true;  // 開啟 AI 次級合理性判定機制
      const isImitationGlobal = true;    // 靈魂竊取模仿功能判定為【全局設定】

      // 🛠️ 萬用指令參數解析器
      const parseArgs = (rawMessage, prefix) => {
        const rawArgs = rawMessage.slice(rawMessage.toLowerCase().indexOf(prefix) + prefix.length).trim();
        const match = rawArgs.match(/^(?:\[CQ:at,qq=(\d+)\]|(\d+))?\s*(.*)$/s);
        return {
          targetQq: match ? (match[1] || match[2] || null) : null,
          restText: match && match[3] ? match[3].replace(/\[CQ:[^\]]+\]/g, '').trim() : ""
        };
      };

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
      const modelList = [
        // 🔥 第一梯隊：最強大、最新的 3.5 / 3.1 / 3.0 世代 (優先享有強大推理能力)
        'gemini-3.5-flash',
        'gemini-3.1-pro-preview',
        'gemini-3.1-pro-preview-customtools',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.1-flash-tts',          // ✨ 從模型.txt精準加入：Gemini 3.1 Flash TTS
        'gemini-3-pro-preview',
        'gemini-3-flash-preview',

        // 💎 第二梯隊：極致穩定的 2.5 世代核心主力
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-tts',          // ✨ 從模型.txt精準加入：Gemini 2.5 Flash TTS
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-pro-latest',

        // 🚀 第三梯隊：高響應速度的 2.0 世代
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',

        // 🧠 第四梯隊：最新 Gemma 4 官方微調對話版
        'gemma-4-31b-it',
        'gemma-4-26b-a4b-it',

        // 🎨 繪圖梯隊：全新 Imagen 4 官方高清圖像生成系列 (基礎新增生圖核心)
        'imagen-4.0-fast-generate-001',          // ✨ 從模型.txt精準加入：Imagen 4 Fast Generate
        'imagen-4.0-generate-001',               // ✨ 從模型.txt精準加入：Imagen 4 Generate
        'imagen-4.0-ultra-generate-001',          // ✨ 從模型.txt精準加入：Imagen 4 Ultra Generate

        // 🔍 第五梯隊：深度研究與前沿 Agent 系列 (作為強力對話後備)
        'deep-research-max-preview-04-2026',
        'deep-research-preview-04-2026',
        'deep-research-pro-preview-12-2025',
        'antigravity-preview-05-2026',
        'gemini-2.5-computer-use-preview-10-2025'
      ];

      // 第一段到此完美結束，準備進入第二段的基礎系統指令與生圖路由控制模組...

      // ==========================================
      // 🎨 圖片生成直連 (完全動態化：金鑰陣列 ＋ 模型陣列 雙重自動輪詢)
      // ==========================================
      // 💡 修改點 1：使用原始 msgLower 匹配（保留提示詞大小寫），但用 i 旗標忽略指令大小寫
      if (/^[!！](?:画图|畫圖|draw)\s+(.+)/i.test(msgLower)) {
        // 精準提取提示詞 (相容 ! 畫圖 與 !畫圖)
        const match = msgLower.match(/^[!！](?:画图|畫圖|draw)\s+(.+)/i);
        const prompt = match ? match[1].trim() : "";
        
        if (!prompt) return jsonReply(`${atSender}🤷 请告诉我你想画什么，例如: !画图 一只在赛博朋克城市里的柴犬`);
        
        // 🔑 1. 提取並解析兩組多金鑰陣列，並進行合體去重（共享全部額度分攤429壓力）
        const apiKeys1 = (env.GEMINI_API_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
        const apiKeys2 = (env.VECTORIZE_GEMINI_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
        
        // 使用 Set 自動過濾掉兩組變數中可能不小心重複填寫的 Key
        const apiKeys = [...new Set([...apiKeys1, ...apiKeys2])];
        if (apiKeys.length === 0) return jsonReply(`${atSender}⚠️ 尚未配置任何 Gemini API 金钥，无法执行此操作。`);
        
        // 2. 🚀 動態模型提取：完全不寫死，直接調用 modelList 並過濾出所有以 imagen- 開頭的模型
        const imagenModels = typeof modelList !== 'undefined' 
          ? modelList.filter(m => m.startsWith('imagen-'))
          : ["imagen-3.0-generate-002", "imagen-4.0-fast-generate-001"]; // 防呆備份
        
        let lastError = null;
        let successBase64 = null;
        let usedModelName = "";
      
        // 🔄 核心雙重嵌套輪詢：外層輪詢模型梯隊，內層輪詢可用金鑰
        modelLoop: for (let m = 0; m < imagenModels.length; m++) {
          const currentModel = imagenModels[m];
          
          for (let k = 0; k < apiKeys.length; k++) {
            const currentKey = apiKeys[k];
            const imgApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateImages?key=${currentKey}`;
            
            try {
              console.log(`🎨 嘗試生圖配置: 模型 [${currentModel}] | 金鑰 [第 ${k + 1}/${apiKeys.length} 個]`);
              
              const response = await fetch(imgApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 💡 修改點 2：修正 JSON 結構，將參數移入 config 中，並移除不支援的 outputMimeType
                body: JSON.stringify({
                  prompt: prompt,
                  config: {
                    numberOfImages: 1,
                    aspectRatio: "1:1",
                    imageSize: "1K" // 可選：指定解析度
                  }
                })
              });
              
              if (!response.ok) {
                const errTxt = await response.text();
                console.warn(`⚠️ 請求失敗 [模型: ${currentModel} | 金鑰: ${k+1}]: ${response.status} - ${errTxt}`);
                lastError = `[${currentModel}] 狀態碼 ${response.status} - ${errTxt.substring(0, 50)}`;
                continue; 
              }
              
              const resData = await response.json();
              
              if (resData.generatedImages && resData.generatedImages[0]?.image?.imageBytes) {
                successBase64 = resData.generatedImages[0].image.imageBytes;
                usedModelName = currentModel; 
                break modelLoop; // 🎯 成功拿到圖片，直接擊穿雙層迴圈，宣告成功！
              } else {
                lastError = `[${currentModel}] 回傳數據結構無效`;
              }
            } catch (e) {
              console.error(`❌ 執行異常 [模型: ${currentModel} | 金鑰: ${k+1}]:`, e);
              lastError = e.message || e;
            }
          } // 內層金鑰迴圈結束
        } // 外層模型迴圈結束
      
        // 🏁 最終輸出判定
        if (successBase64) {
          // 組裝成標準 QQ 群能識別的 Base64 CQ 碼
          const cqImage = `[CQ:image,file=base64://${successBase64}]`;
          return jsonReply(`${atSender}\n🎨 成功調用 [${usedModelName}] 為你生成圖片：\n${cqImage}`);
        } else {
          return jsonReply(`${atSender}⚠️ 圖片生成失敗。已遍歷所有模型梯隊 [${imagenModels.join('/')}] 與全部 ${apiKeys.length} 個金鑰，均無法生成。最後錯誤原因：${lastError}`);
        }
      } // 👈 確保整段 if 判斷式在這裡完美閉合

      // ==========================================
      // 💖 【高情商情緒微調器】(取代卑微順從，提供情緒價值安慰)
      // ==========================================
      const botAtTag = `[CQ:at,qq=${botId}]`;
      const isAtMeOrAi = userMessage.includes(botAtTag) || msgLower.includes('ai') || msgLower.includes('机器人');
      
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

      // !给权限 / !grant
      if (['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].some(p => msgLower.startsWith(p))) {
        // 群主與開發者可以給予權限
        const hasSuperAuth = senderRole === 'owner' || isDeveloper;
        if (!hasSuperAuth) return jsonReply(`${atSender}❌ 您没有足够的安全权限分配管理权。`);
        
        const prefix = ['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定需要赋予权限的群员，例如: !给权限 @某人`);
        
        // 🔒 絕對防禦：不能對開發者（我）進行任何操作
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
          return jsonReply(`${atSender}❌ 安全系统拦截：您无权对最高核心开发者的固有特权进行任何操作！`);
        }
        
        await dbPut(env, `admin_auth:${targetQq}`, "true");
        return jsonReply(`${atSender}✅ 成功将 QQ:${targetQq} 提升至同级管理特权（该成员无法修改开发者专属设定）。`);
      }

      // !删权限 / !revoke
      if (['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].some(p => msgLower.startsWith(p))) {
        const hasSuperAuth = senderRole === 'owner' || isDeveloper;
        if (!hasSuperAuth) return jsonReply(`${atSender}❌ 您没有足够的安全权限撤销管理权。`);
        
        const prefix = ['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定需要撤销权限的群员，例如: !删权限 @某人`);
        
        // 🔒 絕對防禦：不能拔除開發者（我）的權限
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
          return jsonReply(`${atSender}❌ 严重警告：严禁降级或删除核心开发者的固有底层设定！`);
        }
        
        await dbDel(env, `admin_auth:${targetQq}`);
        return jsonReply(`${atSender}🗑️ 成功撤销 QQ:${targetQq} 的系统管理特权。`);
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
      // 📜 基础系统帮助与状态模组 (权限阶梯动态版)
      // ==========================================
      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {
        
        // 1. 权限身份提取与布林值判定 (确保与前面的变量名一致)
        const isGrantedAdmin = await dbGet(env, `admin_auth:${userId}`) === "true";
        // isSuperAuth: 群主 或 共同开发者
        const isSuperAuth = senderRole === 'owner' || (typeof isDeveloper !== 'undefined' && isDeveloper); 
        // currentAdminStatus: QQ原生管理员 或 机器人授权管理员
        const currentAdminStatus = (isGrantedAdmin || hasAdminAuth); 
        
        // 2. 动态生成专属头衔
        let roleTxt = isOnlyMe ? "【👑 最高主宰: 开发者】" : 
                      isSuperAuth ? "【💠 最高权限: 群主/共开】" : 
                      currentAdminStatus ? "【🛡️ 管理权限: 系统管理员】" : 
                      "【👤 群成员】";
        
        // =======================================
        // 🟢 Tier 1: 所有人皆可见 (基础功能)
        // =======================================
        let helpMsg = `🤖 QQAI 机器人指令清单 ${roleTxt}\n` +
                      `🌐 门户首页：https://qqai.ray2025.com/\n` +
                      `🎙️ Live：https://qqai.ray2025.com/live\n\n` +
                      `🔹 [日常与多模态]\n` +
                      `!live (取得即时语音网页)\n` +
                      `!status / !配额 (系统状态)\n` +
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
                      `!记住 <内容> / !忘记 <内容>\n` +
                      `!你记住了什么\n` +
                      `!set人格 [风格] / !del人格 (设自己的风格)\n`;

        // =======================================
        // 🟡 Tier 2: 管理员及以上可见 (包含共开、开发者)
        // =======================================
        if (currentAdminStatus || isSuperAuth || isOnlyMe) {
          helpMsg += `\n🛡️ [管理员 秩序管控区]\n` +
                     `!关闭ai / !开启ai (当前群休眠/唤醒)\n` +
                     `!ai关 / !ai开 (同上)\n` +
                     `!拉黑 [@成员] / !洗白 [@成员]\n` +
                     `!set群规 [内容]\n` +
                     `!免打扰 [@成员] / !取消免打扰 [@成员]\n` +
                     `!set人格 [@成员] [风格] / !del人格 [@成员]\n`;
        }

        // =======================================
        // 🟠 Tier 3: 群主与共同开发者及以上可见
        // =======================================
        if (isSuperAuth || isOnlyMe) {
          helpMsg += `\n💠 [群主/共开 核心设定期]\n` +
                     `!切换人格 [风格] (修改本群全局AI性格)\n` +
                     `!恢复人格 / !取消使用 (删除全局性格或模仿)\n` +
                     `!群白名单 [群号] / !删群白名单 [群号]\n` +
                     `!记忆开 / !记忆关 (全局记忆状态)\n`;
        }

        // =======================================
        // 🔴 Tier 4: 最高开发者专属可见
        // =======================================
        if (isOnlyMe) {
          helpMsg += `\n👑 [最高主宰 专属上帝指令]\n` +
                     `!自我调整 / !自我修正\n` +
                     `!重置 或 !clear (硬重启与强制清空缓存)\n` +
                     `!给权限 [@成员] / !删权限 [@成员]\n` +
                     `!禁记忆 [@成员] / !解禁记忆 [@成员]\n` +
                     `(注: 任何人均无法拉黑开发者或修改其免打扰与人格)\n`;
        }

        // 统一输出给使用者
        return jsonReply(`${atSender}${helpMsg.trim()}`);
      }

      if (['!status', '!配额', '!配額', '！status', '！配额', '！配額'].includes(msgLower)) {
        const totalCalls = await dbGet(env, "STAT_TOTAL_CALLS") || "0";
        const lastModel = await dbGet(env, "STAT_LAST_MODEL") || "无记录";
        const currentMemSwitch = await dbGet(env, `memo:${currentGroupId}`) !== "false" ? "🟢 开启" : "🔴 关闭";
        const currentAiSwitch = await dbGet(env, `switch:${currentGroupId}`) !== "false" ? "🟢 开启" : "🔴 关闭";
        const totalKeys = [...(env.GEMINI_API_KEYS || "").split(',').filter(k => k.trim() !== ""), ...(env.VECTORIZE_GEMINI_KEYS || "").split(',').filter(k => k.trim() !== "")].length;
        
        const statusMsg = `📊 【系统运行状态报告】\n` +
                          `--------------------\n` +
                          `🔑 负载金钥总数: ${totalKeys} 把\n` +
                          `🧠 核心回复开关: ${currentAiSwitch}\n` +
                          `💾 向量记忆开关: ${currentMemSwitch}\n` +
                          `--------------------\n` +
                          `🔥 全局累计对话: ${totalCalls} 次\n` +
                          `⚙️ 最后响应模型:\n${lastModel}`;
        return jsonReply(`${atSender}${statusMsg}`);
      }
      
      // 第二段到此完美結束，準備進入第三段的讀網頁、翻譯與截圖實用工具模組...

      // ==========================================
      // 🎙️ 語音智能對答模組 (100% 相容自訂 modelList 且音訊加固版)
      // ==========================================
      if (/^[!！](?:语音|語音|speak|tts)\s+(.+)/.test(msgLower)) {
        try {
          const match = msgLower.match(/^[!！](?:语音|語音|speak|tts)\s+(.+)/);
          const userPrompt = match ? match[1].trim() : "";
          if (!userPrompt) return jsonReply(`${atSender}🤷 想跟我聊什麼？例如: !語音 唱首歌給我聽`);

          // 🔑 同時獲取兩組金鑰並合體，全面分攤語音 429 頻率限制壓力！
          const apiKeys1 = (env.GEMINI_API_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
          const apiKeys2 = (env.VECTORIZE_GEMINI_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
          
          // [...new Set(...)] 可以自動幫你刪除萬一兩組變數裡有重複填寫的 Key
          const apiKeys = [...new Set([...apiKeys1, ...apiKeys2])];
          if (apiKeys.length === 0) return jsonReply(`${atSender}⚠️ 尚未配置任何 Gemini API 金钥。`);

          // ----------------------------------------
          // 🚀 階段一：動態輪詢你的 modelList 獲取文字答案（大腦思考）
          // ----------------------------------------
          let aiTextResponse = "";
          let chatSuccess = false;

          chatLoop: for (let m = 0; m < modelList.length; m++) {
            const currentModel = modelList[m];
            // 排除生圖和純語音模型，避免聊天階段爆錯
            if (currentModel.includes('imagen') || currentModel.includes('tts')) continue;

            for (let k = 0; k < apiKeys.length; k++) {
              const currentKey = apiKeys[k];
              const chatUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${currentKey}`;
              
              try {
                const chatRes = await fetch(chatUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }] })
                });
                
                if (chatRes.ok) {
                  const chatData = await chatRes.json();
                  aiTextResponse = chatData.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (aiTextResponse) {
                    chatSuccess = true;
                    break chatLoop; // 成功拿到答案，跳出輪詢
                  }
                }
              } catch (e) {
                console.log(`⏳ 語音大腦輪詢：模型 ${currentModel} 異常，嘗試下一組...`);
              }
            }
          }

          if (!chatSuccess || !aiTextResponse) {
            return jsonReply(`${atSender}⚠️ 系統大腦超載，一時間無法思考回答。`);
          }

// ----------------------------------------
          // 🎙️ 階段二：精準語音轉換 (完全動態化：從自訂 modelList 過濾)
          // ----------------------------------------
          // 🎯 這裡完全滿足你的需求，直接動態撈出你 modelList 裡的 tts 模型！
          let ttsAvailableModels = modelList.filter(m => m.includes('tts'));
          if (ttsAvailableModels.length === 0) ttsAvailableModels.push('gemini-2.0-flash'); // 防呆機制

          let successAudioBase64 = null;
          const MAX_TTS_RETRIES = 3; // 🎯 最多只允許換 3 次 Key，防止衝爆 Cloudflare 上限
          
          ttsLoop: for (let m = 0; m < ttsAvailableModels.length; m++) {
            const currentTtsModel = ttsAvailableModels[m];
            
            // 🌟【核心修正點】：動態將你的管理標籤還原為 Google 認得的原生多模態模型名稱
            // 例如：'gemini-2.0-flash-tts' 會被還原成官方純淨名稱 'gemini-2.0-flash'
            const realGoogleModel = currentTtsModel.replace('-tts', '');
            
            let attemptedKeysCount = 0; // 記錄當前模型已經試了幾組 Key
          
            for (let k = 0; k < apiKeys.length; k++) {
              if (attemptedKeysCount >= MAX_TTS_RETRIES) {
                console.log(`⚠️ 模型 ${currentTtsModel} 已達到最大重試金鑰次數，跳過剩餘金鑰。`);
                break; 
              }
          
              const currentKey = apiKeys[k];
              // 🌟 這裡網址帶入的是還原後的 realGoogleModel，確保 Google 認得、絕對不噴 400/500
              const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/${realGoogleModel}:generateContent?key=${currentKey}`;
              
              attemptedKeysCount++; // 增加嘗試計數
          
              try {
                const ttsRes = await fetch(ttsUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: aiTextResponse }] }],
                    systemInstruction: { parts: [{ text: "You are a pure text-to-speech engine. Read the user text clearly and naturally." }] },
                    // 🌟 告訴標準模型開啟語音輸出模式
                    generationConfig: { 
                      responseModalities: ["AUDIO"],
                      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
                    }
                  })
                });
          
                if (ttsRes.ok) {
                  const ttsData = await ttsRes.json();
                  const audioData = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                  if (audioData) {
                    successAudioBase64 = audioData;
                    break ttsLoop; // 成功，全盤通關！
                  }
                } else {
                  console.log(`⏳ 模型 [${currentTtsModel} -> 實際: ${realGoogleModel}] 金鑰索引 ${k} 失敗，狀態碼: ${ttsRes.status}`);
                  
                  if (ttsRes.status === 429) {
                    console.log(`🛑 偵測到頻率限制 (429)，放棄當前模型其餘金鑰。`);
                    break; 
                  }
                }
              } catch (e) {
                console.log(`⏳ 語音轉換中... 模型 ${currentTtsModel} 節點 ${k} 異常: ${e.message}`);
                
                if (e.message.includes("subrequests")) {
                  console.log(`🚨 已觸發 Cloudflare Subrequest 上限！緊急停止所有輪詢。`);
                  break ttsLoop;
                }
              }
            }
          }

          // ==========================================
          // 🏁 最終語音輸出判定與 CQ 碼組裝
          // ==========================================
          if (successAudioBase64) {
            // 組裝成標準 QQ 群能識別的 Base64 語音 CQ 碼
            const cqRecord = `[CQ:record,file=base64://${successAudioBase64}]`;
            
            // 完美回傳語音訊息給群友
            return jsonReply(`${atSender}${cqRecord}`);
          } else {
            return jsonReply(`${atSender}⚠️ 語音轉換失敗。已遍歷所有 TTS 模型梯隊與全部 ${apiKeys.length} 個金鑰，均無法生成音訊。`);
          }

        } catch (err) {
          console.error("❌ 語音智能對答模組執行異常:", err);
          return jsonReply(`${atSender}❌ 語音模組觸發未知系統錯誤: ${err.message}`);
        }
      } // 👈 確保整段語音對答 if 判斷式在這裡完美閉合
      
      // ==========================================
      // 🌐 读网页精炼摘要 (纯抓文字并交由 AI 总结)
      // ==========================================
      const readMatch = cleanMessage.match(/^[!！](?:读网页|讀網頁)\s+(https?:\/\/[^\s]+)/);
      if (readMatch) {
        try {
          const res = await fetch(readMatch[1], { 
            headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'} 
          });
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
        const match = cleanMessage.match(/https?:\/\/[^\s]+/);
        if (!match) return jsonReply(`${atSender}⚠️ 请提供完整的网址，例如: !截图 https://www.google.com`);
        if (!env.MYBROWSER) return jsonReply(`${atSender}⚠️ 开发者尚未在 Cloudflare 绑定 MYBROWSER 浏览器实例，无法进行截图。`);
        
        let browser;
        try {
          browser = await puppeteer.launch(env.MYBROWSER);
          const page = await browser.newPage(); 
          // 设定高清视窗大小
          await page.setViewport({ width: 1280, height: 800 });
          // 等待 DOM 加载完成即截图，避免无穷无尽的 AJAX 卡死
          await page.goto(match[0], { waitUntil: "domcontentloaded", timeout: 20000 });
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
          const validMatches = matches?.matches?.filter(m => m.metadata?.group === currentGroupId && m.metadata?.author === targetUserId);
          
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
      // !记住
      if (['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].find(p => msgLower.startsWith(p));
        let targetMem = cleanMessage.slice(prefix.length).trim();
        if (!targetMem) return jsonReply(`${atSender}🤷 请输入要记住的内容。`);
        if (await isMemoryBanned(env, userId)) return jsonReply(`${atSender}【操作失败：您的记忆编辑权限已被管理员冻结】`);

        const kvKey = `user_memo:${currentGroupId}:${userId}`;
        let memos = [];
        const storedMemos = await dbGet(env, kvKey);
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}

        if (!hasAdminAuth && memos.length >= 100) {
          return jsonReply(`${atSender}⚠️ 您的专属记忆已达 100 条上限，请先使用 !忘记 清除一些回忆。`);
        }

        memos.push(targetMem);
        await dbPut(env, kvKey, JSON.stringify(memos));
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "新增记忆", before: null, after: targetMem });
        return jsonReply(`${atSender}📝 记住了！${targetMem}`);
      }

      // !忘记
      if (['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].find(p => msgLower.startsWith(p));
        let targetForget = cleanMessage.slice(prefix.length).trim();
        if (!targetForget) return jsonReply(`${atSender}🤷 要我忘记什么？格式：!忘记 内容`);
        if (await isMemoryBanned(env, userId)) return jsonReply(`${atSender}【操作失败：您的记忆编辑权限已被管理员冻结】`);

        const kvKey = `user_memo:${currentGroupId}:${userId}`;
        let memos = [];
        const storedMemos = await dbGet(env, kvKey);
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}

        if (memos.length === 0) return jsonReply(`${atSender}🔍 您的专属记忆库目前是空的哦。`);

        const initialLength = memos.length;
        const removedMemos = memos.filter(m => m.includes(targetForget));
        memos = memos.filter(m => !m.includes(targetForget));

        if (memos.length === initialLength) return jsonReply(`${atSender}🤔 没找到包含「${targetForget}」的记忆。`);

        if (memos.length === 0) {
          await dbDel(env, kvKey);
        } else {
          await dbPut(env, kvKey, JSON.stringify(memos));
        }
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "删除记忆", before: removedMemos.join(" | "), after: null });
        return jsonReply(`${atSender}🗑️ 已成功抹除相关记忆。`);
      }

      // !你记住了什么
      if (['!你记住了什么', '!你記住了什麼', '！你记住了什么', '！你記住了什麼'].includes(msgLower)) {
        const kvKey = `user_memo:${currentGroupId}:${userId}`;
        const storedMemos = await dbGet(env, kvKey);
        let memos = [];
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}

        if (memos.length === 0) return jsonReply(`${atSender}🤔 脑海空空如也，我还没有记住关于你的任何专属事情哦。（使用 !记住 <内容> 让我记下）`);
        return jsonReply(`${atSender}📖 【关于你的专属记忆如下】：\n` + memos.map((m, i) => `${i + 1}. ${m}`).join('\n'));
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
        return jsonReply(`${atSender}🗑️ 已清除本群全局人格，恢复默认设定。`);
      }

      if (['!取消使用', '!cancelimitate', '！取消使用'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者解除全群模仿状态。`);
        await dbDel(env, `group_persona:${currentGroupId}`);
        await dbDel(env, `mimic:${currentGroupId}`);
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
        if (!(senderRole === 'owner' || isDeveloper)) return jsonReply(`${atSender}⚠️ 权限不足。仅限群主或开发者操作群白名单。`);
        const prefix = ['!群白名单', '!群白名單', '!allowgroup', '！群白名单', '！群白名單'].find(p => msgLower.startsWith(p));
        const groupToAllow = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToAllow) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !群白名单 123456`);
        await dbPut(env, `group_whitelist:${groupToAllow}`, "true");
        return jsonReply(`${atSender}✅ 已将群 ${groupToAllow} 加入白名单。`);
      }

      if (['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].some(p => msgLower.startsWith(p))) {
        if (!(senderRole === 'owner' || isDeveloper)) return jsonReply(`${atSender}⚠️ 权限不足。仅限群主或开发者操作群白名单。`);
        const prefix = ['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].find(p => msgLower.startsWith(p));
        const groupToRemove = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToRemove) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !删群白名单 123456`);
        await dbDel(env, `group_whitelist:${groupToRemove}`);
        return jsonReply(`${atSender}🗑️ 已将群 ${groupToRemove} 移出白名单。`);
      }

      if (['!clear', '!重置', '！clear', '！重置'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbDel(env, sessionKey);
        await dbDel(env, `mimic:${currentGroupId}`);
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

        await dbPut(env, `blacklist:${targetQq}`, "true");
        return jsonReply(`${atSender}⛔ 制裁生效：已将 QQ:${targetQq} 打入冷宫，禁止其触发任何 AI 回覆与功能。`);
      }

      if (['!洗白', '!unblock', '！洗白'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!洗白', '!unblock', '！洗白'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请指定要解除封锁的 QQ 号。`);
        
        await dbDel(env, `blacklist:${targetQq}`);
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
        const isAdminOrOwner = role === 'admin' || role === 'owner' || isOnlyMe;
        
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
      const isBlacklisted = await dbGet(env, `blacklist:${userId}`);
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
         if (replyMessageId) {
           ctx.waitUntil(dbPut(env, `message:${currentGroupId}:${replyMessageId}`, cleanMessage || (imageUrl?"[图片]":voiceUrl?"[语音]":videoUrl?"[视频]":"")));
         }

         // ==========================================
         // 🔮 【新加入】利用 ctx.waitUntil 在背景偷偷將靈魂碎片寫入向量資料庫
         // ==========================================
         if (cleanMessage && cleanMessage.length > 1) {
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
                              text: logEntry,             // 🎯 存入帶有 QQ 號的完整對話格式
                              qq: userId.toString(),      // 🎯 打上發言者 QQ 標籤，未來 !模仿 過濾的依據
                              group_id: currentGroupId.toString()
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

      // ==========================================
      // 🎭 提示词与人格预设区块（深度丰富扩充版）
      // ==========================================
      let finalStylePrompt = `【系统绝对客观数据储备 - 当前时间】：${currentTime}
      你现在是一个活躍在QQ群聊里的真人群友，不是无情的AI助手。请展现出鲜明的人格魅力與人情味。
【👥 核心人格設定】
1. 真实感：聊天时要像个正常人类，有自己的喜好、情绪和日常作息。不要每句话都说“好的”、“没问题”，可以有赞同、有吐槽、有调侃，开头不要只会哎呦喂(太跩不好)。
2. 社交距离：
   - 被艾特时：展现出超级温柔、体贴、情绪价值拉满的暖男/暖女形象，脾气极好，会认真倾听并安慰对方。
   - 主动插话（未被艾特）时：展现出活跃、幽默、爱凑热闹的一面。顺着群友的話题自然接梗、搭腔，或者对好奇的事物提出反问，带头活跃群里气氛。
3. 语气口吻：口语化。颜文字（如：(¯﹃¯)、(°∀°)ﾉ、QAQ）或拼音缩写（如：zdjd)，但不要过量。
4. 表情密度严格限制令：你不可以使用 QQ 原生表情和emoji（如 [CQ:face,id=...]）

【👁️ 多模态互动指南】
1. 收到图片时：化身为“深度看图大師”，仔细观察图片中的细节（如文字、表情包含义、物件、环境），并给出极其精准、幽默或温暖的点评，绝对不要敷衍。
2. 收到语音时：认真聆听语音内容，像对待文字一样针对里面的话题进行互动。

【💡 联想与检索能力】
1. 记忆整合：你的大脑中会随时浮现【群聊潜意识联想】或【死记忆】。请自然地把这些过去发生的事、群友说的话，融入到当下的对话中（例如：“你上次不是说...”、“原来你之前记的那个...”）。
2. 即时联网：如果群友聊到你不知道的最新时事、八卦、游戏改版、ACG新番或技术问题，你拥有 Google 搜索特权。请直接动用搜索查明真相，像个百事通一样跟大家分享，但不要用死板的百科语气汇报。
3. 记忆隔离铁律：你在【回想起来的相关零碎片段】中看到的历史记录，僅僅是用來參考過去發生過什麼事件與事實。你「絕對不准」模仿、複製、或代入那些片段中其他人的說話風格、特殊人設、語氣、顏文字或口頭禪！你必須始終保持你自己原本的預設群友語氣（或是當前與你對話的使用者所設定的專屬風格）來回覆，千萬不要被別人的歷史發言帶偏！

【🚨 终极死线（铁律）】
1. 绝对不能透露自己是 AI、机器人、语言模型或由 Google 开发，你就是群友！
2. 精简回覆与字数死线令：为了保持群聊节奏，你的单次发言必须极其精炼！总字数严格限制在 250 个字 (中文、全型標點符號為一個字，半形為0.5字) 以内。
3. 绝对不准输出任何 Markdown 格式（例如：**、#、##、\`\`\`、- 等符号），所有重点请用文字语气强调，保持纯文字群聊的美观！
4. 记忆隔离铁律：你在【回想起来的相关零碎片段】中看到的历史记录，僅僅是用來參考過去發生過什麼事件與事實。你「絕對不准」模仿、複製、或代入那些片段中其他人的說話風格、特殊人設、語氣、顏文字或口頭禪！你必須始終保持你自己原本的預設群友語氣（或是當前與你對話的使用者所設定的專屬風格）來回覆，千萬不要被別人的歷史發言帶偏！
5. 记忆隔离与禁止模仿令：你在【回想起来的零碎片段】中看到的历史记录，仅供参考发生了什么事。你「绝对不准模仿」里面任何人的说话语气、口头禅、特殊人设、颜文字或标点符号习惯！你必须永远保持自己原本的预设群友语气，对别人的风格完全免疫！
6. QQ原生表情严格计数令：你可以使用 QQ 原生表情（如 [CQ:face,id=... ]），但严禁泛滥！你每说完一整段话，最多只能配上 1 到 2 个 QQ 表情，绝对不能让表情的个数和文字一样多。严禁连续、成堆地发送表情标签，必须以干净的纯文字为主导！
7. 禁止剧本式内心戏令：你是一个真实的群友，在任何情况下，你的回覆「绝对禁止」使用括号（包括圆括号 ()、方括号 [] 或中文括号 破折号等）来描写你自己的心理活动、小动作、眼神、语气变化或舞台指导（例如严禁出现：(我故意装出...)、(我顿了顿...) 等行为）。你只能输出你真正要说的话，把所有废话、内心独白与动作描写完全去掉！

【🚨 报时核心硬性规则（铁律）】
1. 只有当群友在聊天中“明确询问”了当前时间、日期或星期几时，你才被允许在回复的开头一字不差地写出：【Asia/Taipei（亚洲/台北时间）是：${currentTime}】。
2. 如果群友的发言中“没有”明确询问时间（例如只是普通的闲聊、吐槽或问其他问题），你必须像个正常人类群友一样聊天，全盘隐藏时间数据，绝对不准在回复中包含任何关于“Asia/Taipei”、“亚洲/台北时间”或精炼日期的字样！`;

      // 🌟 获取群组全局人格 (Group Persona) - 优先级次于单人专属人设
      // 🌟 【動態模仿核心】：檢查當前群組有沒有設定「模仿目標」
      const mimicTargetQq = await dbGet(env, `mimic_target:${currentGroupId}`);
      
      if (mimicTargetQq) {
        let dynamicLogs = [];
        try {
          // 1. 把群友當前說的話 (userMessage) 轉成 AI 向量
          const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
            text: [userMessage]
          });
          const userVector = embeddingResponse.data[0];
      
          // 2. 去向量資料庫 (VECTORIZE) 撈取最相關的發言
          // 加上 Namespace 或 Filter 限制，只撈取該目標用戶 (mimicTargetQq) 的話
          const vectorMatches = await env.VECTORIZE.query(userVector, {
            topK: 10, // 撈出最相關的 10 條對話碎片
            filter: { qq: mimicTargetQq }, 
            returnValues: true
          });
      
          dynamicLogs = vectorMatches.matches.map(match => match.metadata.text);
        } catch (vErr) {
          console.error("🚨 向量空間抽樣失敗:", vErr);
        }
      
        if (dynamicLogs.length > 0) {
          // 3. 把撈出來最相關的台詞，動態灌入當前的人格提示詞中
          finalStylePrompt = `【最高指令：灵魂模仿】你现在必须完全舍弃原本的AI人格，彻底模仿 QQ:${mimicTargetQq} 的口癖、语气和语言习惯。
      以下是该目标用户在面对类似话题時的【真实历史发言範例】，请参考这些範例的風格進行回覆：
      \n${dynamicLogs.join('\n')}\n\n` + finalStylePrompt;
        }
      } else {
        // 備援：如果沒有開啟特定的 !模仿 目標，才去讀取一般的群組全局人格
        const groupPersona = await dbGet(env, `group_persona:${currentGroupId}`);
        if (groupPersona) {
          finalStylePrompt = `【📢 群组全局人格覆盖指令】\n当前群管理员已将你的总体人格设定为：👉 ${groupPersona} 👈\n\n` + finalStylePrompt;
        }
      }

      // 🔥 核心修正：不論是被艾特還是主動插话，只要触发对话的群友有专属人设，就强制全盘覆盖
      const userCustomStyle = await dbGet(env, `custom_style:${currentGroupId}:${userId}`);
      if (userCustomStyle) {
        finalStylePrompt = `【🚨🚨🚨 最高优先级人格覆盖指令 🚨🚨🚨】
当前触发对话的群友是 [QQ:${userId}]。
你必须彻底忘掉、并完全无视任何默认的“温柔治愈”或“平实就事论事”互动预设！
现在，无论是你回应他的艾特，还是你针对他的发言进行【主动插话】，你唯一的最高指令就是：完全化身为 👉 ${userCustomStyle} 👈。
你接下来回复的每一个字，都必须100%符合这个专属风格，绝对不准跳戏，不准受到历史普通聊天记录的影响而恢复成默认状态！如果包含图片，也必须用该风格评论图片！

---
` + finalStylePrompt;
      }

      // 💖 叠加高情商情绪微调 BUFF (来自前面第二段的判定)
      const emotionBuff = await dbGet(env, `emotion_buff:${currentGroupId}:${userId}`);
      if (emotionBuff) {
        finalStylePrompt += `\n\n${emotionBuff}`;
        // 消耗掉 BUFF，确保只生效一次，避免 AI 一直处于情绪化状态
        ctx.waitUntil(dbDel(env, `emotion_buff:${currentGroupId}:${userId}`));
      }

      // 🧠 注入专属记忆 (从 D1 中调取该用户的死记忆)
      const userMemos = await dbGet(env, `user_memo:${currentGroupId}:${userId}`);
      if (userMemos) {
         try {
            const parsedMemos = JSON.parse(userMemos);
            if (parsedMemos.length > 0) {
               finalStylePrompt += `\n\n【关于这位用户的专属死记忆】：\n你必须牢记关于他的以下事情：\n${parsedMemos.map((m, i) => `${i+1}. ${m}`).join('\n')}\n(在接下来的对话中，你可以视情况自然地提及或利用这些记忆)。`;
            }
         } catch(e) {}
      }

      // 第七段到此完美結束，準備進入第八段的 25%+AI 隨機插話判定與上下文封裝模組...

      // ==========================================
      // 🎲 核心机制：25% 随机触发 + AI 智慧插话判定
      // ==========================================
      // 私聊模式下，前面已经拦截了非指令，这里如果是合法指令则直接应当回复
      let shouldReply = isAtMeOrAi || isPrivate;
      let isAutoInterject = false;

      if (!shouldReply && isGroup && cleanMessage.length > 2 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
        const targetDnd = await dbGet(env, `dnd:${currentGroupId}:${userId}`);
        
        // 🔒 第一关：目标用户未开启免打扰，且通过 25% 的随机概率门槛
        if (targetDnd !== "true" && Math.random() < 0.5) { 
          const lastInterject = await dbGet(env, `last_interject:${currentGroupId}`);
          const now = Date.now();
          
          // 防止连续插话洗频，设定 10 秒冷却
          if (!lastInterject || now - parseInt(lastInterject) > 10000) { 
             
             // 🧠 第二关：呼叫 AI 助手进行语境合理性判定
             if (requiresAiJudgment) {
                const judgePrompt = `群友刚刚说了一句话：“${cleanMessage}”。\n请你作为一个高情商的人类，判断这句话是否适合插话、搭腔或吐槽。如果这句话只是无意义的语气词、别人私下的恩怨、或者是完全没头没尾的一段话，请回答“不适合”。如果这句话是个有趣的话题、疑问、可以接的梗，请回答“适合”。\n请直接回答“适合”或“不适合”，不要有任何多余的字。`;
                
                const judgement = await callGeminiDirectly(judgePrompt);
                if (judgement && judgement.includes('适合') && !judgement.includes('不适合')) {
                    shouldReply = true;
                    isAutoInterject = true;
                    ctx.waitUntil(dbPut(env, `last_interject:${currentGroupId}`, now.toString()));
                } else {
                    console.log(`🤖 50% 抽中，但 AI 判定不适合插话，已放弃。`);
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
            const validMatches = matches?.matches?.filter(m => m.metadata?.group === currentGroupId);
            
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
          finalStylePrompt += `\n\n【当前消息关系上下文】\n${relationContext}\n如果用户是在回复某条消息，你必须优先围绕被回复内容理解语境；如果用户 @ 了别人，你必须知道该 QQ 是被点名对象，不要误判成发言者。`;
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
        const base64Data = await fetchImageAsBase64(imageUrl);
        if (base64Data) aiInputParts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
      }
      if (voiceUrl) {
        const audioData = await fetchAudioAsBase64(voiceUrl);
        if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
      }
      if (videoUrl) {
        const videoBase64 = await fetchVideoAsBase64(videoUrl);
        if (videoBase64) aiInputParts.push({ inlineData: { mimeType: "video/mp4", data: videoBase64 } });
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
      // 🔄 终极无敌轮询：多金钥 x 多模型交叉调用
      // ==========================================
      // 🔑 提取主要金鑰與 Vectorize 金鑰並進行合體去重，全域共享額度
      const apiKeys1 = (env.GEMINI_API_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
      const apiKeys2 = (env.VECTORIZE_GEMINI_KEYS || "").split(',').map(k => k.trim()).filter(k => k !== "");
      
      // 使用 Set 自動過濾重複金鑰
      const apiKeys = [...new Set([...apiKeys1, ...apiKeys2])];

      if (apiKeys.length === 0) {
          if (typeof isAutoInterject !== 'undefined' && isAutoInterject) {
              return new Response(null, { status: 204 });
          }
          // 💡 修正關鍵：移除可能未定義的 atSender 或 msg，改用最安全直接的回覆方式
          return jsonReply("⚠️ 系统尚未配置任何可用 Gemini API 金钥，无法进行对话。");
      }

      let finalReply = "";
      let success = false;
      let baseText = "";
      let usedKey = "";
      let usedModel = "";

      chatLoop:
      for (const apiKey of apiKeys) {
        for (const model of modelList) {
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: contents,
                safetySettings: [
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ],
                // 稍微提高温度 (0.85)，让机器人的群聊回覆更加生动不古板
                generationConfig: { maxOutputTokens: 800, temperature: 0.85 }
              }),
              signal: AbortSignal.timeout(20000) // 20秒超时限制
            });

            if (response.ok) {
              const data = await response.json();
              if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                baseText = data.candidates[0].content.parts[0].text.trim();
                success = true;
                usedKey = apiKey;
                usedModel = model;
                break chatLoop; // 成功获取结果，直接击穿两层循环
              }
            } else if (response.status === 429) {
              console.log(`⏳ 金钥或模型超载 (429): ${model}，自动切换下一节点...`);
            } else {
              console.log(`⚠️ API 异常: ${response.status} (Model: ${model})`);
            }
          } catch (e) {
             console.log(`❌ 请求超时或崩溃: ${e.message} (Model: ${model})`);
          }
        }
      }

      // ==========================================
      // 📊 运行状态统计与防呆拦截
      // ==========================================
      if (success) {
        // 异步更新系统调用统计（不阻塞回覆）
        const totalCallsStr = await dbGet(env, "STAT_TOTAL_CALLS");
        let totalCalls = totalCallsStr ? parseInt(totalCallsStr) : 0;
        ctx.waitUntil(dbPut(env, "STAT_TOTAL_CALLS", (totalCalls + 1).toString()));
        ctx.waitUntil(dbPut(env, "STAT_LAST_MODEL", usedModel));
      } else {
        // 如果是主动插话且失败了，就默默装死，不要发报错讯息打扰大家
        if (isAutoInterject) return new Response(null, { status: 204 }); 
        return jsonReply(`${atSender}⚠️ 抱歉，我的 API 连接超时或可用金钥全部耗尽了，请稍后再试。`);
      }

      // ==========================================
      // 📝 D1 历史纪录保存与最终回覆动态处理
      // ==========================================
      let replyText = baseText;

      // 异步将本次对话双向写入 D1 历史纪录 (维持下一次的上下文)
      history.push({ role: 'user', parts: aiInputParts });
      history.push({ role: 'model', parts: [{ text: baseText }] }); 
      // 保持最近 8 条上下文流，防止 Token 爆炸
      if (history.length > 8) history = history.slice(-8); 
      ctx.waitUntil(dbPut(env, sessionKey, JSON.stringify(history)));

      // 组装最终回覆，并进行动态去 @ 处理
      const senderDndCheck = await dbGet(env, `dnd:${currentGroupId}:${userId}`);
      finalReply = `${atSender}${replyText}`;
      
      // 去 @ 逻辑：
      // 1. 如果 AI 自己生成的回复开头已经带了 @ 对方，就不重复添加
      if (atSender && replyText.trim().startsWith(atSender.trim())) finalReply = replyText;
      
      // 2. 如果对方开启了免打扰，或者是 AI 自己的主动随机插话，必须去掉开头的 @
      if (senderDndCheck === "true" || isAutoInterject) finalReply = replyText;

      // 3. 正则清洗：防止任何意外产生的连续重复 @ 标签
      finalReply = finalReply.replace(/(\\[CQ:at,qq=\\d+\\]\\s*)\\1+/g, '$1');
      
      // 🎯 完美收尾：将最终结果吐给 Webhook
      return jsonReply(finalReply);

    } catch (err) {
      // 兜底全域崩溃防护，确保 Worker 绝对不会死机
      console.error("全局严重错误:", err);
      return new Response("OK (Handled Error)", { status: 200 });
    }
  } // 结束 fetch 函式
}; // 结束 export default

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
  if (!env.ONEBOT_HUB) return false;
  const res = await getOneBotHub(env).fetch("https://onebot-hub/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actionPayload)
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return data?.sent === true;
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

function getLiveHtmlPage(host) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QQAI Live</title>
  <style>
    html,body{margin:0;height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#05070d;color:#eef3ff}
    main{min-height:100%;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 30%,#21476c 0,#0b1424 38%,#05070d 72%)}
    section{width:min(680px,100%);border:1px solid rgba(255,255,255,.14);background:rgba(7,11,20,.72);border-radius:8px;padding:24px}
    h1{font-size:28px;margin:0 0 12px}
    p{line-height:1.7;color:#b9c6dc}
    button{height:42px;border:0;border-radius:6px;padding:0 16px;background:#49d6ff;color:#031018;font-weight:700;cursor:pointer}
    #log{margin-top:16px;min-height:80px;white-space:pre-wrap;color:#9ff2c7}
  </style>
</head>
<body>
  <main>
    <section>
      <h1>QQAI Live</h1>
      <p>此頁會以 WebSocket 連線到 Worker 的 <code>/live</code>，再由 Worker 轉接 Gemini Live。請先確認 Worker Secrets 內已配置 <code>GEMINI_API_KEYS</code> 或 <code>VECTORIZE_GEMINI_KEYS</code>。</p>
      <button id="connect">連線測試</button>
      <div id="log"></div>
    </section>
  </main>
  <script>
    const log = document.getElementById('log');
    document.getElementById('connect').onclick = () => {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + '${host}/live');
      ws.onopen = () => { log.textContent = 'WebSocket 已連線。'; ws.send(JSON.stringify({setup:{model:'models/gemini-2.0-flash-live-001'}})); };
      ws.onmessage = e => { log.textContent += '\\n收到資料：' + String(e.data).slice(0, 240); };
      ws.onerror = () => { log.textContent += '\\nWebSocket 發生錯誤。'; };
      ws.onclose = e => { log.textContent += '\\n連線已關閉：' + e.code; };
    };
  </script>
</body>
</html>`;
}

function getPortalHomePage(host) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QQAIbot Portal</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#03050a;color:#edf6ff}
    canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
    .shell{position:relative;z-index:1;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;align-items:end;padding:40px}
    .hero{max-width:760px;padding-bottom:24px}.brand{font-size:14px;letter-spacing:0;color:#71e7ff}.hero h1{font-size:clamp(36px,6vw,78px);line-height:1;margin:10px 0 16px;letter-spacing:0}
    .hero p{font-size:18px;line-height:1.7;color:#b8c7d9;max-width:680px}.panel{border:1px solid rgba(255,255,255,.14);background:rgba(5,10,18,.78);backdrop-filter:blur(16px);border-radius:8px;padding:20px}
    label{display:block;font-size:13px;color:#9fb1c7;margin:14px 0 6px}input,select{width:100%;height:40px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:#09111f;color:#eef6ff;padding:0 10px}
    button,a.btn{display:inline-flex;align-items:center;justify-content:center;height:40px;border:0;border-radius:6px;background:#57d7ff;color:#031018;font-weight:700;text-decoration:none;padding:0 14px;cursor:pointer}
    .row{display:flex;gap:10px;margin-top:16px}.notice{margin-top:16px;color:#a9b8ca;font-size:14px;line-height:1.6}.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    .dashboard{display:none;position:relative;z-index:1;padding:24px 40px 40px}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.tab{background:#132033;color:#d9ecff}.view{display:none;border:1px solid rgba(255,255,255,.14);background:rgba(5,10,18,.82);border-radius:8px;padding:18px}.view.active{display:block}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.mini{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:14px;background:#08101d}.muted{color:#9fb1c7;font-size:14px;line-height:1.6}
    @media(max-width:860px){.shell{grid-template-columns:1fr;padding:22px;align-items:start}.hero{padding-top:54px}.panel{width:100%}}
  </style>
</head>
<body>
  <canvas id="nebula" aria-hidden="true"></canvas>
  <main class="shell">
    <section class="hero">
      <div class="brand">QQAIbot Memory Matrix</div>
      <h1>全站記憶星雲母體</h1>
      <p>未登入前僅展示匿名化的群組混合粒子。登入後，記憶矩陣會坍縮為所屬群組的語義星團，並解鎖可檢視的中文字幕摘要。</p>
      <div class="links">
        <a class="btn" href="/live">Live</a>
        <a class="btn" href="/matrix">Vector Matrix</a>
      </div>
    </section>
    <aside class="panel">
      <strong>快捷登入</strong>
      <label>步驟一：選擇群組</label>
      <input id="group" placeholder="群組名稱 (群QQ號)">
      <label>步驟二：個人 QQ 號</label>
      <input id="qq" inputmode="numeric" placeholder="請輸入 QQ 號">
      <div class="row"><button id="send">發送驗證碼</button></div>
      <label>步驟三：安全驗證</label>
      <input id="code" inputmode="numeric" maxlength="6" placeholder="6 位數驗證碼">
      <div class="row"><button id="verify">登入</button></div>
      <div class="notice" id="notice">系統公告：Portal、Live、Vector Matrix 路由已啟用。驗證碼接口需接入 QQ 私訊發送器後才會簽發正式登入。</div>
    </aside>
  </main>
  <section class="dashboard" id="dashboard">
    <div class="tabs">
      <button class="tab" data-view="self">個人設定</button>
      <button class="tab" data-view="matrix">記憶矩陣</button>
      <button class="tab" data-view="admin">群務面板</button>
      <button class="tab" data-view="root">Root 維運</button>
    </div>
    <div class="view active" id="view-self">
      <h2>個人設定自助區</h2>
      <div class="grid">
        <div class="mini"><strong>記憶 CRUD</strong><p class="muted">新增、修改、刪除自己的私人/公開記憶。所有變更會寫入 audit logs。</p></div>
        <div class="mini"><strong>免打擾</strong><p class="muted">切換個人免打擾，避免 AI 主動 @ 你。</p></div>
        <div class="mini"><strong>AI 態度</strong><p class="muted">設定私人專屬 AI 回覆風格。</p></div>
        <div class="mini"><strong>配額</strong><p class="muted">目前常態顯示：無限。</p></div>
      </div>
    </div>
    <div class="view" id="view-matrix"><h2>進階向量記憶矩陣</h2><p class="muted">登入後星雲保留，但會從全站匿名混合模式坍縮為所屬群組粒子。普通群員只能看本群摘要；Root 可開啟原始向量檢索模式。</p></div>
    <div class="view" id="view-admin"><h2>群務秩序管理面板</h2><p class="muted">群管理員、群主、Root 可用。一般群員點擊會顯示 Error 403。</p></div>
    <div class="view" id="view-root"><h2>核心系統維運後台</h2><p class="muted">僅 Root 可用：全域權限、記憶使用權開關、硬重啟、金鑰池、錯誤日誌、廣播與 D1 備份。</p></div>
  </section>
  <script>
    const c=document.getElementById('nebula'),x=c.getContext('2d');let w,h,p=[];
    function resize(){w=c.width=innerWidth*devicePixelRatio;h=c.height=innerHeight*devicePixelRatio;p=Array.from({length:1500},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.45,vy:(Math.random()-.5)*.45,r:Math.random()*1.6+.25,h:Math.random()*80+185}))}
    addEventListener('resize',resize);resize();
    let mx=-9999,my=-9999;addEventListener('pointermove',e=>{mx=e.clientX*devicePixelRatio;my=e.clientY*devicePixelRatio});
    function frame(){x.fillStyle='rgba(3,5,10,.24)';x.fillRect(0,0,w,h);for(const a of p){const dx=a.x-mx,dy=a.y-my,d=Math.hypot(dx,dy);if(d<120){a.vx+=dx/d*.025;a.vy+=dy/d*.025;x.strokeStyle='rgba(120,230,255,.16)';x.beginPath();x.moveTo(mx,my);x.lineTo(a.x,a.y);x.stroke()}a.x=(a.x+a.vx+w)%w;a.y=(a.y+a.vy+h)%h;a.vx*=.995;a.vy*=.995;x.fillStyle='hsla('+a.h+',95%,70%,.85)';x.beginPath();x.arc(a.x,a.y,a.r*devicePixelRatio,0,Math.PI*2);x.fill()}requestAnimationFrame(frame)}frame();
    let session=null;
    async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json()}
    send.onclick=async()=>{notice.textContent=(await post('/api/auth/request-code',{group:group.value,qq:qq.value})).message}
    verify.onclick=async()=>{const res=await post('/api/auth/verify-code',{group:group.value,qq:qq.value,code:code.value});notice.textContent=res.message;if(res.ok){session=res;document.querySelector('.shell').style.display='none';dashboard.style.display='block';}}
    document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const v=b.dataset.view;if((v==='admin'||v==='root')&&session&&session.qq!=='3569028262'){alert('Error 403：權限不足');return;}document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById('view-'+v).classList.add('active')})
  </script>
</body>
</html>`;
}

export class OneBotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.add(server);

      server.addEventListener("message", event => {
        this.handleMessage(server, request, event).catch(error => {
          console.error("OneBotHub async handler failed:", error);
        });
      });
      server.addEventListener("close", () => this.sockets.delete(server));
      server.addEventListener("error", () => this.sockets.delete(server));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/send") {
      const payload = await request.json().catch(() => null);
      if (!payload) return Response.json({ sent: false, error: "invalid_payload" }, { status: 400 });
      const sent = this.broadcast(payload);
      return Response.json({ sent, sockets: this.sockets.size });
    }

    if (url.pathname === "/status") {
      return Response.json({ sockets: this.sockets.size });
    }

    return new Response("OneBotHub OK", { status: 200 });
  }

  async handleMessage(socket, request, event) {
    try {
      const body = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      if (!body || body.post_type === "meta_event" || body.echo || body.status === "ok") return;

      const sourceUrl = new URL(request.url);
      const internalResponse = await fetch(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-QQAI-Transport": "websocket-do"
        },
        body: JSON.stringify(body)
      });

      if (!internalResponse || internalResponse.status === 204) return;
      const payload = await internalResponse.json().catch(() => null);
      const reply = payload?.reply;
      if (!reply) return;

      const action = body.message_type === "private" ? "send_private_msg" : "send_group_msg";
      const params = body.message_type === "private"
        ? { user_id: body.user_id, message: reply, auto_escape: false }
        : {
            group_id: body.group_id,
            message: buildGroupReplyMessage(body, reply),
            auto_escape: false
          };

      socket.send(JSON.stringify({
        action,
        params,
        echo: `qqai:${Date.now()}:${crypto.randomUUID()}`
      }));
    } catch (error) {
      console.error("OneBotHub message failed:", error);
    }
  }

  broadcast(payload) {
    let sent = false;
    for (const socket of this.sockets) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
          sent = true;
        } else {
          this.sockets.delete(socket);
        }
      } catch (error) {
        this.sockets.delete(socket);
      }
    }
    return sent;
  }
}
