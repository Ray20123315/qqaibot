function brandLogoSvg(className = "qqai-brand-logo", title = "AI Control Center") {
  const safeClass = String(className || "qqai-brand-logo").replace(/[^a-zA-Z0-9 _-]/g, "");
  const safeTitle = String(title || "AI Control Center").replace(/[<>&]/g, "");
  return `<svg class="${safeClass}" viewBox="0 0 64 64" role="img" aria-label="${safeTitle}">
    <defs>
      <linearGradient id="qqai-brand-cyan" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#27e6ff"/>
        <stop offset=".52" stop-color="#4b7dff"/>
        <stop offset="1" stop-color="#8e5cff"/>
      </linearGradient>
      <linearGradient id="qqai-brand-violet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a8bff"/>
        <stop offset=".56" stop-color="#9b5cff"/>
        <stop offset="1" stop-color="#d05cff"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="62" height="62" rx="18" fill="rgba(6,14,32,.92)" stroke="rgba(100,190,255,.30)"/>
    <path d="M17 10h12L20.5 48H8.5z" fill="url(#qqai-brand-cyan)"/>
    <path d="M36 18h11l8.5 30H43.5z" fill="url(#qqai-brand-violet)"/>
    <path d="M15 41h31l-2.8 10H12.2z" fill="url(#qqai-brand-cyan)" opacity=".96"/>
    <circle cx="51" cy="12" r="4" fill="#37e7ff"/>
    <circle cx="51" cy="12" r="8" fill="none" stroke="rgba(55,231,255,.25)"/>
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
    <span class="brand-copy"><b>AI Control Center</b><small>${subtitle}</small></span>
  </${tag}>`;
}

function brandFaviconLink() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#081225"/><path d="M17 10h12L20.5 48H8.5z" fill="#27e6ff"/><path d="M36 18h11l8.5 30H43.5z" fill="#9b5cff"/><path d="M15 41h31l-2.8 10H12.2z" fill="#4b7dff"/><circle cx="51" cy="12" r="4" fill="#37e7ff"/></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

export { brandFaviconLink, brandLockupMarkup, brandLogoSvg };
