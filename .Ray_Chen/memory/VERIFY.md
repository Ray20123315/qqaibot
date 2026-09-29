# VERIFY

## Verified Keyboard Product Revision

`719290878187f2230a5be10092cc4a9aa3ce1e34`

Deployed main head before final memory reconciliation:
`e6824c0a7e825450526152da90b7b0d8fba3049c`

## QQ Official Behavior Used

- action.type=2: command button; inserts @bot + action.data into the input box.
- action.enter=true: automatically sends the command.
- action.enter=false: leaves the command in the input box for editing.
- action.click_limit: deprecated; omitted for normal buttons so default unlimited behavior applies.

## Regression Coverage

- registry preserves per-command `panel.enter` metadata;
- explicit no-argument commands are marked direct-send;
- help/status buttons are type=2 + enter=true;
- codex/模型 parameterized buttons are type=2 + enter=false;
- parameterized button data preserves a trailing space;
- no normal command button contains click_limit;
- pagination buttons are type=2 + enter=true;
- runtime normalization preserves `enter`, `reply`, `unsupport_tips` and only preserves click_limit when explicitly supplied;
- existing Interaction intent/session regressions remain green.

## GitHub Actions

- development product run `36511639011`: SUCCESS
- final development-head run `36511690614`: SUCCESS
- main run `36511830433`: SUCCESS

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cloudflare Production

Connected Build `8da5b2da-5646-4e73-a34e-ba21844b020c`:
- commit: `e6824c0a7e825450526152da90b7b0d8fba3049c`
- branch: `main`
- outcome: success

## Remaining Live Verification

Check one direct-send button (for example help/status) and one prefill button (for example codex/翻译/禁言) in the real QQ client.
