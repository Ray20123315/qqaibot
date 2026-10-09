# GOTCHAS

- QQ official Abot group proactive send can return QQ_API_400:40034105 无权限 in unapproved groups, even if one group works. Do not assume all group IDs are addressable.
- A NapCat-only group has no QQ official Group OpenID. Its database key napcat:<groupID> MUST NOT be passed to official send API; use Bbot OneBot direct.
- Some QQ groups have Bbot self QQ 2681167798 which is protected; this must not block an administrator from joining a bridge, only prevent ungranted stop/leave/revoke or grant.
- Fresh OneBot roster required for privileged commands. Bbot must have valid authenticated Reverse WS and receive roster callback; HTTP 401 means no commands work.
- Incoming WS handler blocking on self DO stub fetch can deadlock OneBot ACK; use direct same-socket send for command replies and alarm-based outbox dispatch.
- Old Abot /!use previously issued unverified invite in one group; it is NOT an active Bbot-native invite and must not be silently mixed with groups from unknown QQ ID mappings.
- Old Abot Gateway hot DO instance might still process older versions of @AIBot commands. Plain !use without @ suppresses official-event duplication.
