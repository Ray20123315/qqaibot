# VERIFY

## Goal Revision 4

Live failure:
- command: `/!面板 群聊`
- observed at: 2026-10-01 23:09:35 +08
- result: fallback text only, no clickable buttons

## Required Payload Invariant

For a message reply carrying an inline keyboard:
- `msg_type === 0`
- `content` contains the panel text
- `keyboard.content.rows` is present
- do not require `markdown` for the panel keyboard path
- preserve `msg_id` / `msg_seq` for ordinary message replies
- preserve `event_id` for interaction replies

## Button Invariants

- direct command: type=2, enter=true, reply=false
- parameterized command: type=2, enter=false
- reusable: no mandatory click_limit
- pagination: clickable command action

## Gates

- product patch: PENDING
- development CI: PENDING
- main CI: PENDING
- Cloudflare Connected Build: PENDING
- live QQ render: PENDING
