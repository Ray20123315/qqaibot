# VERIFY

## QQ Open Model Preference

Verified commit: `820779518c8bf60bcc541182249f651101632080`
GitHub Actions run: `36387904014`
Conclusion: success

`verify-v4-user-settings-routing.mjs` verifies:
- settings keys are namespaced;
- settings go through User Persistence read/write/delete;
- QQ Open model command uses user storage;
- missing user storage is visibly non-durable;
- generation reads user-storage preference;
- official switch-model does not write model_pref to platform D1;
- legacy OneBot path retains platform DB compatibility.

## Preview preflight

Cloudflare inventory read-back completed. No dedicated V4 public Preview D1 exists yet.
Next create name: `qqaibot-v4-public-preview`.
Production D1 UUID to protect: `569a01fe-3297-40e1-832f-09c3793056ed`.
