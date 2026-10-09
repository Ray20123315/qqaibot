# VERIFY

- First feature Github CI 37960815779: 31 passed / 1 failed; only tests/command-routing.test.mjs expected /health command_prefix '/! or !'.
- Fix source worker.js now returns '/! or !' while native command parsing still prefers plain !.
- Newly added NapCat group linking, admin ACL, native message destination and onOnebotEvent mock unit tests passed in first feature run.
- Full next CI and memory v0.0.76 TAR.GZ verification pending.
- After CI green: promote main, verify Worker build source SHA and OneBot socket health, then user tests plain !use in one group and !CODE alias in second group.
