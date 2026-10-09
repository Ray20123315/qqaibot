# CURRENT_STATE

- Original main historical product commit: 6a22b06433cfaffcf13abe2b60a917305290b629
- Immutable archive branch archive/legacy-main-20261009 points to original product commit.
- Promoted product main commit: 2beed0b762d07484fc8b7f201682504f429b5201 (GitHub head verified post update).
- Latest code feature branch: feature/qq-cross-group-bridge-20261009 same product SHA at last observation.
- GitHub main CI: 37955271118 success, all node tests and Wrangler dry-run.
- Cloudflare main commit deployed: 2beed0b762d07484fc8b7f201682504f429b5201, build success, Worker qqai deployment ID 7e8bb6ff-e5ba-4621-b22d-01fc6b665f27.
- Cloudflare source version ID 3a774f7c-2268-4c94-849c-bb0ad0d414a5 at 100% on 2026-10-09T15:55:42Z.
- Worker runtime: new Abot/Bbot cross-group bridge, AI disabled by code design.
- Real QQ group communication: NOT TESTED / UNKNOWN. Do not infer successful message delivery from build and deployment.
- Verified existing configured names for required secrets ONEBOT_ACCESS_TOKEN and QQ_OPEN_CLIENT_SECRET, no secret values read.
- /health direct external inspection blocked in tool environment, not a production error claim.
