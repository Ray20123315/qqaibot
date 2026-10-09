# CURRENT_STATE

- Current product SHA on GitHub main 61666942ac971a4d52c88105a1970898a180f340
- GitHub feature CI 37969072123 success and main CI 37969193082 success, Node tests and Wrangler dry-run.
- Cloudflare qqai main build from 61666942ac971a4d52c88105a1970898a180f340 deployed 100%: ID 7903d855-69bb-49d1-9d49-2c85ef5fd16a, version ed71a6b6-dbd6-4402-a4f2-e0a311e606d5.
- Original full main archived in archive/legacy-main-20261009 SHA 6a22b06433cfaffcf13abe2b60a917305290b629.
- App mode remains Bbot-only, Abot disabled; OneBotHub identity bridge-bbot-recall-v4 must receive new socket connection before group commands work.
- New source-to-target actual send_group_msg message_id mapping and recalled sources/queue D1 tables, additive receive_only group column.
- --no group is receive-only; normal group broadcasts join notice, !setting reports rights and current link groups, !help lists commands.
- Native at/mface/face supported as described; Bilibili card changed to descriptive text. QQ live validation unknown.
- No D1 old data erased, no credentials changed, no forced Git push.
