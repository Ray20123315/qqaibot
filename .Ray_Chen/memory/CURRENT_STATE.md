# CURRENT_STATE
- Production main before feature: d0e45d2a02d4183bdda227371042eca7212f3d6a
- Original archive branch archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- Bbot-only / Abot disabled, receives OneBot relays, existing --no group remains receive-only and is visible in public !help and !setting group lists; receives source recall synchronization
- New feature branch feature/bilibili-copyable-text-20261010 changes src/relay.js readableCard for Bilibili HTTPS copyable raw text; keeps plain text, not original QQ card payload
- New tests verify Bilibili link preservation and non-Bilibili sanitization
- No D1 mutation or admin policy change
- Feature CI, Cloudflare deployment and actual QQ preview behavior unverified
