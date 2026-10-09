# GOTCHAS

- 2026 QQ group proactive push enable reported on mobile QQ, but official 2025 doc still says disabled; verify actual API and group toggle.
- Bbot numeric QQ ID and Abot opaque Group OpenID not interchangeable. Pairing requires both observed code proofs from same QQ group.
- Bbot roster expires in 2 minutes and can be stale; stop protected admin writes fail closed.
- Official API may not reproduce QQ proprietary cards, reply/forward IDs or inaccessible media. Bbot native fallback best effort and may be unavailable.
- Abot timeout/5xx and Bbot send ACK timeout are ambiguous: DO NOT replay and risk double send.
- Inbound Abot echo may lose invisible marker in QQ client; obtain ABOT_QQ_ID from real Bbot observations for robust ignore.
- Old QQ Gateway DO state/WS and NapCat reverse WS may persist across deployment; safe cutover requires reconnect plan.
- Platform group owner can remove Bot, protected-user rule cannot override that.
