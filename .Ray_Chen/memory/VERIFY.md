# VERIFY

## Current Repair

Task: qqaibot-20261001-panel-complete-real-message-send
Goal revision: 2
Base main: 5b7f3c5e1c75d98150d794b2d2c689c77a145bfc
Current deployed product: 6cb891571bdb2744b13bd11e3731c2a267fdf1ed

## Native Group Discovery Requirements

- use categorized group panels built from the canonical registry;
- max 20 items per panel;
- total group + developer C2C panels <= 20;
- union of native group PanelItem names equals every enabled group command panel.command;
- native group panels must not contain category placeholder names such as `!面板 基础`;
- category labels may remain in panel remarks;
- server-side permission checks remain authoritative.

## Inline Keyboard Requirements Preserved

- manual `!面板 <分类>` still resolves to the existing inline keyboard;
- direct child commands remain type=2 + enter=true;
- parameterized commands remain type=2 + enter=false;
- pagination remains reusable.

## Gates

- product patch: PENDING
- development CI: PENDING
- main CI: PENDING
- Cloudflare Connected Build: PENDING
- live QQ native discovery: PENDING_USER
