# DECISIONS

## Retained

D-001 through D-058 remain in force unless explicitly superseded below.

## D-059 Control plane vs user-content persistence
status: accepted
date: 2026-09-28
Decision: QQAIBOT platform D1 remains the control plane for authentication, consent evidence, identity links and encrypted resource configuration. V4 user-content persistence (settings, memory, chat history, plugin data and future user content) requires a user-owned Storage Connector. The User Persistence facade has no fallback to platform D1 when a required user connector is absent.
