# USER_REQUIREMENTS

- Preserve original main in another Git branch and eventually make main new cross-group connector.
- Bbot observes all normal QQ group messages and provides numeric QQ identities. Abot uses official API to send to linked other groups.
- /use issues code, /<code> <alias> joins any number of groups, forward all ordinary messages as [group/alias]nickname: content.
- Try real cross-group @ using verified QQ ID <-> group member OpenID; QQ user must be a member of target group.
- Commands /status /leave /rename /revoke /stop /resume /grant /ungrant and persistent authorization.
- QQ 3569028262 and 2681167798 protected: when present, ungranted admins/owners cannot stop; only protected IDs may grant other members. Without these members, admin/owner may administer.
- AI chat disabled but may return later.
- NEW 2026-10-09: enable proactive group sending when QQ group permits; forward as much media as possible, including image/voice/video/file/emoji; Bbot may send only when Abot truly cannot.
