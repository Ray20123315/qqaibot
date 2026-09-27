# PROJECT

## Purpose

QQAIBOT is migrating from a large OneBot/NapCat-oriented surface to a lean QQ Open Platform native V4 while preserving mature AI, Codex, plugin, security, data, and system-management foundations that remain useful.

## Canonical Repository

- GitHub: `Ray20123315/qqaibot`
- production branch: `main`
- active V4 branch: `v4-qqopen-native`

## V4 Product Principle

The visible/control-plane product should contain only functionality that is useful, necessary, or supported by the QQ Open Platform path. Optional historical systems must not dominate the main Portal.

Primary Portal areas:
- Overview
- QQ Open
- Group Management
- AI / Codex
- Plugins
- System

## Long-term Safety Constraints

- Existing authorization/confirmation checks remain authoritative.
- QQ Open `openid`, `member_openid`, and `group_openid` stay opaque strings.
- Bot capability and caller authorization are separate checks.
- AppSecret/access tokens and other credentials must never be committed or copied into memory.
- CodexWork filesystem authorization remains enforced locally with explicit roots and no deletion.
- Legacy data must not be destructively deleted merely to simplify UI; physical code/data deletion happens only after migration evidence establishes that the replacement is safe.
