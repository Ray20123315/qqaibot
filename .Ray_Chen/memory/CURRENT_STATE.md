# CURRENT_STATE

- Main at 6a22b06433cfaffcf13abe2b60a917305290b629, old branch archive/legacy-main-20261009 verified
- New bridge code feature baseline 281fdf83c06dabe1090a65ee6c4e9bd7ed94b4dd
- GitHub Actions 37950336668 passed for proactive-media and fallback extension
- This revision adds secure two-sided group verification (Bbot group QQ number & Abot Group OpenID), plus invisible echo marker in outgoing Abot messages to minimize bot loops
- Newly added tests group binding both proofs and Bbot echo filtration
- QQ official push permission: documented 2025 discontinuation vs 2026 user/group owner toggle reported; status API may be gated
- Cloudflare qqai settings have ONEBOT_ACCESS_TOKEN, QQ_OPEN_CLIENT_SECRET, QQ_OPEN_APP_ID bindings, values not exported
- D1 schema uses bridge_* new names, legacy database tables not deleted by this feature code
- Production main not deployed or changed, real QQ deliverability unknown
