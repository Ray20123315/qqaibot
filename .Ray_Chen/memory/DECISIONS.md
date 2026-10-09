# DECISIONS

- Historical main archived to archive/legacy-main-20261009 first, same original commit.
- 2026-10-09 user explicitly approved immediate main switch despite no live QQ testing ("你不放我怎麼測試，放過去").
- Executed nonforced fast-forward update of main from 6a22b06433cfaffcf13abe2b60a917305290b629 to 2beed0b762d07484fc8b7f201682504f429b5201.
- Cloudflare connected build auto-deployed official source main 2beed0b762d07484fc8b7f201682504f429b5201, independently verified success.
- Bbot numeric IDs authoritative for protected QQ group management; Abot official OpenID cannot be converted automatically.
- Prefer Abot sender; Bbot only if Abot clearly rejected / unsupported. Ambiguous send never replayed automatically.
- User must now do live QQ acceptance. No simulated success claim.
