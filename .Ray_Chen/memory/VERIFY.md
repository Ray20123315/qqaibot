# VERIFY

- GitHub refs: main and feature product revision 2beed0b762d07484fc8b7f201682504f429b5201, backup archive/legacy-main-20261009 revision 6a22b06433cfaffcf13abe2b60a917305290b629.
- Main CI: 37955271118, SUCCESS including npm run check tests + Wrangler dry-run.
- Cloudflare qqai deployment: 7e8bb6ff-e5ba-4621-b22d-01fc6b665f27, version 3a774f7c-2268-4c94-849c-bb0ad0d414a5, 100% traffic, build outcome success for main revision 2beed0b762d07484fc8b7f201682504f429b5201.
- Direct HTTP GET /health through inspection tool returned proxy 403 "requests ... are not allowed"; this is tool boundary, NOT confirmed user endpoint status.
- Test in QQ: group bot proactive permission, NapCat authenticated OneBot WS, group /use and /verify dual bot proof, /code join, outgoing/target group text/media/at, protected IDs stop/grant behavior.
- Final memory v0.0.70 CI archive and SHA: pending this commit.
- Rollback reference: archive/legacy-main-20261009; do not force update without checking production and committed state.
