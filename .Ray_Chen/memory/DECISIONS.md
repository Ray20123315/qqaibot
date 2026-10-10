# DECISIONS
2026-10-10 rev2: Abot official AI Gateway test uses separate DO qqai-abot-passive-ai-v1 and existing QqOpenGateway migration. Only group @ messages trigger. Passive message replies carry original msg_id; no proactive push or fallback to Bbot.
2026-10-10: Source group_openid/member_openid are opaque. D1 keys independent of Bbot numeric qq; model client unchanged (Gemini existing Secret default, DeepSeek configured but no automatic paid switch).
2026-10-10: QQ official Gateway READY is necessary but insufficient for send proof. Real controlled @Abot needed.
2026-10-10: Preserve backup archive/bbot-ai-before-abot-20261010 and earlier archives, don't delete data.
