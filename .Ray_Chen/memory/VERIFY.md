# VERIFY

- GitHub Actions 37950336668: SUCCESS for v0.0.68, 17 tests + Worker dry-run. 
- Current v0.0.69: CI pending; new tests dual QQ group and official group verification, anti-echo marker.
- Node.js npm run check runs all node tests and wrangler --dry-run.
- Workflow packages Ray_Chen_memory_v0.0.69.tar.gz and .sha256 with read/list checks.
- Required REAL tests before production: Abot received /use /verify and numeric Bbot same-group event, correct QQ ID/OpenID, Bbot target roster, Abot proactive enabled via QQ group app, true member mention, images/voices/video/files, Bbot ACK and no duplicate.
- If a transport test fails or platform push rejected, do not falsely mark VERIFIED.
