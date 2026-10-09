# DECISIONS

2026-10-10: Cloudflare error QQ_API_400:40034024 was observed on Abot group reply with msg_id. A definite platform rejection means this attempt did not deliver. Retry exactly once without msg_id when group allows proactive sends; do not retry on network timeout, ambiguous failure or 5xx. This is not permission to use Bbot for arbitrary unsolicited delivery.
2026-10-10: Previous /use could leave a pending DB group after failed response; regenerate fresh pending invite/verification codes when /use is repeated, revoking old invite while leaving active verified rooms unchanged.
2026-10-10: Stage fix branch then CI, promote main only on success, retain archive and recovery path.
