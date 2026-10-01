# CURRENT_STATE

## Development

- branch: `v4-qqopen-native`
- verified product head: `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe`
- GitHub Actions: `36878357756` — success
- regression, V3, V4 QQ Open, isolated deployment checks and Worker bundle all passed.

## Command Panel Architecture

- QQ native group panel: category launcher only.
- Child command surface: custom inline keyboard, two columns, max five rows, paginated.
- Direct child command: `type=2 + enter=true`.
- Parameterized child command: `type=2 + enter=false`.
- Normal buttons remain reusable without `click_limit`.

## Retired Functionality

- relationship category removed;
- master/partner commands removed from registry/catalog and worker handlers;
- Portal relationship policy, display and cleanup coupling removed;
- relationship storage reduced to historical cleanup only;
- historical master/partner mute-lock sources remain parseable for safe cleanup;
- werewolf remains absent.

## Production

- main promotion: PENDING
- main CI: PENDING
- Cloudflare production build: PENDING
- live QQ client smoke: PENDING_USER
