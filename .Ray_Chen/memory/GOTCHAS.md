# GOTCHAS

- QQ Open Abot active-send could be restricted per group (observed QQ 40034105), so cross-group joining cannot depend on Abot availability.
- Existing Abot pending code cannot be used as a NapCat-created active invite; do not auto-import without group mapping. Ask first group to create fresh !use Bbot code.
- NapCat reverse WS may keep a hot DO running older code across deployments. New hub key bridge-bbot-napcat-v2 is isolated; must reconnect client to attach to new DO; /health reports connected only after handshake.
- Bbot's own numeric QQ 2681167798 may be one of the protected identities in every group; this must restrict STOP/LEAVE/GRANT but not prevent admin/owner from initial JOIN/CREATE.
- Native Bbot group commands and replies require a fresh OneBot get_group_member_list roster. If roster query fails, fail closed rather than claim caller admin.
- Outbox dispatch in a Bbot DO should not synchronously call the same DO while receiving a WebSocket message; use short alarm, do not blindly resend ambiguous ACK.
- Bare !use (no @AIBot) prevents older official QQ Gateway from issuing a second unrelated link code.
- Abot and Bbot media formats may not be completely interoperable; no real QQ media end-to-end evidence yet.
