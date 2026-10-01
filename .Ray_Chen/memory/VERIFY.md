# VERIFY

## Current Repair

Task: qqaibot-20261001-panel-complete-real-message-send
Base: a1c19cf0d732fd576000c8ecb2753facf38c51e8

## Required Keyboard Behavior

- direct/no-argument command: action.type=2, enter=true, canonical command unchanged;
- parameterized/target/content command: action.type=2, enter=false, canonical command plus trailing space;
- pagination: action.type=2, enter=true;
- reply=false for normal panel buttons;
- click_limit absent for reusable normal buttons.

## Required Coverage

Regression must enumerate every non-empty group category/page and every enabled group command. It must also assert the newly restored runtime command families are present in discovery.

## Verification Gates

- product patch: PENDING
- local/repository regression: PENDING
- development CI: PENDING
- main update: PENDING
- main CI: PENDING
- production Connected Build: PENDING
- live QQ client smoke: PENDING_USER
