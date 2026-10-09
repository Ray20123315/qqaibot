# DECISIONS

- 2026-10-10 goal revision 7: NapCat Bbot now primary for receiving commands, verifying group owner/admin and sending verification replies. Other QQ groups need only Bbot membership; does not require Abot Group OpenID or Abot receiving official event. Supersedes mandatory Abot/Bbot two-sided proof for new NapCat-only links.
- 2026-10-10: synthetic group_openid prefix napcat: identifies Bbot-routed numeric QQ group. Never send this synthetic value to QQ official API. Existing real Abot groups still retain their verified mappings and can be used by old Abot-first transport when linked.
- 2026-10-10: group creation/join permitted by trusted owner/admin even in group containing Bbot protected QQ; protected ACL continues to prohibit stopping/leaving/revoking or delegation.
- 2026-10-10: no synchronous outbound message flush from Bbot incoming WS event. Enqueue then short OneBotHub alarm and cron backup to permit successful OneBot ACK handling.
- 2026-10-10: current Abot Gateway skips group management commands under BRIDGE_NAPCAT_COMMANDS=true to avoid duplicate room creation when @AIBot message seen. Plain !use without @ recommended until older Gateway sessions cease.
