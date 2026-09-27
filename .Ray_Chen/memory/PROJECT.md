# PROJECT

## Purpose

QQAIBOT is migrating from OneBot/NapCat-oriented infrastructure to a lean QQ Open Platform native V4 while preserving mature AI, Codex, plugin, security, and data systems until replacements are verified.

## Repository / Environments

- production repository branch: `main`
- V4 development branch: `v4-qqopen-native`
- production Worker: `qqai`
- isolated test Worker: `qqai-v4test`
- test URL: `https://qqai-v4test.ray20123315.workers.dev`

## Isolation Rule

The isolated V4 test environment must not bind production D1, production custom domains, Vectorize, OneBotHub, or production routes. Its purpose is QQ Gateway connectivity and passive reply verification only.

## Safety Constraints

- Never store QQ AppSecret in GitHub, Ray_Chen memory, logs, or normal vars.
- Production `qqai` / `main` stays unchanged until explicit cutover.
- OpenID values remain opaque strings.
- Existing permission gates stay authoritative.
- CodexWork local filesystem restrictions remain unchanged.
