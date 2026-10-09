# CURRENT_STATE
- GitHub repo Ray20123315/qqaibot, main Bbot-only product SHA 7d2dbac38f212dc23f735e3f8f3fa18c156ce89e
- legacy full backup archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- GitHub Actions feature CI 37963923027 and main CI 37964001494 SUCCESS, 35 tests + Wrangler dry-run
- Cloudflare qqai deployment ed52e60a-7c9f-47ec-bf8a-78383af71815, version a37b19c5-42ea-43aa-b8b7-a38d702f3d45, 100% on 7d2dbac38f212dc23f735e3f8f3fa18c156ce89e, build success
- No active imports to QQ Open API or Gateway from new Worker, Abot official traffic absent from new runtime design
- Existing QQ_OPEN_GATEWAY DO class and D1 historical tables intentionally retained; cron sends /shutdown to old named instances
- Cloudflare telemetry showed a historical QQ Gateway instance receiving /shutdown but its socket closure not externally proven; no new Abot READY/group event in sampled events after deployment
- latest Worker version records OneBotHub messages; Bbot actual group command receipt /health not independently checked
- all QQ commands and transfers use NapCat Bbot only, original protections persist, AI disabled
