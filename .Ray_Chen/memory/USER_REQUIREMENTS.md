# USER_REQUIREMENTS

- All code must ship to main after tests, with original main preserved at archive/legacy-main-20261009.
- Bridge arbitrary number of QQ groups with !use and !CODE group alias, using NapCat to authenticate real QQ account IDs, current group membership and owner/admin roles.
- Protect QQ IDs 3569028262 and 2681167798 from ungranted group admin stop/leave/revoke; only protected user can grant while either is in the group. Admins may start/join. Keep explicit delegated scopes.
- Relay text, numeric @ if target member present, image, voice, video, files and native segments as far as OneBot supports; guard against loops and duplicate delivery.
- Native command only via Bbot, no QQ slash panel required; no AI chat.
- NEW 2026-10-10: TEMPORARILY DISABLE Abot entirely and route EVERY incoming message, reply, verification and cross-group outbound using Bbot, even when official OpenID exists. Preserve Abot credentials, old data and capability for possible later reenable.
