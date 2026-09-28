# CURRENT_STATE

## GitHub

- product revision on main: `f44c8118c83e57637a6b0f55f0013ff093b2f1fc`
- product revision on v4-qqopen-native: `f44c8118c83e57637a6b0f55f0013ff093b2f1fc`
- development CI `36400632740`: success
- main CI `36400793446`: success

## Cloudflare

- Worker: `qqai`
- Connected Build: `e5270c67-4c0e-4eaf-9d1a-3d5feb95cdd5`
- commit: `f44c8118c83e57637a6b0f55f0013ff093b2f1fc`
- branch: `main`
- outcome: success

## Command Discovery

- registry entries: 77
- ordinary C2C member commands remain globally discoverable
- Developer-specific C2C panels inherit both `member` and `developer` commands
- privileged Developer visibility is additive, not replacement
- group discovery remains categorized; privileged group items use QQ `only_admin` where supported
- discovery panel hard limit: 20

## Transport and Safety

- QQ Open/AIBot remains primary.
- OneBot remains internal fallback only after mapping/role checks.
- Runtime authorization remains authoritative regardless of UI visibility.
- OpenIDs are never treated as numeric QQ IDs.
