# USER_REQUIREMENTS
- 2026-10-10 new requirement: QQAIBOT should not discuss politics. Implement as global AI answer restriction rather than modifying QQ group content or blocking ordinary nonpolitical commands.
- Existing: Official Abot receives QQ GROUP_AT_MESSAGE_CREATE and sends passive msg_id AI reply, reuse existing Gemini Secret, no unsolicited group chat, no duplicate Bbot answer. Bbot cross-group bridge plugin default OFF.
- Preserve D1 and Cloudflare Secret values, backups, protected QQ identities and deployed service.
