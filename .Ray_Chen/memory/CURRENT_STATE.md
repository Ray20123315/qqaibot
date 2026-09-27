# CURRENT_STATE

## Production Baseline

Production QQ Open Gateway is configured and previously user-verified READY. OneBotHub and QqOpenGateway both remain deployed. The latest hybrid/event-expansion work is not yet on main.

## Feature Branch Baseline

Branch: `v4-qqopen-native`
Head before this phase: `e7292b6ba90c3e2228cbdec43cb8cf153e21224e`

Already implemented:
- shared QQ Open application runtime
- AI/Codex/D1/Vectorize/cooldown reuse
- QQ Open-aware action translation
- official passive-reply limits and msg_seq allocation
- Gateway heartbeat/Resume/Identify hardening
- rich-media normalization and official send/recall wrappers
- V3 plugin dispatch through QQ Open
- optional menu/panel synchronization

## New Hybrid Requirement

QQ Open is primary where official capabilities exist. NapCat/OneBot remains an auxiliary source for full visibility and legacy-only data/capabilities. Hybrid ownership/dedupe is not yet fully implemented.

## Official Event Expansion To Implement

- GROUP_MESSAGE_CREATE full-group observation
- INTERACTION_CREATE
- C2C_MSG_RECEIVE / C2C_MSG_REJECT
- GROUP_MSG_RECEIVE / GROUP_MSG_REJECT
- transport ownership/dedupe diagnostics
