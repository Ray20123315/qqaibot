import { rayAiExperienceScript, rayAiExperienceStyle } from "./experience-v6.js";

function brandLogoSvg(className = "qqai-brand-logo", title = "RAY AI") {
  const safeClass = String(className || "qqai-brand-logo").replace(/[^a-zA-Z0-9 _-]/g, "");
  const safeTitle = String(title || "RAY AI").replace(/[<>&]/g, "");
  return `<svg class="${safeClass}" viewBox="0 0 72 72" role="img" aria-label="${safeTitle}">
    <defs>
      <linearGradient id="qqai-brand-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38efff"/><stop offset=".52" stop-color="#3f7cff"/><stop offset="1" stop-color="#8f5cff"/></linearGradient>
      <linearGradient id="qqai-brand-violet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d8dff"/><stop offset=".55" stop-color="#a15cff"/><stop offset="1" stop-color="#e05cff"/></linearGradient>
      <filter id="ray-logo-glow"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle class="ray-logo-ring" cx="36" cy="36" r="31" fill="rgba(4,13,32,.92)" stroke="url(#qqai-brand-cyan)" stroke-width="2.2"/>
    <circle cx="36" cy="36" r="27" fill="none" stroke="rgba(90,213,255,.20)" stroke-width="1"/>
    <path class="ray-logo-r" d="M20 51l9.2-31h15.1c8.5 0 12.9 3.8 11.1 10.2-1.2 4.3-4.8 7.2-10.2 8.3L52 51H40.9l-6.2-11.4h-3L28.3 51H20zm14.3-20h7.3c2.7 0 4.4-1.1 4.9-3 .5-1.9-.8-2.8-3.7-2.8h-6.9L34.3 31z" fill="url(#qqai-brand-cyan)" filter="url(#ray-logo-glow)"/>
    <path d="M30.2 40.1h10.2L49.7 51H38.8z" fill="url(#qqai-brand-violet)" opacity=".95"/>
    <circle cx="57" cy="16" r="2.6" fill="#45efff"/><circle cx="57" cy="16" r="5.8" fill="none" stroke="rgba(69,239,255,.24)"/>
  </svg>`;
}

function brandLockupMarkup({
  href = "/",
  className = "brand brand-lockup",
  subtitle = "AI · PLUGINS · BYOR",
  compact = false
} = {}) {
  const tag = href ? "a" : "div";
  const hrefAttr = href ? ` href="${href}"` : "";
  return `<${tag} class="${className}${compact ? " compact" : ""}"${hrefAttr}>
    ${brandLogoSvg("qqai-brand-logo")}
    <span class="brand-copy" data-product="AI Control Center" data-architecture="${subtitle}"><b>RAY AI</b><small>QQ AI BOT</small><span class="sr-only">AI Control Center · ${subtitle}</span></span>
  </${tag}>`;
}


function brandPublicStyleBase() {
  return `<style id="qqai-brand-public-v4">
.qqai-brand-logo{width:44px;height:44px;display:block;flex:0 0 auto;filter:drop-shadow(0 0 20px rgba(47,174,255,.20))}
.brand-lockup{display:flex!important;align-items:center!important;gap:12px!important;text-decoration:none!important}
.brand-lockup .brand-copy{display:grid!important;gap:2px!important}.brand-lockup .brand-copy b{font-size:17px!important;letter-spacing:-.02em!important}.brand-lockup .brand-copy small{font-size:9px!important;letter-spacing:.17em!important;font-weight:850!important}.auth-brand-hero{margin:0 0 18px}.auth-brand-logo{width:72px;height:72px}
.public-theme-toggle{width:40px;height:40px;border-radius:11px;border:1px solid var(--line)!important;background:var(--surface-soft)!important;color:var(--text)!important;cursor:pointer;font-weight:900}
.public-home-v4{display:grid;gap:18px;padding:58px 0 68px}
.public-v4-hero{display:grid;grid-template-columns:minmax(0,.92fr) minmax(440px,1.08fr);gap:34px;align-items:stretch}
.public-v4-copy,.public-v4-system{border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,var(--surface),var(--surface-strong));box-shadow:var(--shadow);position:relative;overflow:hidden}
.public-v4-copy{padding:46px}.public-v4-copy:after{content:"";position:absolute;width:340px;height:340px;border-radius:50%;right:-180px;bottom:-190px;background:radial-gradient(circle,rgba(50,219,255,.24),rgba(77,100,255,.10) 42%,transparent 70%)}
.public-v4-eyebrow{font-size:10px;font-weight:900;letter-spacing:.19em;color:var(--cyan);text-transform:uppercase}.public-v4-copy h1{font-size:clamp(42px,5.2vw,76px);line-height:1.02;letter-spacing:-.058em;margin:12px 0 18px;max-width:800px}.public-v4-copy>p{max-width:690px;color:var(--muted);font-size:15px;line-height:1.85;margin:0 0 27px}
.public-v4-points{display:flex;gap:8px;flex-wrap:wrap;margin-top:26px}.public-v4-pill{font-size:10px;font-weight:800;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--surface-soft)}
.public-v4-system{padding:24px;display:grid;grid-template-rows:auto 1fr auto;min-height:470px}.public-v4-system-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--line)}.public-v4-system-brand{display:flex;align-items:center;gap:12px}.public-v4-system-brand .qqai-brand-logo{width:58px;height:58px}.public-v4-system-brand b{display:block;font-size:15px}.public-v4-system-brand small{display:block;color:var(--muted);font-size:10px;margin-top:3px}.public-v4-live{font-size:9px;color:var(--green);border:1px solid color-mix(in srgb,var(--green) 35%,var(--line));padding:6px 9px;border-radius:999px}
.public-v4-map{display:grid;align-content:center;gap:13px;padding:22px 0}.public-v4-core{border:1px solid color-mix(in srgb,var(--cyan) 38%,var(--line));border-radius:17px;padding:17px;background:linear-gradient(135deg,color-mix(in srgb,var(--cyan) 8%,var(--surface-soft)),var(--surface-soft))}.public-v4-core small{display:block;color:var(--cyan);font-size:9px;letter-spacing:.14em;font-weight:900}.public-v4-core b{display:block;font-size:18px;margin:5px 0}.public-v4-core p{margin:0;color:var(--muted);font-size:11px;line-height:1.55}
.public-v4-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.public-v4-node{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--surface-soft);min-height:84px}.public-v4-node span{display:block;font-size:9px;color:var(--faint);letter-spacing:.09em}.public-v4-node b{display:block;font-size:12px;margin:5px 0}.public-v4-node small{color:var(--muted);font-size:9px}
.public-v4-note{font-size:10px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
.public-v4-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.public-v4-card{border:1px solid var(--line);border-radius:19px;padding:22px;background:var(--surface);min-height:210px}.public-v4-card-kicker{font-size:9px;letter-spacing:.15em;font-weight:900;color:var(--cyan)}.public-v4-card h2{font-size:22px;margin:8px 0 10px;letter-spacing:-.03em}.public-v4-card p{font-size:12px;color:var(--muted);line-height:1.72;margin:0}.public-v4-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:18px}.public-v4-tags span{border:1px solid var(--line);background:var(--surface-soft);border-radius:999px;padding:5px 8px;color:var(--muted);font-size:9px}
.public-v4-plugins{border:1px solid var(--line);border-radius:22px;padding:26px;background:var(--surface)}.public-v4-section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:17px}.public-v4-section-head h2{margin:4px 0 0;font-size:28px}.public-v4-section-head p{max-width:520px;text-align:right;margin:0;color:var(--muted);font-size:11px}.public-v4-plugin-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.public-v4-plugin{border:1px solid var(--line);border-radius:13px;background:var(--surface-soft);padding:13px;min-height:105px}.public-v4-plugin b{display:block;font-size:11px}.public-v4-plugin span{display:block;color:var(--muted);font-size:9px;margin-top:6px;line-height:1.45}.public-v4-plugin em{display:inline-block;font-style:normal;font-size:8px;color:var(--faint);margin-top:9px}
.public-v4-cta{display:flex;align-items:center;justify-content:space-between;gap:24px;border:1px solid var(--line-strong);border-radius:22px;padding:26px 28px;background:linear-gradient(115deg,color-mix(in srgb,var(--cyan) 8%,var(--surface)),color-mix(in srgb,var(--violet) 8%,var(--surface)))}.public-v4-cta h2{margin:0 0 6px;font-size:24px}.public-v4-cta p{margin:0;color:var(--muted);font-size:11px}
:root[data-theme="light"]{color-scheme:light;--bg:#f5f8fc;--bg2:#edf3fa;--surface:rgba(255,255,255,.92);--surface-strong:#fff;--surface-soft:#f3f6fa;--line:#dbe4ef;--line-strong:#c8d6e7;--text:#162035;--muted:#66758b;--faint:#8793a6;--cyan:#047eaa;--blue:#315ee8;--violet:#704ad8;--purple:#8b49d3;--green:#13795b;--amber:#9d6300;--red:#b73349;--shadow:0 24px 70px rgba(31,45,74,.10);--glow:none}
:root[data-theme="light"] body{background:radial-gradient(circle at 15% 10%,rgba(48,114,255,.10),transparent 30rem),radial-gradient(circle at 82% 14%,rgba(128,82,255,.08),transparent 28rem),linear-gradient(180deg,#f8fbff 0%,#f3f7fc 48%,#edf3f9 100%)}
:root[data-theme="light"] body:before{opacity:.30;background-image:linear-gradient(rgba(67,111,171,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(67,111,171,.08) 1px,transparent 1px)}
:root[data-theme="light"] .top:after{background:linear-gradient(90deg,transparent,rgba(35,126,194,.28),rgba(112,74,216,.22),transparent)}
:root[data-theme="light"] .nav a{color:#5f718a}:root[data-theme="light"] .nav a:hover,:root[data-theme="light"] .nav a.active{color:#172033;background:#eaf0f7;box-shadow:none}:root[data-theme="light"] .nav .nav-cta{color:#fff}
:root[data-theme="light"] .btn{color:#203049;background:#f5f8fc;border-color:#d5e0ed}:root[data-theme="light"] .btn.primary{color:#fff;background:linear-gradient(110deg,#078ab5,#315ee8 55%,#704ad8)}
:root[data-theme="light"] .auth-visual,:root[data-theme="light"] .auth-card{background:linear-gradient(155deg,rgba(255,255,255,.96),rgba(246,249,253,.97));box-shadow:var(--shadow)}
:root[data-theme="light"] .field input,:root[data-theme="light"] .field select,:root[data-theme="light"] .field textarea{background:#fff;color:var(--text);border-color:#d7e2ef}
:root[data-theme="light"] .notice,:root[data-theme="light"] .auth-point{background:#f4f7fb;color:var(--muted);border-color:#dde6f0}
@media(max-width:1100px){.public-v4-hero{grid-template-columns:1fr}.public-v4-system{min-height:390px}.public-v4-plugin-row{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.public-v4-copy{padding:28px}.public-v4-grid{grid-template-columns:1fr}.public-v4-plugin-row{grid-template-columns:repeat(2,minmax(0,1fr))}.public-v4-section-head,.public-v4-cta{display:grid}.public-v4-section-head p{text-align:left}.public-v4-flow{grid-template-columns:1fr}.brand-lockup .brand-copy small{display:none}}
@media(max-width:480px){.public-v4-plugin-row{grid-template-columns:1fr}.public-v4-copy{padding:22px}.public-v4-system{padding:18px}.qqai-brand-logo{width:39px;height:39px}}
</style>`;
}

function brandPublicStyle() {
  return brandPublicStyleBase() + rayAiExperienceStyle("public");
}

function brandThemeBootScriptBase() {
  return `<script id="qqai-brand-theme-boot">(function(){try{var t=localStorage.getItem("qqai_theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();<\/script>`;
}

function brandThemeBootScript() {
  return brandThemeBootScriptBase() + rayAiExperienceScript("public");
}

function brandFaviconLink() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><circle cx="36" cy="36" r="31" fill="#061126" stroke="#39e7ff" stroke-width="2"/><path d="M20 51l9.2-31h15.1c8.5 0 12.9 3.8 11.1 10.2-1.2 4.3-4.8 7.2-10.2 8.3L52 51H40.9l-6.2-11.4h-3L28.3 51H20zm14.3-20h7.3c2.7 0 4.4-1.1 4.9-3 .5-1.9-.8-2.8-3.7-2.8h-6.9L34.3 31z" fill="#39e7ff"/><path d="M30.2 40.1h10.2L49.7 51H38.8z" fill="#9b5cff"/></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

export { brandFaviconLink, brandLockupMarkup, brandLogoSvg, brandPublicStyle, brandThemeBootScript };
