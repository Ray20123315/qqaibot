const PORTAL_LOCALES = Object.freeze([
  { id: "zh-TW", label: "繁體中文" },
  { id: "zh-CN", label: "简体中文" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "vi", label: "Tiếng Việt" }
]);

const PORTAL_MESSAGES = Object.freeze({
  "zh-TW": Object.freeze({
    "app.subtitle": "核心精簡 · 插件擴充 · 自備資源",
    "nav.home": "首頁", "nav.plugins": "插件", "nav.account": "帳號與設定", "nav.health": "系統健康",
    "top.language": "語言", "top.refresh": "更新", "top.light": "淺色", "top.dark": "深色", "top.logout": "登出",
    "home.kicker": "AI CONTROL CENTER", "home.title": "保持核心簡單，把能力交給插件。", "home.summary": "登入、權限、安全與插件執行留在核心；社群、審核、自動化、模型與整合能力由插件提供。",
    "home.pluginTitle": "已安裝功能插件", "home.pluginHelp": "從插件中心開啟需要的能力，側欄不再塞滿所有功能。",
    "home.runtimeTitle": "核心狀態", "home.runtimeHelp": "只顯示維持平台安全運作所需的資訊。",
    "plugins.title": "插件中心", "plugins.subtitle": "非必要能力以插件呈現。現有功能先透過相容橋接保留，再逐步拆離核心。",
    "plugins.open": "開啟", "plugins.bridge": "相容橋接", "plugins.developer": "僅開發者",
    "account.title": "帳號與設定", "account.subtitle": "帳號安全、語言、外觀與目前身份。高權限設定仍由伺服器判定。",
    "account.security": "帳號安全", "account.preferences": "介面偏好", "account.identity": "目前身份",
    "health.title": "系統健康", "health.subtitle": "核心連線、儲存與必要執行環境的診斷。",
    "footer.rights": "© 2026 ray20123315. All rights reserved.",
    "common.loading": "讀取中…", "common.unavailable": "目前無法使用", "common.open": "開啟", "common.core": "核心"
  }),
  "zh-CN": Object.freeze({
    "app.subtitle": "精简核心 · 插件扩展 · 自备资源",
    "nav.home": "首页", "nav.plugins": "插件", "nav.account": "账号与设置", "nav.health": "系统健康",
    "top.language": "语言", "top.refresh": "更新", "top.light": "浅色", "top.dark": "深色", "top.logout": "登出",
    "home.kicker": "AI CONTROL CENTER", "home.title": "保持核心简单，把能力交给插件。", "home.summary": "登录、权限、安全与插件执行留在核心；社群、审核、自动化、模型与集成能力由插件提供。",
    "home.pluginTitle": "已安装功能插件", "home.pluginHelp": "从插件中心打开需要的能力，侧栏不再塞满所有功能。",
    "home.runtimeTitle": "核心状态", "home.runtimeHelp": "只显示维持平台安全运行所需的信息。",
    "plugins.title": "插件中心", "plugins.subtitle": "非必要能力以插件呈现。现有功能先通过兼容桥接保留，再逐步拆离核心。",
    "plugins.open": "打开", "plugins.bridge": "兼容桥接", "plugins.developer": "仅开发者",
    "account.title": "账号与设置", "account.subtitle": "账号安全、语言、外观与当前身份。高权限设置仍由服务器判定。",
    "account.security": "账号安全", "account.preferences": "界面偏好", "account.identity": "当前身份",
    "health.title": "系统健康", "health.subtitle": "核心连接、存储与必要运行环境的诊断。",
    "footer.rights": "© 2026 ray20123315. All rights reserved.",
    "common.loading": "读取中…", "common.unavailable": "当前无法使用", "common.open": "打开", "common.core": "核心"
  }),
  "en": Object.freeze({
    "app.subtitle": "Small core · Plugin extensions · Bring your own resources",
    "nav.home": "Home", "nav.plugins": "Plugins", "nav.account": "Account & Settings", "nav.health": "System Health",
    "top.language": "Language", "top.refresh": "Refresh", "top.light": "Light", "top.dark": "Dark", "top.logout": "Sign out",
    "home.kicker": "AI CONTROL CENTER", "home.title": "Keep the core simple. Put capabilities in plugins.", "home.summary": "Authentication, authorization, security and plugin execution stay in the core. Community, moderation, automation, models and integrations are provided as plugins.",
    "home.pluginTitle": "Installed feature plugins", "home.pluginHelp": "Open capabilities from the plugin center instead of filling the sidebar with every feature.",
    "home.runtimeTitle": "Core status", "home.runtimeHelp": "Only information required to operate the platform safely is shown here.",
    "plugins.title": "Plugin Center", "plugins.subtitle": "Non-essential capabilities are presented as plugins. Existing features use compatibility bridges while implementation is progressively separated from the core.",
    "plugins.open": "Open", "plugins.bridge": "Compatibility bridge", "plugins.developer": "Developer only",
    "account.title": "Account & Settings", "account.subtitle": "Account security, language, appearance and your current identity. Elevated authority remains server-controlled.",
    "account.security": "Account security", "account.preferences": "Interface preferences", "account.identity": "Current identity",
    "health.title": "System Health", "health.subtitle": "Diagnostics for core connectivity, storage and required runtime services.",
    "footer.rights": "© 2026 ray20123315. All rights reserved.",
    "common.loading": "Loading…", "common.unavailable": "Unavailable", "common.open": "Open", "common.core": "Core"
  }),
  "ja": Object.freeze({
    "app.subtitle":"小さなコア · プラグイン拡張 · BYOR","nav.home":"ホーム","nav.plugins":"プラグイン","nav.account":"アカウントと設定","nav.health":"システム状態","top.language":"言語","top.refresh":"更新","top.light":"ライト","top.dark":"ダーク","top.logout":"ログアウト","home.kicker":"AI CONTROL CENTER","home.title":"コアはシンプルに。機能はプラグインへ。","home.summary":"認証、権限、安全性、プラグイン実行はコアに残し、コミュニティ、モデレーション、自動化、モデル、連携はプラグインで提供します。","home.pluginTitle":"インストール済みプラグイン","home.pluginHelp":"必要な機能はプラグインセンターから開きます。","home.runtimeTitle":"コア状態","home.runtimeHelp":"安全な運用に必要な情報だけを表示します。","plugins.title":"プラグインセンター","plugins.subtitle":"非必須機能はプラグインとして整理します。既存機能は互換ブリッジで維持しながら段階的に分離します。","plugins.open":"開く","plugins.bridge":"互換ブリッジ","plugins.developer":"開発者のみ","account.title":"アカウントと設定","account.subtitle":"セキュリティ、言語、外観、現在の権限を管理します。","account.security":"アカウント安全","account.preferences":"表示設定","account.identity":"現在の権限","health.title":"システム状態","health.subtitle":"コア接続、ストレージ、必須ランタイムを診断します。","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"読み込み中…","common.unavailable":"利用不可","common.open":"開く","common.core":"コア"
  }),
  "ko": Object.freeze({
    "app.subtitle":"작은 코어 · 플러그인 확장 · BYOR","nav.home":"홈","nav.plugins":"플러그인","nav.account":"계정 및 설정","nav.health":"시스템 상태","top.language":"언어","top.refresh":"새로고침","top.light":"라이트","top.dark":"다크","top.logout":"로그아웃","home.kicker":"AI CONTROL CENTER","home.title":"코어는 단순하게, 기능은 플러그인으로.","home.summary":"인증, 권한, 보안, 플러그인 실행은 코어에 두고 커뮤니티, 관리, 자동화, 모델, 연동은 플러그인으로 제공합니다.","home.pluginTitle":"설치된 기능 플러그인","home.pluginHelp":"모든 기능을 사이드바에 넣지 않고 플러그인 센터에서 엽니다.","home.runtimeTitle":"코어 상태","home.runtimeHelp":"안전한 운영에 필요한 정보만 표시합니다.","plugins.title":"플러그인 센터","plugins.subtitle":"비필수 기능은 플러그인으로 제공합니다. 기존 기능은 호환 브리지를 거쳐 점진적으로 코어에서 분리합니다.","plugins.open":"열기","plugins.bridge":"호환 브리지","plugins.developer":"개발자 전용","account.title":"계정 및 설정","account.subtitle":"계정 보안, 언어, 외관 및 현재 권한을 관리합니다.","account.security":"계정 보안","account.preferences":"인터페이스 설정","account.identity":"현재 권한","health.title":"시스템 상태","health.subtitle":"코어 연결, 저장소 및 필수 런타임 진단.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"불러오는 중…","common.unavailable":"사용할 수 없음","common.open":"열기","common.core":"코어"
  }),
  "es": Object.freeze({
    "app.subtitle":"Núcleo mínimo · Plugins · Tus recursos","nav.home":"Inicio","nav.plugins":"Plugins","nav.account":"Cuenta y ajustes","nav.health":"Estado del sistema","top.language":"Idioma","top.refresh":"Actualizar","top.light":"Claro","top.dark":"Oscuro","top.logout":"Salir","home.kicker":"AI CONTROL CENTER","home.title":"Un núcleo simple. Las capacidades viven en plugins.","home.summary":"Autenticación, permisos, seguridad y ejecución de plugins permanecen en el núcleo; comunidad, moderación, automatización, modelos e integraciones se ofrecen como plugins.","home.pluginTitle":"Plugins instalados","home.pluginHelp":"Abre las capacidades desde el centro de plugins.","home.runtimeTitle":"Estado del núcleo","home.runtimeHelp":"Solo se muestra lo necesario para operar con seguridad.","plugins.title":"Centro de plugins","plugins.subtitle":"Las capacidades no esenciales se presentan como plugins y las funciones existentes usan puentes de compatibilidad durante la migración.","plugins.open":"Abrir","plugins.bridge":"Puente compatible","plugins.developer":"Solo desarrolladores","account.title":"Cuenta y ajustes","account.subtitle":"Seguridad, idioma, apariencia e identidad actual.","account.security":"Seguridad de la cuenta","account.preferences":"Preferencias","account.identity":"Identidad actual","health.title":"Estado del sistema","health.subtitle":"Diagnóstico de conectividad, almacenamiento y servicios esenciales.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"Cargando…","common.unavailable":"No disponible","common.open":"Abrir","common.core":"Núcleo"
  }),
  "fr": Object.freeze({
    "app.subtitle":"Noyau minimal · Plugins · Vos ressources","nav.home":"Accueil","nav.plugins":"Plugins","nav.account":"Compte et réglages","nav.health":"État système","top.language":"Langue","top.refresh":"Actualiser","top.light":"Clair","top.dark":"Sombre","top.logout":"Déconnexion","home.kicker":"AI CONTROL CENTER","home.title":"Un noyau simple. Les capacités passent par les plugins.","home.summary":"Authentification, autorisations, sécurité et exécution des plugins restent dans le noyau ; communauté, modération, automatisation, modèles et intégrations sont fournis par des plugins.","home.pluginTitle":"Plugins installés","home.pluginHelp":"Ouvrez les capacités depuis le centre de plugins.","home.runtimeTitle":"État du noyau","home.runtimeHelp":"Seules les informations nécessaires au fonctionnement sûr sont affichées.","plugins.title":"Centre de plugins","plugins.subtitle":"Les capacités non essentielles sont présentées comme plugins ; les fonctions existantes restent disponibles via des ponts de compatibilité pendant la migration.","plugins.open":"Ouvrir","plugins.bridge":"Pont de compatibilité","plugins.developer":"Développeur uniquement","account.title":"Compte et réglages","account.subtitle":"Sécurité, langue, apparence et identité actuelle.","account.security":"Sécurité du compte","account.preferences":"Préférences","account.identity":"Identité actuelle","health.title":"État système","health.subtitle":"Diagnostic de la connectivité, du stockage et des services essentiels.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"Chargement…","common.unavailable":"Indisponible","common.open":"Ouvrir","common.core":"Noyau"
  }),
  "de": Object.freeze({
    "app.subtitle":"Kleiner Kern · Plugins · Eigene Ressourcen","nav.home":"Start","nav.plugins":"Plugins","nav.account":"Konto & Einstellungen","nav.health":"Systemstatus","top.language":"Sprache","top.refresh":"Aktualisieren","top.light":"Hell","top.dark":"Dunkel","top.logout":"Abmelden","home.kicker":"AI CONTROL CENTER","home.title":"Der Kern bleibt einfach. Funktionen gehören in Plugins.","home.summary":"Authentifizierung, Berechtigungen, Sicherheit und Plugin-Ausführung bleiben im Kern; Community, Moderation, Automatisierung, Modelle und Integrationen kommen als Plugins.","home.pluginTitle":"Installierte Plugins","home.pluginHelp":"Funktionen werden im Plugin-Center geöffnet.","home.runtimeTitle":"Kernstatus","home.runtimeHelp":"Es werden nur betriebsnotwendige Informationen angezeigt.","plugins.title":"Plugin-Center","plugins.subtitle":"Nicht notwendige Funktionen werden als Plugins dargestellt; bestehende Funktionen bleiben während der Migration über Kompatibilitätsbrücken verfügbar.","plugins.open":"Öffnen","plugins.bridge":"Kompatibilitätsbrücke","plugins.developer":"Nur Entwickler","account.title":"Konto & Einstellungen","account.subtitle":"Kontosicherheit, Sprache, Darstellung und aktuelle Identität.","account.security":"Kontosicherheit","account.preferences":"Oberfläche","account.identity":"Aktuelle Identität","health.title":"Systemstatus","health.subtitle":"Diagnose für Kernverbindungen, Speicher und notwendige Laufzeitdienste.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"Lädt…","common.unavailable":"Nicht verfügbar","common.open":"Öffnen","common.core":"Kern"
  }),
  "pt-BR": Object.freeze({
    "app.subtitle":"Núcleo enxuto · Plugins · Seus recursos","nav.home":"Início","nav.plugins":"Plugins","nav.account":"Conta e configurações","nav.health":"Saúde do sistema","top.language":"Idioma","top.refresh":"Atualizar","top.light":"Claro","top.dark":"Escuro","top.logout":"Sair","home.kicker":"AI CONTROL CENTER","home.title":"Mantenha o núcleo simples. Coloque recursos em plugins.","home.summary":"Autenticação, autorização, segurança e execução de plugins ficam no núcleo; comunidade, moderação, automação, modelos e integrações são plugins.","home.pluginTitle":"Plugins instalados","home.pluginHelp":"Abra recursos pelo centro de plugins.","home.runtimeTitle":"Estado do núcleo","home.runtimeHelp":"Mostramos apenas o necessário para operação segura.","plugins.title":"Centro de plugins","plugins.subtitle":"Recursos não essenciais são plugins; funções existentes usam pontes de compatibilidade durante a migração.","plugins.open":"Abrir","plugins.bridge":"Ponte de compatibilidade","plugins.developer":"Somente desenvolvedor","account.title":"Conta e configurações","account.subtitle":"Segurança, idioma, aparência e identidade atual.","account.security":"Segurança da conta","account.preferences":"Preferências","account.identity":"Identidade atual","health.title":"Saúde do sistema","health.subtitle":"Diagnósticos de conectividade, armazenamento e serviços essenciais.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"Carregando…","common.unavailable":"Indisponível","common.open":"Abrir","common.core":"Núcleo"
  }),
  "vi": Object.freeze({
    "app.subtitle":"Lõi gọn · Plugin mở rộng · Tài nguyên của bạn","nav.home":"Trang chủ","nav.plugins":"Plugin","nav.account":"Tài khoản & cài đặt","nav.health":"Sức khỏe hệ thống","top.language":"Ngôn ngữ","top.refresh":"Làm mới","top.light":"Sáng","top.dark":"Tối","top.logout":"Đăng xuất","home.kicker":"AI CONTROL CENTER","home.title":"Giữ lõi đơn giản. Đưa tính năng vào plugin.","home.summary":"Xác thực, phân quyền, bảo mật và thực thi plugin ở trong lõi; cộng đồng, kiểm duyệt, tự động hóa, mô hình và tích hợp được cung cấp dưới dạng plugin.","home.pluginTitle":"Plugin tính năng đã cài","home.pluginHelp":"Mở tính năng từ trung tâm plugin thay vì nhồi mọi thứ vào thanh bên.","home.runtimeTitle":"Trạng thái lõi","home.runtimeHelp":"Chỉ hiển thị thông tin cần thiết để vận hành an toàn.","plugins.title":"Trung tâm Plugin","plugins.subtitle":"Tính năng không thiết yếu được trình bày dưới dạng plugin; tính năng hiện có dùng cầu tương thích trong quá trình tách khỏi lõi.","plugins.open":"Mở","plugins.bridge":"Cầu tương thích","plugins.developer":"Chỉ nhà phát triển","account.title":"Tài khoản & cài đặt","account.subtitle":"Bảo mật tài khoản, ngôn ngữ, giao diện và danh tính hiện tại.","account.security":"Bảo mật tài khoản","account.preferences":"Tùy chọn giao diện","account.identity":"Danh tính hiện tại","health.title":"Sức khỏe hệ thống","health.subtitle":"Chẩn đoán kết nối lõi, lưu trữ và dịch vụ runtime thiết yếu.","footer.rights":"© 2026 ray20123315. All rights reserved.","common.loading":"Đang tải…","common.unavailable":"Không khả dụng","common.open":"Mở","common.core":"Lõi"
  })
});

function normalizePortalLocale(value) {
  const raw = String(value || "").trim();
  if (!raw) return "zh-TW";
  const lower = raw.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-tw") || lower.startsWith("zh-hk") || lower.startsWith("zh-hant")) return "zh-TW";
  if (lower.startsWith("zh-cn") || lower.startsWith("zh-sg") || lower.startsWith("zh-hans")) return "zh-CN";
  if (lower.startsWith("pt")) return "pt-BR";
  const exact = PORTAL_LOCALES.find(item => item.id.toLowerCase() === lower);
  if (exact) return exact.id;
  const base = lower.split("-")[0];
  return PORTAL_LOCALES.find(item => item.id.toLowerCase().split("-")[0] === base)?.id || "en";
}

function portalI18nPayload() {
  return Object.freeze({ locales: PORTAL_LOCALES, messages: PORTAL_MESSAGES, defaultLocale: "zh-TW" });
}

export { PORTAL_LOCALES, PORTAL_MESSAGES, normalizePortalLocale, portalI18nPayload };
