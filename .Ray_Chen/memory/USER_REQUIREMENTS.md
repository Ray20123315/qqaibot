# USER_REQUIREMENTS

1. Move old main in entirety to separate Git branch; replace main only when safe and verified.
2. Abot QQ Open Platform sends; Bbot personal account observes QQ group message and provides numeric identity.
3. /use creates connection code; /<code> <alias> joins arbitrarily many groups; forward ordinary messages to all other joined groups with [group-or-alias]nickname: prefix.
4. Cross-group @: if target belongs to receiving group, attempt true mention only with verified OpenID mapping; otherwise text fallback.
5. Support /status /leave /rename /revoke and /stop /resume /grant /ungrant.
6. If member 3569028262 or 2681167798 is present, ungranted admin/owner must not stop bridge. Only protected IDs can grant in protected groups. With neither present, owner/admin may manage/stop and grant.
7. AI chat off now, modular possible later.
8. Verify thoroughly; no false live-success reports.
