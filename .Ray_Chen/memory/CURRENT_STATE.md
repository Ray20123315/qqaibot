# CURRENT_STATE
- Product main baseline 5415fb104b7cb2b30b0f59938c91a412c476b494 with Abot AI, Bbot memory & Codex via Cloudflare; prior EXE was a console launcher and user insists on native GUI.
- New feature feature/native-gui-and-qq-panel-cleanup-20261011 adds tools/gui WinForms GUI, hidden Node engine, Windows publish job; no Windows compilation performed yet.
- Current parser tests assert /!设置插话率 is NOT recognized, but QQ client may show stale command stored separately in QQ official panel. Official API /v2/panels list/update/delete documented. New src/qq-panel-cleanup.js removes only exact item, to be executed once after production release, result unknown.
- Previous backups kept. archive/pre-native-gui-20261011 points to 5415fb104b7cb2b30b0f59938c91a412c476b494.
- No production changes in this stage. CI pending.
