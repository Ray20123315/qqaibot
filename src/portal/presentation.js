import { brandLogoMarkup } from "./brand.js";

function replaceLegacyBrandMarks(html, surface = "surface") {
  let index = 0;
  return String(html || "")
    .replace(/<span class="brand-mark"[^>]*><i><\/i><i><\/i><\/span>/g, () =>
      brandLogoMarkup({ className: "qqai-brand-logo", idPrefix: surface + "-brand-" + (++index) })
    )
    .replace(/<div class="logo">AI<\/div>/g, () =>
      brandLogoMarkup({ className: "qqai-brand-logo", idPrefix: surface + "-logo-" + (++index) })
    );
}

function publicLandingMainMarkup() {
  const heroLogo = brandLogoMarkup({ className: "public-hero-logo", idPrefix: "public-hero" });
  return `<main class="public-main">
<section class="public-hero">
  <div class="public-hero-copy">
    <div class="public-product-mark">${heroLogo}<span>AI CONTROL CENTER</span></div>
    <h1 data-i18n="public.hero.title">保持核心簡單，把需要的能力裝成插件。</h1>
    <p data-i18n="public.hero.summary">安全帳密、權限與插件執行留在核心；其他能力按需啟用。</p>
    <div class="hero-actions">
      <a class="btn primary" href="/login" data-i18n="public.hero.start">登入控制中心</a>
      <a class="btn ghost" href="/register" data-i18n="public.hero.activate">首次啟用</a>
    </div>
    <div class="public-trust-row">
      <span>Authentication</span><span>Server-side ACL</span><span>Plugin-first</span><span>BYOR</span>
    </div>
  </div>
  <div class="public-architecture" aria-label="Core and plugin architecture">
    <div class="architecture-core">
      <div class="architecture-label">CORE</div>
      <article><b>Identity</b><span>Account · Password · 2FA</span></article>
      <article><b>Authority</b><span>Server-side role & permission</span></article>
      <article><b>Plugin Runtime</b><span>Registry · State · Execution</span></article>
    </div>
    <div class="architecture-plugin-cloud">
      <div class="architecture-label">PLUGINS</div>
      <span>Community</span><span>Moderation</span><span>Automation</span><span>AI Knowledge</span><span>Models</span><span>Integrations</span><span>Developer Tools</span>
    </div>
  </div>
</section>

<section class="public-section" id="features">
  <div class="public-section-head">
    <div><span class="eyebrow">MINIMAL CORE</span><h2>核心只做必要的事</h2></div>
    <p>產品能力預設關閉，需要時從插件中心啟用；核心不再把所有功能塞進同一個後台。</p>
  </div>
  <div class="public-core-grid">
    <article><span>01</span><h3>登入與帳號安全</h3><p>密碼、2FA、復原與安全 Session 留在核心。</p></article>
    <article><span>02</span><h3>權限判定</h3><p>角色與 Developer / Root 身份始終由伺服器判定。</p></article>
    <article><span>03</span><h3>插件生命週期</h3><p>功能插件預設關閉，由插件中心啟用、停用與開啟。</p></article>
  </div>
</section>

<section class="public-section">
  <div class="public-section-head">
    <div><span class="eyebrow">PLUGIN-FIRST</span><h2>需要什麼，再裝什麼</h2></div>
    <p>社群、審核、自動化、模型、知識與診斷等能力不再是第一級核心功能。</p>
  </div>
  <div class="public-plugin-preview">
    <article><b>◎</b><span>Community</span></article>
    <article><b>盾</b><span>Moderation</span></article>
    <article><b>⚡</b><span>Automation</span></article>
    <article><b>◇</b><span>AI Knowledge</span></article>
    <article><b>AI</b><span>Models</span></article>
    <article><b>＋</b><span>Integrations</span></article>
    <article><b>&lt;/&gt;</b><span>Developer Tools</span></article>
  </div>
</section>

<section class="public-cta">
  <div><span class="eyebrow">AIBOT.RAY2025.COM</span><h2>從一個乾淨的核心開始。</h2><p>登入後只看到首頁、插件與帳號設定；其餘能力按需啟用。</p></div>
  <div class="hero-actions"><a class="btn primary" href="/login" data-i18n="public.hero.start">登入控制中心</a><a class="btn ghost" href="/register" data-i18n="public.hero.activate">首次啟用</a></div>
</section>
</main>`;
}

function publicPresentationClientScript() {
  return `<script id="qqai-public-presentation-client">(function(){var root=document.documentElement;function theme(){try{return localStorage.getItem('qqai_theme')==='dark'?'dark':'light'}catch(e){return'light'}}function label(){var b=document.getElementById('publicThemeToggle');if(!b)return;b.textContent=root.dataset.theme==='dark'?'☀':'◐';b.setAttribute('aria-label',root.dataset.theme==='dark'?'Use light theme':'Use dark theme')}root.dataset.theme=theme();var b=document.getElementById('publicThemeToggle');if(b)b.onclick=function(){var next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;try{localStorage.setItem('qqai_theme',next)}catch(e){}label()};label()})();<\/script>`;
}

function publicPresentationStyles() {
  return `
<style id="qqai-public-redesign-v1">
:root{color-scheme:light;--public-bg:#f6f8fc;--public-panel:#fff;--public-panel2:#eef3fa;--public-text:#111a2c;--public-muted:#65728a;--public-line:#dce4ef;--public-accent:#3a6ff8;--public-accent2:#815cf7;--public-shadow:0 24px 70px rgba(24,43,84,.10)}
:root[data-theme="dark"]{color-scheme:dark;--public-bg:#070a12;--public-panel:#0e1420;--public-panel2:#151e2c;--public-text:#f1f5fb;--public-muted:#95a4ba;--public-line:#273449;--public-accent:#65a7ff;--public-accent2:#9b7bff;--public-shadow:0 28px 80px rgba(0,0,0,.34)}
body{background:var(--public-bg)!important;color:var(--public-text)!important}.cyber-skyline,.edge-motto{display:none!important}.shell{width:min(1320px,calc(100% - 40px))!important}.top{border-bottom:1px solid var(--public-line)!important}.top:after{display:none!important}
.brand{color:var(--public-text)!important}.brand-copy small,.nav a{color:var(--public-muted)!important}.nav a:hover,.nav a.active{color:var(--public-text)!important;background:var(--public-panel2)!important}.nav .nav-cta{background:linear-gradient(115deg,var(--public-accent),var(--public-accent2))!important;color:#fff!important;box-shadow:none!important}
.qqai-brand-logo{width:44px;height:44px;display:block;flex:0 0 auto}.public-hero-logo{width:72px;height:72px}.public-main{padding:48px 0 0}.public-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,.86fr);gap:54px;align-items:center;min-height:600px;padding:46px 0 72px}.public-product-mark{display:flex;align-items:center;gap:14px;color:var(--public-accent);font-size:11px;font-weight:900;letter-spacing:.18em}.public-hero h1{margin:22px 0 20px;font-size:clamp(48px,6.4vw,88px);line-height:.98;letter-spacing:-.065em;max-width:780px}.public-hero p{color:var(--public-muted);font-size:17px;line-height:1.8;max-width:700px}.public-trust-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.public-trust-row span{border:1px solid var(--public-line);background:var(--public-panel);border-radius:999px;padding:7px 10px;color:var(--public-muted);font-size:10px;font-weight:800}
.public-architecture{border:1px solid var(--public-line);border-radius:28px;padding:18px;background:var(--public-panel);box-shadow:var(--public-shadow);display:grid;gap:14px}.architecture-label{font-size:9px;letter-spacing:.18em;color:var(--public-muted);font-weight:900}.architecture-core{border:1px solid color-mix(in srgb,var(--public-accent) 35%,var(--public-line));border-radius:20px;padding:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--public-accent) 9%,var(--public-panel)),var(--public-panel))}.architecture-core article{padding:15px 0;border-bottom:1px solid var(--public-line)}.architecture-core article:last-child{border-bottom:0}.architecture-core b{display:block}.architecture-core span{display:block;color:var(--public-muted);font-size:11px;margin-top:4px}.architecture-plugin-cloud{border:1px solid var(--public-line);border-radius:20px;padding:18px;display:flex;flex-wrap:wrap;gap:8px;background:var(--public-panel2)}.architecture-plugin-cloud .architecture-label{width:100%}.architecture-plugin-cloud span{padding:9px 11px;border:1px solid var(--public-line);border-radius:11px;background:var(--public-panel);font-size:11px;font-weight:760}
.public-section{padding:70px 0;border-top:1px solid var(--public-line)}.public-section-head{display:flex;justify-content:space-between;gap:28px;align-items:end;margin-bottom:24px}.public-section-head h2,.public-cta h2{margin:6px 0 0;font-size:clamp(28px,4vw,48px);letter-spacing:-.045em}.public-section-head p{max-width:520px;color:var(--public-muted);text-align:right;line-height:1.7}.eyebrow{font-size:10px;letter-spacing:.18em;color:var(--public-accent);font-weight:900}.public-core-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.public-core-grid article{padding:24px;border:1px solid var(--public-line);border-radius:18px;background:var(--public-panel)}.public-core-grid article>span{color:var(--public-accent);font-size:11px;font-weight:900}.public-core-grid h3{margin:18px 0 8px;font-size:18px}.public-core-grid p{margin:0;color:var(--public-muted);font-size:13px;line-height:1.65}.public-plugin-preview{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}.public-plugin-preview article{min-height:126px;border:1px solid var(--public-line);background:var(--public-panel);border-radius:16px;padding:16px;display:flex;flex-direction:column;justify-content:space-between}.public-plugin-preview b{font-size:20px;color:var(--public-accent)}.public-plugin-preview span{font-size:11px;font-weight:800}.public-cta{margin:30px 0 70px;padding:32px;border:1px solid var(--public-line);border-radius:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--public-accent) 9%,var(--public-panel)),color-mix(in srgb,var(--public-accent2) 8%,var(--public-panel)));display:flex;align-items:center;justify-content:space-between;gap:22px}.public-cta p{color:var(--public-muted)}
.public-locale,.public-theme-toggle{height:42px;border:1px solid var(--public-line);border-radius:10px;background:var(--public-panel);color:var(--public-text);padding:0 10px}.public-theme-toggle{cursor:pointer;font-weight:800}.footer{border-top:1px solid var(--public-line)!important;color:var(--public-muted)!important}
.auth-visual,.auth-card{background:var(--public-panel)!important;border-color:var(--public-line)!important;box-shadow:var(--public-shadow)!important}.auth-visual:before,.auth-visual:after{opacity:.12!important}.auth-copy p,.auth-card>p,.auth-point,.notice,.small,.muted{color:var(--public-muted)!important}.auth-point,details,.notice{background:var(--public-panel2)!important;border-color:var(--public-line)!important}.field label,summary{color:var(--public-muted)!important}.field input,.field select,.field textarea{background:var(--public-panel)!important;border-color:var(--public-line)!important;color:var(--public-text)!important}.btn{background:var(--public-panel2)!important;border-color:var(--public-line)!important;color:var(--public-text)!important;box-shadow:none!important}.btn.primary{background:linear-gradient(115deg,var(--public-accent),var(--public-accent2))!important;color:#fff!important}.btn.ghost{background:transparent!important}
@media(max-width:980px){.public-hero{grid-template-columns:1fr;min-height:auto}.public-architecture{max-width:720px}.public-plugin-preview{grid-template-columns:repeat(4,1fr)}}@media(max-width:700px){.shell{width:min(100% - 22px,1320px)!important}.public-main{padding-top:16px}.public-hero{padding:30px 0 50px;gap:28px}.public-hero h1{font-size:44px}.public-section-head,.public-cta{display:block}.public-section-head p{text-align:left}.public-core-grid{grid-template-columns:1fr}.public-plugin-preview{grid-template-columns:repeat(2,1fr)}.public-cta .hero-actions{margin-top:20px}.public-locale{max-width:130px}}
</style>`;
}

export { publicLandingMainMarkup, publicPresentationClientScript, publicPresentationStyles, replaceLegacyBrandMarks };
