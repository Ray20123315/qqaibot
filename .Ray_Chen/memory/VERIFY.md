# VERIFY

## Current Repair

Task: qqaibot-20261001-panel-complete-real-message-send
Goal revision: 3
Base main: 8beea65b514484e6ed5ec352640492693b4d4901

## Native Panel Requirements

- exactly one managed global group category-root panel;
- category entries cover every retained non-empty command category;
- category command sends route to the existing paginated inline keyboard;
- inline keyboard covers every enabled retained group command;
- direct child button: type=2 + enter=true;
- parameterized child button: type=2 + enter=false;
- reusable buttons omit click_limit.

## Removed Feature Requirements

- no relationship category in GROUP_PANEL_CATEGORY_META;
- no relationship commands in INITIAL_COMMANDS;
- no executable 主人/对象 relationship command handler in worker.js;
- no Portal relationship policy GET/POST endpoints;
- no Portal relationship policy/client management controls;
- no 狼人杀/狼人殺 command/runtime/help/catalog surface.

## Compatibility Allowed

- old partner_binding rows may be deleted on member leave;
- old master/partner mute-lock sources may remain recognized until expiration/unlock.

## Gates

- product patch: PENDING
- development CI: PENDING
- main CI: PENDING
- Cloudflare Connected Build: PENDING
- live QQ smoke: PENDING_USER
