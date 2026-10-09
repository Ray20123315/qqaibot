# DECISIONS

2026-10-10: Abot replies only in one QQ group, other groups show 40034105 no proactive permission. Use NapCat Bbot as primary command observer, authority for QQ IDs/rosters and verification sender; group creation/join does not require Abot OpenID (supersedes mandatory dual-proof for new NapCat-native groups).
2026-10-10: Synthetic database key napcat:<QQgroup> is not real QQ OpenID; deliver straight to OneBot for this type, preserving Abot-first for valid real OpenID groups.
2026-10-10: Owner/admin may join or initiate room even with protected QQ present; grant/stop/leave/revoke still subject to protected QQ policy.
2026-10-10: Use new DO identity bridge-bbot-napcat-v2 so existing hot Bbot DO is not mistaken for current code; user must reconnect NapCat Client one time after main deploy.
2026-10-10: No secrets rotated or exported. Old state kept and old interface command panel not reactivated. All changes CI verified before main fast-forward.
