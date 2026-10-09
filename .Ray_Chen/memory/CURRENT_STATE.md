# CURRENT_STATE

- Production main unchanged at 6a22b06433cfaffcf13abe2b60a917305290b629 (last verified before commit)
- Legacy archive branch same SHA
- Feature baseline 6ada5f75f8542187a37b9ab98be611b98bcd2292 CI success, media extension STAGED
- Target new feature revision: revision check after commit
- Abot-first strategy; on explicit 400/401/403/404/405/415/422, 22009, 304082, 304083 -> Bbot fallback if target QQ group known. 5xx/timeout ambiguous -> no fallback
- Bbot native send requires remote OneBot success ACK
- Rich media: official /files -> msg_type 7, or Bbot OneBot native segment; unsupported source attachments may still fail
- Official group OpenID mapping requires two-sided confirmation; true QQ mention tries <qqbot-at-user id="..."/> when mapped
- Abot group bot_state may be 11253 forbidden; /status reports unknown
- AI chat not loaded in new Worker
- Live delivery not verified
