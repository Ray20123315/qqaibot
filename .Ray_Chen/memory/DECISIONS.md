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


## D-074 Normal child-command buttons use QQ command-button semantics
status: accepted
date: 2026-09-29
Decision: normal group child-command buttons use action.type=2. Commands explicitly marked panel.enter=true auto-send; all others prefill the input box for user completion.

## D-075 Normal command buttons are reusable by default
status: accepted
date: 2026-09-29
Decision: omit action.click_limit from normal command buttons. The QQ API documents click_limit as deprecated with unlimited default behavior. Callback click limits may still be preserved for unrelated features that explicitly set them.

## D-076 Unknown commands default to prefill
status: accepted
date: 2026-09-29
Decision: new or unclassified commands default to enter=false so adding a command cannot accidentally create a one-click execution path.
