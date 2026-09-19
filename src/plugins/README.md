# Self-made Plugin Execution Modes

QQAI 插件執行只允許兩種模式，兩者的信任邊界不同，不可互相降級。

## trusted_bundled

適合自己撰寫或已人工審核、可信任作者的插件。插件必須以原始碼加入 `src/plugins/bundled/`，在 `index.js` 明確 import/register，通過 `verify-plugin-execution-modes.mjs` 與完整 regression 後，隨 QQAI Worker bundle 重新部署。

這是 build-time trust decision。因為插件已進入同一 Worker bundle，所以不能把它當成不受信任程式碼；review、來源、Hash、測試與部署紀錄才是主要防線。

Manifest 最小格式：

```js
export const manifest = {
  id: "example.plugin",
  name: "Example Plugin",
  version: "1.0.0",
  mode: "trusted_bundled",
  events: ["message.created"]
};

export async function handler(payload, context) {
  return { handled: false, actions: [] };
}
```

## sandboxed_external

適合 Marketplace／其他使用者提供的陌生 JavaScript 插件。QQAI Core 不使用 `eval`、`new Function` 或 `node:vm` 執行插件；程式碼交給 Cloudflare Dynamic Workers 的 `PLUGIN_LOADER` 建立獨立 isolate。

安全預設：

- `globalOutbound: null`：外部插件不能直接 `fetch()` 或 `connect()` 上網。
- 不把 `DB`、`AI`、`ONEBOT_HUB`、Vectorize、Rate Limiter、Secrets 或完整 `env` 傳給 sandbox。
- sandbox `env` 只有非敏感的 `QQAI_PLUGIN` metadata。
- CPU 與 subrequest 另設低於帳號上限的 custom limits。
- sandbox 回傳值一律視為 untrusted data；目前只接受 `reply`、`log`、`metric` 三種受限 action。
- `reply` 固定只能回到觸發該插件的 same-event scope，不能自行指定 QQ／群組目標。
- 未來若要增加能力，必須由 Core 增加顯式 host capability；不得直接把 Core binding 暴露給插件。

External plugin 最小格式：

```js
export async function onEvent(payload, context) {
  return {
    handled: true,
    actions: [{ type: "reply", text: "hello" }]
  };
}
```

## Cloudflare requirement

Dynamic Workers 目前只提供 Workers Paid plan。部署者要啟用 external sandbox 時，必須在 Wrangler 設定加入：

```toml
[[worker_loaders]]
binding = "PLUGIN_LOADER"
```

若沒有這個 binding，`sandboxed_external` 會回傳 `PLUGIN_SANDBOX_UNAVAILABLE`，不會自動退回同程序執行。
