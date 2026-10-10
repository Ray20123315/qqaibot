# VERIFY
- QQ official documentation: POST /v2/groups/{group_openid}/messages, msg_type:0, msg_id original, msg_seq:1, passive group reply lifetime ~5 min. Earlier src/qq-api.js sendGroup uses these fields.
- New tests/abot-ai.test.mjs verify official event parsing, no ordinary group unsolicited replies, OpenID passive send msg_id, dedupe, !help local, API 40034105 failure no Bbot reroute, HELLO IDENTIFY and READY.
- Updated tests/abot-disabled.test.mjs verifies old sessions shut down while new official session starts only if QQ_AI_ABOT_ENABLED.
- Full npm run check + Wrangler dry-run pending, Cloudflare deployment and real QQ trial pending. Do not claim live success.
