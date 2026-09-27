# VERIFY

## Pre-phase Baseline

Feature head: `e7292b6ba90c3e2228cbdec43cb8cf153e21224e`
Prior full CI: `36337247900` success

## Official Facts To Preserve In Tests

- GROUP_MESSAGE_CREATE uses GROUP_AND_C2C_EVENT (1<<25) and requires QQ "receive all messages" capability.
- INTERACTION_CREATE uses INTERACTION (1<<26).
- Interaction types 11 and 12 require acknowledgement; other documented interaction types do not.
- C2C/GROUP MSG RECEIVE/REJECT represent active-message permission changes, not ordinary chat messages.

## Required Verification Before Main

1. repository regression
2. V3 regression
3. V4 QQ Open regression including hybrid ownership
4. isolated V4 test deployment
5. Worker bundle dry-run
6. diagnostics assertions for full-message/interaction/push state
7. no interaction intent forced unless permission is explicitly enabled
8. OneBot fallback remains present
