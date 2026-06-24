import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env, ctx) {
    // 1. 確保只處理 POST 請求 (QQ Webhook 標準)
    if (request.method !== 'POST') return new Response('🤖 Worker 运行正常', { status: 200 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

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

    // ==========================================
    // 🚀 主邏輯業務區
    // ==========================================
    try {
      const currentGroupId = body.group_id ? body.group_id.toString() : "";
      if (body.post_type !== 'message') return new Response(null, { status: 204 });
      
      const isGroup = body.message_type === 'group';
      const isPrivate = body.message_type === 'private';
      if (!isGroup && !isPrivate) return new Response(null, { status: 204 });

      // 精準提取群組身分
      const senderCard = body.sender?.card || body.sender?.nickname || userId;
      const senderRole = body.sender?.role || "member"; 
      const isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";
      const roleName = senderRole === "owner" ? "群主" : (senderRole === "admin" ? "管理员" : "群友");
      
      let userMessage = body.raw_message || body.message || "";
      const msgLower = userMessage.trim().toLowerCase();
      
      let atSender = isGroup ? `[CQ:at,qq=${userId}] ` : "";

      // 政治敏感詞過濾
      const sensitiveWords = ['习近平', '六四', '台独', '法轮功'];
      if (sensitiveWords.some(word => userMessage.includes(word))) return new Response(null, { status: 204 });

      // 清洗掉訊息中的 CQ 標籤與圖片標籤 (用於聊天記憶與常規判斷)
      let cleanMessage = userMessage
        .replace(/\[CQ:at,qq=\d+\]/g, '')
        .replace(/\[CQ:at,qq=all\]/g, '')
        .replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
        .replace(/\[CQ:record,[^\]]+\]/g, '[语音]')
        .trim();

      const imgUrlMatch = userMessage.match(/\[CQ:image,[^\]]*url=([^,\]]+)/);
      const imageUrl = imgUrlMatch ? imgUrlMatch[1] : null;

      const voiceUrlMatch = userMessage.match(/\[CQ:record,[^\]]*url=([^,\]]+)/);
      const voiceUrl = voiceUrlMatch ? voiceUrlMatch[1] : null;

      // 💡 核心權限判定 (群主、管理員、開發者)
      const hasAdminAuth = senderRole === 'admin' || senderRole === 'owner' || isDeveloper;

      // 🛠️ 萬用指令參數解析器 (提取目標 QQ 與 剩餘文字，支援純數字與 @CQ碼)
      const parseArgs = (rawMessage, prefix) => {
        const rawArgs = rawMessage.slice(rawMessage.toLowerCase().indexOf(prefix) + prefix.length).trim();
        const match = rawArgs.match(/^(?:\[CQ:at,qq=(\d+)\]|(\d+))?\s*(.*)$/s);
        return {
          targetQq: match ? (match[1] || match[2] || null) : null,
          restText: match && match[3] ? match[3].replace(/\[CQ:[^\]]+\]/g, '').trim() : ""
        };
      };

      // ==========================================
      // 📜 基礎系統指令管理模組
      // ==========================================
      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {
        let roleTxt = isDeveloper ? "【开发者】" : senderRole === 'owner' ? "【群主】" : senderRole === 'admin' ? "【管理员】" : "【群成员】";
        let helpMsg = `🤖 机器人指令清单 ${roleTxt}\n\n` +
                      `🔹 [超强实用工具]\n` +
                      `!读网页 [网址] (提取精华摘要)\n` +
                      `!翻译 [语言] [内容] (专业翻译)\n` +
                      `!会议纪要 [数字] (提取重点结论)\n` +
                      `!总结 [数字] (八卦轻松吃瓜)\n\n` +
                      `🔹 [群员可用]\n` +
                      `!截图 [网址] (获取网页快照)\n` +
                      `!群规 / !rules\n` +
                      `!免打扰 (开启后AI不主动插话)\n` +
                      `!取消免打扰\n` +
                      `!记住 <内容> (写入你的专属记忆)\n` +
                      `!忘记 <内容> (抹除专属记忆)\n` +
                      `!你记住了什么 (查看所有专属记忆)\n` +
                      `!set人格 [风格内容] (自定义风格)\n` +
                      `!del人格 (恢复默认人格)\n\n` +
                      `🔸 [管理专享]\n` +
                      `!ai开 / !ai关 / !重置\n` +
                      `!记忆开 / !记忆关\n` +
                      `!使用 [@成员/QQ号] 的说话方式 / !取消使用\n` +
                      `!免打扰 [@成员/QQ号] (帮他人开关)\n` +
                      `!set人格 [@成员/QQ号] [内容]\n` +
                      `!del人格 [@成员/QQ号]\n` +
                      `!群白名单 [群号] / !删群白名单 [群号]\n` +
                      `!黑名单 [@成员/QQ号] / !解除黑名单 [@成员]`;
        return jsonReply(helpMsg);
      }

      // 🌐 讀網頁功能 (純抓文字)
      const readMatch = cleanMessage.match(/^[!！](?:读网页|讀網頁)\s+(https?:\/\/[^\s]+)/);
      if (readMatch) {
        const targetUrl = readMatch[1];
        try {
          const res = await fetch(targetUrl, { headers: {'User-Agent': 'Mozilla/5.0'} });
          const html = await res.text();
          const text = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
                           .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
                           .replace(/<\/?[^>]+(>|$)/g, " ")
                           .replace(/\s+/g, ' ')
                           .substring(0, 15000); 
          const prompt = `请帮我快速总结以下网页内容的核心重点，字数控制在200-300字以内，语言要生动精炼，直接输出结果，绝对不要用Markdown格式：\n\n${text}`;
          const aiSummary = await callGeminiDirectly(prompt);
          if (aiSummary) return jsonReply(`${atSender}📄 【网页提炼总结】：\n${aiSummary}`);
          return jsonReply(`${atSender}❌ 网页分析失败，AI 可能卡住了。`);
        } catch (e) { return jsonReply(`${atSender}❌ 无法读取该网页内容，可能被对方伺服器拦截了！`); }
      }

      // 🔠 萬能翻譯
      const translateMatch = cleanMessage.match(/^[!！](?:翻译|翻譯)\s+([^\s]+)\s+(.*)$/s);
      if (translateMatch) {
        const targetLang = translateMatch[1];
        const targetText = translateMatch[2];
        const prompt = `你现在是一位精通${targetLang}的资深翻译官。请将以下内容翻译成${targetLang}，要求信达雅。并在翻译结果下方补充1~2句与此相关的日常或商务应用例句。严禁使用Markdown格式。需要翻译的内容：\n${targetText}`;
        const aiTranslation = await callGeminiDirectly(prompt);
        if (aiTranslation) return jsonReply(`${atSender}🔠 【${targetLang} 翻译结果】：\n${aiTranslation}`);
        return jsonReply(`${atSender}❌ 翻译失败，AI 查字典查晕了。`);
      }

      // 📝 會議紀要
      const meetingMatch = msgLower.match(/^[!！](?:会议纪要|會議紀要)\s*(\d+)?/);
      if (meetingMatch) {
        let count = meetingMatch[1] ? parseInt(meetingMatch[1]) : 50;
        if (count > 200) count = 200; if (count < 10) count = 10;
        const storedLogs = await env.QQ_STORE.get(`recent_logs:${currentGroupId}`);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        if (logs.length < 5) return jsonReply(`${atSender}📝 刚刚群里都没人说话，没什么好纪录的。`);
        
        const targetLogs = logs.slice(-count);
        const prompt = `请将以下群聊记录整理成一份「会议精华纪要」。\n要求包含：1. 讨论的核心主题 2. 达成的共识或主要观点 3. 待办事项或结论。请用专业精炼的语言整理，直接输出重点，严禁使用Markdown格式：\n\n` + targetLogs.join('\n');
        const summary = await callGeminiDirectly(prompt);
        if (summary) return jsonReply(`${atSender}📋 【最近 ${targetLogs.length} 条群聊精华纪要】：\n${summary}`);
        return jsonReply(`${atSender}❌ 纪要生成失败。`);
      }

      // 🌐 Puppeteer 無頭瀏覽器截圖功能
      if (['!截图', '!截圖', '!screenshot', '！截图', '！截圖'].some(p => msgLower.startsWith(p))) {
        const match = cleanMessage.match(/https?:\/\/[^\s]+/);
        if (!match) return jsonReply(`${atSender}⚠️ 请提供完整的网址，例如: !截图 https://google.com`);
        if (!env.MYBROWSER) return jsonReply(`${atSender}⚠️ 开发者尚未在 Cloudflare 绑定 MYBROWSER 浏览器实例。`);

        try {
          const browser = await puppeteer.launch(env.MYBROWSER);
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(match[0], { waitUntil: "domcontentloaded" });
          const imgBuffer = await page.screenshot();
          await browser.close();

          let binary = '';
          const bytes = new Uint8Array(imgBuffer);
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return jsonReply(`${atSender}[CQ:image,file=base64://${btoa(binary)}]`);
        } catch (err) {
          return jsonReply(`${atSender}❌ 网页截图失败：${err.message}`);
        }
      }

      // 📈 吃瓜總結功能 (支援自訂數量，配合迴圈輪詢)
      const melonMatch = msgLower.match(/^[!！](?:吃瓜|总结|總結)\s*(\d+)?/);
      if (melonMatch && !meetingMatch) {
        let count = melonMatch[1] ? parseInt(melonMatch[1]) : 60;
        if (count > 100) count = 100; 
        if (count < 5) count = 5;

        const logKey = `recent_logs:${currentGroupId}`;
        const storedLogs = await env.QQ_STORE.get(logKey);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        if (logs.length < 5) return jsonReply(`${atSender}🍵 刚刚群里都没什么人说话，没有瓜可以吃呀~`);

        const targetLogs = logs.slice(-count);
        const promptText = `请看以下最近群里的聊天记录。请用八卦、轻松的语气，帮我简单总结大家刚刚在聊些什么（重点抓取有趣的内容，字数控制在500字以内，不准用markdown，但可以使用条列式）：\n\n` + targetLogs.join('\n');
        
        const keysStr = env.GEMINI_API_KEYS || "";
        const apiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k !== "");
        const melonModelList = ['gemini-3.1-flash-lite', 'gemini-3-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];
        
        if (apiKeys.length > 0) {
          melonLoop: for (const apiKey of apiKeys) {
            for (const model of melonModelList) {
              try {
                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }] }),
                  signal: AbortSignal.timeout(15000)
                });
                if (!geminiRes.ok) continue;
                const data = await geminiRes.json();
                if (data.candidates?.[0]) {
                  return jsonReply(`${atSender}🍉 【最近 ${targetLogs.length} 条吃瓜总结】：\n${data.candidates[0].content.parts[0].text.replace(/[\*#\-]/g, '').trim()}`);
                }
              } catch(e) {}
            }
          }
        }
        return jsonReply(`${atSender}❌ 总结失败，AI 偷懒了。`);
      }

      // 🧠 專屬記憶盤點
      if (['!你记住了什么', '!你記住了什麼', '！你记住了什么', '！你記住了什麼'].includes(msgLower)) {
        const storedMemos = await env.QQ_STORE.get(`user_memo:${currentGroupId}:${userId}`);
        let memos = [];
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}
        if (memos.length === 0) return jsonReply(`${atSender}🤔 脑海空空如也，我还没有记住关于你的任何专属事情哦。（使用 !记住 <内容> 让我记下）`);
        return jsonReply(`${atSender}📖 【关于你的专属记忆如下】：\n` + memos.map((m, i) => `${i + 1}. ${m}`).join('\n'));
      }

      // 🧠 專屬記憶刻入 (KV 機制：所有人皆可用，一般人限 100 筆，每次調用)
      if (['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].find(p => msgLower.startsWith(p));
        let targetMem = cleanMessage.slice(prefix.length).trim();
        if (!targetMem) return jsonReply(`${atSender}🤷 请输入要记住的内容。`);
        
        const kvKey = `user_memo:${currentGroupId}:${userId}`;
        let memos = [];
        const storedMemos = await env.QQ_STORE.get(kvKey);
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}
        
        // 權限判定：非管理員且達到 100 筆則擋下
        if (!hasAdminAuth && memos.length >= 100) {
          return jsonReply(`${atSender}⚠️ 您的专属记忆已达 100 条上限，请先使用 !忘记 清除一些回忆。`);
        }
        
        memos.push(targetMem);
        await env.QQ_STORE.put(kvKey, JSON.stringify(memos));
        return jsonReply(`${atSender}📝 记住了！这是专属您的死记忆，以后每次对话我都会强制想起来。`);
      }

      // 🗑️ 手動刪除個人專屬記憶 (KV 機制)
      if (['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].find(p => msgLower.startsWith(p));
        let targetForget = cleanMessage.slice(prefix.length).trim();
        if (!targetForget) return jsonReply(`${atSender}🤷 要我忘记什么？格式：!忘记 内容`);
        
        const kvKey = `user_memo:${currentGroupId}:${userId}`;
        let memos = [];
        const storedMemos = await env.QQ_STORE.get(kvKey);
        if (storedMemos) try { memos = JSON.parse(storedMemos); } catch(e) {}
        
        if (memos.length === 0) return jsonReply(`${atSender}🔍 您的专属记忆库目前是空的哦。`);
        
        // 模糊搜尋刪除
        const matchIndex = memos.findIndex(m => m.includes(targetForget));
        if (matchIndex !== -1) {
          const removedText = memos[matchIndex];
          memos.splice(matchIndex, 1);
          if (memos.length === 0) {
            await env.QQ_STORE.delete(kvKey);
          } else {
            await env.QQ_STORE.put(kvKey, JSON.stringify(memos));
          }
          return jsonReply(`${atSender}🗑️ 已成功忘掉关于您的这段记忆："${removedText}"`);
        } else {
          return jsonReply(`${atSender}🔍 找不到包含该内容的专属记忆呢...`);
        }
      }

      // 🎭 群友自訂風格指令 (支援 @成員)
      if (['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格', '！setpersonality'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格', '！setpersonality'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        
        let targetUserId = userId;
        let isSettingOthers = false;

        if (targetQq) {
          targetUserId = targetQq;
          isSettingOthers = true;
        }

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人设置专属人格。`);
        if (!restText) return jsonReply(`${atSender}⚠️ 风格内容不能为空哦！格式：!set人格 [@成员] 傲娇妹妹`);

        await env.QQ_STORE.put(`custom_style:${currentGroupId}:${targetUserId}`, restText);
        if (isSettingOthers) {
          return jsonReply(`${atSender}✨ 已成功为 QQ:${targetUserId} 设定专属外挂人格！`);
        } else {
          return jsonReply(`${atSender}✨ 专属人格定制成功！以后我单独回你时会切换成这种风格。`);
        }
      }

      // 🗑️ 清除自訂風格指令 (支援 @成員)
      if (['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格', '！clear人格'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格', '！clear人格'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        let targetUserId = userId;
        let isSettingOthers = false;

        if (targetQq) {
          targetUserId = targetQq;
          isSettingOthers = true;
        }

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人清除人格。`);

        await env.QQ_STORE.delete(`custom_style:${currentGroupId}:${targetUserId}`);
        
        if (isSettingOthers) {
          return jsonReply(`${atSender}🗑️ 已成功清除 QQ:${targetUserId} 的专属人格。`);
        } else {
          return jsonReply(`${atSender}🗑️ 专属人格已清除，已恢复默认预设。`);
        }
      }

      // 🔇 免打擾指令 (支援 @成員)
      if (['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾', '！noat'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾', '！noat'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        let targetUserId = userId; 
        let isSettingOthers = false;

        if (targetQq) {
          targetUserId = targetQq;
          isSettingOthers = true;
        }

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人开启免打扰。`);

        await env.QQ_STORE.put(`dnd:${currentGroupId}:${targetUserId}`, "true");
        
        if (isSettingOthers) {
          return jsonReply(`${atSender}✅ 已成功帮 QQ:${targetUserId} 开启免打扰模式。`);
        } else {
          return jsonReply(`${atSender}✅ 已为您开启免打扰。AI不会主动对您插话或随意 @ 您。`);
        }
      }

      if (['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾', '！cancelnoat'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾', '！cancelnoat'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        let targetUserId = userId;
        let isSettingOthers = false;

        if (targetQq) {
          targetUserId = targetQq;
          isSettingOthers = true;
        }

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人取消免打扰。`);

        await env.QQ_STORE.delete(`dnd:${currentGroupId}:${targetUserId}`);
        
        if (isSettingOthers) {
          return jsonReply(`${atSender}⭕ 已成功帮 QQ:${targetUserId} 取消免打扰模式。`);
        } else {
          return jsonReply(`${atSender}⭕ 已取消免打扰模式。`);
        }
      }

      // 🎭 靈魂竊取模仿功能 (支援 @成員 與 獨立解除)
      if (['!使用', '！使用'].some(p => msgLower.startsWith(p)) && msgLower.includes('说话方式')) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!使用', '！使用'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!targetQq) return jsonReply(`${atSender}⚠️ 格式：!使用 [@成员/QQ号] 的说话方式`);
        
        await env.QQ_STORE.put(`mimic_target:${currentGroupId}`, targetQq);
        return jsonReply(`${atSender}🎭 成功捕获 QQ:${targetQq} 的语调灵魂！输入 !取消使用 可单独解除。`);
      }

      // 🚫 獨立解除模仿指令
      if (['!取消使用', '！取消使用', '!解除模仿', '！解除模仿'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.delete(`mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}⭕ 已成功解除说话方式的模仿，恢复默认群友状态（聊天记忆未受影响）。`);
      }

      // 白名單群組管理
      if (['!群白名单', '!群白名單', '!groupwhitelist', '！群白名单', '！群白名單', '！groupwhitelist'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!群白名单', '!群白名單', '!groupwhitelist', '！群白名单', '！群白名單', '！groupwhitelist'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (targetQq) {
          await env.QQ_STORE.put(`whitelist_group:${targetQq}`, "true");
          return jsonReply(`${atSender}✅ 群组 ${targetQq} 已加入白名单。`);
        }
        return jsonReply(`${atSender}⚠️ 请提供群号。`);
      }

      if (['!删群白名单', '!刪群白名單', '!delgroupwhitelist', '！删群白名单', '！刪群白名單', '！delgroupwhitelist'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!删群白名单', '!刪群白名單', '!delgroupwhitelist', '！删群白名单', '！刪群白名單', '！delgroupwhitelist'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (targetQq) {
          await env.QQ_STORE.delete(`whitelist_group:${targetQq}`);
          return jsonReply(`${atSender}❌ 群组 ${targetQq} 已移出白名单。`);
        }
        return jsonReply(`${atSender}⚠️ 请提供群号。`);
      }

      // 群規設定
      if (['!set群规', '!set群規', '!setrules', '！set群规', '！set群規', '！setrules'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!set群规', '!set群規', '!setrules', '！set群规', '！set群規', '！setrules'].find(p => msgLower.startsWith(p));
        let content = cleanMessage.slice(prefix.length).trim();
        if (!content) return jsonReply(`${atSender}⚠️ 内容不能为空。`);
        await env.QQ_STORE.put(`notice:${currentGroupId}`, content);
        return jsonReply(`${atSender}✅ 群规更新成功！`);
      }

      if (['!群规', '!群規', '!rules', '！群规', '！群規', '！rules'].includes(msgLower)) {
        const notice = await env.QQ_STORE.get(`notice:${currentGroupId}`) || "该群暂无设置群规。";
        return jsonReply(`📋 群规：\n\n${notice}`);
      }

      // 黑白名單個人管理 (支援 @成員)
      if (['!黑名单', '!黑名單', '!blacklist', '！黑名单', '！黑名單', '！blacklist'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!黑名单', '!黑名單', '!blacklist', '！黑名单', '！黑名單', '！blacklist'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (targetQq) {
          await env.QQ_STORE.put(`status:blacklist:${targetQq}`, "true");
          return jsonReply(`${atSender}⛔ 已将 QQ:${targetQq} 加入黑名单。`);
        }
        return jsonReply(`${atSender}⚠️ 请提供 @成员 或 QQ号。`);
      }

      if (['!解除黑名单', '!解除黑名單', '!unblacklist', '！解除黑名单', '！解除黑名單', '！unblacklist'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        const prefix = ['!解除黑名单', '!解除黑名單', '!unblacklist', '！解除黑名单', '！解除黑名單', '！unblacklist'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (targetQq) {
          await env.QQ_STORE.delete(`status:blacklist:${targetQq}`);
          return jsonReply(`${atSender}⭕ 已解除 QQ:${targetQq} 的黑名单。`);
        }
        return jsonReply(`${atSender}⚠️ 请提供 @成员 或 QQ号。`);
      }

      // 開關控制
      if (['!ai开', '!ai開', '!aion', '！ai开', '！ai開', '！aion'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.put(`switch:${currentGroupId}`, "true");
        return jsonReply(`${atSender}🤖 AI 聊天功能已开启。`);
      }
      if (['!ai关', '!ai關', '!aioff', '！ai关', '！ai關', '！aioff'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.put(`switch:${currentGroupId}`, "false");
        return jsonReply(`${atSender}⚙️ AI 功能已关闭。`);
      }

      if (['!记忆开', '!記憶開', '!memoryon', '！记忆开', '！記憶開', '！memoryon'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.put(`memo:${currentGroupId}`, "true");
        return jsonReply(`${atSender}🧠 自动记忆已开启。`);
      }
      if (['!记忆关', '!記憶關', '!memoryoff', '！记忆关', '！記憶關', '！memoryoff'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.put(`memo:${currentGroupId}`, "false");
        return jsonReply(`${atSender}🧊 自动记忆已关闭。`);
      }

      if (['!clear', '!重置', '!reset', '！clear', '！重置', '！reset'].includes(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await env.QQ_STORE.delete(`history:group:${currentGroupId}`);
        await env.QQ_STORE.delete(`mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}🧹 缓存与模仿状态已全部重置！`);
      }

      if (isPrivate) return new Response(null, { status: 204 });

      // ==========================================
      // 🛡️ 群組白名單攔截器
      // ==========================================
      const isGroupWhitelisted = await env.QQ_STORE?.get(`whitelist_group:${currentGroupId}`);
      if (isGroupWhitelisted !== "true") return new Response(null, { status: 204 });

      // ==========================================
      // 🧠 👁️ 萬物皆刻 (無視黑名單記憶 - 向量庫背景運行 & 近期日誌)
      // ==========================================
      const memoSwitch = await env.QQ_STORE?.get(`memo:${currentGroupId}`);
      const botIdTag = `[CQ:at,qq=${botId}]`;
      const isAtMe = userMessage.includes(botIdTag);

      if (!isAtMe && (cleanMessage.length > 1 || imageUrl || voiceUrl) && !cleanMessage.startsWith('!') && !cleanMessage.startsWith('！')) {
        ctx.waitUntil((async () => {
          // 1. 寫入供 !吃瓜 用的近期滾動紀錄 (最高保留到 100 條)
          const logKey = `recent_logs:${currentGroupId}`;
          let logs = [];
          const storedLogs = await env.QQ_STORE.get(logKey);
          if (storedLogs) { try { logs = JSON.parse(storedLogs); } catch(e){} }
          logs.push(`[${senderCard}]: ${cleanMessage || (imageUrl?"发了张图":"发了语音")}`);
          if (logs.length > 100) logs = logs.slice(-100);
          await env.QQ_STORE.put(logKey, JSON.stringify(logs));

// 2. 寫入供長期語意聯想用的 Vectorize
          if (env.VECTORIZE && memoSwitch !== "false" && cleanMessage.length > 2) {
            try {
              // 過濾掉 QQ 表情，只留下純文字存進記憶庫
              const pureMessage = cleanMessage.replace(/\[CQ:face,[^\]]+\]/g, '').trim();
              
              // 如果過濾完還有文字，才存進去
              if (pureMessage.length > 0) {
                const vec = await getVector(pureMessage);
                if (vec && typeof vec !== 'string') {
                  const recordId = `chat_${currentGroupId}_${Date.now()}`;
                  await env.VECTORIZE.insert([{
                    id: recordId,
                    values: vec,
                    metadata: { 
                      text: `[${roleName} ${senderCard}(QQ:${userId}) 曾说]: ${pureMessage}`, 
                      group: currentGroupId,
                      author: userId
                    }
                  }]);
                }
              }
            } catch (e) {
              console.error("Vectorize insert failed:", e);
            }
          }

      // 🛡️ 黑名單與聊天開關門檻
      const isBlacklisted = await env.QQ_STORE?.get(`status:blacklist:${userId}`);
      if (isBlacklisted === "true") return new Response(null, { status: 204 });

      const aiSwitch = await env.QQ_STORE?.get(`switch:${currentGroupId}`);
      if (aiSwitch === "false") return new Response(null, { status: 204 });

      let shouldReply = isAtMe;
      let isAutoInterject = false;

      // ⚡ 隨機插話機制 (20% 機率)
      if (!isAtMe && (cleanMessage.length > 1 || imageUrl || voiceUrl) && !cleanMessage.startsWith('!') && !cleanMessage.startsWith('！')) {
        const targetDnd = await env.QQ_STORE.get(`dnd:${currentGroupId}:${userId}`);
        if (targetDnd !== "true" && Math.random() < 0.25) { 
          const lastInterject = await env.QQ_STORE.get(`last_interject:${currentGroupId}`);
          const now = Date.now();
          if (!lastInterject || now - parseInt(lastInterject) > 10000) { 
            shouldReply = true;
            isAutoInterject = true;
            ctx.waitUntil(env.QQ_STORE.put(`last_interject:${currentGroupId}`, now.toString()));
          }
        }
      }

      if (!shouldReply) return new Response(null, { status: 204 });

      let aiInputParts = [];
      let memoryContext = "";
      
      // ✨ 檢查模仿目標
      const mimicQq = await env.QQ_STORE.get(`mimic_target:${currentGroupId}`);
      if (mimicQq && env.VECTORIZE) {
        try {
          const queryVec = await getVector("发言 语调 习惯");
          if (queryVec && typeof queryVec !== 'string') {
            const matches = await env.VECTORIZE.query(queryVec, { 
              topK: 3, 
              returnMetadata: "all"
            });
            const validMatches = matches?.matches?.filter(m => m.metadata?.group === currentGroupId && m.metadata?.author === mimicQq);
            if (validMatches?.length > 0) {
              memoryContext += `\n【⚠️ 复制人特异功能提示：请参考目标 QQ:${mimicQq} 以下的历史发言风格进行高仿】:\n` +
                               validMatches.map(m => m.metadata?.text || "").join("\n") + "\n";
            }
          }
        } catch(e){}
      }

      // 🌟 KV 專屬個人記憶調閱 (每次必調，直接塞給 AI)
      const kvMemKey = `user_memo:${currentGroupId}:${userId}`;
      const storedUserMemos = await env.QQ_STORE.get(kvMemKey);
      if (storedUserMemos) {
        try { 
          const parsedMemos = JSON.parse(storedUserMemos); 
          if (parsedMemos.length > 0) {
            memoryContext += `\n【✨ 关于当前群友 QQ:${userId} 的专属死记忆】:\n` + 
                             parsedMemos.map((m, i) => `${i+1}. ${m}`).join("\n") + "\n";
          }
        } catch(e) {}
      }

      // 常規語境記憶調閱 (模糊搜尋輔助)
      if (env.VECTORIZE && cleanMessage) {
        try {
          const queryVec = await getVector(cleanMessage);
          if (queryVec && typeof queryVec !== 'string') {
            const matches = await env.VECTORIZE.query(queryVec, { topK: 5, returnMetadata: "all" });
            const validMatches = matches?.matches?.filter(m => m.metadata?.group === currentGroupId);
            if (validMatches?.length > 0) {
              memoryContext += "\n【回想起来的相关零碎片段】:\n" + 
                               validMatches.slice(0, 2).map(m => m.metadata?.text || "").filter(t => t !== "").join("\n") + "\n";
            }
          }
        } catch (err) {}
      }

      if (imageUrl) {
        const base64Data = await fetchImageAsBase64(imageUrl);
        if (base64Data) aiInputParts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
      }

      if (voiceUrl) {
        const audioData = await fetchAudioAsBase64(voiceUrl);
        if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
      }

      // ==========================================
      // 🎭 提示詞與人格預設區塊（深度豐富擴充版）
      // ==========================================
      let finalStylePrompt = `你现在是一个活躍在QQ群聊里的真人群友，不是无情的AI助手。请展现出鲜明的人格魅力與人情味。

【👥 核心人格設定】
1. 真实感：聊天时要像个正常人类，有自己的喜好、情绪和日常作息。不要每句话都说“好的”、“没问题”，可以有赞同、有吐槽、有调侃。
2. 社交距离：
   - 被艾特时：展现出超级温柔、体贴、情绪价值拉满的暖男/暖女形象，脾气极好，会认真倾听并安慰对方。
   - 主动插话（未被艾特）时：展现出活跃、幽默、爱凑热闹的一面。顺着群友的話题自然接梗、搭腔，或者对好奇的事物提出反问，带头活跃群里气氛。
3. 语气口吻：口语化、接地气。可以适度使用网络流行语（如：草、哈、笑死、確實）、颜文字（如：(¯﹃¯)、(°∀°)ﾉ、QAQ）或拼音缩写，但不要过量。
4. 表情密度嚴格限制令：你可以使用 QQ 原生表情（如 [CQ:face,id=...]）來增加聊天的生動度，但必須嚴格控制數量！你發送的「QQ表情總個數」絕對不能和文字一樣多。每當你說完一整段話，最多隻能配上 1 到 2 個最符合當下心情的 QQ 表情。嚴禁在每句話的結尾或中間瘋狂連續堆疊表情標籤，必須讓文字佔據絕對主導地位！

【👁️ 多模态互动指南】
1. 收到图片时：化身为“深度看图大師”，仔细观察图片中的细节（如文字、表情包含义、物件、环境），并给出极其精准、幽默或温暖的点评，绝对不要敷衍。
2. 收到语音时：认真聆听语音内容，像对待文字一样针对里面的话题进行互动。

【💡 联想与检索能力】
1. 记忆整合：你的大脑中会随时浮现【群聊潜意识联想】或【死记忆】。请自然地把这些过去发生的事、群友说的话，融入到当下的对话中（例如：“你上次不是说...”、“原来你之前记的那个...”）。
2. 即时联网：如果群友聊到你不知道的最新时事、八卦、游戏改版、ACG新番或技术问题，你拥有 Google 搜索特权。请直接动用搜索查明真相，像个百事通一样跟大家分享，但不要用死板的百科语气汇报。
3. 记忆隔离铁律：你在【回想起来的相关零碎片段】中看到的历史记录，僅僅是用來參考過去發生過什麼事件與事實。你「絕對不准」模仿、複製、或代入那些片段中其他人的說話風格、特殊人設、語氣、顏文字或口頭禪！你必須始終保持你自己原本的預設群友語氣（或是當前與你對話的使用者所設定的專屬風格）來回覆，千萬不要被別人的歷史發言帶偏！

【🚨 终极死线（铁律）】
1. 绝对不能透露自己是 AI、机器人、语言模型或由 Google 开发，你就是群友！
2. 单次回复字数不限，请根据话题展开深入聊聊，尽量多说一点字，表达得更详细、更有条理。
3. 绝对不准输出任何 Markdown 格式（例如：**、#、##、\`\`\`、- 等符号），所有重点请用文字语气强调，保持纯文字群聊的美观！
4. 记忆隔离铁律：你在【回想起来的相关零碎片段】中看到的历史记录，僅僅是用來參考過去發生過什麼事件與事實。你「絕對不准」模仿、複製、或代入那些片段中其他人的說話風格、特殊人設、語氣、顏文字或口頭禪！你必須始終保持你自己原本的預設群友語氣（或是當前與你對話的使用者所設定的專屬風格）來回覆，千萬不要被別人的歷史發言帶偏！
5. 風格隔離與禁止模仿令：無論在【最近的對話紀錄】或【回想起來的相关零碎片段】中看到其他群友使用何種語氣、口頭禪、特殊人設、顏文字、QQ表情包、或是特殊的標點符號習慣（例如每句話都加特定詞尾），你都「絕對不准學習或模仿」！，那些歷史紀錄僅僅是讓你了解「發生了什麼事情（事實與數據）」，而不是讓你融入他們的說話風格。你必須始終保持你自己原本設定的、正常的、一般的群友語氣，絕對要對其他人的說話方式進行「免疫」，違者視為嚴重違規！`;

      // 👑 開發者特權覆蓋
      if (isDeveloper) {
        finalStylePrompt += `\n\n👑 【特殊指令】：正在与你对话的 [QQ:${userId}] 是你的「开发者本人」！你的语气必须要变得极其崇拜、依赖，并且完全服从他说的任何话！`;
      }
      
      // 🔥 核心修正：不論是被艾特還是主動插話，只要觸發對話的群友有專屬人設，就強制全盤覆蓋
      const userCustomStyle = await env.QQ_STORE.get(`custom_style:${currentGroupId}:${userId}`);
      if (userCustomStyle) {
        finalStylePrompt = `【🚨🚨🚨 最高优先级人格覆盖指令 🚨🚨🚨】
当前触发对话的群友是 [QQ:${userId}]。
你必须彻底忘掉、并完全无视任何默认的“温柔治愈”或“平实就事论事”互动预设！
现在，无论是你回应他的艾特，还是你针对他的发言进行【主动插话】，你唯一的最高指令就是：完全化身为 👉 ${userCustomStyle} 👈。
你接下来回复的每一个字，都必须100%符合这个专属风格，绝对不准跳戏，不准受到历史普通聊天记录的影响而恢复成默认状态！如果包含图片，也必须用该风格评论图片！

---
` + finalStylePrompt;
      }

      // KV 短暫歷史上下文
      const historyKey = `history:group:${currentGroupId}`;
      let history = [];
      if (env.QQ_STORE) {
        const stored = await env.QQ_STORE.get(historyKey);
        if (stored) try { history = JSON.parse(stored); } catch(e) {}
      }

      const contents = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));
      
      let msgDesc = cleanMessage;
      if (!cleanMessage && imageUrl) msgDesc = "[发送了一张图片，请你仔细看图并针对图片内容回复]";
      if (!cleanMessage && voiceUrl) msgDesc = "[发送了一段语音消息，请你聆听并回复]";

      const devTag = isDeveloper ? "【开发者本人】" : "";
      let userPrompt = isAutoInterject
        ? `(状态：主动插话讨论) 刚刚 [${roleName} ${devTag} ${senderCard}(QQ:${userId})] 说：${msgDesc}`
        : `(状态：常规聊天询问) [${roleName} ${devTag} ${senderCard}(QQ:${userId})] 对你说：${msgDesc}`;
      
      aiInputParts.push({ text: `${memoryContext}\n\n${userPrompt}` });
      contents.push({ role: 'user', parts: aiInputParts });

      const modelList = [
        'gemini-3.1-flash-lite',
        'gemini-3-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemma-4-31b',
        'gemma-4-26b'
      ];
      const keysStr = env.GEMINI_API_KEYS || "";
      const apiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k !== "");

      let replyText = "";
      let success = false;

      // ==========================================
      // 💬 呼叫 Gemini AI 核心 (完美保留原始輪詢機制 + 新增 Google Search 工具)
      // ==========================================
      if (apiKeys.length > 0) {
        chatLoop: for (const apiKey of apiKeys) {
          for (const model of modelList) {
            try {
              const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contents: contents,
                  systemInstruction: { parts: [{ text: finalStylePrompt }] },
                  tools: [{ googleSearch: {} }] // 🌐 確保在此開啟聯網工具
                }), 
                signal: AbortSignal.timeout(15000) 
              });
              
              if (!geminiRes.ok) continue; 
              
              const responseData = await geminiRes.json();
              if (responseData.candidates?.[0]) {
                replyText = responseData.candidates[0].content.parts[0].text;
                replyText = replyText.replace(/[\*#\-\`~>_]/g, '').trim(); 
                success = true;
                break chatLoop;
              }
            } catch (err) {}
          }
        }
      }

      // ==========================================
      // 🛠 終端發送閘
      // ==========================================
      if (success) {
        if (env.QQ_STORE) {
          history.push({ role: 'user', text: `[${roleName} ${senderCard}(QQ:${userId})]: ${msgDesc}` });
          history.push({ role: 'model', text: replyText });
          if (history.length > 6) history = history.slice(-6); 
          ctx.waitUntil(env.QQ_STORE.put(historyKey, JSON.stringify(history)));
        }

        const senderDndCheck = await env.QQ_STORE.get(`dnd:${currentGroupId}:${userId}`);
        let finalReply = `${atSender}${replyText}`;
        if (atSender && replyText.trim().startsWith(atSender.trim())) finalReply = replyText;
        if (senderDndCheck === "true") finalReply = replyText; // 免打擾則去頭部 @

        finalReply = finalReply.replace(/(\[CQ:at,qq=\d+\]\s*)\1+/g, '$1');
        return jsonReply(finalReply);
      } else {
        return jsonReply(`${atSender}❌ 唔...我的脑子好像宕机了（API 额度耗尽或节点连接失败），请开发者检查一下吧。`);
      }

    } catch (e) { 
      return new Response(null, { status: 204 }); 
    }
  },
};
