# CURRENT_STATE
- GitHub QQAIBOT main code ed944543d4a265101a7abafa2ff9eeee84f28c63, backed up previous CLI main at archive/cli-before-native-gui-20261011 SHA 5415fb104b7cb2b30b0f59938c91a412c476b494.
- Real Windows native GUI implemented via .NET8 WinForms and packaged with Node Codex backend. GUI QQAIBOT-CodexBridge.exe PE subsystem 2 SHA256 5cb47bb16e252e9c871d26e17cd01ab939e80836c57df9bab52f4b0b47a3eeb9; backend QQAIBOT-CodexBridge-Backend.exe subsystem 3 SHA256 9501d9e055d6e2b7e0cf8a165603712e33fc830d752d092d52fba3c1b33febff. Full ZIP artifact 11693066002 verified.
- CI feature Node 38114026195 and Windows 38114026126 success; main Node 38114199375 and Windows 38114199372 success, test and smoke.
- Cloudflare qqai deployment c92451d0-bdc5-470b-bc49-24cab00837ae version f50fed87-5265-478d-84b3-1c6fc85d269c, main SHA ed944543d4a265101a7abafa2ff9eeee84f28c63 build success, 100% traffic. No Worker AI or secret changes required.
- QQ legacy native slash command /!设置插话率 NOT found in currently active Worker sources. Official developer portal holds published command metadata, no authenticated read/delete performed. Manual platform cleanup still pending.
