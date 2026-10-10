# DECISIONS
2026-10-10 rev3: Enforce bot no-politics restriction with input guard before LLM, model system instruction, and generated-output guard before sending. Neutral refusal: 抱歉，我不討論政治相關話題。可以聊聊其他主題。
2026-10-10: Implement one src/topic-policy.js as canonical policy shared by Abot AI and Bbot AI paths; avoid duplicating keyword semantics.
2026-10-10: Rejected political input should not consume Gemini tokens, and blocked output should not enter conversation history. Preserve legitimate other chat and management commands.
2026-10-10: Acknowledge heuristic's incompleteness rather than claiming absolute guarantee. No filtering of cross-group user-generated forwarded messages.
