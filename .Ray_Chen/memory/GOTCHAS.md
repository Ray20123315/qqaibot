# GOTCHAS

## Retained

Prior transport, identity, user-storage, political, plugin-sandbox and group-storage risks remain relevant.

## G-053 Split-brain personal settings
Risk: saving QQ Open settings to user storage while reading the old platform D1 would make the UI appear successful but runtime behavior use stale data.
Mitigation: personal style, DND, model preference and manual memory now read and write through the same user-storage paths.

## G-054 Shared Vectorize leaks BYO-memory boundaries
Risk: writing QQ Open manual memories into platform Vectorize would copy user-owned content back into shared infrastructure.
Mitigation: QQ Open manual memory skips Vectorize insert/query; OneBot legacy behavior remains unchanged.

## G-055 Preview D1 quota exhaustion
Risk: blind retries can create duplicates after an ambiguous API result, while repurposing another D1 can corrupt another project.
Mitigation: exact-name read-back before every retry; current create failed explicitly with Cloudflare 7406 and no resource was created.
