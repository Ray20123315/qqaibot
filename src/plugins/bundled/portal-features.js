const PORTAL_FEATURE_PLUGINS = Object.freeze([
  {
    manifest: {
      id: "qqai.community",
      name: "Community",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Community, group, member and relationship management.",
      portal: {
        category: "community",
        icon: "◎",
        defaultView: "groups",
        views: ["groups", "members", "member-actions", "relationships", "member-data", "member-cleanup", "notification-routing", "settingscenter"],
        order: 10,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "社群管理", description: "群組、群友、關係、通知與成員資料工具。" },
        "zh-CN": { name: "社群管理", description: "群组、群友、关系、通知与成员资料工具。" },
        "en": { name: "Community", description: "Groups, members, relationships, notifications and member data." },
        "ja": { name: "コミュニティ", description: "グループ、メンバー、関係、通知、メンバーデータ。" },
        "ko": { name: "커뮤니티", description: "그룹, 멤버, 관계, 알림 및 멤버 데이터 관리." },
        "es": { name: "Comunidad", description: "Grupos, miembros, relaciones, avisos y datos de miembros." },
        "fr": { name: "Communauté", description: "Groupes, membres, relations, notifications et données membres." },
        "de": { name: "Community", description: "Gruppen, Mitglieder, Beziehungen, Benachrichtigungen und Mitgliedsdaten." },
        "pt-BR": { name: "Comunidade", description: "Grupos, membros, relações, notificações e dados de membros." },
        "vi": { name: "Cộng đồng", description: "Nhóm, thành viên, quan hệ, thông báo và dữ liệu thành viên." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.moderation",
      name: "Moderation",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Rules, moderation proposals, violations and appeals.",
      portal: {
        category: "safety",
        icon: "盾",
        defaultView: "ruleviolations",
        views: ["ruleviolations", "moderation", "appealreview", "violationhistory", "appeals"],
        order: 20,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "群規與審核", description: "群規、待確認操作、違規紀錄與申訴流程。" },
        "zh-CN": { name: "群规与审核", description: "群规、待确认操作、违规记录与申诉流程。" },
        "en": { name: "Moderation", description: "Rules, pending actions, violation history and appeals." },
        "ja": { name: "モデレーション", description: "ルール、保留操作、違反履歴、異議申し立て。" },
        "ko": { name: "모더레이션", description: "규칙, 대기 작업, 위반 기록 및 이의 제기." },
        "es": { name: "Moderación", description: "Reglas, acciones pendientes, infracciones y apelaciones." },
        "fr": { name: "Modération", description: "Règles, actions en attente, infractions et appels." },
        "de": { name: "Moderation", description: "Regeln, ausstehende Aktionen, Verstöße und Einsprüche." },
        "pt-BR": { name: "Moderação", description: "Regras, ações pendentes, violações e recursos." },
        "vi": { name: "Kiểm duyệt", description: "Nội quy, thao tác chờ duyệt, vi phạm và khiếu nại." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.automation",
      name: "Automation",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Schedules, activities, polls and task queues.",
      portal: {
        category: "automation",
        icon: "⚡",
        defaultView: "collaboration",
        views: ["collaboration", "schedules", "tasks"],
        order: 30,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "自動化", description: "活動、投票、排程提醒與任務佇列。" },
        "zh-CN": { name: "自动化", description: "活动、投票、排程提醒与任务队列。" },
        "en": { name: "Automation", description: "Activities, polls, schedules and task queues." },
        "ja": { name: "自動化", description: "イベント、投票、スケジュール、タスクキュー。" },
        "ko": { name: "자동화", description: "활동, 투표, 일정 및 작업 대기열." },
        "es": { name: "Automatización", description: "Actividades, encuestas, horarios y colas de tareas." },
        "fr": { name: "Automatisation", description: "Activités, sondages, planifications et files de tâches." },
        "de": { name: "Automatisierung", description: "Aktivitäten, Umfragen, Zeitpläne und Aufgabenwarteschlangen." },
        "pt-BR": { name: "Automação", description: "Atividades, enquetes, agendas e filas de tarefas." },
        "vi": { name: "Tự động hóa", description: "Hoạt động, bình chọn, lịch và hàng đợi tác vụ." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.knowledge",
      name: "Knowledge",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "AI memory, knowledge and conversation review.",
      portal: {
        category: "ai",
        icon: "◇",
        defaultView: "memory",
        views: ["memory", "conversations", "aidecisions"],
        order: 40,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "AI 記憶與知識", description: "記憶、知識卡片、對話紀錄與 AI 回覆紀錄。" },
        "zh-CN": { name: "AI 记忆与知识", description: "记忆、知识卡片、对话记录与 AI 回复记录。" },
        "en": { name: "AI Knowledge", description: "Memory, knowledge cards, conversations and AI reply history." },
        "ja": { name: "AI ナレッジ", description: "メモリ、ナレッジ、会話、AI 応答履歴。" },
        "ko": { name: "AI 지식", description: "메모리, 지식 카드, 대화 및 AI 응답 기록." },
        "es": { name: "Conocimiento IA", description: "Memoria, conocimiento, conversaciones e historial de respuestas." },
        "fr": { name: "Connaissances IA", description: "Mémoire, connaissances, conversations et historique des réponses." },
        "de": { name: "KI-Wissen", description: "Speicher, Wissen, Unterhaltungen und Antwortverlauf." },
        "pt-BR": { name: "Conhecimento de IA", description: "Memória, conhecimento, conversas e histórico de respostas." },
        "vi": { name: "Tri thức AI", description: "Bộ nhớ, tri thức, hội thoại và lịch sử phản hồi AI." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.models",
      name: "Models",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Model routing, quotas and simulation.",
      portal: {
        category: "ai",
        icon: "AI",
        defaultView: "models",
        views: ["models", "quota", "simulator"],
        order: 50,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "模型與額度", description: "模型路由、成本額度與事件模擬器。" },
        "zh-CN": { name: "模型与额度", description: "模型路由、成本额度与事件模拟器。" },
        "en": { name: "Models & Quotas", description: "Model routing, cost limits and event simulation." },
        "ja": { name: "モデルと上限", description: "モデルルーティング、コスト上限、イベントシミュレーション。" },
        "ko": { name: "모델 및 한도", description: "모델 라우팅, 비용 한도 및 이벤트 시뮬레이션." },
        "es": { name: "Modelos y cuotas", description: "Ruteo de modelos, límites de coste y simulación." },
        "fr": { name: "Modèles et quotas", description: "Routage des modèles, limites de coût et simulation." },
        "de": { name: "Modelle & Limits", description: "Modellrouting, Kostenlimits und Ereignissimulation." },
        "pt-BR": { name: "Modelos e cotas", description: "Roteamento de modelos, limites de custo e simulação." },
        "vi": { name: "Mô hình & hạn mức", description: "Định tuyến mô hình, giới hạn chi phí và mô phỏng." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.integrations",
      name: "Integrations",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Optional third-party integrations.",
      portal: {
        category: "integration",
        icon: "＋",
        defaultView: "bilibili",
        views: ["bilibili"],
        order: 60,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "外部整合", description: "Bilibili 與其他選用型第三方連接能力。" },
        "zh-CN": { name: "外部集成", description: "Bilibili 与其他可选第三方连接能力。" },
        "en": { name: "Integrations", description: "Bilibili and other optional third-party integrations." },
        "ja": { name: "外部連携", description: "Bilibili などの任意の外部連携。" },
        "ko": { name: "외부 연동", description: "Bilibili 및 선택형 타사 연동." },
        "es": { name: "Integraciones", description: "Bilibili y otras integraciones opcionales." },
        "fr": { name: "Intégrations", description: "Bilibili et autres intégrations facultatives." },
        "de": { name: "Integrationen", description: "Bilibili und weitere optionale Integrationen." },
        "pt-BR": { name: "Integrações", description: "Bilibili e outras integrações opcionais." },
        "vi": { name: "Tích hợp", description: "Bilibili và các tích hợp bên thứ ba tùy chọn." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.werewolf",
      name: "Werewolf",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Werewolf game tools.",
      portal: {
        category: "entertainment",
        icon: "狼",
        defaultView: "werewolf",
        views: ["werewolf"],
        order: 70,
        legacyBridge: true
      },
      i18n: {
        "zh-TW": { name: "狼人殺", description: "狼人殺房間、角色與遊戲控制。" },
        "zh-CN": { name: "狼人杀", description: "狼人杀房间、角色与游戏控制。" },
        "en": { name: "Werewolf", description: "Werewolf rooms, roles and game controls." },
        "ja": { name: "人狼", description: "人狼ゲームのルーム、役職、進行管理。" },
        "ko": { name: "마피아 게임", description: "늑대인간 게임 방, 역할 및 게임 제어." },
        "es": { name: "Hombre lobo", description: "Salas, roles y controles del juego." },
        "fr": { name: "Loup-garou", description: "Salons, rôles et contrôles de partie." },
        "de": { name: "Werwolf", description: "Räume, Rollen und Spielsteuerung." },
        "pt-BR": { name: "Lobisomem", description: "Salas, papéis e controles do jogo." },
        "vi": { name: "Ma sói", description: "Phòng chơi, vai trò và điều khiển trò Ma Sói." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  },
  {
    manifest: {
      id: "qqai.developer-tools",
      name: "Developer Tools",
      version: "1.0.0",
      mode: "trusted_bundled",
      events: ["portal.open"],
      author: "ray20123315",
      description: "Diagnostics, logs, platform permissions and maintenance tools.",
      portal: {
        category: "developer",
        icon: "</>",
        defaultView: "health",
        views: ["health", "platform", "logs", "maintenance"],
        order: 90,
        legacyBridge: true,
        developerOnly: true
      },
      i18n: {
        "zh-TW": { name: "開發者工具", description: "健康診斷、平台權限、日誌與系統維護。" },
        "zh-CN": { name: "开发者工具", description: "健康诊断、平台权限、日志与系统维护。" },
        "en": { name: "Developer Tools", description: "Health, platform permissions, logs and system maintenance." },
        "ja": { name: "開発者ツール", description: "ヘルス、権限、ログ、システム保守。" },
        "ko": { name: "개발자 도구", description: "상태 진단, 권한, 로그 및 시스템 유지보수." },
        "es": { name: "Herramientas de desarrollo", description: "Salud, permisos, registros y mantenimiento." },
        "fr": { name: "Outils développeur", description: "Santé, permissions, journaux et maintenance." },
        "de": { name: "Entwicklerwerkzeuge", description: "Status, Berechtigungen, Protokolle und Wartung." },
        "pt-BR": { name: "Ferramentas do desenvolvedor", description: "Saúde, permissões, logs e manutenção." },
        "vi": { name: "Công cụ phát triển", description: "Sức khỏe hệ thống, quyền, nhật ký và bảo trì." }
      }
    },
    async handler() { return { handled: false, actions: [] }; }
  }
]);

export { PORTAL_FEATURE_PLUGINS };
