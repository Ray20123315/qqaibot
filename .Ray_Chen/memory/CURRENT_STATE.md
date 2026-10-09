# CURRENT_STATE

- main before this change: e02b5ecd94ef51a70a1299e3f28ea0a578dc4738
- full old system preserved archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- feature branch feature/bbot-only-20261010 staging Bbot-only code, not deployed at this memory snapshot
- src/bridge.js no longer imports QQ Open API; src/delivery.js cannot use Abot, even for historical real OpenID target
- worker.js no longer imports QQ Open client; scheduled never calls /ensure; legacy QqOpenGateway is inert, supports /shutdown/alarm.
- old QqOpenGateway class binding and migrations preserved; old QQ credentials not overwritten
- Bbot DO identity remains bridge-bbot-napcat-v2; authenticated reverse WS required
- tests and live QQ behavior of this revision currently UNKNOWN / pending
