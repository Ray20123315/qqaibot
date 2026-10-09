# GOTCHAS

- QQ group API can reject passive reply with 40034024 invalid/unauthorized msg_id even when Gateway event arrives. Send with msg_id first, then (only on explicit rejection) try a proactive no-msg-id send if group permission permits. Do not confuse this with a network timeout.
- Code can initialize group room rows BEFORE the reply succeeds. Repeated /use for an unverified room must recover from this partial state.
- Abot group proactive send toggles / group quotas still apply. Cloudflare CI/build passing does not establish QQ live reply behavior.
- Keep QQAIBOT main archive/legacy-main-20261009 for recovery.
