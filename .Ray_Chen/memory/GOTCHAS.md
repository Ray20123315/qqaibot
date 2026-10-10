# GOTCHAS
- Political filter is keyword-based and NFKC-normalized with spaced Han normalization; aliases, slang or context may be missed, while innocuous quoted words may be blocked. No purely heuristic filter ensures total semantic coverage.
- Apply output sanitizer BEFORE AI reply is sent or stored. The refusal text itself contains 政治 and should not be re-sanitized as generated output.
- Abot status/help/clear commands must bypass the generative political filter to avoid hiding maintenance controls.
- Gemini and QQ official send credentials remain server-only; do not print secret contents, user message text or OpenIDs.
- Abot uses QQ official source msg_id to reply in eligible groups; Gateway READY is not proof of send permission.
