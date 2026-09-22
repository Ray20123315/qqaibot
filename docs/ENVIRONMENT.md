# Environment / Binding Reference

本文件是 **目前 source 實際讀取** 的 Cloudflare bindings、公開 Worker 變數與 Secrets 對照表。  
原則：公開設定放 `wrangler.toml [vars]`；憑證、密碼、Token、API Key 一律用 Cloudflare Secret；不要把真實值提交到 Git。

> Developer Portal 帳號仍遵守「第一次必須 QQID 驗證」：`PORTAL_DEVELOPER_USERNAME` / `PORTAL_DEVELOPER_INITIAL_PASSWORD` 只鎖定第一次啟用要建立的帳密，不能繞過 QQID 六位驗證碼。

## 1. Cloudflare bindings

| 名稱 | 類型 | 現況 | 用途 |
| --- | --- | --- | --- |
| `DB` | D1 | 必要 | Portal 帳號、Session、設定、對話、稽核、索引與各類持久資料。 |
| `ONEBOT_HUB` | Durable Object | 必要 | OneBot WebSocket、RPC、事件佇列與連線狀態。 |
| `AI` | Workers AI | 建議 | Workers AI / embedding 等 Cloudflare AI 路徑。 |
| `VECTORIZE` | Vectorize | 記憶功能需要 | 長期語意記憶與向量查詢。 |
| `PLUGIN_LOADER` | Worker Loader | 可選 / Paid | Marketplace/外部插件的 Dynamic Workers 隔離執行；未綁定時 fail closed。 |
| `MY_RATE_LIMITER` | Rate Limiter | 設定檔存在 | Wrangler 已建立 binding；目前核心 source 沒有直接呼叫此 binding，主要 runtime rate-limit 仍有自己的保護。 |
| `QQAI_PLUGIN` | Dynamic Worker internal env | **不要手動設定** | 只由外部插件 sandbox wrapper 注入插件 id/version/mode。 |

### 目前沒有正式 source binding 的資源

`KV`、`R2` **目前不是 production source 直接讀取的 binding**。它們可出現在 BYOR / 未來接入設計中，但新部署不要因首頁預覽就誤以為現在一定要建立。若日後程式真正加入 `KV` / `R2` binding，env contract verifier 也必須同步更新。

## 2. 開發者身份與 Portal 首次帳密

| 名稱 | 類型 | 必要性 | 說明 |
| --- | --- | --- | --- |
| `DEVELOPER_IDS` | public var | 必要 | 逗號/分號/換行分隔的最高開發者 QQID 清單。 |
| `ROOT_QQ_IDS` | public var | 可選 | 額外 Root QQID，與 `DEVELOPER_IDS` 合併。 |
| `DEVELOPER_ID` | public var | legacy | 單一開發者 QQID 相容欄位。 |
| `PORTAL_DEVELOPER_USERNAME` | public var | 可選但建議開發者設定 | 鎖定開發者**第一次 QQID 驗證啟用**時建立的 username；不會直接登入。 |
| `PORTAL_DEVELOPER_INITIAL_PASSWORD` | **Secret** | 與上項搭配可選 | 鎖定開發者第一次啟用時輸入的初始密碼。QQID 驗證成功後才比較；啟用後 D1 的 PBKDF2 hash 變成唯一登入依據。 |

建議設定：

```bash
# wrangler.toml [vars]
DEVELOPER_IDS = "你的QQID"
PORTAL_DEVELOPER_USERNAME = "你的登入帳號"

# Secret：不要寫進 wrangler.toml
npx wrangler secret put PORTAL_DEVELOPER_INITIAL_PASSWORD
```

第一次仍走 `/register`：QQID → 六位驗證碼 → 輸入上述 username/password → 建立 D1 帳號。之後走 `/login`。  
**修改 `PORTAL_DEVELOPER_INITIAL_PASSWORD` 不會修改已啟用帳號密碼**；要改密碼請走復原流程。

## 3. 公開 Worker vars（source 目前有讀取）

### 公開網址 / 顯示

- `PUBLIC_BASE_URL`：Portal/help/live 對外基底網址。
- `BOT_DISPLAY_NAME`：Bot 顯示名稱。

### 部署通知

- `DEPLOY_NOTIFY_WORKER_NAME`
- `DEPLOY_NOTIFY_BRANCH`
- `DEPLOY_NOTIFY_DEVELOPER_IDS`
- `DEPLOY_NOTIFY_DEVELOPER_ID`
- `DEPLOY_NOTIFY_SELF_GRACE_SECONDS`

`DEPLOY_NOTIFY_START_COOLDOWN_SECONDS` 仍留在現有設定檔作相容/預留，但 **目前 source 沒有直接讀取**，不要以為改它一定會改 runtime 行為。

### OneBot / 自動化安全

- `ENABLE_ONEBOT_HTTP_EVENTS`：HTTP event ingress；正常維持 `false`。
- `QQAI_PUBLIC_INTERNAL_FALLBACK`：direct loopback 失敗後的 public loopback 緊急開關；正常維持 `false`。
- `AUTO_CHECKIN_ENABLED`
- `AUTO_CHECKIN_RETRY_INTERVAL_MS`
- `AUTO_CHECKIN_CONCURRENCY`

### 模型 / 路由 / 成本（source 目前有讀取）

- `GEMINI_CHAT_MODELS`
- `GEMINI_DECISION_MODELS`
- `GEMINI_SEARCH_MODELS`
- `GEMINI_VISION_MODELS`
- `GEMINI_TTS_MODELS`
- `GEMINI_LIVE_MODEL`
- `GEMMA_CHAT_MODELS`
- `GEMMA_DECISION_MODELS`
- `GEMMA_LAST_RESORT_MODELS`
- `DEEPSEEK_FLASH_MODEL`
- `DEEPSEEK_DAILY_BUDGET_CNY`
- `DEEPSEEK_EMERGENCY_FALLBACK`
- `MODEL_COST_POLICY`
- `IMAGE_INSPECTION_ENABLED`

以下名稱仍在舊設定/文件中，但目前 source 不直接讀取：`DEEPSEEK_PRO_MODEL`、`GEMINI_IMAGE_MODELS`、`IMAGEN_MODELS`。保留它們是為了部署相容與未來功能，不應把它們當成目前已生效的路由開關。

## 4. Secrets / 敏感值（source 目前有讀取）

### Google / Gemini / Gemma

- `GEMINI_API_KEYS`
- `VECTORIZE_GEMINI_KEYS`
- `GEMINI_CHAT_API_KEYS`
- `GEMINI_DECISION_API_KEYS`
- `GEMMA_CHAT_API_KEYS`
- `GEMMA_DECISION_API_KEYS`
- `GEMINI_SEARCH_API_KEYS`
- `GEMINI_SEARCH_API_KEY`（legacy singular）
- `GEMINI_VISION_API_KEYS`
- `GEMINI_VISION_API_KEY`（legacy singular）
- `IMAGE_CHECK_API_KEYS`（legacy alias）
- `IMAGE_CHECK_API_KEY`（legacy singular alias）

### DeepSeek

- `DEEPSEEK_API_KEYS`
- `DEEPSEEK_API_KEY`（legacy singular）

### OneBot / NapCat

- `ONEBOT_ACCESS_TOKEN`
- `ONEBOT_HTTP_ACCESS_TOKEN`：HTTP action fallback 專用，現在會優先於共用 token。
- `ONEBOT_HTTP_ACTION_URL`
- `ONEBOT_HTTP_URL`
- `NAPCAT_HTTP_URL`
- `NAPCAT_ACCESS_TOKEN`（alias）
- `ONEBOT_TOKEN`（legacy alias）

URL 如果內含 credential/query secret，也要當 Secret 管理。

### Portal / 2FA

- `PORTAL_AUTH_SECRET`：Portal 一般敏感資料加密 fallback。
- `TOTP_ENCRYPTION_KEY`：**TOTP seed 的優先加密 key**；建議獨立設定，不與 OneBot token 共用。
- `PORTAL_DEVELOPER_INITIAL_PASSWORD`：只用於開發者第一次驗證啟用的帳密約束，不作日常明文密碼儲存。

### Cloudflare build detail

- `CLOUDFLARE_BUILDS_API_TOKEN`：可選，取得 build 詳細資料。

## 5. 建議的 production secrets 指令

至少：

```bash
npx wrangler secret put GEMINI_API_KEYS
npx wrangler secret put ONEBOT_ACCESS_TOKEN
npx wrangler secret put PORTAL_AUTH_SECRET
npx wrangler secret put TOTP_ENCRYPTION_KEY
```

若使用固定開發者初始帳密：

```bash
npx wrangler secret put PORTAL_DEVELOPER_INITIAL_PASSWORD
```

依功能再加：

```bash
npx wrangler secret put GEMINI_SEARCH_API_KEYS
npx wrangler secret put GEMINI_VISION_API_KEYS
npx wrangler secret put DEEPSEEK_API_KEYS
npx wrangler secret put ONEBOT_HTTP_ACCESS_TOKEN
npx wrangler secret put CLOUDFLARE_BUILDS_API_TOKEN
```

## 6. 不要做的事

- 不要把 API Key、Token、初始密碼放入 `wrangler.toml [vars]`。
- 不要在 GitHub Issue、commit message、Portal log 或 Ray_Chen memory 寫真實 Secret。
- 不要把 `DEVELOPER_IDS` 開放給一般 Portal 使用者修改。
- 不要為了讓首頁「顯示已連接」而建立其實程式沒用到的 KV/R2；UI 預覽必須標示真實/預留狀態。
