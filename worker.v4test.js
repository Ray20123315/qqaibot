import { QqOpenGateway, getQqOpenGateway } from "./src/v4/qqopen/runtime.js";

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

async function gatewayStatus(env) {
  if (!env?.QQ_OPEN_GATEWAY) return { ok: false, error: "QQ_OPEN_GATEWAY_NOT_BOUND" };
  const response = await getQqOpenGateway(env).fetch("https://qq-open-gateway/api/v4/qqopen/status");
  return response.json().catch(() => ({ ok: false, error: "STATUS_PARSE_FAILED" }));
}

async function ensureGateway(env) {
  if (!env?.QQ_OPEN_GATEWAY) return { ok: false, error: "QQ_OPEN_GATEWAY_NOT_BOUND" };
  const response = await getQqOpenGateway(env).fetch("https://qq-open-gateway/api/v4/qqopen/ensure", { method: "POST" });
  return response.json().catch(() => ({ ok: false, error: "ENSURE_PARSE_FAILED" }));
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAIBOT V4 Test</title>
<style>
:root{color-scheme:dark;--bg:#05070d;--panel:rgba(14,19,33,.76);--line:rgba(145,156,225,.17);--text:#f2f5ff;--muted:#98a5bb;--ok:#45e3aa;--warn:#ffc566;--bad:#ff657d}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--text);background:radial-gradient(circle at 18% 14%,rgba(108,82,255,.24),transparent 34%),radial-gradient(circle at 82% 20%,rgba(52,211,255,.15),transparent 30%),var(--bg);overflow-x:hidden}
body:before{content:"";position:fixed;inset:-20%;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.19) 0 1px,transparent 1.5px);background-size:42px 42px;opacity:.38;animation:stars 28s linear infinite}@keyframes stars{to{transform:translate3d(90px,64px,0)}}main{width:min(1100px,calc(100% - 32px));margin:0 auto;padding:46px 0 70px;position:relative}.hero{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,rgba(17,22,39,.88),rgba(7,10,18,.8));padding:30px;box-shadow:0 34px 120px rgba(0,0,0,.38);backdrop-filter:blur(20px)}.hero:after{content:"";position:absolute;width:300px;height:300px;right:-90px;top:-110px;border-radius:50%;background:conic-gradient(from 45deg,#7865ff,#44d4ff,#d455ff,#7865ff);filter:blur(8px);opacity:.55;animation:spin 10s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.hero>*{position:relative;z-index:2}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.18em;color:#a8b0ff}.hero h1{font-size:clamp(34px,7vw,72px);line-height:.95;letter-spacing:-.06em;margin:14px 0}.hero p{max-width:700px;color:var(--muted);line-height:1.7}.status{display:inline-flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.04);font-weight:800}.dot{width:10px;height:10px;border-radius:50%;background:#6c768b}.dot.ok{background:var(--ok);box-shadow:0 0 20px rgba(69,227,170,.8);animation:pulse 1.7s infinite}.dot.warn{background:var(--warn)}.dot.bad{background:var(--bad)}@keyframes pulse{50%{box-shadow:0 0 0 10px rgba(69,227,170,0)}}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}.card{border:1px solid var(--line);border-radius:20px;background:var(--panel);padding:18px;backdrop-filter:blur(18px);transition:.2s ease}.card:hover{transform:translateY(-3px);border-color:rgba(145,130,255,.35)}.label{font-size:12px;color:var(--muted)}.big{font-size:27px;font-weight:900;margin-top:5px}.console{margin-top:16px;border:1px solid var(--line);border-radius:18px;background:rgba(2,4,9,.68);padding:16px;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word;min-height:170px}.hint{margin-top:16px;color:var(--muted);font-size:13px;line-height:1.7}.hint code{color:#c9ceff}.secret{color:#ffca72;font-weight:800}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{padding:22px}.hero:after{opacity:.25}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="eyebrow">QQAIBOT / ISOLATED V4 TEST</div>
    <h1>QQ Open<br>連線測試台</h1>
    <p>這是獨立的 <b>qqai-v4test</b> Worker。沒有正式網域、沒有 D1、沒有 OneBot，也不會讀寫正式 QQAIBOT 資料。</p>
    <div class="status"><i id="dot" class="dot"></i><span id="state">讀取中...</span></div>
  </section>
  <section class="grid">
    <div class="card"><div class="label">Gateway</div><div id="gateway" class="big">—</div></div>
    <div class="card"><div class="label">Last Event</div><div id="event" class="big" style="font-size:18px">—</div></div>
    <div class="card"><div class="label">Reconnect</div><div id="reconnect" class="big">0</div></div>
  </section>
  <div id="console" class="console">Loading...</div>
  <div class="hint">
    只需要在 <b>qqai-v4test</b> 設定 <span class="secret">QQ_OPEN_CLIENT_SECRET</span> Secret。AppID 與 Intent 已固定在測試設定。<br>
    READY 後測試：單聊 <code>!qqping</code>；群聊 <code>@机器人 !qqping</code>；回音 <code>!qqecho hello</code>。
  </div>
</main>
<script>
async function refresh(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'}),j=await r.json(),g=j.gateway||{};
    const state=g.ready?'READY':g.connected?'CONNECTED':g.connecting?'CONNECTING':'OFFLINE';
    document.getElementById('state').textContent='QQ Open '+state;
    document.getElementById('gateway').textContent=state;
    document.getElementById('event').textContent=g.lastEventType||'—';
    document.getElementById('reconnect').textContent=String(g.reconnectCount||0);
    document.getElementById('dot').className='dot '+(g.ready?'ok':g.connected||g.connecting?'warn':'bad');
    document.getElementById('console').textContent=JSON.stringify(j,null,2);
  }catch(e){document.getElementById('state').textContent='STATUS ERROR';document.getElementById('dot').className='dot bad';document.getElementById('console').textContent=String(e)}
}
refresh();setInterval(refresh,3000);
</script>
</body>
</html>`;
}

const TestWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      const gateway = await gatewayStatus(env).catch(error => ({ ok:false, error:String(error?.message || error) }));
      return json({ ok:true, worker:"qqai-v4test", isolated:true, gateway });
    }
    if (url.pathname === "/api/status") {
      const gateway = await gatewayStatus(env).catch(error => ({ ok:false, error:String(error?.message || error) }));
      return json({
        ok:true,
        worker:"qqai-v4test",
        isolated:true,
        productionResources:false,
        configured:Boolean(gateway?.configured),
        enabled:Boolean(gateway?.enabled),
        gateway
      });
    }
    if (url.pathname === "/api/ensure" && request.method === "POST") {
      const result = await ensureGateway(env).catch(error => ({ ok:false, error:String(error?.message || error) }));
      return json(result, result?.ok === false ? 503 : 200);
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(dashboardHtml(), { headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"} });
    }
    return new Response("Not found", { status:404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(ensureGateway(env).catch(() => null));
  }
};

export default TestWorker;
export { QqOpenGateway };
