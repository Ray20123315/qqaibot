# 🌌 QQ AI Bot (專案名稱：qqai)

一個基於 **Cloudflare Workers** 邊緣運算生態打造的高效能 QQ 群聊 AI 機器人。完美整合了 Google Gemini 大語言模型、Vectorize 向量資料庫（長期語意記憶）以及 Puppeteer 瀏覽器自動化環境，提供極其乾淨、精煉且擬真自然的群聊互動體驗。

本專案特別針對 QQ 群聊生態進行了深度優化，從底層根除了 AI 常見的「戲癮大發（括號內心戲）」、「表情包氾濫（CQ 碼堆疊）」以及「跨語系編碼亂碼（菱形問號 ）」等痛點。

---

## 🚀 核心技術棧與環境

* **核心運行環境**：[Bun](https://bun.sh/) (v1.2.15+) / Node.js (v22.16.0)
* **邊緣運算平台**：[Cloudflare Workers](https://workers.cloudflare.com/)
* **大語言模型 (LLM)**：Google Gemini API (支援多模型輪詢 Fallback：`gemini-3.1-flash-lite`, `gemini-3-flash` 等)
* **長期語意回想 (Vector DB)**：Cloudflare 原生嵌入模型 (`@cf/baai/bge-m3`) + Cloudflare Vectorize (`VECTORIZE`)
* **短期會話快取 (KV)**：Cloudflare KV (`QQ_STORE`)
* **網頁自動化渲染**：Cloudflare Puppeteer (`MYBROWSER`)
* **套件管理與配置**：現代化 `wrangler.jsonc` (`compatibility_date: 2026-06-24`)

---

## ✨ 獨家核心功能

### 1. 🧠 雙軌制記憶與專屬記憶系統
* **短期上下文快取 (KV)**：記錄當前群聊的 6 條上下文邏輯，確保對話連貫。
* **長期語意聯想 (Vectorize)**：AI 會在背景自動將群友聊天內容向量化。當觸發相關話題時，AI 會自動「回想起」過往的對話片段。
* **個人專屬死記憶**：群友可透過指令讓 AI 記住專屬事項，每次對話時 AI 都會強制提取該群友的專屬記憶。

### 2. 🛡️ 鐵律式人格約束與風格自訂
* **防呆防亂碼限制**：嚴格限制單次發言不超過 80 字，最多 1-2 個原生表情，禁用 Markdown 與劇本式內心戲。
* **千人千面自訂人格**：支援為特定群友設定「專屬外掛人格」，當 AI 與該群友對話時，會強制切換為設定的風格（傲嬌、毒舌等）。

### 3. 👁️ 多模態與主動互動機制
* **看圖聽語音**：支援讀取群內的圖片（轉 Base64）與語音（自動辨識 mp3/wav/amr/ogg），AI 能針對圖片細節或語音內容進行精準互動。
* **智慧主動插話**：打破傳統只能被動 `@` 的限制，AI 在未被 `@` 的情況下，有 25% 機率會根據當前話題主動搭話（內建 10 秒冷卻防刷頻）。

---

## 🎮 完整互動與管理指令清單

AI 在群聊中會即時監聽 Webhook 請求，並提供極其豐富的實用工具與管理指令：

### 🔹 實用工具 (所有人可用)
| 指令 | 說明 |
| :--- | :--- |
| `!读网页 [网址]` | 提取網頁正文並讓 AI 精煉總結成 200-300 字的核心重點。 |
| `!截图 [网址]` | 呼叫 Cloudflare Puppeteer 無頭瀏覽器，直接在群內發送該網頁的截圖。 |
| `!翻译 [语言] [内容]` | 專業翻譯工具，翻譯後會自動補充 1~2 句日常或商務應用例句。 |
| `!会议纪要 [数字]` | 將最近的 `N` 條（預設 50，最多 200）群聊紀錄整理成包含核心主題、共識、待辦事項的專業精華紀要。 |
| `!总结 [数字]` 或 `!吃瓜` | 將最近的 `N` 條（預設 60，最多 100）群聊紀錄，用八卦、輕鬆的語氣進行總結。 |
| `!群规` 或 `!rules` | 查看當前群組的群規。 |

### 🔹 個人記憶與設定 (所有人可用)
| 指令 | 說明 |
| :--- | :--- |
| `!记住 [内容]` | 寫入專屬你的死記憶（一般人上限 100 條），AI 每次遇到你都會想起來。 |
| `!忘记 [内容]` | 透過模糊搜尋，抹除指定的專屬記憶。 |
| `!你记住了什么` | 查看 AI 腦海中所有關於你的專屬記憶清單。 |
| `!set人格 [风格内容]` | 幫自己設定專屬外掛人格（例如：`!set人格 傲娇妹妹`）。 |
| `!del人格` | 刪除自己的專屬人格，恢復預設群友模式。 |
| `!免打扰` | 開啟後，AI 不會再對你主動插話或隨意 `@` 你。 |
| `!取消免打扰` | 恢復正常的 AI 互動模式。 |

### 🔸 群管與開發者專屬指令 (需具備 Admin/Owner/Developer 權限)
| 指令 | 說明 |
| :--- | :--- |
| `!set人格 [@成员] [风格]` | 強制幫某個群友設定專屬人格。 |
| `!del人格 [@成员]` | 清除某個群友的專屬人格。 |
| `!免打扰 [@成员]` | 強制幫某個群友開啟免打擾。 |
| `!取消免打扰 [@成员]` | 強制幫某個群友關閉免打擾。 |
| `!使用 [@成员] 的说话方式` | **靈魂竊取功能**！AI 會去記憶庫撈取該群友的歷史發言，並完美模仿其語調與習慣。 |
| `!取消使用` | 解除模仿狀態。 |
| `!群白名单 [群号]` | 將群組加入白名單（只有白名單內的群組 AI 才會運作）。 |
| `!删群白名单 [群号]` | 將群組移出白名單。 |
| `!黑名单 [@成员]` | 將特定愛搗亂的群友加入黑名單，AI 將完全無視他。 |
| `!解除黑名单 [@成员]` | 解除該群友的黑名單。 |
| `!set群规 [内容]` | 設定或更新本群群規。 |
| `!ai开` / `!ai关` | 一鍵開啟或關閉本群的 AI 回覆功能。 |
| `!记忆开` / `!记忆关` | 一鍵開啟或關閉本群的 Vectorize 自動記憶功能。 |
| `!clear` 或 `!重置` | **緊急按鈕**：物理清空當前群組的短期上下文快取與模仿狀態，重置 AI 大腦。 |

---

## ⚙️ 部署與安裝指南

### 1. 準備 Cloudflare 基礎設施
建立 KV 空間與 Vectorize 索引：
```bash
npx wrangler kv:namespace create "QQ_STORE"
npx wrangler vectorize create qqai --dimensions=1024 --metric=cosine
```

### 2. 設定 `wrangler.jsonc`
請確保你的設定檔與以下一致（請替換 KV 的 `id`）：
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "qqai",
  "main": "worker.js",
  "compatibility_date": "2026-06-24",
  "compatibility_flags": ["nodejs_compat"],
  "browser": { "binding": "MYBROWSER" },
  "ai": { "binding": "AI" },
  "kv_namespaces": [
    {
      "binding": "QQ_STORE",
      "id": "bf716105d0f6412fa97daad4e0f544d2" // 替換為你的 KV ID
    }
  ],
  "vectorize": [
    { "binding": "VECTORIZE", "index_name": "qqai" }
  ],
  "vars": {
    "BACKGROUND_BROWSER_TIMEOUT": "60",
    "DEVELOPER_ID": "3569028262"
  },
  "observability": {
    "logs": { "enabled": false, "invocation_logs": true }
  }
}
```

### 3. 設定 API 金鑰
將你的 Google Gemini API Key 加入環境變數（支援多把金鑰用逗號 `,` 分隔）：
```bash
npx wrangler secret put GEMINI_API_KEYS
```

### 4. 本地安裝與一鍵部署
```bash
bun install
npx wrangler login
npx wrangler deploy worker.js --no-assets
```

---

## 📄 版權與授權條款 (License)

本專案採用 **自訂免費使用但禁止修改條款 (Custom Non-Derivative License)**，由版權所有人 **ray20123315** 制定。

### ⚠️ 核心法律約束：你可以免費使用，但絕對不可以修改原始碼！

```text
Copyright (c) 2026 ray20123315

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, copy, and distribute the Software, subject to the following strict conditions:

1. MODIFICATION IS STRICTLY PROHIBITED. You may not modify, alter, translate, reverse-engineer, or create derivative works of the Software in any way.
2. The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

**📜 條款白話文解讀：**
1. **免費使用與散佈**：你被授權可以免費下載、架設、執行以及原封不動地分享此軟體副本。
2. **嚴格禁止改作（零容忍）**：**你不得以任何形式修改、閹割、新增、翻譯或對本軟體進行反向工程。** 只要你動了程式碼中的任何一行（包括私自改編後發佈），即視為嚴重違反本授權協議，版權所有者 (ray20123315) 保留所有法律追訴權。
3. **免責聲明**：本軟體按「現狀」提供，不附帶任何明示或暗示的保證。
