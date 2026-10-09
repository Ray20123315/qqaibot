# DECISIONS

- Original main preserved at archive/legacy-main-20261009
- Abot-first, Bbot only if official API definitive failure; no fallback on ambiguous results
- 2026-10-09 group binding requires BOTH Abot and Bbot seeing same one-time code, supersedes single-Bbot proof (security)
- QQ ID and official group/member OpenID must never be silently interchanged
- Protected group management fail closed, delegated scopes explicit
- Official media upload via HTTPS then msg_type7; native Bbot on definitive unsupported/blocked
- Outbound Abot includes invisible echo marker to reduce relay loops; also supports explicit ABOT_QQ_ID ignore where known
- No main promotion without evidence of permission, runtime configuration and safe cutover
