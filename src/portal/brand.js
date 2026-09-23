const BRAND_LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI Control Center logo">
  <defs>
    <linearGradient id="qqai-g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#27e7ff"/>
      <stop offset=".52" stop-color="#4f7dff"/>
      <stop offset="1" stop-color="#9d5cff"/>
    </linearGradient>
    <linearGradient id="qqai-g2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#37dfff"/>
      <stop offset=".55" stop-color="#776dff"/>
      <stop offset="1" stop-color="#d45cff"/>
    </linearGradient>
    <filter id="qqai-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#qqai-glow)">
    <path d="M18 7h13L23 52H10z" fill="url(#qqai-g1)"/>
    <path d="M38 18h12l5 34H42z" fill="url(#qqai-g2)"/>
    <path d="M16 42h29l-4 10H13z" fill="url(#qqai-g1)"/>
    <rect x="50" y="7" width="8" height="8" rx="2.2" fill="#36e8ff"/>
  </g>
</svg>`;

function safeToken(value, fallback) {
  const token = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return token || fallback;
}

function brandLogoMarkup({ className = "qqai-brand-logo", title = "AI Control Center", idPrefix = "qqai-brand" } = {}) {
  const safeClass = String(className || "qqai-brand-logo").replace(/[^a-zA-Z0-9_ -]/g, "");
  const safeTitle = String(title || "AI Control Center").replace(/[<>&"]/g, "");
  const prefix = safeToken(idPrefix, "qqai-brand");
  return BRAND_LOGO_SVG
    .replaceAll("qqai-g1", prefix + "-g1")
    .replaceAll("qqai-g2", prefix + "-g2")
    .replaceAll("qqai-glow", prefix + "-glow")
    .replace("<svg ", `<svg class="${safeClass}" data-brand-logo="qqai" title="${safeTitle}" `);
}

export { BRAND_LOGO_SVG, brandLogoMarkup };
