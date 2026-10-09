# DECISIONS

- 2026-10-09 original main archived at archive/legacy-main-20261009.
- Abot-first Bbot-only-when-needed adopted 2026-10-09. Supersedes old no-Bbot-send constraint. Fallback on definitive platform rejection, not unknown timeouts; prevent duplicate delivery.
- Trusted Bbot group members and QQ ID are authoritative for admin/authorization, never infer numeric ID from OpenID.
- Protected group delegation only by protected QQ accounts; stale roster fail closed.
- QQ group proactive permission may be reopened and toggled in mobile group bot settings; probe bot_state opportunistically, do not automatically alter owner-controlled settings.
- QQ official media (HTTPS URL) two-step upload and send; otherwise Bbot native segments; track failures.
- Real @ syntax now <qqbot-at-user id="..."/> with verified member OpenID; fallback native QQ @ via Bbot if Abot definitively fails.
- No main deployment without runtime readiness check.
