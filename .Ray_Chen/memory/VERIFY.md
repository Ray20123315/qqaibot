# VERIFY

## Product verification

Canonical GitHub Actions workflow:
- `.github/workflows/validate.yml`

Required checks:
- `npm run check`
- `npm run check:v3`
- `npm run check:bundle`

Verified run:
- run_id: 36268773902
- product_commit: 0d86baf190a02de5be3e9622ddceea248eb67e8a
- result: success

## Targeted invariants

- `src/members/details.js` must not contain user-visible sections named `【OneBot 即时原始资料】` or `【D1 已保存完整资料】`.
- The formatter must not stringify `details.liveSources`, `details.storedSources`, or the whole `details.operationalState` into QQ output.
- `worker.js` must not contain the success text `已尝试撤回该消息。`.
- Successful administrator recall path must return HTTP 204.
- `src/operations/runtime.js` must keep a fixed AI command allowlist and reject unknown intent.
- Routed execution must occur before effective permissions are recalculated in the normal command path.

## Runtime smoke test still recommended

Use a real QQ group/NapCat connection and confirm:
1. `!详细资料 @成员` is concise and contains no raw JSON.
2. Admin reply + `!撤回` removes the target message without a bot success message.
3. A normal member cannot use natural language to perform an admin-only command.
4. Admin natural-language requests still trigger the same confirmation/permission behavior as explicit `!` commands.
