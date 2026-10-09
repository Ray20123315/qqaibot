# CURRENT_STATE

- repo Ray20123315/qqaibot
- main product now contains repair commit 618cdd90ee10d7eeae8a76545d4b4d428d574dba
- legacy backup archive/legacy-main-20261009 points to 6a22b06433cfaffcf13abe2b60a917305290b629
- Cloudflare qqai deployed version 57508156-e5af-4b3d-a08d-46510b8120e1, build successful, source main commit 618cdd90ee10d7eeae8a76545d4b4d428d574dba, 100% traffic
- GitHub Actions 37956722873 succeeded: tests and Wrangler dry-run
- observed before fix: ABOT_RESPONSE_FAILED QQ_API_400:40034024 invalid/unauthorized msg_id while handling real event
- fix: single proactive retry without invalid msg_id on explicit QQ code 40034024; no retry on unknown network results
- pending /use repair enables recovering previously hidden invite and nonce
- QQ live client after fix: unknown, user report is from prior deployed version
- AI chat disabled by project design, admin and protected user ACL unchanged
