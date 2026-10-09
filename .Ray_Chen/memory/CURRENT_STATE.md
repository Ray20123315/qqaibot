# CURRENT_STATE

- main prior to task: ff80b3d96e223b1663e7d2c5b5b578828b052410
- legacy archive/legacy-main-20261009 original main SHA: 6a22b06433cfaffcf13abe2b60a917305290b629
- prior working Abot replies observed in one QQ group; other QQ groups returned QQ_API 40034105 proactive no permission
- Bbot prior authenticated WS observed by Cloudflare, but current persistent connection and QQ groups need validation
- proposed new NapCat Bbot-only room group keys: napcat:<numericQQGroupID> in existing bridge_groups.group_openid column, actual target QQ Group OpenID unknown
- new Bbot group commands !use and !CODE alias register and join without official Group OpenID and without Abot verification step
- Abot official controls ignored under BRIDGE_NAPCAT_COMMANDS=true; Abot may still send if group OpenID has been verified in existing data
- destination with napcat: marker uses OneBot send_group_msg directly, awaiting ACK; no call to Abot API with synthetic key
- preserved D1 old data; no destructive data migrations planned
- CI and real QQ test not run yet for this patch
