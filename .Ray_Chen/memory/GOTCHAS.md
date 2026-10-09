# GOTCHAS
- Abot official 40034105 permission issues motivated Bbot-only mode; new code no longer calls official API. Old DO may have an old hot socket for a short interval; /shutdown requested.
- QQ Open Platform slash autocomplete panel lives in developer account, separate from Worker and may remain visible despite disabled Abot code.
- Bbot OneBot socket must authenticate via ONEBOT_ACCESS_TOKEN; 401 indicates token mismatch.
- No QQ numeric group means Bbot cannot send, even if historical Group OpenID exists; do not synthesize an ID.
- Bbot native ACK timeout is ambiguous and must not blindly resend. Offline outbox stays pending until reconnection.
- QQ 3569028262 and 2681167798 protected, delegated ACL restrictions remain.
