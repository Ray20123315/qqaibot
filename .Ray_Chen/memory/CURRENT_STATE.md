# CURRENT_STATE

## Integration Candidate

- integration commit: `af4b743fec796cc071aafce3559f66c2ae7c9a50`
- first parent / newest main: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- second parent / keyboard branch: `d4ae8580ff28c7cc7a88d888b2ea0a65c6a55f0f`
- development integration CI: pending

## Preserved Main Work

- Portal temporary system-admin credential support remains present.
- D1 fallback rate limiting for Portal auth remains present.
- verify-system-admin-auth.mjs remains from newest main.

## Keyboard Work Included

- group category replies can carry two-column QQ inline keyboards.
- large categories paginate within keyboard row limits.
- callback data reuses existing canonical command handlers.
- QQ Open runtime sends keyboard payloads for passive message replies and interaction replies.
- deterministic unsupported keyboard responses may fall back to text.

## Safety

- no force update was used;
- runtime permissions and confirmations are unchanged;
- ordinary /! AI bypass semantics are unchanged;
- QQ Open remains primary and OneBot remains controlled fallback.
