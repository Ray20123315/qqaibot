# DECISIONS
2026-10-10 rev 2: Re-enable official Abot gateway solely for AI group passive replies; unlike previous failing proactive sends, include source msg_id. No automatic fallback Bbot because message may be duplicated and disguises permission errors.
2026-10-10: Official member_openid and group_openid are opaque; do not attempt numeric QQ ID inference. Use separate OpenID-keyed D1 AI history/seen/usage.
2026-10-10: Safe trial supports official @ events and text only; more commands/permissions require real Abot identity verification and staged QQ tests.
2026-10-10: Original Bbot AI main saved as archive/bbot-ai-before-abot-20261010 8bc7427f85f23ab52935c2a83b87e7e2df909c14; no force pushes.
