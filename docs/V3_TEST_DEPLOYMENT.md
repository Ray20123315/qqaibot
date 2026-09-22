# V3 測試部署

這個流程只用來把 `v3-rewrite` 的 V3 功能部署到隔離的 Cloudflare 測試 Worker。它不會使用 production custom domain，也不應綁定 production D1、Durable Objects、Vectorize、Rate Limiter 或其他 production 資源。

## 隔離邊界

- Worker：`qqai-v3test`，只開 `workers.dev` / preview URL。
- D1：`wrangler.v3test.toml` 使用 draft binding `DB`，由 Wrangler 自動 provision 測試資料庫；不要把 production `database_id` 放進這個檔案。
- Cron：測試 config 沒有 `[triggers]`，因此不執行正式排程。
- OneBot / AI / Vectorize / Rate Limiter：測試 config 不綁定，smoke test 不使用這些功能。
- GPT Plugin Security Review：預設關閉。

## GitHub Actions Secrets

到 GitHub repository：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`，建立：

1. `CLOUDFLARE_ACCOUNT_ID`：Cloudflare account ID。
2. `CLOUDFLARE_API_TOKEN`：只允許本測試部署所需權限的 account-owned API token。

第一次執行會建立新的 Worker 與 D1，因此 token 需要能建立這兩種資源。依 Cloudflare 目前 granular permission 模型，建議把 scope 限制在使用的 account，並給：

- Workers：`Admin`（第一次建立 `qqai-v3test` 需要；既有 Worker 後可評估縮成 `Editor`）。
- D1：需要可建立／寫入 D1 的權限；目前 Cloudflare API 對建立 D1 接受 `D1 Write`，granular role 可使用 D1 product `Admin` 完成首次 provision。

不要把 Account ID 或 API Token 寫進 `wrangler.v3test.toml`、README、commit、Issue、Actions log 或其他 repo 檔案。Account ID 雖不是密碼，仍應透過 CI 設定統一管理；API Token 必須視為 Secret。

## 執行

GitHub → `Actions` → `Deploy V3 test Worker` → `Run workflow`。

workflow 會依序：

1. `npm install --ignore-scripts`。
2. `npm run check` 跑完整 regression。
3. 對 `wrangler.v3test.toml` 做 production route / D1 ID 防呆與 Wrangler dry-run。
4. 驗證兩個 Cloudflare CI Secret 存在。
5. 部署 `qqai-v3test`。
6. 對隔離 D1 執行 `tools/v3test-bootstrap.sql`，只建立 smoke test 需要的 `kv_store`。
7. Live smoke-test：`/healthz`、`/plugin-security`、`/api/v3/plugin-security`、`/portal`，並確認 V3 Plugin Manager 的注入標記存在。

## 目前狀態

2026-09-22 已在 task branch 驗證：完整 regression PASS，`wrangler.v3test.toml` dry-run PASS；實際 deploy 尚未執行，因 repository 尚未設定 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。
