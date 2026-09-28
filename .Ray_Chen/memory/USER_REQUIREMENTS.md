# USER_REQUIREMENTS

## Active Requirements

- Work only on `feature/v4-public-bot`; do not modify or merge to `main` because main has unrelated bugs being repaired elsewhere.
- QQ Open should implement all feasible capabilities first: full group messages, context observation, non-@ analysis, group management, mute, kick, recall and related supported actions.
- Automatically use QQ Open capability when actually available; use legacy OneBot/NapCat as fallback/supplement when unavailable or denied.
- Avoid duplicate replies/moderation/actions across QQ Open and OneBot.
- Website must use human-readable labels and explanations, not source code, raw environment names, internal route names or raw platform payloads.
- Developer Mode is developer-account-only. Activation interaction: hidden input `00000`, revealing `開 → 開發 → 開發者 → 開發者模 → 開發者模式`.
- Custom dropdowns, modals, selects, confirmations and related UI controls; do not rely on visually raw browser-native controls where custom product UI is expected.
- AIBot private messages provide settings without requiring the website.
- AI private chat via AIBot is available only when the user has their own AI API or authorized access to an AI Provider; do not provide a public API proxy.
- AI API key onboarding must support BOTH: authenticated one-time secure web input and direct AIBot private-message input.
- Full AI API keys are never redisplayed after storage.
- Roles: 授權成員, AI 提供者, 管理員, 開發者.
- AI 提供者 may authorize use only inside groups that provider currently belongs to. If provider is no longer in the group, provider-backed access must stop.
- 管理員 has lower platform permissions than 開發者; 開發者 has full platform ownership.
- The QQ-authored AIBot privacy guide is reference-only and must not be edited.
- Service use requires legal-statement consent unless a developer-controlled silent group whitelist override is active.
- Developer group whitelist is controlled from AIBot private messages and must not announce activation/deactivation inside the target group.
- Political topics are prohibited by product policy. Apply text prefilter first, then classifier for ambiguous content, plus output guard.
- Users may create plugins. Plugins with global/cross-tenant/system risk must be forcibly stopped, quarantined and surfaced to a dedicated web security-review flow.
- Keep D1/KV/DO usage lean; do not add unnecessary storage.
- Copyright notice: `Copyright © 2026 Ray Chen. All rights reserved.`
- Public source remains source-available, not open-source; no-use terms should be as restrictive as legally/platform-contractually practical.
- Use the same Cloudflare `qqai` Worker via branch/preview capability, not a second Worker.
- Official QQ self-test template is the user-provided 2023 file. Implementation and self-verification happen first; the template is filled afterward.
- Secrets must never be committed or stored in Ray_Chen memory.
