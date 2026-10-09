# PROJECT

QQAIBOT revised to bridge multiple ordinary QQ groups, with Bbot/NapCat as trusted numeric identity and incoming message collector; Abot/QQ Open Platform as default sender. Cloudflare Worker + D1 + two DO instances and existing migration history. Old production archive/legacy-main-20261009. AI chat disabled in new source.

Approved fallback: Bbot can send only after Abot has definitively rejected the message or official API cannot encode media. Never auto-send after timeout/ambiguous result. Preserve source display, segment type, QQ @ where possible, and no relay echo loops.
