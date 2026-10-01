# CURRENT_STATE

## GitHub

- canonical branch: main
- current main head at recovery: a1c19cf0d732fd576000c8ecb2753facf38c51e8
- repair branch: chatgpt/fix-command-panel-message-send-20261001
- main and former v4-qqopen-native branch were identical before this repair.

## Confirmed Defects

1. Direct/no-argument group keyboard buttons currently use action.type=1 callbacks.
2. That callback path ACKs INTERACTION_CREATE and invokes the canonical handler through a synthetic legacy body; it does not produce a normal user-authored QQ command message.
3. The V4 command registry covers only its registered set and misses active runtime command families, so all-category coverage does not prove the panel is functionally complete.

## Target Behavior

- direct/no-argument: action.type=2, enter=true, exact canonical command;
- parameterized/target/content: action.type=2, enter=false, canonical command plus trailing space;
- pagination: action.type=2, enter=true;
- active missing commands added to registry and covered by regression tests.

## Preserved State

- QQ Open/AIBot stays primary.
- OneBot stays controlled fallback only.
- QQ_OPEN_INTENTS stays unchanged; Interaction support may still be used by unrelated features.
- Server-side authorization and moderation confirmation remain authoritative.
- /!普通内容 remains AI bypass.

## Verification State

Product changes: PLANNED.
Live QQ client verification: pending after deployment.
