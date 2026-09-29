# DECISIONS

## Retained

D-001 through D-071 remain in force.

## D-072 Interaction intent is mandatory for inline keyboard callbacks
status: accepted
date: 2026-09-29
Decision: production/test/default QQ Open intents include GROUP_MESSAGES (1<<25) and INTERACTION (1<<26), combined as 100663296. A keyboard without the Interaction intent is considered nonfunctional even if it renders.

## D-073 Intent changes invalidate session resume
status: accepted
date: 2026-09-29
Decision: QqOpenGateway records the intent mask used to identify a session. RESUME is allowed only when the stored sessionIntents equals the current configured intent mask; otherwise a fresh IDENTIFY is required.
