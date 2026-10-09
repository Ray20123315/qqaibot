# CURRENT_STATE

- Legacy main SHA at branch archive/legacy-main-20261009: 6a22b06433cfaffcf13abe2b60a917305290b629 VERIFIED
- feature initial commit: 2435e9115fe700a118ad44ba8fa838a932f8284e PRODUCED
- GitHub Actions run 37946376223: SUCCESS, test + Worker Wrangler dry-run
- Second parser regression patch: PRODUCED, CI pending
- main: unchanged, protects QQ production
- Live QQ Abot push + mention: UNKNOWN; Tencent official documentation indicates unsolicited push disabled
- Supported relay: text and structured at; media contents are currently represented by placeholders, not uploaded as media
- AI chat: absent from new Worker source
- DB: new bridge_* tables; legacy tables retained on historical branch and physical D1 binding
