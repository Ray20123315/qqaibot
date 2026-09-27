# GOTCHAS

## Retained

All prior QQ Open, OpenID, Gateway, Portal, permissions, D1/Cron and Connected Builds risks remain relevant.

## G-029 Dual-observation duplicates
Risk: QQ Open and OneBot may both observe one human action.
Mitigation: C2C and explicit group-at are QQ Open-owned. Ordinary group messages transition only after actual official full-group evidence, and mapped OneBot messages then become observation-only.

## G-030 Interaction permission failure
Risk: enabling INTERACTION intent without permission can make Gateway Identify fail.
Mitigation: production remains at `33554432`; enable `100663296` only after permission confirmation.

## G-031 Group id domains are different
Risk: numeric OneBot group id and QQ group_openid are not interchangeable.
Mitigation: `QQ_HYBRID_GROUP_MAP` is explicit JSON. No automatic inference.

## G-032 Active push authorization
Risk: an official active group message can fail if the group has disabled bot active messages.
Mitigation: persist GROUP_MSG_RECEIVE/REJECT state and use official active send only when allowed; otherwise OneBot fallback.

## G-033 Numeric mentions cannot be translated safely
Risk: OneBot schedule payloads may contain numeric QQ mentions that QQ Open expects as OpenID mentions.
Mitigation: such sends stay on OneBot until explicit user identity linking exists.

## G-034 CodexWork export filesystem boundary
Risk: Cloudflare Worker cannot read local Codex Bridge filesystem paths.
Mitigation: retain local/OneBot export helper or design an explicit bounded file-transfer channel; never pretend the Worker can upload a local path.

## G-035 Dashboard config difference warning
Risk: Wrangler may report remote Dashboard vars that differ from local config.
Verification: post-deploy read-back confirmed DEVELOPER_IDS, PORTAL_ADMIN_USERNAME, plugin security vars and all existing Secrets remained present after this deployment.
