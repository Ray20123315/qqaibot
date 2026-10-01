# CURRENT_STATE

## Production

- canonical branch: `main`
- verified product code: `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe`
- deployed main trigger: `aebde1ca3e43cc809645803456b639e659d56fc5`
- development CI: `36878357756` — success
- main CI: `36878859974` — success
- Cloudflare Worker: `qqai`
- Connected Build: `6f36a019-e50f-4907-af27-6197b5088e8b` — success

## Panel Architecture

- native group panel = compact category launcher;
- child commands = bot-managed paginated inline keyboards;
- direct child = type=2 + enter=true;
- parameterized child = type=2 + enter=false;
- no one-shot click limits.

## Retired Relationship Feature

- no relationship category;
- no relationship commands in catalog/registry;
- no relationship command handlers in worker;
- no Portal relationship list/policy/level controls;
- no cleanup relationship protection;
- no relationship state in member details;
- partner-bindings module can only delete historical stored rows;
- old master/partner mute-lock sources remain parseable only for safe historical handling.

## Werewolf

- no 狼人杀/狼人殺 in worker, help or command catalog;
- permanent regression covers the absence.

## Remaining

- live QQ panel refresh/interaction: PENDING_USER
