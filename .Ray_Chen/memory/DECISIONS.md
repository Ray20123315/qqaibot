# DECISIONS
- 2026-10-10 goal revision 8: user explicitly requests Abot temporarily disabled, Bbot solely responsible for commands, numeric QQ verification, group linking, replies, media and relaying. Supersedes former Abot-first fallback. Keep secret and DB for future re-enable, no QQ platform account deletion.
- 2026-10-10 Bbot-only code merged nonforce to main at 7d2dbac38f212dc23f735e3f8f3fa18c156ce89e, tested and auto deployed.
- Existing historical Abot DOs receive /shutdown each cron; retained inert gateway class to preserve migrations. Do not claim QQ platform or old hot connection removed without live evidence.
- Do not attempt official sends even to historical real OpenID groups. Require verified numeric QQ group and use OneBot.
