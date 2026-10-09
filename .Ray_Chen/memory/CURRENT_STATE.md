# CURRENT_STATE

- main before this feature: ff80b3d96e223b1663e7d2c5b5b578828b052410
- legacy archive/legacy-main-20261009: 6a22b06433cfaffcf13abe2b60a917305290b629
- new primary control code on feature/napcat-native-link-20261010 includes NapCat native group ID, role authorization, Bbot-only destination sends and short alarm outbox
- first feature CI 37960815779: 31 tests passed, one health field string regression. Fix worker.js 'command_prefix' to preserve existing expected '/! or !'.
- no production deployment or D1 destructive change yet; previous Abot one-group response and QQ 40034105 on others observed
- new CI pending, live Bbot reply/forwarding not proven by mock tests
